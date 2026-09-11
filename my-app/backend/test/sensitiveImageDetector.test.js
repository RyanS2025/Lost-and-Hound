// Unit tests for the sensitive-image scoring engine.
//
// Every case runs against a synthetic Vision response in test/fixtures/vision/.
// No network, no API key, no real photographs of anyone's ID.

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateImage,
  luhnValid,
  extractPanCandidates,
  normalizeOcrText,
  isSafeSearchBlocked,
  BLOCK_THRESHOLD,
  ESCALATE_THRESHOLD,
} from "../lib/sensitiveImageDetector.js";
import { loadVision } from "./fixtures/load.js";

const evalA = (name) => evaluateImage({ stageA: loadVision(name) });
const evalAB = (a, b) => evaluateImage({ stageA: loadVision(a), stageB: loadVision(b) });

// ── The regression that protects the app's most common listing category ─────
describe("Husky Card is a legitimate category — campus branding must not block", () => {
  test("a Northeastern hoodie scores below the escalation band", () => {
    const r = evalA("nu-hoodie");
    assert.equal(r.blocked, false);
    assert.equal(r.escalate, false, "must not cost a second Vision call");
    assert.ok(r.score < ESCALATE_THRESHOLD, `scored ${r.score}`);
  });

  test("a printed lanyard reaches the campus cap and escalates, but is allowed", () => {
    const stageA = evalA("lanyard-husky-text");
    assert.equal(stageA.blocked, false);
    assert.equal(stageA.escalate, true);
    assert.equal(stageA.score, 4, "campus group is capped below the threshold");

    const final = evalAB("lanyard-husky-text", "stageB-lanyard");
    assert.equal(final.blocked, false, "Lanyard/Textile labels must clear it");
  });

  test("an actual Husky Card face is blocked", () => {
    const r = evalA("husky-card-front");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "government_id");
  });

  test("campus signals alone can never reach the block threshold", () => {
    // The cap is the mechanism. If someone raises a CAMPUS_* weight without
    // raising the cap, this still holds; if they raise the cap, this fails.
    const r = evalA("lanyard-husky-text");
    assert.ok(r.score < BLOCK_THRESHOLD);
  });
});

describe("payment cards", () => {
  test("card front blocks on the number alone", () => {
    const r = evalA("credit-card-front");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "payment");
    assert.ok(r.reasons.includes("PAY_LUHN_PAN"));
    assert.ok(r.reasons.includes("PAY_PAN_GROUPED"));
  });

  test("Amex front blocks", () => {
    const r = evalA("amex-card-front");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "payment");
  });

  test("card back has no number, so it escalates and blocks on the logo", () => {
    const stageA = evalA("credit-card-back");
    assert.equal(stageA.blocked, false);
    assert.equal(stageA.escalate, true);

    const final = evalAB("credit-card-back", "stageB-card-logo-only");
    assert.equal(final.blocked, true);
  });

  test("a wallet photo with a card partly visible escalates, then blocks", () => {
    const stageA = evalA("wallet-with-card-visible");
    assert.equal(stageA.escalate, true, "partial OCR should not decide alone");

    const final = evalAB("wallet-with-card-visible", "stageB-credit-card");
    assert.equal(final.blocked, true);
  });
});

describe("Luhn false positives — receipts and order numbers stay allowed", () => {
  test("a long number labelled ORDER is not a card", () => {
    const r = evalA("receipt-long-digits");
    assert.equal(r.blocked, false);
    assert.ok(!r.reasons.includes("PAY_LUHN_PAN"));
  });

  test("a bare Luhn-valid run on a receipt escalates but is not blocked", () => {
    const stageA = evalA("receipt-bare-luhn");
    assert.equal(stageA.blocked, false, "one number must not block on its own");
    assert.equal(stageA.escalate, true);

    const final = evalAB("receipt-bare-luhn", "stageB-receipt");
    assert.equal(final.blocked, false, "Receipt/Paper labels carry no weight");
  });

  test("a shipping tracking number is not a card", () => {
    assert.equal(evalA("tracking-number").blocked, false);
  });

  test("a textbook ISBN is not a card", () => {
    assert.equal(evalA("isbn-textbook").blocked, false);
  });
});

describe("government ID", () => {
  test("passport MRZ blocks on its own", () => {
    const r = evalA("passport-mrz");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "government_id");
    assert.ok(r.reasons.includes("GOV_MRZ"));
  });

  test("driver's licence blocks", () => {
    const r = evalA("drivers-license");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "government_id");
  });

  test("social security card blocks", () => {
    const r = evalA("ssn-card");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "government_id");
  });
});

describe("PII documents", () => {
  test("bank statement blocks", () => {
    const r = evalA("bank-statement");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "pii_document");
  });

  test("cheque blocks", () => {
    assert.equal(evalA("cheque").blocked, true);
  });

  test("logged-in account screen blocks", () => {
    assert.equal(evalA("logged-in-bank-screen").blocked, true);
  });

  test("insurance card escalates, then blocks on the document label", () => {
    assert.equal(evalA("insurance-card").escalate, true);
    assert.equal(evalAB("insurance-card", "stageB-identity-document").blocked, true);
  });
});

