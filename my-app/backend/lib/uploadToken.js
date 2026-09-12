// ════════════════════════════════════════════════════════════════════════════
// Verified-upload tokens
// ════════════════════════════════════════════════════════════════════════════
// Closes a hole that made image screening decorative.
//
// The upload flow is three separate requests: mint a signed URL, PUT the bytes
// straight to Supabase Storage, then attach the resulting public URL to a
// listing or a support ticket. Screening happens in a FOURTH request between
// the PUT and the attach — so before this module existed, nothing tied the two
// together. POST /api/listings accepted any image_url whose hostname ended in
// ".supabase.co", with no proof it had ever been screened and no check that it
// belonged to the caller. A scripted client could skip verification entirely.
//
// Now /api/verify-image issues a short-lived signed token naming the exact
// storage path and the exact user, and the attach endpoints refuse an image
// without one.
//
// ── Why a signed token rather than a verified_uploads table ─────────────────
// A table's one real advantage is single-use enforcement via a consumed_at
// column. But consider what replay actually buys an attacker here: presenting
// the same token twice attaches the SAME already-screened image to a second
// listing. That is spam, already bounded by writeLimiter (60/15min), not a
// screening bypass — and cross-user replay is impossible because the subject
// is bound into the signature.
//
// Against that: a table needs a TTL column, a query on every attach, and a
// cleanup cron. The decisive argument is operational. This repo has no
// migration tooling — schema is applied by hand in the Supabase dashboard — so
// a stateless fix means the security-critical part of this work can ship, and
// be reverted, without touching the database at all.
//
// ── The token also carries the redaction proof ──────────────────────────────
// When screening BLOCKS an image, verify-image returns a token with kind
// "blocked". The attach endpoints accept image_redacted: true only against
// one. Without that, image_redacted would be a client-asserted boolean and
// anyone could decorate any listing with a fake "we hid this" privacy tile.
// ════════════════════════════════════════════════════════════════════════════

import crypto from "crypto";

export const UPLOAD_TOKEN_TTL_MS = 15 * 60 * 1000;
export const STORAGE_BUCKET = "listing-images";

let warnedAboutFallbackSecret = false;

/**
 * Signing key. Falls back to the service-role key so this ships with zero new
 * required env vars — that matters in a repo where production config is
 * hand-managed in the Railway dashboard and a missing variable means the
 * security fix silently does not work. The service-role key is already
 * required for the process to boot, is already secret, and is stable across
 * restarts. Resolved at call time against an injectable env rather than cached
 * at module load, so the unit tests and imageScreening.js can supply their own
 * without the real environment being present.
 */
export function resolveUploadSecret(env = process.env) {
  const explicit = env.UPLOAD_TOKEN_SECRET;
  if (explicit) return explicit;

  const fallback = env.SUPABASE_SERVICE_ROLE_KEY;
  if (fallback) {
    if (!warnedAboutFallbackSecret) {
      warnedAboutFallbackSecret = true;
      console.warn(
        "[UploadToken] UPLOAD_TOKEN_SECRET is not set; deriving from SUPABASE_SERVICE_ROLE_KEY. " +
          "Set an explicit secret to decouple token validity from key rotation."
      );
    }
    return fallback;
  }
  return null;
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

const secret = () => resolveUploadSecret(process.env);

function hmac(signingInput, key) {
  return crypto.createHmac("sha256", key).update(signingInput).digest();
}

/**
 * @param {{path: string, subject: string, kind: "ok"|"blocked", now?: number,
 *          secret?: string}} args
 * @returns {string|null} null when no signing key is configured.
 */
export function signUploadToken({ path, subject, kind, now = Date.now(), secret: key }) {
  const signingKey = key || secret();
  if (!signingKey) return null;
  if (!path || !subject || (kind !== "ok" && kind !== "blocked")) return null;

  const payload = { v: 1, k: kind, p: path, s: subject, exp: now + UPLOAD_TOKEN_TTL_MS };
  const body = `v1.${b64url(JSON.stringify(payload))}`;
  return `${body}.${b64url(hmac(body, signingKey))}`;
}

/**
 * @param {string} token
 * @param {{subject: string, now?: number, secret?: string}} args
 * @returns {{ok: boolean, path?: string, kind?: string, reason?: string}}
 */
export function verifyUploadToken(token, { subject, now = Date.now(), secret: key } = {}) {
  const signingKey = key || secret();
  if (!signingKey) return { ok: false, reason: "no_secret" };
  if (typeof token !== "string" || !token) return { ok: false, reason: "missing" };

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return { ok: false, reason: "malformed" };

  const body = `${parts[0]}.${parts[1]}`;
  const expected = hmac(body, signingKey);
  let provided;
  try {
    provided = Buffer.from(parts[2], "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }

  // Length check first: timingSafeEqual throws on a length mismatch, and the
  // length of an HMAC is not a secret.
  if (provided.length !== expected.length) return { ok: false, reason: "bad_signature" };
  if (!crypto.timingSafeEqual(provided, expected)) return { ok: false, reason: "bad_signature" };

  let payload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (payload.v !== 1) return { ok: false, reason: "bad_version" };
  if (typeof payload.exp !== "number" || payload.exp < now) return { ok: false, reason: "expired" };
  if (!payload.s || payload.s !== subject) return { ok: false, reason: "wrong_subject" };
  if (payload.k !== "ok" && payload.k !== "blocked") return { ok: false, reason: "bad_kind" };
  if (typeof payload.p !== "string" || !payload.p) return { ok: false, reason: "malformed" };

  return { ok: true, path: payload.p, kind: payload.k };
}

/**
 * Turn a stored public URL back into its storage object path, or null if the
 * URL is not one of ours.
 *
 * Pinned to the exact ${SUPABASE_URL}/storage/v1/object/public/listing-images/
 * prefix. The previous check accepted any hostname ending in ".supabase.co",
 * which includes every other Supabase project on the internet.
 */
export function storagePathFromPublicUrl(publicUrl) {
  if (typeof publicUrl !== "string" || !publicUrl) return null;

  const base = process.env.SUPABASE_URL;
  if (!base) return null;

  const prefix = `${base.replace(/\/+$/, "")}/storage/v1/object/public/${STORAGE_BUCKET}/`;
  if (!publicUrl.startsWith(prefix)) return null;

  const path = publicUrl.slice(prefix.length);
  if (!path) return null;
  // Reject traversal and any query/fragment smuggled onto the end.
  if (path.includes("..") || path.includes("?") || path.includes("#")) return null;
  if (path.startsWith("/")) return null;

  return path;
}

/**
 * Does this storage path belong to this subject?
 *
 * Authenticated uploads live under "<user id>/"; logged-out support
 * attachments live under "guest/support/". Guests have no identity, so for
 * them this is a prefix check only — which is exactly why guest object names
 * carry a random suffix (see POST /api/upload-url/guest). Without that, one
 * guest could name another's path and obtain a token for it.
 */
export function pathBelongsToSubject(path, subject) {
  if (typeof path !== "string" || !path || path.includes("..")) return false;
  if (subject === "guest") return path.startsWith("guest/support/");
  return path.startsWith(`${subject}/`);
}
