// Unit tests for the verified-upload token.
//
// This file is the bypass-attempt test suite. Before this module existed,
// POST /api/listings accepted any image_url on any *.supabase.co host with no
// proof of screening and no ownership check.

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import {
  signUploadToken,
  verifyUploadToken,
  storagePathFromPublicUrl,
  pathBelongsToSubject,
  UPLOAD_TOKEN_TTL_MS,
} from "../lib/uploadToken.js";

const SECRET = "test-signing-key-not-a-real-secret";
const USER = "11111111-2222-3333-4444-555555555555";
const PATH = `${USER}/1700000000000-abc.jpg`;
const NOW = 1_700_000_000_000;

const sign = (over = {}) =>
  signUploadToken({ path: PATH, subject: USER, kind: "ok", now: NOW, secret: SECRET, ...over });
const verify = (token, over = {}) =>
  verifyUploadToken(token, { subject: USER, now: NOW, secret: SECRET, ...over });

describe("round trip", () => {
  test("a freshly signed token verifies", () => {
    const r = verify(sign());
    assert.equal(r.ok, true);
    assert.equal(r.path, PATH);
    assert.equal(r.kind, "ok");
  });

  test("a blocked-kind token round trips and reports its kind", () => {
    const r = verify(sign({ kind: "blocked" }));
    assert.equal(r.ok, true);
    assert.equal(r.kind, "blocked");
  });
});

describe("rejection — every one of these is an attack", () => {
  test("a token minted for another user", () => {
    const other = signUploadToken({
      path: PATH, subject: "99999999-0000-0000-0000-000000000000",
      kind: "ok", now: NOW, secret: SECRET,
    });
    assert.equal(verify(other).ok, false);
    assert.equal(verify(other).reason, "wrong_subject");
  });

  test("presenting a valid token while claiming to be someone else", () => {
    const r = verify(sign(), { subject: "someone-else" });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "wrong_subject");
  });

  test("an expired token", () => {
    const r = verify(sign(), { now: NOW + UPLOAD_TOKEN_TTL_MS + 1 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "expired");
  });

  test("a tampered payload — swapping in a different storage path", () => {
    const token = sign();
    const [v, payload, sig] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    decoded.p = `${USER}/some-other-object.jpg`;
    const forged = `${v}.${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${sig}`;
    const r = verify(forged);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "bad_signature");
  });

  test("a tampered payload — upgrading blocked to ok", () => {
    const token = sign({ kind: "blocked" });
    const [v, payload, sig] = token.split(".");
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    decoded.k = "ok";
    const forged = `${v}.${Buffer.from(JSON.stringify(decoded)).toString("base64url")}.${sig}`;
    assert.equal(verify(forged).ok, false);
  });

  test("a tampered signature", () => {
    const token = sign();
    const parts = token.split(".");
    parts[2] = Buffer.from("x".repeat(32)).toString("base64url");
    assert.equal(verify(parts.join(".")).ok, false);
  });

  test("a signature of the wrong length does not throw", () => {
    // timingSafeEqual throws on a length mismatch; the length check must come
    // first or a short signature becomes a 500 instead of a rejection.
    const parts = sign().split(".");
    parts[2] = Buffer.from("short").toString("base64url");
    assert.doesNotThrow(() => verify(parts.join(".")));
    assert.equal(verify(parts.join(".")).ok, false);
  });

  test("a token signed with a different key", () => {
    const other = signUploadToken({
      path: PATH, subject: USER, kind: "ok", now: NOW, secret: "different-key",
    });
    assert.equal(verify(other).ok, false);
    assert.equal(verify(other).reason, "bad_signature");
  });

  test("garbage and missing tokens", () => {
    for (const t of ["", null, undefined, "abc", "v1.x", "v2.a.b", 42, {}]) {
      assert.equal(verify(t).ok, false);
    }
  });

  test("no signing key configured means no token and no verification", () => {
    const r = verifyUploadToken("anything", { subject: USER, now: NOW, secret: "" });
    assert.equal(r.ok, false);
  });
});

describe("storagePathFromPublicUrl", () => {
  const ORIGINAL = process.env.SUPABASE_URL;
  before(() => { process.env.SUPABASE_URL = "https://example-project.supabase.co"; });
  after(() => {
    if (ORIGINAL === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = ORIGINAL;
  });

  const url = (p) =>
    `https://example-project.supabase.co/storage/v1/object/public/listing-images/${p}`;

  test("extracts the object path from one of our URLs", () => {
    assert.equal(storagePathFromPublicUrl(url(PATH)), PATH);
  });

  test("rejects another Supabase project — the old check allowed this", () => {
    // The previous rule was hostname.endsWith(".supabase.co"), which trusts
    // every Supabase project on the internet.
    assert.equal(
      storagePathFromPublicUrl(
        "https://attacker.supabase.co/storage/v1/object/public/listing-images/x.jpg"
      ),
      null
    );
  });

  test("rejects a different bucket", () => {
    assert.equal(
      storagePathFromPublicUrl(
        "https://example-project.supabase.co/storage/v1/object/public/other-bucket/x.jpg"
      ),
      null
    );
  });

  test("rejects path traversal", () => {
    assert.equal(storagePathFromPublicUrl(url("../../secrets/x.jpg")), null);
  });

  test("rejects a smuggled query string or fragment", () => {
    assert.equal(storagePathFromPublicUrl(url("x.jpg?download=1")), null);
    assert.equal(storagePathFromPublicUrl(url("x.jpg#frag")), null);
  });

  test("rejects non-URLs, empty input and a bare prefix", () => {
    for (const v of ["", null, undefined, 42, "not a url", url("")]) {
      assert.equal(storagePathFromPublicUrl(v), null);
    }
  });
});

describe("pathBelongsToSubject", () => {
  test("a user owns only their own prefix", () => {
    assert.equal(pathBelongsToSubject(`${USER}/x.jpg`, USER), true);
    assert.equal(pathBelongsToSubject(`${USER}/support/x.jpg`, USER), true);
    assert.equal(pathBelongsToSubject("00000000-0000-0000-0000-000000000000/x.jpg", USER), false);
  });

  test("a prefix that merely starts with the id is not ownership", () => {
    assert.equal(pathBelongsToSubject(`${USER}-evil/x.jpg`, USER), false);
  });

  test("guests are confined to guest/support/", () => {
    assert.equal(pathBelongsToSubject("guest/support/x.jpg", "guest"), true);
    assert.equal(pathBelongsToSubject(`${USER}/x.jpg`, "guest"), false);
    assert.equal(pathBelongsToSubject("guest/other/x.jpg", "guest"), false);
  });

  test("traversal is rejected for every subject", () => {
    assert.equal(pathBelongsToSubject(`${USER}/../other/x.jpg`, USER), false);
    assert.equal(pathBelongsToSubject("guest/support/../../x.jpg", "guest"), false);
  });
});
