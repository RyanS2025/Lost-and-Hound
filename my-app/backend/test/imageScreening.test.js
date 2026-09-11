// Unit tests for the screening orchestration.
//
// Everything is injected, so these run with no network, no Supabase, no Vision
// key and no new dependencies. The fail-closed branches are the ones that
// matter most: they are the difference between "screening is on" and
// "screening silently does nothing", and the old code took the second path
// whenever GOOGLE_CLOUD_VISION_API_KEY was unset.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  screenUploadedImage,
  shouldFailClosed,
  isSupportedImage,
  IMAGE_MAX_BYTES,
} from "../lib/imageScreening.js";
import { verifyUploadToken } from "../lib/uploadToken.js";
import { loadVision } from "./fixtures/load.js";

const SECRET = "test-signing-key-not-a-real-secret";
const USER = "11111111-2222-3333-4444-555555555555";
const PATH = `${USER}/1700000000000-abc.jpg`;
const NOW = 1_700_000_000_000;

const jpeg = (size = 64) => {
  const b = Buffer.alloc(size, 0x41);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
  return b;
};

/** Minimal fakes with call recording. */
function makeDeps({
  buffer = jpeg(),
  stageA = "clean-backpack",
  stageB = null,
  visionFails = false,
  env = {},
  downloadFails = false,
  removeFails = false,
  usage = 0,
} = {}) {
  const calls = { remove: [], fetch: 0, rpc: [], blocks: [] };
  let stage = 0;

  return {
    calls,
    deps: {
      now: () => NOW,
      env: {
        NODE_ENV: "production",
        GOOGLE_CLOUD_VISION_API_KEY: "fake-key",
        UPLOAD_TOKEN_SECRET: SECRET,
        ...env,
      },
      storage: {
        download: async () =>
          downloadFails
            ? { data: null, error: new Error("nope") }
            : { data: { arrayBuffer: async () => buffer }, error: null },
        remove: async (paths) => {
          calls.remove.push(...paths);
          return removeFails ? { error: new Error("remove failed") } : { error: null };
        },
      },
      readUsage: async () => usage,
      rpc: async (fn, args) => { calls.rpc.push({ fn, args }); },
      insertBlock: async (row) => { calls.blocks.push(row); },
      fetch: async () => {
        calls.fetch += 1;
        if (visionFails) {
          const e = new Error("The operation was aborted due to timeout");
          e.name = "TimeoutError";
          throw e;
        }
        const name = stage++ === 0 ? stageA : stageB;
        return { ok: true, json: async () => ({ responses: [loadVision(name)] }) };
      },
    },
  };
}

const run = (opts) => {
  const { deps, calls } = makeDeps(opts);
  return screenUploadedImage({ filePath: PATH, subject: USER, requestIp: "1.2.3.4" }, deps)
    .then((result) => ({ result, calls }));
};

describe("shouldFailClosed", () => {
  test("fails closed by default, whatever the environment", () => {
    assert.equal(shouldFailClosed({}), true);
    assert.equal(shouldFailClosed({ NODE_ENV: "production" }), true);
    assert.equal(shouldFailClosed({ NODE_ENV: "development" }), true);
  });
  test("NODE_ENV does not decide this", () => {
    // The regression this guards: screening used to be off unless NODE_ENV was
    // exactly "production", and nothing in the deploy sets that variable.
    assert.equal(shouldFailClosed({ NODE_ENV: "prod" }), true);
    assert.equal(shouldFailClosed({ NODE_ENV: "Production" }), true);
    assert.equal(shouldFailClosed({ NODE_ENV: "production " }), true);
  });
  test("the break-glass flag is the only way open", () => {
    // Without an escape hatch, a Google outage means nobody can post a photo
    // and the only remedy is a redeploy. There is no on-call here.
    assert.equal(shouldFailClosed({ IMAGE_SCREENING_FAIL_OPEN: "1" }), false);
    // Anything other than the exact opt-in string stays closed.
    assert.equal(shouldFailClosed({ IMAGE_SCREENING_FAIL_OPEN: "true" }), true);
    assert.equal(shouldFailClosed({ IMAGE_SCREENING_FAIL_OPEN: "0" }), true);
  });
});

describe("isSupportedImage", () => {
  test("accepts JPEG, PNG and WebP", () => {
    assert.equal(isSupportedImage(jpeg()), true);
    const png = Buffer.alloc(12); png[0] = 0x89; png[1] = 0x50; png[2] = 0x4e; png[3] = 0x47;
    assert.equal(isSupportedImage(png), true);
    const webp = Buffer.from("RIFF____WEBP", "ascii");
    assert.equal(isSupportedImage(webp), true);
  });

  test("rejects GIF — Vision only annotates the first frame", () => {
    // An animated GIF with a clean frame 1 and a licence at frame 40 would
    // otherwise pass screening completely.
    const gif = Buffer.from("GIF89a______", "ascii");
    assert.equal(isSupportedImage(gif), false);
  });

  test("rejects non-images and truncated input", () => {
    assert.equal(isSupportedImage(Buffer.from("#!/bin/sh\necho hi")), false);
    assert.equal(isSupportedImage(Buffer.alloc(4)), false);
    assert.equal(isSupportedImage(null), false);
  });
});

