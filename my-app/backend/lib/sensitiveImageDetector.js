// ════════════════════════════════════════════════════════════════════════════
// Sensitive-image detector
// ════════════════════════════════════════════════════════════════════════════
// Scores a Google Vision annotation for signs that the photo is a government
// ID, a payment card, or a document carrying personal information. Pure: no
// I/O, no env, no policy. It returns a verdict; the CALLER (lib/imageScreening)
// decides what to do about it, including what happens when Vision is down.
//
// ── Two-stage escalation, because Vision bills per feature per image ────────
// The free tier is 1000 units/month and the Finances dashboard tracks it, so
// "just request every feature" would be a 4x cost regression.
//
//   Stage A (always, 2 units)   SAFE_SEARCH_DETECTION + TEXT_DETECTION
//   Stage B (only 4 <= score < 6, 2 more)  LABEL_DETECTION + LOGO_DETECTION
//
// Clean photos of jackets and backpacks score 0-2 and never escalate, so the
// real-world average lands near 2.1 units per image. Stage B exists for the
// cases OCR cannot resolve — glare, an angled card, a face-down licence, a
// non-English ID — where a non-text opinion is the only way to tell.
//
// ── Why the scores are grouped and capped ───────────────────────────────────
// Every group's contribution is capped below or at the block threshold, so NO
// SINGLE KEYWORD CAN BLOCK AN IMAGE ALONE. The one exception is GOV_MRZ, whose
// pattern does not occur outside real machine-readable travel documents.
//
// The `campus` cap of 4 is the load-bearing one. "Husky Card" is a legitimate
// listing category on this platform — students post about lost Husky Cards
// constantly — so NORTHEASTERN on a hoodie, a water bottle or a laptop sticker
// must never be enough. It lands at 2. A lanyard printed "NORTHEASTERN · HUSKY
// CARD" reaches the 4 cap, escalates, and stage B's Lanyard/Textile labels let
// it through. Only an actual card face, which also carries ID fields or comes
// back labelled `Identity document`, crosses 6.
// ════════════════════════════════════════════════════════════════════════════

export const BLOCK_THRESHOLD = 6;
export const ESCALATE_THRESHOLD = 4;
export const MAX_OCR_CHARS = 20000;

// Cap per group. The sum of capped groups is the score.
const GROUP_CAPS = { payment: 9, gov: 9, campus: 4, pii: 7, vision: 6 };

// Which tier a group maps to when it is the dominant one. Ties break in this
// object's key order: government ID first, then payment, then PII.
const GROUP_TIERS = {
  gov: "government_id",
  campus: "government_id",
  payment: "payment",
  pii: "pii_document",
  vision: null, // vision corroborates; it never names the tier on its own
};

// ── Luhn ────────────────────────────────────────────────────────────────────

/** Standard mod-10 checksum. Input must already be digits only. */
export function luhnValid(digits) {
  if (!/^\d{12,19}$/.test(digits)) return false;
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

// Issuer identification number families. Matching one of these is what earns
// the full 5 points — Luhn alone is far too weak (see below).
const IIN_FAMILIES = [
  /^4\d{12}(\d{3})?$/,                                        // Visa
  /^5[1-5]\d{14}$/,                                           // Mastercard
  /^2(2[2-9]\d{2}|[3-6]\d{3}|7[01]\d{2}|720\d)\d{10}$/,       // Mastercard 2-series
  /^3[47]\d{13}$/,                                            // Amex
  /^6(?:011\d{12}|5\d{14}|4[4-9]\d{13}|22[1-9]\d{12})$/,      // Discover
  /^3(?:0[0-5]|[68]\d)\d{11}$/,                               // Diners
  /^35(?:2[89]|[3-8]\d)\d{12}$/,                              // JCB
];

// Labels that legitimately precede a long Luhn-valid number that is NOT a card.
const PAN_CONTEXT_BLOCK_RE =
  /\b(ORDER|INVOICE|TRACKING|IMEI|SERIAL|SN|ISBN|UPC|EAN|TXN|REF|CONFIRMATION|MEID)\b[^A-Z0-9]{0,6}$/;

// Two shapes, deliberately NOT one permissive pattern.
//
// An earlier draft used /(?:\d[ -]?){11,18}\d/, which allows a separator
// anywhere. On a receipt reading "CAFE 617 4526018159083012" that greedily
// matches across the space into a 19-digit run, fails Luhn, and consumes the
// real 16-digit number without ever testing it — a silent false negative.
//
// Real card numbers are either printed solid or grouped 4-4-4-4 (4-6-5 for
// Amex), so matching exactly those two shapes is both stricter and more
// accurate than allowing arbitrary spacing.
const PAN_SOLID_RE = /(^|\D)(\d{12,19})(?=\D|$)/g;
const PAN_GROUPED_RE = /\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,4}|\d{4}[ -]\d{6}[ -]\d{5}/g;

