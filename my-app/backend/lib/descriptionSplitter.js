// ════════════════════════════════════════════════════════════════════════════
// Description auto-sorter
// ════════════════════════════════════════════════════════════════════════════
// Curry Student Center's front desk confirms an item belongs to a claimant by
// asking them to describe a detail that isn't publicly visible — "what's the
// crack on the case?", "what's in the side pocket?". If the whole description
// is on the public feed, anyone can read the specifics and parrot them back.
//
// Students write ONE description. This module splits it into:
//   external — what the feed shows, with identifying specifics removed
//   internal — the original text, for desk staff to verify a claimant against
//
// ── Three hard constraints, all load-bearing ────────────────────────────────
//
// 1. THIS FILE IMPORTS NOTHING. No `import`, no `require`, no `process`, no
//    `Buffer`, no `window`. That is what lets a byte-identical copy live at
//    src/utils/descriptionSplitter.js for the live preview in the create form,
//    with scripts/check-splitter-sync.sh able to enforce equality with `cmp`.
//    (The repo already duplicates profanityFilter.js for the same reason — and
//    those two copies have already drifted, which is why this one is checked.)
//
// 2. NO /g FLAG ON ANY DETECTOR REGEX. A /g regex keeps `lastIndex` between
//    .test() calls, so the same clause would classify differently depending on
//    what was tested before it. /g appears below only inside .replace(), which
//    resets state. A unit test asserts two consecutive calls are deep-equal.
//
// 3. NO LOOKBEHIND. Safari only shipped (?<=) in 16.4 and this runs inside the
//    iOS Capacitor WebView. Write /(^|[^0-9])(\d{5,})([^0-9]|$)/ instead of
//    /(?<!\d)\d{5,}(?!\d)/. LookAHEAD is fine and is used freely.
//
// ── The guarantee ───────────────────────────────────────────────────────────
// Redaction is CLAUSE-LEVEL and ALL-OR-NOTHING. A clause is either kept whole
// or dropped whole; nothing is masked or partially rewritten. Word-level
// redaction leaks through the skeleton it leaves behind — "engraved ▮.▮." tells
// a reader it is two initials — and makes the guarantee unauditable. Dropping
// whole clauses means "no token from a dropped clause appears in external" is
// a property a test can assert over the entire fixture corpus.
// ════════════════════════════════════════════════════════════════════════════

// ── Public constants ────────────────────────────────────────────────────────

/** Reason ids. Ordered by reporting priority: the first match wins the label. */
export const REASONS = Object.freeze({
  SECRET: "SECRET",
  IDENTIFIER: "IDENTIFIER",
  CONTACT: "CONTACT",
  MONEY: "MONEY",
  ENGRAVING: "ENGRAVING",
  SIZE: "SIZE",
  NAMED_CONTENTS: "NAMED_CONTENTS",
  ATTACHMENT_DECOR: "ATTACHMENT_DECOR",
  DAMAGE: "DAMAGE",
  SUSPICIOUS_SCRIPT: "SUSPICIOUS_SCRIPT",
});

/** Human labels for the withheld-reason chips in the create form. */
export const REASON_LABELS = Object.freeze({
  SECRET: "codes & passwords",
  IDENTIFIER: "numbers & IDs",
  CONTACT: "contact info",
  MONEY: "money",
  ENGRAVING: "engravings & names",
  SIZE: "size",
  NAMED_CONTENTS: "contents",
  ATTACHMENT_DECOR: "stickers & charms",
  DAMAGE: "marks & damage",
  SUSPICIOUS_SCRIPT: "unrecognised characters",
});

// Shown on the feed when every clause redacted away. Deliberately 74 chars —
// under the feed card's 100-char truncation, so it never clips mid-word.
export const EMPTY_EXTERNAL_FALLBACK =
  "Details withheld — describe this item at the Curry front desk to claim it.";

// ── Normalization ───────────────────────────────────────────────────────────
// Everything here feeds MATCHING only. The text that survives into `external`
// is always sliced verbatim from the input — never a normalized form.