describe("accepted uploads", () => {
  test("a clean photo returns 200 with a usable ok-token", async () => {
    const { result, calls } = await run({ stageA: "clean-backpack" });
    assert.equal(result.status, 200);
    assert.equal(result.body.valid, true);
    assert.deepEqual(calls.remove, [], "a clean object must not be deleted");

    const check = verifyUploadToken(result.body.uploadToken, {
      subject: USER, now: NOW, secret: SECRET,
    });
    assert.equal(check.ok, true);
    assert.equal(check.kind, "ok");
    assert.equal(check.path, PATH);
  });

  test("one Vision call and 2 billed units for an unambiguous image", async () => {
    const { calls } = await run({ stageA: "clean-backpack" });
    assert.equal(calls.fetch, 1);
    assert.deepEqual(calls.rpc[0].args, { p_month: "2023-11", p_units: 2 });
  });
});

describe("blocked uploads", () => {
  test("deletes the object, returns 422, and issues a blocked-token", async () => {
    const { result, calls } = await run({ stageA: "credit-card-front" });
    assert.equal(result.status, 422);
    assert.equal(result.body.code, "IMAGE_BLOCKED");
    assert.equal(result.body.tier, "payment");
    assert.deepEqual(calls.remove, [PATH], "the image must not survive in storage");

    const check = verifyUploadToken(result.body.redactionToken, {
      subject: USER, now: NOW, secret: SECRET,
    });
    assert.equal(check.ok, true);
    assert.equal(check.kind, "blocked");
  });

  test("a failed delete still returns 422", async () => {
    // A storage failure must never be readable as "the image is acceptable".
    const { result } = await run({ stageA: "credit-card-front", removeFails: true });
    assert.equal(result.status, 422);
  });

  test("the audit row carries rule ids and hashes, never content", async () => {
    const { calls } = await run({ stageA: "ssn-card" });
    const row = calls.blocks[0];
    assert.equal(row.subject_kind, "user");
    assert.equal(row.subject_id, USER);
    assert.equal(row.ip_hash, null, "identified users need no IP");
    assert.equal(row.surface, "listing");
    assert.ok(row.reasons.every((r) => /^[A-Z0-9_]+$/.test(r)));
    assert.match(row.path_hash, /^[a-f0-9]{32}$/);
    assert.ok(!JSON.stringify(row).includes(PATH), "the raw path must not be stored");
    assert.ok(!JSON.stringify(row).includes("078"), "OCR content must not be stored");
  });

  test("guest blocks record a hashed IP and no user id", async () => {
    const { deps, calls } = makeDeps({ stageA: "drivers-license" });
    await screenUploadedImage(
      { filePath: "guest/support/1700000000000-xyz.jpg", subject: "guest", requestIp: "9.9.9.9" },
      deps
    );
    const row = calls.blocks[0];
    assert.equal(row.subject_kind, "guest");
    assert.equal(row.subject_id, null);
    assert.match(row.ip_hash, /^[a-f0-9]{16}$/);
    assert.ok(!JSON.stringify(row).includes("9.9.9.9"), "raw IP must not be stored");
    assert.equal(row.surface, "support");
  });
});

describe("escalation", () => {
  test("an ambiguous image makes a second call and bills 4 units", async () => {
    const { result, calls } = await run({
      stageA: "wallet-with-card-visible",
      stageB: "stageB-credit-card",
    });
    assert.equal(calls.fetch, 2);
    assert.deepEqual(calls.rpc[0].args, { p_month: "2023-11", p_units: 4 });
    assert.equal(result.status, 422, "stage B should confirm the card");
  });

  test("a Husky Card lanyard escalates and is then allowed", async () => {
    const { result, calls } = await run({
      stageA: "lanyard-husky-text",
      stageB: "stageB-lanyard",
    });
    assert.equal(calls.fetch, 2);
    assert.equal(result.status, 200);
    assert.deepEqual(calls.remove, []);
  });
});

describe("fail-closed and fail-open", () => {
  test("a Vision timeout in production rejects and removes the object", async () => {
    const { result, calls } = await run({ visionFails: true });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "SCREENING_UNAVAILABLE");
    assert.deepEqual(calls.remove, [PATH], "an unscreened image must not remain");
  });

  test("the same timeout accepts once fail-open is opted into", async () => {
    const { result, calls } = await run({
      visionFails: true,
      env: { IMAGE_SCREENING_FAIL_OPEN: "1" },
    });
    assert.equal(result.status, 200);
    assert.deepEqual(calls.remove, []);
  });

  test("a missing API key rejects — it used to pass silently", async () => {
    const { result, calls } = await run({ env: { GOOGLE_CLOUD_VISION_API_KEY: "" } });
    assert.equal(result.status, 503);
    assert.deepEqual(calls.remove, [PATH]);
  });

  test("a missing API key accepts only with the opt-out set", async () => {
    const { result } = await run({
      env: { GOOGLE_CLOUD_VISION_API_KEY: "", IMAGE_SCREENING_FAIL_OPEN: "1" },
    });
    assert.equal(result.status, 200);
  });

  test("an unset NODE_ENV still rejects", async () => {
    // The regression: our Dockerfile sets no NODE_ENV, so this was the real
    // production configuration and it used to accept unscreened images.
    const { result, calls } = await run({ visionFails: true, env: { NODE_ENV: undefined } });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "SCREENING_UNAVAILABLE");
    assert.deepEqual(calls.remove, [PATH]);
  });

  test("no Vision units are billed when screening never ran", async () => {
    const { calls } = await run({ env: { GOOGLE_CLOUD_VISION_API_KEY: "" } });
    assert.deepEqual(calls.rpc, [], "the old code counted calls it never made");
  });
});

