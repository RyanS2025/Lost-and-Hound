// Unit tests for the description auto-sorter.
//
// Run: cd my-app/backend && npm test
//
// The table in test/fixtures/descriptions.js is the spec. The invariants below
// run over every entry in it, so adding a fixture automatically extends the
// guarantee checks — which is the point: a rule change is a security change,
// and the corpus is what makes one reviewable.

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  splitDescription,
  containsWithheldDetail,
  EMPTY_EXTERNAL_FALLBACK,
  REASONS,
  REASON_LABELS,
} from "../lib/descriptionSplitter.js";
import { CORPUS, TITLE_CORPUS } from "./fixtures/descriptions.js";

const tokens = (s) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

describe("splitDescription — corpus", () => {
  for (const c of CORPUS) {
    test(c.name, () => {
      const r = splitDescription(c.input, c.opts);
      const expected = c.external === null ? "" : c.external;
      assert.equal(r.external, expected, "external text");
      assert.deepEqual(r.withheld, c.withheld, "withheld reasons");
    });
  }
});

describe("invariants — asserted for every corpus entry", () => {
  for (const c of CORPUS) {
    const r = splitDescription(c.input, c.opts);

    test(`[${c.name}] internal is the sanitized original`, () => {
      assert.equal(r.internal, c.input.trim());
    });

    test(`[${c.name}] external invents no new words`, () => {
      // Every token in the public text must have come from the input. Guards
      // against a reassembly bug splicing text in from somewhere else.
      const inTokens = tokens(r.internal);
      for (const t of tokens(r.external)) {
        assert.ok(inTokens.has(t), `external token "${t}" is not in the input`);
      }
    });

    test(`[${c.name}] idempotent — re-splitting the public text is a no-op`, () => {
      // The strongest regression test in the suite. If the classifier ever
      // starts eating benign text, the second pass eats more and this fails.
      const again = splitDescription(r.external, c.opts);
      assert.equal(again.external, r.external, "second pass changed the text");
      assert.deepEqual(again.withheld, [], "second pass withheld something");
    });

    test(`[${c.name}] deterministic across calls`, () => {
      // Catches a /g regex leaking lastIndex between invocations.
      assert.deepEqual(splitDescription(c.input, c.opts), r);
    });

    test(`[${c.name}] external never grows beyond the input`, () => {
      // +1 for the terminal period that signals truncation.
      assert.ok(r.external.length <= r.internal.length + 1);
    });

    test(`[${c.name}] reason ids are opaque — never matched text`, () => {
      // Load-bearing: withheld reasons are logged and persisted. If a matched
      // substring ever leaked into this array we would be durably storing the
      // exact PII the feature exists to withhold.
      for (const id of r.withheld) {
        assert.match(id, /^[A-Z_]+$/);
        assert.ok(REASONS[id], `unknown reason id ${id}`);
        assert.ok(REASON_LABELS[id], `reason ${id} has no UI label`);
      }
    });

    if (c.withheld.length === 0) {
      test(`[${c.name}] clean input is a byte-identical round trip`, () => {
        // No re-casing, no added punctuation, no whitespace normalisation.
        assert.equal(r.external, c.input.trim());
      });
    }
  }
});

describe("the guarantee — specifics never reach the public text", () => {
  // Explicit leak cases. The corpus table above asserts exact output; this
  // asserts the property that actually matters, in terms a reviewer can check
  // without recomputing the expected string.
  const cases = [
    ["iPhone 14 Pro, serial F2LX9K2M", ["f2lx9k2m", "serial"]],
    ["Husky Card, NUID 001234567", ["001234567", "nuid"]],
    ["keys w/ a blue dolphin keychain", ["dolphin", "keychain"]],
    ["wallet, PIN is 4821", ["4821", "pin"]],
    ["silver ring, engraved J.R. on the inner band", ["j.r", "engraved"]],
    ["backpack with a laptop and an insulin pen inside", ["laptop", "insulin"]],
    ["black case, cracked in the top-left corner", ["crack", "top-left"]],
    ["bag, $200 cash in the side pocket", ["200", "cash"]],
    ["phone, lock screen is a photo of my cat", ["cat", "lock screen"]],
    ["notebook, my number is 617-555-0143", ["617", "0143"]],
  ];

  for (const [input, forbidden] of cases) {
    test(input, () => {
      const { external } = splitDescription(input);
      const lower = external.toLowerCase();
      for (const secret of forbidden) {
        assert.ok(
          !lower.includes(secret),
          `"${secret}" leaked into the public text: "${external}"`
        );
      }
    });
  }
});

