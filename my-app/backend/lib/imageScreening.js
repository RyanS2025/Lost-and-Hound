// ════════════════════════════════════════════════════════════════════════════
// Upload screening orchestration
// ════════════════════════════════════════════════════════════════════════════
// One function behind both /api/verify-image and /api/verify-image/guest,
// which were near-identical 50-line blocks. Everything it touches arrives
// through `deps`, so the whole decision tree — including the fail-closed
// behaviour, which is the part most likely to be got wrong — is unit-testable
// with no network, no Supabase and no new dependencies.
//
// It never throws. Callers do:
//   const result = await screenUploadedImage({ ... });
//   res.status(result.status).json(result.body);
// ════════════════════════════════════════════════════════════════════════════

import crypto from "crypto";

import { evaluateImage } from "./sensitiveImageDetector.js";
import { signUploadToken, resolveUploadSecret } from "./uploadToken.js";

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const VISION_STAGE_A_TIMEOUT_MS = 8000;
export const VISION_STAGE_B_TIMEOUT_MS = 5000;
export const DEFAULT_MONTHLY_UNIT_BUDGET = 900;

const VISION_ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";

/**
 * An upload we could not screen is rejected — everywhere, unless someone has
 * explicitly asked otherwise.
 *
 * This used to key on `NODE_ENV === "production"`, which made the entire
 * safety property of this module contingent on one env var that nothing else
 * in the backend reads and nothing validates at boot. Our own Dockerfile never
 * sets it. A deploy that merely forgot it would accept unscreened IDs and bank
 * cards with no symptom beyond a console.warn.
 *
 * So the default is now the safe one, and a contributor without a Google Cloud
 * key opts out deliberately with IMAGE_SCREENING_FAIL_OPEN=1 in their .env —
 * the same break-glass switch production would use during a Vision outage.
 * Forgetting to set something now fails safe instead of silently open.
 */
export function shouldFailClosed(env) {
  return env.IMAGE_SCREENING_FAIL_OPEN !== "1";
}

/**
 * Magic-number check on the first 12 bytes.
 *
 * GIF is deliberately absent. Vision annotates only the FIRST FRAME, so an
 * animated GIF with a clean opening frame and a driver's licence at frame 40
 * passes screening completely. Nobody posts animated GIFs of lost jackets, so
 * dropping the format closes that hole at no cost.
 */
export function isSupportedImage(buffer) {
  if (!buffer || buffer.length < 12) return false;
  const h = buffer;
  const jpeg = h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff;
  const png = h[0] === 0x89 && h[1] === 0x50 && h[2] === 0x4e && h[3] === 0x47;
  const webp =
    h[0] === 0x52 && h[1] === 0x49 && h[2] === 0x46 && h[3] === 0x46 &&
    h[8] === 0x57 && h[9] === 0x45 && h[10] === 0x42 && h[11] === 0x50;
  return jpeg || png || webp;
}

async function defaultDeps() {
  // Imported lazily: lib/supabase.js calls createClient() at module scope and
  // throws without env vars, which would make this module un-importable in a
  // unit test that supplies its own fakes.
  const { supabase } = await import("./supabase.js");
  const storage = supabase.storage.from("listing-images");

  return {
    storage,
    fetch: globalThis.fetch,
    now: Date.now,
    env: process.env,
    rpc: (fn, args) => supabase.rpc(fn, args),
    readUsage: async (month) => {
      const { data } = await supabase
        .from("vision_usage")
        .select("call_count")
        .eq("month", month)
        .single();
      return data?.call_count ?? 0;
    },
    insertBlock: async (row) => {
      await supabase.from("sensitive_image_blocks").insert(row);
    },
  };
}

const fail = (status, error, extra = {}) => ({ ok: false, status, body: { error, ...extra } });

async function annotate({ deps, key, base64, features, timeoutMs }) {
  const res = await deps.fetch(`${VISION_ENDPOINT}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features }],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Vision HTTP ${res.status}`);
  const json = await res.json();
  return json?.responses?.[0] ?? null;
}

/**
 * Download, validate and screen one uploaded object.
 *
 * @param {{filePath: string, subject: string, requestIp?: string}} args
 *        `subject` is the user id, or the literal "guest" for the logged-out
 *        support-attachment path.
 * @param {object} [injected] Test seam; see defaultDeps().
 */