// Mirrors INVISIBLE_CHARS_RE in lib/validation.js. Duplicated rather than
// imported because of constraint 1 above.
const INVISIBLE_RE =
  /[­͏ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

// Cyrillic and Greek characters that render as Latin. A student who types
// "оwner" with a Cyrillic о is trying to dodge a keyword match.
const HOMOGLYPHS = {
  а: "a", в: "b", е: "e", ё: "e", к: "k", м: "m", н: "h", о: "o", р: "p",
  с: "c", т: "t", у: "y", х: "x", і: "i", ѕ: "s", ԁ: "d", ᴏ: "o", ј: "j",
  Α: "a", Β: "b", Ε: "e", Ζ: "z", Η: "h", Ι: "i", Κ: "k", Μ: "m", Ν: "n",
  Ο: "o", Ρ: "p", Τ: "t", Υ: "y", Χ: "x", α: "a", ν: "v", ο: "o", ρ: "p",
  τ: "t", ε: "e", ι: "i", κ: "k", μ: "m", σ: "s", υ: "u",
};

const DIGIT_WORDS_RE = /\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/g;
const DIGIT_WORD_VALUES = {
  zero: "0", oh: "0", one: "1", two: "2", three: "3", four: "4",
  five: "5", six: "6", seven: "7", eight: "8", nine: "9",
};

// 5+ consecutive single-character tokens: "F 2 L X 9", "s-e-r-i-a-l".
// Natural English essentially never produces this, so collapsing only WITHIN
// the match is safe. Collapsing a whole clause is not: "black jansport 32oz
// bottle" would become "blackjansport32ozbottle", which looks like a serial.
const SPACED_RUN_RE = /(?:[a-z0-9][\s.\-_*·]+){4,}[a-z0-9]/gi;

function stripInvisible(s) {
  return s.replace(INVISIBLE_RE, "");
}

/** Lowercased, homoglyph-folded, NFKD-flattened form. Used by keyword rules. */
function normalize(s) {
  const folded = stripInvisible(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "");
  let out = "";
  for (const ch of folded) out += HOMOGLYPHS[ch] || ch;
  return out.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Digit-oriented form. Spells out digit-words, collapses separators that sit
 * BETWEEN digits, and collapses spaced-out identifier runs. Used only by the
 * numeric detectors, never by keyword ones.
 */
function digitize(norm) {
  return norm
    .replace(DIGIT_WORDS_RE, (m) => DIGIT_WORD_VALUES[m])
    .replace(/(\d)[\s.\-_]+(?=\d)/g, "$1")
    .replace(SPACED_RUN_RE, (m) => m.replace(/[\s.\-_*·]/g, ""));
}

// ── Segmentation ────────────────────────────────────────────────────────────
// A hand-rolled scanner rather than String.split(regex).
//
// Why: split() cannot express the guards a period needs. Treating "." as a
// hard break would cut "engraved J.R. on the back" into "engraved J" / "R" /
// "on the back" — the first redacts on "engraved", and "R. on the back"
// survives. That is precisely the skeleton leak clause-level redaction exists
// to prevent. Expressing "a period that is not an initial or a decimal"
// requires looking at the PRECEDING characters, and lookbehind is banned
// (constraint 3). A scanner has the preceding characters in hand for free.

const HARD_PUNCT_RE = /^(\s*)([.;!?\n—–•]+)(\s*)/;
const COMMA_RE = /^(\s*,\s*)/;
const CONNECTOR_RE =
  /^(\s+(?:and|&|plus|also|but|with|w\/a|w\/|containing|contains|holding|holds|carrying|that\s+has|which\s+has|has)\s+)/i;

// Connectors that mean "the next clause is the CONTENTS of this one".
// Note the explicit (^|\s)...(\s|$) rather than \b: "w/" ends in a slash, and
// \b after a non-word character never matches, so /\bw\/\b/ is dead.
const CONTAINER_SEP_RE =
  /(^|\s)(with|w\/a|w\/|containing|contains|holding|holds|carrying|has)(\s|$)/i;

// A clause whose own text opens a contents list, for when the separator slot
// was already taken by a comma.
const CONTAINER_HEAD_RE =
  /^\s*(with|w\/a|w\/|has|have|holds|holding|contains|containing|carrying|packed\s+with)\b/i;

// Coordinators that continue a list rather than starting a new thought.
const BARE_COORDINATOR_RE = /^(\s*,\s*|\s+(?:and|&|plus|also)\s+)$/i;

const isDigit = (c) => c >= "0" && c <= "9";
const isLetter = (c) => /[a-z]/i.test(c || "");

/**
 * Does a separator start at `i`? Returns { sep, hard } or null.
 * `text` and `i` give access to the preceding character, which is what makes
 * the period and comma guards possible.
 */
function separatorAt(text, i) {
  const rest = text.slice(i);
  const prev = i > 0 ? text[i - 1] : "";

  const hard = HARD_PUNCT_RE.exec(rest);
  if (hard) {
    const [full, lead, punct, trail] = hard;
    // A run of two or more, or any non-period punctuation, always breaks.
    const isBarePeriod = punct === ".";
    if (!isBarePeriod) return { sep: full, hard: true };

    const next = text[i + full.length] || "";
    const prevPrev = i > 1 ? text[i - 2] : "";

    // "3.5", "1.99" — a decimal, not a sentence end.
    if (isDigit(prev) && isDigit(next) && !lead && !trail) return null;
    // "J.R.", "e.g." — no space after the period and a letter follows.
    if (!trail && isLetter(next)) return null;
    // "J. R." — the token before the period is a single letter, so it is an
    // initial rather than a word ending. Catches the spaced form too.
    if (isLetter(prev) && !isLetter(prevPrev) && !isDigit(prevPrev)) return null;

    return { sep: full, hard: true };
  }

  const comma = COMMA_RE.exec(rest);
  if (comma) {
    const next = text[i + comma[0].length] || "";
    // "1,234" — digit grouping, not a clause break.
    if (isDigit(prev) && isDigit(next) && comma[0] === ",") return null;
    return { sep: comma[0], hard: false };
  }

  const conn = CONNECTOR_RE.exec(rest);
  if (conn) return { sep: conn[0], hard: false };

  return null;
}

/**
 * Split into clause records. Concatenating every `text + sep` in order
 * reproduces the input exactly — the reassembly step relies on that.
 */
function segment(text) {
  const clauses = [];
  let buf = "";
  let prevSep = "";
  let i = 0;

  while (i < text.length) {
    const m = separatorAt(text, i);
    if (m) {
      clauses.push({ text: buf, sep: m.sep, hard: m.hard, prevSep });
      buf = "";
      prevSep = m.sep;
      i += m.sep.length;
    } else {
      buf += text[i];
      i += 1;
    }
  }
  clauses.push({ text: buf, sep: "", hard: false, prevSep });

  // Blank clauses (two adjacent separators, or a leading one) are NOT filtered
  // out here — reassemble() indexes into this array to find the separator that
  // preceded each clause, and removing entries would misalign that. They are
  // suppressed during reassembly instead.
  return clauses;
}

// ── Detectors ───────────────────────────────────────────────────────────────
// Every rule below answers one question: does this clause contain something a
// front-desk worker could use to tell a real owner from a thief? If yes, the
// clause is desk-only.

// A. Announcement words. The WORD alone redacts, whether or not a value
// follows — which is what makes every spaced-out / homoglyph / spelled-digit
// evasion of the VALUE moot. You cannot hide a serial number without saying
// "serial", and if you don't say it, nobody knows what the string is either.
const IDENTIFIER_HINT_RE =
  /\b(serial(?:\s*(?:no|num|number|#))?|s\/n|imei|meid|iccid|udid|mac\s*address|service\s*tag|model\s*(?:no|num|number|#)|part\s*(?:no|number)|vin|nuid|n\.u\.i\.d|husky\s*(?:card|id)\s*(?:no|number|#)|student\s*(?:id|number)|passport\s*(?:no|number)?|licen[cs]e\s*(?:no|number|plate)?|plate\s*(?:no|number)?|account\s*(?:no|number)|routing|iban|last\s*(?:4|four)|ends?\s*(?:in|with)|cvv|expiry\s*date)\b/i;

const SECRET_HINT_RE =
  /\b(pin|passcode|password|passphrase|pass\s*code|unlock\s*code|combo|combination|lock\s*code|screen\s*lock|lock\s*screen|home\s*screen|wallpaper|screensaver|face\s*id|touch\s*id|background\s*(?:is|photo|picture|image)|photo\s*of\s*(?:my|a|the)|picture\s*of\s*(?:my|a|the))\b/i;

// De-spaced forms, for when "s e r i a l" collapsed to "serial". Only entries
// of 4+ unambiguous characters — "sn", "pin", "vin" would match "pinstripe".
const HINT_DESPACED_RE =
  /(serialnumber|serialno|serial|imei|iccid|meid|udid|servicetag|modelnumber|nuid|studentid|lockscreen|passcode|password|passphrase|lastfour|last4|routingnumber|accountnumber)/i;

// B. Identifier-shaped values with no announcement word.
const LONG_DIGITS_RE = /(^|[^0-9])(\d{5,})([^0-9]|$)/;
const PHONE_RE = /(^|[^0-9])(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}([^0-9]|$)/;
const EMAIL_RE = /[a-z0-9._%+-]+\s?@\s?[a-z0-9.-]+\.[a-z]{2,}/i;
const URL_HANDLE_RE = /(https?:\/\/|www\.)\S+|(^|\s)@[a-z0-9_]{3,}\b/i;

// A bare 4-digit run is only a secret in context. Blanket 4-digit redaction
// eats "Room 204", "2024 planner" and "TI-84".
const FOUR_DIGIT_CONTEXT_RE =
  /\b(pin|code|combo|combination|last\s*4|last\s*four|ends?\s*(?:in|with)|card|debit|credit|acct|account|zip)\b/i;
const BARE_FOUR_DIGITS_RE = /(^|[^0-9])(\d{4})([^0-9]|$)/;

// Token shapes that are NOT serials despite mixing letters and digits.
const UNIT_TOKEN_RE = /^\d+(?:st|nd|rd|th|in|inch|inches|cm|mm|ft|oz|ml|lb|lbs|kg|gb|tb|mb|mah|hz|hr|hrs|min|am|pm|x)$/;
const MODEL_TOKEN_RE = /^(?:ti|gtx|rtx|rx|se|xr|xs|iphone|ipad|galaxy|pixel|size|us|eu|uk|usb|type|mk|gen|v|rev)-?\d{1,4}[a-z]{0,2}$/;
const WORD_THEN_NUMBER_RE = /^[a-z]{4,}\d{1,4}[a-z]{0,2}$/;

/** A token that looks like a serial rather than a model name or a measurement. */
function looksLikeSerial(tok) {
  if (tok.length < 6) return false;
  if (UNIT_TOKEN_RE.test(tok) || MODEL_TOKEN_RE.test(tok)) return false;
  const digits = (tok.match(/\d/g) || []).length;
  const letters = (tok.match(/[a-z]/g) || []).length;
  if (digits < 2 || letters < 2) return false;
  // "iphone14", "chem2311", "room204b" — a real word followed by a number.
  if (WORD_THEN_NUMBER_RE.test(tok)) return false;
  return true;
}

// C. Money. There is no legitimate public reason to state an amount, and "how
// much cash was in it" is a classic desk verification question.
const MONEY_RE =
  /(\$\s?\d|(^|[^a-z])\d+(?:\.\d{2})?\s?(?:dollars?|bucks?|usd)\b|\b(?:twenty|thirty|forty|fifty|hundred)\s+(?:dollars?|bucks?)\b|\bcash\b|\bbills?\b|\bgift\s*card\b)/i;

// D. Engravings, monograms, names. Whole-clause redaction drops the name
// together with the word announcing it, so no skeleton is left behind.
// A physical mark on the item. Always withheld, even when the text of the mark
// is not stated: "engraved on the back" is itself the desk's question.
const INSCRIPTION_RE =
  /\b(engrav\w*|monogram\w*|initials?|inscri\w*|etched|embossed|stamped|signed|marked\s*with)\b/i;

// Merely announcing a name. Handled more leniently than an inscription —
// see isWithheldName().
const NAME_HINT_RE =
  /\b(labell?ed|name\s*(?:tag|label)|name\s*(?:is|written|on)|written\s*(?:on|in|inside)|printed\s*(?:on|in)|says?|reads?|spells?)\b/i;

const INITIALS_RE = /(^|[^a-z])[a-z]\s*\.\s*[a-z]\s*\.?([^a-z]|$)/i;

// Words that routinely follow "says" / "written on" without being a name.
const NOT_A_NAME = new Set([
  "the", "a", "an", "my", "his", "her", "their", "in", "on", "it", "is", "was",
  "inside", "outside", "front", "back", "top", "bottom", "side", "left", "right",
  "and", "with", "of", "to", "for", "something", "nothing", "someone",
]);

/**
 * A first name alone may stay public; anything more may not.
 *
 * Product decision: "Jamie's backpack" helps reunite an item and is weak
 * identification on its own, while "Jamie Rodriguez" or the initials "J.R."
 * are exactly what the desk would ask a claimant to produce.
 *
 * Scoped deliberately: this only ever runs on a clause that ALREADY matched a
 * name hint. It is not a general proper-noun detector — one of those would
 * fire on Snell, Boston, Dunkin and every brand in the catalogue.
 *
 * @returns true when the clause names more than a first name.
 */
function isWithheldName(raw, norm) {
  if (INITIALS_RE.test(norm)) return true;

  // Count capitalised tokens after the announcing word, in the ORIGINAL text —
  // casing is the only signal distinguishing "says Jamie" from "says hello".
  const after = raw.split(/\b(?:says?|reads?|is|tag|label|labell?ed|written|printed|spells?)\b/i).pop() || "";
  const names = after
    .split(/[^A-Za-z'’]+/)
    .filter((t) => t.length > 1 && /^[A-Z]/.test(t) && !NOT_A_NAME.has(t.toLowerCase()));

  return names.length > 1;
}

// F2. Stated size. A labelled size is something an owner knows and a passer-by
// does not, so it belongs to the desk — "what size is it?" is a good
// verification question. Note this catches a STATED size ("size medium",
// "men's 10"), not an adjective: "large navy backpack" stays public, because
// that is a visible property anyone reading the feed can use to spot the item.
const SIZE_RE =
  /\b(size[sd]?|sz)\b|\b(x{1,3}-?l|xs)\b|\b(?:men'?s|women'?s|mens|womens)\s*\d{1,2}(?:\.5)?\b/i;

// E. Contents. CONTAINMENT ALONE IS SUFFICIENT — no noun allowlist.
//
// This is the most consequential rule here. "What's in the side pocket?" is
// THE desk verification question. A noun allowlist is a permanent
// false-negative generator: "my grandmother's thimble inside" sails through
// any list anyone would think to write. Containment-as-sufficient is
// fail-closed and needs no maintenance.
//
// The cost is over-redaction of structural features — "jacket with a hood"
// loses "a hood". Accepted: the item type and colour survive, which is what
// the feed needs. This is the rule most worth revisiting against production
// data; the structured log in the POST handler exists to make that possible.
const CONTAINMENT_RE =
  /\b(inside|in\s*(?:it|there|the\s*(?:bag|case|pocket|sleeve|pouch|wallet|purse|backpack|front|side|main))|contains?|containing|holds?|holding|carrying|packed\s*with|(?:side|front|main|back|zip|hidden|inner|outer)\s*pocket|pocket)\b/i;

// Sensitive regardless of containment — these are never safe to advertise.
const SENSITIVE_NOUN_RE =
  /\b(passport|licen[cs]e|husky\s*card|charlie\s*card|debit|credit\s*card|social\s*security|ssn|insulin(?:\s*pen)?|epi-?pen|inhaler|prescription|medication|meds|syringe|hearing\s*aid|narcan|naloxone)\b/i;

// F. Decor. The single highest-value verification detail in a real
// lost-and-found — nobody guesses "the blue dolphin keychain".
//
// Name tags are deliberately NOT here. They carry a name, and names have their
// own policy: a first name may stay public, more than that may not. Leaving
// them in this list would withhold every name tag regardless.
// Every singular alternative needs an explicit s?: the group is followed by
// \b, so "enamel pin" inside "enamel pins" fails the boundary and the whole
// alternation backtracks to no match. Plurals are the common phrasing here
// ("three enamel pins", "two keychains"), so this is not a corner case.
const DECOR_RE =
  /\b(sticker\w*|decal\w*|charm\w*|key\s*chains?|keychains?|key\s*rings?|keyrings?|fobs?|enamel\s*pins?|pin\s*badges?|patch(?:es)?|bead\w*|tassel\w*|dangles?|lanyards?|popsockets?|pop\s*sockets?|phone\s*grips?|air\s*tags?|airtags?|tile\s*trackers?|luggage\s*tags?|bag\s*tags?|ribbons?|trinkets?|figurines?|plush(?:ies|ie|es)?|button\s*pins?)\b/i;

// G. Damage, but only when it is LOCATED or QUANTIFIED. This seam is what
// keeps general condition public: "a little worn", "scratched up", "used but
// fine" stay on the feed, while "small tear on left strap" does not.
const DAMAGE_RE =
  /\b(crack\w*|chip(?:ped|s)?|scratch(?:ed|es)?|scuff\w*|dent\w*|tear|torn|rip(?:ped|s)?|frayed?|fraying|stain\w*|burn\s*mark|water\s*damage|missing\s+\w+|broken|bent|hole|peeling|discolou?red|faded\s+spot|smudge)\b/i;
const LOCATOR_RE =
  /\b(top|bottom|left|right|upper|lower|corner|edge|side|back|front|strap|zipper|zip|handle|sleeve|screen|lid|spine|cover|band|clasp|toe|heel|sole|hinge|pocket|lens|arm|temple|bezel|near|by|along|under|above|next\s*to|around)\b/i;
const QUANTIFIER_RE =
  /\b(small|tiny|little|big|large|long|thin|hairline|deep|shallow|one|two|three|couple|few|\d+)\b/i;

// H. Mixed scripts inside a single token, after homoglyph folding. Campus
// lost-and-found text has no reason to interleave alphabets inside a word, so
// this fails closed on obfuscation the homoglyph map missed. Scoped to
// INTRA-token so a legitimately non-Latin clause is untouched.
const NON_LATIN_RE = /[Ѐ-ӿͰ-Ͽ]/;

/**
 * Classify one clause. Returns a reason id, or null to keep it.
 * `prev` is the normalized text of the preceding clause — only the 4-digit
 * rule looks at it, for "the code is" / "1234" split across a comma.
 */
function classify(clause, opts, prev) {
  const raw = clause.text;
  const norm = normalize(raw);
  if (!norm) return null;

  const dig = digitize(norm);
  const tokens = dig.split(/[^a-z0-9]+/).filter(Boolean);
  const containerBefore = CONTAINER_SEP_RE.test(clause.prevSep || "");

  // A — announcement words
  if (SECRET_HINT_RE.test(norm) || (HINT_DESPACED_RE.test(dig) && /pass|lock/i.test(dig))) {
    return REASONS.SECRET;
  }
  if (IDENTIFIER_HINT_RE.test(norm) || HINT_DESPACED_RE.test(dig)) {
    return REASONS.IDENTIFIER;
  }

  // B — identifier shapes
  if (EMAIL_RE.test(norm) || URL_HANDLE_RE.test(norm)) return REASONS.CONTACT;
  if (PHONE_RE.test(dig)) return REASONS.IDENTIFIER;
  if (LONG_DIGITS_RE.test(dig)) return REASONS.IDENTIFIER;
  if (tokens.some(looksLikeSerial)) return REASONS.IDENTIFIER;
  if (
    BARE_FOUR_DIGITS_RE.test(dig) &&
    (FOUR_DIGIT_CONTEXT_RE.test(norm) || FOUR_DIGIT_CONTEXT_RE.test(prev || ""))
  ) {
    return REASONS.IDENTIFIER;
  }

  // C — money
  if (MONEY_RE.test(norm)) return REASONS.MONEY;

  // D — engravings and names
  // An inscription is always withheld. A name is withheld only when it is more
  // than a first name.
  if (INSCRIPTION_RE.test(norm)) return REASONS.ENGRAVING;
  if (NAME_HINT_RE.test(norm) && isWithheldName(raw, norm)) return REASONS.ENGRAVING;
  if (INITIALS_RE.test(norm)) return REASONS.ENGRAVING;

  // F2 — stated size
  if (SIZE_RE.test(norm)) return REASONS.SIZE;

  // E — contents
  if (SENSITIVE_NOUN_RE.test(norm)) {
    // A listing whose category already says "Husky Card" publicly is not
    // leaking anything by repeating it. Demotion applies ONLY here — never to
    // identifiers, money, engravings, decor or damage.
    const demoted = normalize(`${opts.category || ""} ${opts.title || ""}`);
    const onlyMatch = norm.match(SENSITIVE_NOUN_RE);
    if (!(onlyMatch && demoted.includes(onlyMatch[0]))) {
      return REASONS.NAMED_CONTENTS;
    }
  }
  if (containerBefore || CONTAINMENT_RE.test(norm)) return REASONS.NAMED_CONTENTS;

  // F — decor
  if (DECOR_RE.test(norm)) return REASONS.ATTACHMENT_DECOR;

  // G — located or quantified damage
  if (DAMAGE_RE.test(norm) && (LOCATOR_RE.test(norm) || QUANTIFIER_RE.test(norm))) {
    return REASONS.DAMAGE;
  }

  // H — intra-token script mixing
  for (const tok of stripInvisible(raw).split(/\s+/)) {
    if (NON_LATIN_RE.test(tok) && /[a-z]/i.test(tok)) return REASONS.SUSPICIOUS_SCRIPT;
  }

  return null;
}

/**
 * Find clauses that are part of a CONTENTS LIST but don't say so themselves.
 *
 * "backpack with keys, wallet and a laptop inside" segments into
 *   backpack │with│ keys │,│ wallet │and│ a laptop inside
 * Only the last clause contains "inside", so classify() alone keeps "keys"
 * and "wallet" — leaking exactly what the desk would ask about.
 *
 * A list opens at a clause introduced by a container separator ("with", "has",
 * "containing") and closes at the first clause that states containment itself.
 * Everything in between is contents. If no clause in the run ever states
 * containment, only the opening clause is taken — that restraint is what stops
 * "black pouch with an insulin pen inside, urgent" from eating "urgent", and
 * "w/ blue dolphin, small tear on left strap" from over-reaching.
 */
function contentsListDrops(clauses) {
  const forced = new Set();

  for (let i = 0; i < clauses.length; i += 1) {
    // A list opens either because the SEPARATOR was a container word, or
    // because the clause itself STARTS with one. The second case matters more
    // than it looks: in "...around 3pm, has a math textbook and a calculator
    // inside", the comma is consumed first, so "has" ends up at the head of
    // the clause rather than in the separator and the list would never open.
    const opensList =
      CONTAINER_SEP_RE.test(clauses[i].prevSep || "") ||
      CONTAINER_HEAD_RE.test(clauses[i].text);
    if (!opensList) continue;

    const run = [i];
    let closed = CONTAINMENT_RE.test(normalize(clauses[i].text));
    let j = i;

    while (!closed) {
      const next = j + 1;
      if (next >= clauses.length) break;
      if (clauses[j].hard) break; // a sentence boundary ends the list
      if (!BARE_COORDINATOR_RE.test(clauses[next].prevSep || "")) break;
      run.push(next);
      if (CONTAINMENT_RE.test(normalize(clauses[next].text))) closed = true;
      j = next;
    }

    if (closed) run.forEach((k) => forced.add(k));
    else forced.add(i);
  }

  return forced;
}

// ── Reassembly ──────────────────────────────────────────────────────────────

const LEADING_CONNECTOR_RE = /^\s*(?:and|but|with|w\/a|w\/|plus|also|&|,)\s+/i;
const TRAILING_CONNECTOR_RE = /\s+(?:and|but|with|w\/a|w\/|plus|also|&)\s*$/i;

/**
 * Emit runs of consecutive kept clauses joined by their ORIGINAL separators,
 * so a run is byte-identical to its source. Runs are then joined by ". " if a
 * hard break fell in the gap between them, otherwise ", ".
 */
function reassemble(clauses, dropped) {
  const runs = [];
  let current = null;
  let pendingHard = false;

  for (let i = 0; i < clauses.length; i += 1) {
    const clause = clauses[i];
    // The separator immediately before this clause is the one that FOLLOWS the
    // previous clause, so its hardness lives on clauses[i - 1].
    const sepBeforeIsHard = i > 0 ? clauses[i - 1].hard : false;

    if (dropped[i]) {
      if (current) {
        runs.push(current);
        current = null;
      }
      pendingHard = pendingHard || sepBeforeIsHard || clause.hard;
      continue;
    }

    if (current) {
      // Still inside a run: re-emit the original separator verbatim, which is
      // what makes an unredacted run byte-identical to its source.
      current.text += clause.prevSep + clause.text;
    } else {
      current = { text: clause.text, hardGapBefore: pendingHard || sepBeforeIsHard };
      pendingHard = false;
    }
  }
  if (current) runs.push(current);

  let out = "";
  runs.forEach((run, idx) => {
    if (idx > 0) out += run.hardGapBefore ? ". " : ", ";
    out += run.text;
  });

  out = out
    .replace(/\s{2,}/g, " ")
    .replace(LEADING_CONNECTOR_RE, "")
    .replace(TRAILING_CONNECTOR_RE, "")
    .replace(/[\s,;]+$/, "")
    .trim();

  return out;
}

// ── Entry point ─────────────────────────────────────────────────────────────

/**
 * Split a description into its public and desk-only halves.
 *
 * @param {string} text  What the student typed.
 * @param {{category?: string, title?: string}} [opts]
 *        The listing's category and title. Used ONLY to demote a
 *        sensitive-noun match that the category chip already states publicly
 *        (a "Husky Card" listing saying "husky card"). Never demotes anything
 *        else.
 * @returns {{external: string, internal: string, withheld: string[]}}
 *          `external` is "" when everything redacted — the CALLER substitutes
 *          EMPTY_EXTERNAL_FALLBACK, so that copy lives in exactly one place
 *          and the preview panel can detect the empty case.
 */
export function splitDescription(text, opts = {}) {
  const source = typeof text === "string" ? stripInvisible(text).trim() : "";
  if (!source) return { external: "", internal: "", withheld: [] };

  const clauses = segment(source);
  const dropped = new Array(clauses.length).fill(false);
  const withheld = [];
  const inContentsList = contentsListDrops(clauses);

  for (let i = 0; i < clauses.length; i += 1) {
    // Blank clauses come from two adjacent separators. Suppress them from the
    // output without treating them as a redaction.
    if (clauses[i].text.trim() === "") {
      dropped[i] = true;
      continue;
    }

    const prevNorm = i > 0 ? normalize(clauses[i - 1].text) : "";
    const reason =
      classify(clauses[i], opts, prevNorm) ||
      (inContentsList.has(i) ? REASONS.NAMED_CONTENTS : null);

    if (reason) {
      dropped[i] = true;
      if (!withheld.includes(reason)) withheld.push(reason);
    }
  }

  // Keyed off withheld rather than `dropped`, which also carries blanks.
  const anyRedacted = withheld.length > 0;
  if (!anyRedacted) return { external: source, internal: source, withheld };

  let external = reassemble(clauses, dropped);

  // A terminal period signals truncation. Only added when something was
  // actually withheld, so a description with nothing to hide is a strict
  // byte-identical round trip — an invariant the test suite asserts.
  if (external && !/[.!?]$/.test(external)) external += ".";

  return { external, internal: source, withheld };
}

/**
 * Detect-only helper for fields that must be REJECTED rather than redacted —
 * title and found_at. A redacted title is useless on a feed card, and unlike
 * the description there is no second field for the detail to move into, so the
 * POST handler bounces the submit and tells the student where it belongs.
 */
export function containsWithheldDetail(text, opts = {}) {
  return splitDescription(text, opts).withheld.length > 0;
}