/** Repeated or strictly sequential digits — test cards and dummy serials. */
function isDegenerate(digits) {
  if (new Set(digits).size <= 3) return true;
  let asc = true;
  let desc = true;
  for (let i = 1; i < digits.length; i += 1) {
    const delta = digits.charCodeAt(i) - digits.charCodeAt(i - 1);
    if (delta !== 1) asc = false;
    if (delta !== -1) desc = false;
  }
  return asc || desc;
}

/**
 * Pull card-number candidates out of OCR text.
 *
 * Luhn is a mod-10 checksum, so roughly one in ten random 16-digit strings
 * passes it. Receipts, order numbers, IMEIs (which genuinely use Luhn), ISBNs
 * and concatenated phone runs all produce hits. Four guards keep that noise
 * from reaching the block threshold:
 *
 *   1. an IIN family match is required for the full weight
 *   2. degenerate sequences are discarded (4111 1111 1111 1111 in a checkout
 *      screenshot is a documented test number, not somebody's card)
 *   3. a preceding ORDER/TRACKING/IMEI label discards the candidate
 *   4. 4-4-4-4 grouping is a BONUS, never a base score, so a bare run buried
 *      in a receipt only reaches 5 — escalating rather than blocking, and
 *      stage B's Receipt/Paper labels then resolve it to allowed
 */
export function extractPanCandidates(text) {
  const seen = new Set();
  const out = [];

  const consider = (raw, index) => {
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length < 12 || digits.length > 19) return;
    if (seen.has(digits)) return;
    if (!luhnValid(digits)) return;
    if (isDegenerate(digits)) return;
    if (PAN_CONTEXT_BLOCK_RE.test(text.slice(Math.max(0, index - 24), index))) return;

    seen.add(digits);
    out.push({
      digits,
      grouped: /\d[ -]\d/.test(raw),
      iin: IIN_FAMILIES.some((re) => re.test(digits)),
    });
  };

  const grouped = new RegExp(PAN_GROUPED_RE.source, "g");
  let m = grouped.exec(text);
  while (m !== null) {
    consider(m[0], m.index);
    m = grouped.exec(text);
  }

  const solid = new RegExp(PAN_SOLID_RE.source, "g");
  m = solid.exec(text);
  while (m !== null) {
    consider(m[2], m.index + m[1].length);
    m = solid.exec(text);
  }

  return out;
}

// ── Normalization ───────────────────────────────────────────────────────────