describe("monthly Vision budget", () => {
  test("exhausted budget pauses photos — a distinct state from an outage", async () => {
    // Must NOT be SCREENING_UNAVAILABLE. That code tells the user to retry in
    // a moment, which is false here: capacity returns on the 1st.
    const { result, calls } = await run({ usage: 900 });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "SCREENING_PAUSED");
    assert.deepEqual(calls.remove, [PATH], "an unscreened image must not remain");
    assert.equal(calls.fetch, 0, "no Vision call should be made once capacity is spent");
  });

  test("a paused upload issues no redaction token", async () => {
    // image_redacted means "we looked and it was sensitive". Nothing was
    // examined here, so a token would let the post claim otherwise.
    const { result } = await run({ usage: 900 });
    assert.equal(result.body.redactionToken, undefined);
    assert.equal(result.body.uploadToken, undefined);
  });

  test("pausing applies even with fail-open set — the spend is real either way", async () => {
    const { result } = await run({ usage: 900, env: { IMAGE_SCREENING_FAIL_OPEN: "1" } });
    assert.equal(result.body.code, "SCREENING_PAUSED");
  });

  test("budget under the ceiling proceeds normally", async () => {
    const { result } = await run({ usage: 899 });
    assert.equal(result.status, 200);
  });

  test("the ceiling is configurable", async () => {
    const { result } = await run({ usage: 50, env: { VISION_MONTHLY_UNIT_BUDGET: "50" } });
    assert.equal(result.status, 503);
    assert.equal(result.body.code, "SCREENING_PAUSED");
  });

  test("a usage-read failure does not decide policy either way", async () => {
    const { deps } = makeDeps({});
    deps.readUsage = async () => { throw new Error("db down"); };
    const result = await screenUploadedImage({ filePath: PATH, subject: USER }, deps);
    assert.equal(result.status, 200);
  });
});

describe("pre-screening rejections", () => {
  test("a missing object is a 404", async () => {
    const { result } = await run({ downloadFails: true });
    assert.equal(result.status, 404);
  });

  test("an oversized object is a 413 and is deleted", async () => {
    // The 5MB check at /api/upload-url reads a client-supplied number that can
    // simply be omitted. This is the first place the real size is known.
    const { result, calls } = await run({ buffer: jpeg(IMAGE_MAX_BYTES + 1) });
    assert.equal(result.status, 413);
    assert.deepEqual(calls.remove, [PATH]);
    assert.equal(calls.fetch, 0, "an oversized file must never reach Vision");
  });

  test("a non-image is a 400 and is deleted", async () => {
    const { result, calls } = await run({ buffer: Buffer.from("#!/bin/sh\necho pwned") });
    assert.equal(result.status, 400);
    assert.deepEqual(calls.remove, [PATH]);
    assert.equal(calls.fetch, 0);
  });
});

describe("SafeSearch behaviour is preserved", () => {
  test("adult content is still blocked", async () => {
    const { result } = await run({ stageA: "safesearch-adult" });
    assert.equal(result.status, 422);
    assert.equal(result.body.tier, "unsafe_content");
  });
});

describe("resilience", () => {
  test("an audit-insert failure does not change the response", async () => {
    const { deps } = makeDeps({ stageA: "credit-card-front" });
    deps.insertBlock = async () => { throw new Error("table missing"); };
    const result = await screenUploadedImage({ filePath: PATH, subject: USER }, deps);
    assert.equal(result.status, 422);
  });

  test("an rpc failure does not change the response", async () => {
    const { deps } = makeDeps({});
    deps.rpc = async () => { throw new Error("rpc down"); };
    const result = await screenUploadedImage({ filePath: PATH, subject: USER }, deps);
    assert.equal(result.status, 200);
  });

  test("a non-OK Vision HTTP status fails closed in production", async () => {
    const { deps } = makeDeps({});
    deps.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
    const result = await screenUploadedImage({ filePath: PATH, subject: USER }, deps);
    assert.equal(result.status, 503);
  });

  test("a per-image Vision error fails closed in production", async () => {
    const { deps } = makeDeps({ stageA: "vision-image-error" });
    const result = await screenUploadedImage({ filePath: PATH, subject: USER }, deps);
    assert.equal(result.status, 503);
  });
});