describe("evasion", () => {
  // Every one of these tries to sneak a value past a keyword match. They all
  // fail on the same principle: the ANNOUNCEMENT WORD redacts the clause on
  // its own, whether or not the value is readable.
  const cases = [
    ["blue case, s e r i a l F 2 L X", "spaced-out identifier"],
    ["blue case, serial is zero zero one two three", "digits spelled as words"],
    ["blue case, оwner sticker on the lid", "Cyrillic homoglyph"],
    ["blue case, ｓｅｒｉａｌ Ｆ２ＬＸ", "fullwidth characters"],
    ["blue case, s-e-r-i-a-l is F2LX", "hyphen-separated identifier"],
    ["blue case, nuid​ 001234567", "zero-width space inside the value"],
    ["blue case, my p a s s c o d e is 1234", "spaced-out secret"],
  ];

  for (const [input, label] of cases) {
    test(label, () => {
      const r = splitDescription(input);
      assert.ok(r.withheld.length > 0, `nothing was withheld from: ${input}`);
      assert.equal(r.external, "blue case.", `leaked: "${r.external}"`);
    });
  }
});

describe("containsWithheldDetail — the title/found_at reject gate", () => {
  for (const c of TITLE_CORPUS) {
    test(`${c.rejected ? "rejects" : "accepts"}: ${c.input}`, () => {
      assert.equal(containsWithheldDetail(c.input, c.opts), c.rejected);
    });
  }
});

describe("module hygiene", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../lib/descriptionSplitter.js", import.meta.url)),
    "utf8"
  );

  test("imports nothing — required for the byte-identical client copy", () => {
    const offenders = src
      .split("\n")
      .filter((l) => /^\s*(import|const\s+\w+\s*=\s*require)\b/.test(l));
    assert.deepEqual(offenders, [], "splitter must stay dependency-free");
  });

  test("no lookbehind — Safari 16.3 and older ship in the iOS WebView", () => {
    // Comments are stripped first: the module documents the banned construct
    // in prose, and the guard should read code rather than explanation.
    const code = src.replace(/^\s*\/\/.*$/gm, "");
    assert.ok(!/\(\?<[=!]/.test(code), "lookbehind assertion found");
  });

  test("no /g flag on detector regexes", () => {
    // /g regexes keep lastIndex between .test() calls, which would make
    // classification depend on call order. They are allowed only in .replace().
    const declarations = src.match(/^const \w+_RE\w* = \/.*\/[a-z]*;$/gm) || [];
    for (const d of declarations) {
      const flags = d.slice(d.lastIndexOf("/") + 1).replace(";", "");
      if (d.includes("SPACED_RUN_RE") || d.includes("DIGIT_WORDS_RE") || d.includes("INVISIBLE_RE")) {
        continue; // replace()-only, documented at the declaration
      }
      assert.ok(!flags.includes("g"), `${d.slice(0, 40)}… has the /g flag`);
    }
  });
});

describe("empty-external fallback", () => {
  test("returns empty string so the caller owns the copy", () => {
    const r = splitDescription("NUID 001234567, $40 cash inside");
    assert.equal(r.external, "");
    assert.ok(r.withheld.length > 0);
  });

  test("fallback copy fits under the feed card's 100-char truncation", () => {
    assert.ok(EMPTY_EXTERNAL_FALLBACK.length < 100);
  });
});

describe("hostile input", () => {
  test("non-string input does not throw", () => {
    for (const v of [null, undefined, 42, {}, [], true]) {
      const r = splitDescription(v);
      assert.equal(r.external, "");
      assert.equal(r.internal, "");
      assert.deepEqual(r.withheld, []);
    }
  });

  test("very long input terminates", () => {
    const r = splitDescription("black bag, ".repeat(400));
    assert.ok(typeof r.external === "string");
  });

  test("pathological separator runs terminate", () => {
    const r = splitDescription(".,.,.,.,.,.,.,.,.,.,.,.,.,.,.,.,.,.,.,.");
    assert.ok(typeof r.external === "string");
  });
});