/** Uppercased, whitespace-collapsed, length-capped OCR text. */
export function normalizeOcrText(raw) {
  if (typeof raw !== "string") return "";
  return raw
    .slice(0, MAX_OCR_CHARS)
    .toUpperCase()
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * OCR routinely reads O for 0, I/L for 1, S for 5, B for 8, Z for 2. Rewriting
 * those blindly turns "BOSTON" into "8O5TON" and "SOS" into "505", so the
 * substitution is applied PER TOKEN and only where the token is already mostly
 * digits. Digit-pattern rules run against this string; keyword rules do not.
 */
function toDigitText(text) {
  return text
    .split(" ")
    .map((tok) => {
      const digits = (tok.match(/\d/g) || []).length;
      if (!digits || digits / tok.length < 0.6) return tok;
      return tok.replace(/[OILSBZ]/g, (c) =>
        ({ O: "0", I: "1", L: "1", S: "5", B: "8", Z: "2" }[c])
      );
    })
    .join(" ");
}

// ── Rules ───────────────────────────────────────────────────────────────────
// Each entry: [id, group, points, test]. `test` receives { text, digitText,
// lines, pans } and returns a boolean. Ids are opaque and are the ONLY thing
// that ever gets logged or persisted — see the note on `reasons` below.

const RULES = [
  // ── Payment cards ─────────────────────────────────────────────────────────
  ["PAY_LUHN_PAN", "payment", 5, (c) => c.pans.some((p) => p.iin)],
  ["PAY_PAN_GROUPED", "payment", 2, (c) => c.pans.some((p) => p.iin && p.grouped)],
  ["PAY_LUHN_WEAK", "payment", 2, (c) => c.pans.some((p) => !p.iin)],
  ["PAY_VALID_THRU", "payment", 3, (c) =>
    /\b(VALID\s*(THRU|FROM)|GOOD\s*THRU|EXPIRES?\s*END|EXP(IRY|IRES)?\s*DATE|MONTH\s*\/\s*YEAR)\b/.test(c.text)],
  ["PAY_CARD_WORDS", "payment", 3, (c) =>
    /\b(DEBIT CARD|CREDIT CARD|CARD ?HOLDER|AUTHORI[SZ]ED SIGNATURE|MEMBER SINCE)\b/.test(c.text)],
  ["PAY_BRAND_WORD", "payment", 2, (c) =>
    /\b(VISA|MASTER ?CARD|AMERICAN EXPRESS|AMEX|DISCOVER|MAESTRO|UNIONPAY|JCB|DINERS CLUB)\b/.test(c.text)],
  ["PAY_ISSUER_NAME", "payment", 2, (c) =>
    /\b(CHASE|BANK OF AMERICA|WELLS FARGO|CITI|CITIBANK|CAPITAL ONE|SANTANDER|TD BANK|PNC|USAA|NAVY FEDERAL|BARCLAYS|HSBC)\b/.test(c.text)],
  ["PAY_CVV", "payment", 2, (c) => /\b(CVV2?|CVC2?|CID|SECURITY CODE)\b/.test(c.text)],
  ["PAY_EXPIRY_MMYY", "payment", 2, (c) =>
    /(^|[^0-9])(0[1-9]|1[0-2])\s*\/\s*([2-4]\d)([^0-9]|$)/.test(c.digitText)],

  // ── Government ID ─────────────────────────────────────────────────────────
  // GOV_MRZ is the only rule that can block on its own. A 28-44 character run
  // of [A-Z0-9<] with four or more chevrons is the ICAO machine-readable zone
  // format; nothing else produces it.
  ["GOV_MRZ", "gov", 6, (c) =>
    c.lines.some((l) => /^[A-Z0-9<]{28,44}$/.test(l.trim()) && (l.match(/</g) || []).length >= 4) ||
    /\bP<[A-Z]{3}[A-Z<]{5,}/.test(c.text)],
  ["GOV_PASSPORT", "gov", 4, (c) => /\b(PASSPORT|PASSEPORT|PASAPORTE|REISEPASS)\b/.test(c.text)],
  ["GOV_DL", "gov", 4, (c) =>
    /\b(DRIVER'?S? LICEN[SC]E|DRIVERS LICEN[SC]E|OPERATOR LICEN[SC]E|COMMERCIAL DRIVER)\b/.test(c.text)],
  ["GOV_AGENCY", "gov", 5, (c) =>
    /\b(DEPARTMENT OF MOTOR VEHICLES|REGISTRY OF MOTOR VEHICLES|DMV|RMV|DEPARTMENT OF STATE|DEPARTMENT OF HOMELAND SECURITY)\b/.test(c.text)],
  ["GOV_SSN_WORDS", "gov", 5, (c) => /\bSOCIAL SECURITY\b/.test(c.text)],
  ["GOV_SSN_PATTERN", "gov", 4, (c) =>
    /(^|[^0-9])(?!000|666|9\d\d)\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4}([^0-9]|$)/.test(c.digitText)],
  ["GOV_VISA", "gov", 4, (c) =>
    /\b(NONIMMIGRANT VISA|IMMIGRANT VISA|VISA TYPE\s*\/\s*CLASS|ISSUING POST NAME)\b/.test(c.text)],
  ["GOV_IDNUM_LABEL", "gov", 3, (c) =>
    /\b(IDENTIFICATION (NO|NUMBER|#)|LICEN[SC]E (NO|NUMBER|#)|DOCUMENT (NO|NUMBER)|DL\s*(NO|#)|LIC\s*(NO|#))\b/.test(c.text)],
  ["GOV_DL_FIELDS", "gov", 2, (c) =>
    /\b(CLASS\s*[A-DM]\b|ENDORSEMENTS?|RESTRICTIONS?|ORGAN DONOR|DONOR)\b/.test(c.text)],
  ["GOV_ID_FIELDS", "gov", 2, (c) =>
    /\b(DATE OF BIRTH|DOB|SEX\s*:?\s*[MF]\b|HGT|WGT|EYES|HAIR|ISS)\b/.test(c.text)],
  ["GOV_USA", "gov", 2, (c) => /\bUNITED STATES OF AMERICA\b/.test(c.text)],

  // ── Campus ID — capped at 4, BELOW the block threshold, on purpose ────────
  ["CAMPUS_NUID_LABEL", "campus", 3, (c) => /\bNUID\b|\bNU ID\b/.test(c.text)],
  ["CAMPUS_BRAND", "campus", 2, (c) => /\bNORTHEASTERN\b/.test(c.text)],
  ["CAMPUS_HUSKY_CARD", "campus", 2, (c) => /\bHUSKY ?CARD\b/.test(c.text)],
  ["CAMPUS_ID_WORDS", "campus", 2, (c) =>
    /\b(STUDENT ID|UNIVERSITY ID|CAMPUS CARD|ONE ?CARD|ID CARD)\b/.test(c.text)],
  ["CAMPUS_NUID_PATTERN", "campus", 2, (c) => /(^|[^0-9])00\d{7}([^0-9]|$)/.test(c.digitText)],

  // ── Documents carrying personal information ───────────────────────────────
  ["PII_CHEQUE", "pii", 5, (c) => /\bPAY TO THE ORDER OF\b|\bVOID AFTER\b/.test(c.text)],
  ["PII_ACCT_LABEL", "pii", 4, (c) =>
    /\b(ACCOUNT (NO|NUMBER)|ACCT\.? ?(NO|#)|ROUTING (NO|NUMBER)|ABA|IBAN|SORT CODE)\b/.test(c.text)],
  ["PII_BANK_STMT", "pii", 4, (c) =>
    /\b(STATEMENT PERIOD|BEGINNING BALANCE|ENDING BALANCE|AVAILABLE BALANCE|CURRENT BALANCE|STATEMENT OF ACCOUNT|ACCOUNT SUMMARY)\b/.test(c.text)],
  ["PII_MEDICAL", "pii", 4, (c) =>
    /\b(MEMBER ID|GROUP (NO|NUMBER)|RX ?BIN|RX ?PCN|RX ?GRP|SUBSCRIBER ID|POLICY (NO|NUMBER)|BLUE CROSS|BLUE SHIELD|MEDICARE|MEDICAID|HEALTH PLAN)\b/.test(c.text)],
  ["PII_ACCOUNT_SCREEN", "pii", 2, (c) =>
    /\b(SIGNED IN AS|LOGGED IN AS|MY ACCOUNT|ACCOUNT SETTINGS|WELCOME BACK,)\b/.test(c.text)],
  ["PII_EMAIL", "pii", 2, (c) => /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/.test(c.text)],
  ["PII_ADDRESS", "pii", 2, (c) =>
    /(^|[^0-9])\d{1,5}\s+[A-Z0-9.'-]+(?:\s+[A-Z0-9.'-]+){0,4}\s+(STREET|ST|AVENUE|AVE|ROAD|RD|BOULEVARD|BLVD|DRIVE|DR|LANE|LN|COURT|CT|WAY|TERRACE|TER|PLACE|PL|CIRCLE|CIR|APT|UNIT|SUITE|STE)\b/.test(c.text)],
  // Only counts alongside an address — a bare 5-digit run is far too common.
  ["PII_ZIP", "pii", 1, (c) =>
    /(^|[^0-9])\d{5}(-\d{4})?([^0-9]|$)/.test(c.digitText) && c.hits.has("PII_ADDRESS")],
  ["PII_PHONE", "pii", 1, (c) =>
    /(^|[^0-9])(\(\d{3}\)\s?|\d{3}[-. ])\d{3}[-. ]\d{4}([^0-9]|$)/.test(c.digitText)],
];

// ── Stage B: label and logo weights ─────────────────────────────────────────
// Labels below 0.75 and logos below 0.6 confidence are ignored entirely.

const LABEL_WEIGHTS = [
  [5, /^(identity document|identity card|id card|id cards|student card|driving licence|driver'?s license|passport|credit card|payment card|bank card|debit card|social security number)$/i],
  // Everything else scores zero. An earlier draft gave `document` and `paper`
  // +1, which put a receipt carrying one bare Luhn-valid number at exactly the
  // block threshold — a false positive produced purely by a rounding cliff.
  // Labels either strongly indicate a card or an ID, or they say nothing.
  [0, /^(document|paper|receipt|text|rectangle|plastic|material property|font|brand)$/i],
];

const LOGO_WEIGHTS = [
  [4, /^(visa|mastercard|american express|discover|maestro)$/i],
  [3, /^(chase|bank of america|wells fargo|citibank|capital one)$/i],
  [2, /^northeastern university$/i],
];

const SAFE_SEARCH_REJECT = new Set(["LIKELY", "VERY_LIKELY"]);

/**
 * The pre-existing SafeSearch rule, preserved exactly: adult or violence at
 * LIKELY and above, racy only at VERY_LIKELY. Changing these thresholds is a
 * separate product decision from this feature.
 */
export function isSafeSearchBlocked(safe) {
  if (!safe) return null;
  if (SAFE_SEARCH_REJECT.has(safe.adult)) return "SAFESEARCH_ADULT";
  if (SAFE_SEARCH_REJECT.has(safe.violence)) return "SAFESEARCH_VIOLENCE";
  if (safe.racy === "VERY_LIKELY") return "SAFESEARCH_RACY";
  return null;
}

function scoreVisionStage(stageB) {
  const hits = [];
  let points = 0;

  for (const label of stageB?.labelAnnotations || []) {
    if ((label.score ?? 0) < 0.75) continue;
    for (const [weight, re] of LABEL_WEIGHTS) {
      if (re.test(String(label.description || "").trim())) {
        if (weight > 0) {
          points += weight;
          hits.push(weight >= 5 ? "VISION_LABEL_DOCUMENT" : "VISION_LABEL_PAPER");
        }
        break;
      }
    }
  }

  for (const logo of stageB?.logoAnnotations || []) {
    if ((logo.score ?? 0) < 0.6) continue;
    for (const [weight, re] of LOGO_WEIGHTS) {
      if (re.test(String(logo.description || "").trim())) {
        points += weight;
        hits.push(weight >= 4 ? "VISION_LOGO_CARD_BRAND" : "VISION_LOGO_ISSUER");
        break;
      }
    }
  }

  return { points, hits: [...new Set(hits)] };
}

/**
 * Score one image.
 *
 * @param {{stageA: object, stageB?: object|null}} input
 *        `responses[0]` objects from the Vision images:annotate API.
 * @returns {{blocked: boolean, escalate: boolean, tier: string|null,
 *            score: number, confidence: number, reasons: string[]}}
 *
 * `reasons` contains RULE IDS ONLY, never matched substrings. This is
 * load-bearing rather than stylistic: the audit table persists this array, and
 * persisting the matched text would durably store the exact personal
 * information the image was deleted to avoid storing.
 */
export function evaluateImage({ stageA, stageB = null }) {
  const empty = {
    blocked: false,
    escalate: false,
    tier: null,
    score: 0,
    confidence: 0,
    reasons: [],
  };

  if (!stageA || stageA.error) {
    return { ...empty, reasons: ["VISION_NO_ANNOTATION"] };
  }

  // SafeSearch short-circuits: it is a different policy with its own history,
  // and mixing its signal into the document score would muddy both.
  const safeReason = isSafeSearchBlocked(stageA.safeSearchAnnotation);
  if (safeReason) {
    return {
      blocked: true,
      escalate: false,
      tier: "unsafe_content",
      score: BLOCK_THRESHOLD,
      confidence: 0.9,
      reasons: [safeReason],
    };
  }

  const rawText = stageA.fullTextAnnotation?.text ?? "";
  if (!rawText && !stageA.safeSearchAnnotation && !stageB) {
    return { ...empty, reasons: ["VISION_NO_ANNOTATION"] };
  }

  const text = normalizeOcrText(rawText);
  const ctx = {
    text,
    digitText: toDigitText(text),
    lines: rawText.slice(0, MAX_OCR_CHARS).split("\n"),
    pans: extractPanCandidates(toDigitText(text)),
    hits: new Set(),
  };

  const groupPoints = { payment: 0, gov: 0, campus: 0, pii: 0, vision: 0 };
  const reasons = [];

  // Rules run in declaration order so PII_ZIP can see whether PII_ADDRESS fired.
  for (const [id, group, points, matches] of RULES) {
    if (!matches(ctx)) continue;
    ctx.hits.add(id);
    groupPoints[group] += points;
    reasons.push(id);
  }

  if (stageB) {
    const v = scoreVisionStage(stageB);
    groupPoints.vision += v.points;
    reasons.push(...v.hits);
  }

  let score = 0;
  for (const [group, points] of Object.entries(groupPoints)) {
    score += Math.min(points, GROUP_CAPS[group]);
  }

  // The dominant group names the tier. `vision` only corroborates, so it is
  // skipped: an image blocked on label evidence alone still reports the
  // text-derived tier if there is one, and government_id otherwise.
  let tier = null;
  let best = 0;
  for (const group of ["gov", "campus", "payment", "pii"]) {
    const capped = Math.min(groupPoints[group], GROUP_CAPS[group]);
    if (capped > best) {
      best = capped;
      tier = GROUP_TIERS[group];
    }
  }
  if (!tier && groupPoints.vision > 0) tier = "government_id";

  const blocked = score >= BLOCK_THRESHOLD;

  return {
    blocked,
    escalate: !blocked && score >= ESCALATE_THRESHOLD && !stageB,
    tier: blocked ? tier : null,
    score,
    confidence: Math.min(1, Math.round((score / 12) * 100) / 100),
    reasons,
  };
}
