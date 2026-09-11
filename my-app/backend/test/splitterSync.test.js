// The splitter is duplicated so the create form can render a live preview
// without a round trip. If the copies drift, the preview shows the student a
// public description that is not the one the server will store.
//
// scripts/check-splitter-sync.sh runs the same check in CI; this mirrors it so
// drift also fails a plain `npm test` locally.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (rel) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

describe("descriptionSplitter copies", () => {
  const canonical = read("../lib/descriptionSplitter.js");
  const copy = read("../../src/utils/descriptionSplitter.js");

  test("are byte-identical", () => {
    assert.equal(
      copy,
      canonical,
      "run: cp my-app/backend/lib/descriptionSplitter.js my-app/src/utils/descriptionSplitter.js"
    );
  });

  test("canonical copy has no imports", () => {
    const offenders = canonical
      .split("\n")
      .map((line, i) => [i + 1, line])
      .filter(([, line]) => /^\s*import\s/.test(line) || /\brequire\(/.test(line));
    assert.deepEqual(offenders, [], "splitter must stay dependency-free");
  });
});