export async function screenUploadedImage({ filePath, subject, requestIp }, injected) {
  const deps = injected || (await defaultDeps());
  const env = deps.env;
  const failClosed = shouldFailClosed(env);
  // Derived from the injected env rather than process.env, so the whole
  // module is driven by `deps` and a test can exercise it in isolation.
  const tokenSecret = resolveUploadSecret(env);
  const issue = (kind) =>
    signUploadToken({ path: filePath, subject, kind, now: deps.now(), secret: tokenSecret });

  // Screening could not run. In production that is a rejection, and the object
  // is removed so an unscreened image is never left sitting in a public bucket.
  const unavailable = async (why) => {
    if (!failClosed) {
      console.warn(
        `[SensitiveImage][FAIL-OPEN] ${why} — screening SKIPPED. ` +
          "IMAGE_SCREENING_FAIL_OPEN=1 is set; unset it to reject instead."
      );
      return {
        ok: true,
        status: 200,
        body: {
          valid: true,
          uploadToken: issue("ok"),
        },
      };
    }
    console.error(`[SensitiveImage][FAIL-CLOSED] ${why}`);
    await deps.storage.remove([filePath]).catch(() => {});
    return fail(
      503,
      "We couldn't check your photo right now. Please try again in a moment, or post without a photo.",
      { code: "SCREENING_UNAVAILABLE" }
    );
  };

  // ── 1. Fetch the object ───────────────────────────────────────────────────
  let buffer;
  try {
    const { data, error } = await deps.storage.download(filePath);
    if (error || !data) return fail(404, "File not found");
    buffer = Buffer.from(await data.arrayBuffer());
  } catch {
    return fail(404, "File not found");
  }

  // ── 2. Real size, not the client's claim ──────────────────────────────────
  // The 5MB limit at /api/upload-url is a number the client sends and can
  // simply omit. This is the first place the actual byte count is known.
  if (buffer.length > IMAGE_MAX_BYTES) {
    await deps.storage.remove([filePath]).catch(() => {});
    return fail(413, "Image must be under 5MB");
  }

  // ── 3. Is it actually an image? ───────────────────────────────────────────
  if (!isSupportedImage(buffer)) {
    await deps.storage.remove([filePath]).catch(() => {});
    return fail(400, "File is not a valid image. Upload rejected.");
  }

  // ── 4. Is screening configured? ───────────────────────────────────────────
  const key = env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!key) return unavailable("GOOGLE_CLOUD_VISION_API_KEY is not set");

  // ── 5. Is there screening capacity left this month? ───────────────────────
  // vision_usage is a counter, not an enforcer — nothing stopped the 1001st
  // unit from being billed. We deliberately stay inside the free tier, so this
  // is the line that keeps us there.
  //
  // This is NOT the same condition as "screening broke", and conflating them
  // would produce a lie in two directions:
  //
  //   * "try again in a moment" is false — capacity returns on the 1st, not in
  //     a moment, so retrying is pure frustration.
  //   * marking the post image_redacted would be false too. That flag means
  //     "we looked and it was sensitive". Here we never looked, and the tile
  //     would accuse an innocent photo of being someone's ID.
  //
  // So this gets its own code, and the post proceeds WITHOUT a photo rather
  // than being blocked. Applies in every environment: the spend is real
  // wherever it happens.
  const month = new Date(deps.now()).toISOString().slice(0, 7);
  const budget = Number(env.VISION_MONTHLY_UNIT_BUDGET ?? DEFAULT_MONTHLY_UNIT_BUDGET);
  if (Number.isFinite(budget) && budget > 0) {
    try {
      const used = await deps.readUsage(month);
      if (used >= budget) {
        console.warn(`[SensitiveImage][PAUSED] screening capacity used for ${month} (${used}/${budget})`);
        await deps.storage.remove([filePath]).catch(() => {});
        return fail(
          503,
          "Photos are paused right now, so this one wasn't added. Your post will still go up — describe the item and the front desk can match it.",
          { code: "SCREENING_PAUSED" }
        );
      }
    } catch {
      // A counter read failure must not decide policy in either direction.
      console.warn("[SensitiveImage] could not read Vision usage; continuing");
    }
  }

  // ── 6. Stage A: SafeSearch + OCR ──────────────────────────────────────────
  const base64 = buffer.toString("base64");
  let stageA;
  try {
    stageA = await annotate({
      deps,
      key,
      base64,
      features: [{ type: "SAFE_SEARCH_DETECTION" }, { type: "TEXT_DETECTION" }],
      timeoutMs: VISION_STAGE_A_TIMEOUT_MS,
    });
  } catch (err) {
    return unavailable(`stageA ${err?.name || "error"}: ${err?.message || "unknown"}`);
  }
  if (!stageA || stageA.error) {
    return unavailable(`stageA returned ${stageA?.error?.message || "no annotation"}`);
  }

  let units = 2;
  let verdict = evaluateImage({ stageA });

  // ── 7. Stage B: labels and logos, only for the ambiguous band ─────────────
  if (verdict.escalate) {
    try {
      const stageB = await annotate({
        deps,
        key,
        base64,
        features: [
          { type: "LABEL_DETECTION", maxResults: 15 },
          { type: "LOGO_DETECTION", maxResults: 10 },
        ],
        timeoutMs: VISION_STAGE_B_TIMEOUT_MS,
      });
      units = 4;
      verdict = evaluateImage({ stageA, stageB });
    } catch (err) {
      // Deliberately NOT fail-closed. A stage-A verdict below the threshold
      // already exists; rejecting merely-ambiguous images during a partial
      // Google outage would break ordinary uploads for no security gain.
      units = 4;
      console.warn(`[SensitiveImage] stageB unavailable (${err?.message}); using stage A verdict`);
    }
  }

  // ── 8. Account for what was actually billed ───────────────────────────────
  // After the key guard, so the dashboard stops counting calls that never
  // happened, and by units rather than calls, since a screen is 2 or 4.
  Promise.resolve(
    deps.rpc("increment_vision_usage_by", { p_month: month, p_units: units })
  ).catch(() => {});

  // ── 9. Blocked ────────────────────────────────────────────────────────────
  if (verdict.blocked) {
    const { error: removeError } = (await deps.storage.remove([filePath])) || {};
    if (removeError) {
      // Still a 422. A failed delete must never be read as "the image is fine".
      console.error("[SensitiveImage] ORPHAN: delete failed for a blocked object", {
        tier: verdict.tier,
      });
    }

    // Fire and forget: the object is already gone, so a logging failure cannot
    // let a blocked image survive.
    Promise.resolve(
      deps.insertBlock({
        subject_kind: subject === "guest" ? "guest" : "user",
        subject_id: subject === "guest" ? null : subject,
        ip_hash: subject === "guest" ? hashIp(requestIp, env) : null,
        surface: filePath.includes("/support/") || filePath.startsWith("guest/") ? "support" : "listing",
        tier: verdict.tier,
        score: verdict.score,
        reasons: verdict.reasons,
        path_hash: hashPath(filePath),
      })
    ).catch(() => {});

    console.log(
      JSON.stringify({
        timestamp: new Date(deps.now()).toISOString(),
        event: "sensitive_image_blocked",
        tier: verdict.tier,
        score: verdict.score,
        reasons: verdict.reasons,
        subject_kind: subject === "guest" ? "guest" : "user",
      })
    );

    return fail(
      422,
      "This photo looks like an ID, bank card, or personal document, so it wasn't saved.",
      {
        code: "IMAGE_BLOCKED",
        tier: verdict.tier,
        redactionToken: issue("blocked"),
      }
    );
  }

  // ── 10. Accepted ──────────────────────────────────────────────────────────
  return {
    ok: true,
    status: 200,
    body: {
      valid: true,
      uploadToken: issue("ok"),
    },
  };
}

// Hashing rather than storing: the audit row must not durably record the
// address of an object we just deleted, nor a raw IP.
function hashPath(filePath) {
  return sha256Hex(filePath).slice(0, 32);
}

function hashIp(ip, env) {
  if (!ip) return null;
  const salt = env.UPLOAD_TOKEN_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "";
  return sha256Hex(`${ip}${salt}`).slice(0, 16);
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}