describe("SafeSearch — today's rule preserved exactly", () => {
  test("adult LIKELY blocks", () => {
    const r = evalA("safesearch-adult");
    assert.equal(r.blocked, true);
    assert.equal(r.tier, "unsafe_content");
    assert.deepEqual(r.reasons, ["SAFESEARCH_ADULT"]);
  });

  test("racy LIKELY does NOT block — only VERY_LIKELY does", () => {
    assert.equal(evalA("safesearch-racy-likely").blocked, false);
  });

  test("isSafeSearchBlocked thresholds", () => {
    assert.equal(isSafeSearchBlocked({ adult: "POSSIBLE" }), null);
    assert.equal(isSafeSearchBlocked({ adult: "LIKELY" }), "SAFESEARCH_ADULT");
    assert.equal(isSafeSearchBlocked({ violence: "VERY_LIKELY" }), "SAFESEARCH_VIOLENCE");
    assert.equal(isSafeSearchBlocked({ racy: "LIKELY" }), null);
    assert.equal(isSafeSearchBlocked({ racy: "VERY_LIKELY" }), "SAFESEARCH_RACY");
    assert.equal(isSafeSearchBlocked(null), null);
  });
});

describe("degraded Vision responses", () => {
  test("a clean photo with no text scores zero", () => {
    const r = evalA("clean-backpack");
    assert.equal(r.score, 0);
    assert.equal(r.blocked, false);
    assert.equal(r.escalate, false);
  });

  test("a per-image error yields VISION_NO_ANNOTATION and no verdict", () => {
    const r = evalA("vision-image-error");
    assert.equal(r.blocked, false);
    assert.deepEqual(r.reasons, ["VISION_NO_ANNOTATION"]);
    // Policy lives in the caller — the detector never decides fail-open/closed.
  });

  test("a missing stageA yields VISION_NO_ANNOTATION", () => {
    assert.deepEqual(evaluateImage({ stageA: null }).reasons, ["VISION_NO_ANNOTATION"]);
  });

  test("an empty stageB does not crash or change the verdict", () => {
    const withB = evalAB("lanyard-husky-text", "stageB-none");
    assert.equal(withB.blocked, false);
  });
});

describe("reasons are opaque rule ids — never matched text", () => {
  // Load-bearing: the audit table persists this array. If a matched substring
  // ever leaked in, we would be durably storing the exact personal information
  // the image was deleted to avoid storing.
  const names = [
    "husky-card-front", "credit-card-front", "drivers-license", "passport-mrz",
    "ssn-card", "bank-statement", "cheque", "insurance-card",
    "logged-in-bank-screen", "receipt-bare-luhn", "amex-card-front",
  ];

  for (const name of names) {
    test(name, () => {
      const r = evalA(name);
      for (const id of r.reasons) {
        assert.match(id, /^[A-Z0-9_]+$/, `reason "${id}" is not an opaque id`);
      }
    });
  }

  test("no reason contains a digit run from the source text", () => {
    const r = evalA("ssn-card");
    assert.ok(!r.reasons.join(" ").includes("078"));
  });
});

describe("determinism", () => {
  test("evaluating twice gives identical results", () => {
    // Catches a /g regex leaking lastIndex between calls.
    for (const n of ["credit-card-front", "receipt-bare-luhn", "husky-card-front"]) {
      assert.deepEqual(evalA(n), evalA(n), n);
    }
  });
});

describe("luhnValid", () => {
  const good = ["4526018159083012", "378282246310005", "6011111111111117"];

  for (const pan of good) {
    test(`accepts ${pan}`, () => assert.equal(luhnValid(pan), true));

    test(`rejects ${pan} with one digit changed`, () => {
      const i = pan.length - 2;
      const bumped =
        pan.slice(0, i) + String((Number(pan[i]) + 1) % 10) + pan.slice(i + 1);
      assert.equal(luhnValid(bumped), false);
    });
  }

  test("rejects non-digits and out-of-range lengths", () => {
    assert.equal(luhnValid("123"), false);
    assert.equal(luhnValid("abcd"), false);
    assert.equal(luhnValid("12345678901234567890"), false);
    assert.equal(luhnValid(""), false);
  });
});

describe("extractPanCandidates guards", () => {
  test("discards degenerate sequences such as documented test numbers", () => {
    assert.deepEqual(extractPanCandidates("4111 1111 1111 1111"), []);
    assert.deepEqual(extractPanCandidates("5555555555554444"), []);
  });

  test("discards a candidate preceded by an ORDER or IMEI label", () => {
    assert.deepEqual(extractPanCandidates("ORDER 4526018159083012"), []);
    assert.deepEqual(extractPanCandidates("IMEI: 4526018159083012"), []);
  });

  test("keeps a genuine IIN match and flags separator grouping", () => {
    const [c] = extractPanCandidates("4526 0181 5908 3012");
    assert.equal(c.iin, true);
    assert.equal(c.grouped, true);
  });

  test("a Luhn-valid number outside every IIN family is only weak evidence", () => {
    const [c] = extractPanCandidates("9927501374619283");
    if (c) assert.equal(c.iin, false);
  });
});

describe("normalizeOcrText", () => {
  test("uppercases, collapses whitespace and caps length", () => {
    assert.equal(normalizeOcrText("  Valid\n\n Thru  "), "VALID THRU");
    assert.equal(normalizeOcrText("x".repeat(30000)).length, 20000);
  });

  test("tolerates non-string input", () => {
    assert.equal(normalizeOcrText(null), "");
    assert.equal(normalizeOcrText(undefined), "");
  });
});

describe("OCR digit confusion is applied per token, not blindly", () => {
  test("BOSTON and SOS are not mangled into digit strings", () => {
    // A blanket O->0 / S->5 rewrite would turn these into garbage that the
    // numeric rules could then match.
    const r = evaluateImage({
      stageA: {
        safeSearchAnnotation: {},
        fullTextAnnotation: { text: "BOSTON SOS LOST BOTTLE" },
      },
    });
    assert.equal(r.score, 0);
    assert.equal(r.blocked, false);
  });
});
