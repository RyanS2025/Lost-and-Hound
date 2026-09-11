// ════════════════════════════════════════════════════════════════════════════
// Description splitter corpus — THIS IS THE SPEC
// ════════════════════════════════════════════════════════════════════════════
// The classifier is a security boundary, so a rule change is a security
// change. Every rule tweak should add a case here; the invariants in
// descriptionSplitter.test.js then run over all of them automatically.
//
// ⚠️  CI HAZARD: scripts/check-location-embeds.sh greps every .js file under
// my-app/ for the literal substring "locations" followed by "(" and fails the
// build on any hit, with no filtering for comments or string literals. Do not
// use that substring in any fixture, however natural it reads.
// ════════════════════════════════════════════════════════════════════════════

/**
 * Each case: { name, input, opts, external, withheld }
 *   external — expected public text. `null` means "expected to redact to
 *              nothing", i.e. the caller substitutes EMPTY_EXTERNAL_FALLBACK.
 *   withheld — expected reason ids, in first-seen clause order.
 */
export const CORPUS = [
  // ── The worked examples from the design ───────────────────────────────────
  {
    name: "fragmentary comma list",
    input:
      "black jansport, math textbook inside, keychain w/ blue dolphin, small tear on left strap",
    opts: {},
    external: "black jansport.",
    withheld: ["NAMED_CONTENTS", "ATTACHMENT_DECOR", "DAMAGE"],
  },
  {
    name: "container separator keeps the brand and colour public",
    input:
      "Navy blue North Face backpack with a laptop and notebooks inside. Found on a chair near the printing station.",
    opts: {},
    external:
      "Navy blue North Face backpack. Found on a chair near the printing station.",
    withheld: ["NAMED_CONTENTS"],
  },
  {
    name: "model name survives, serial and lock screen do not",
    input:
      "iPhone 14 Pro, space black, serial F2LX9K2M, lock screen is a photo of my dog",
    opts: {},
    external: "iPhone 14 Pro, space black.",
    withheld: ["IDENTIFIER", "SECRET"],
  },
  {
    name: "all specifics redacts to nothing",
    input: "NUID 001234567, engraved J.R. on the back, $40 cash in the billfold",
    opts: {},
    external: null,
    withheld: ["IDENTIFIER", "ENGRAVING", "MONEY"],
  },
  {
    // A stated size is a desk detail: "what size is it?" is a good
    // verification question, and an owner knows the answer. General condition
    // and the location stay public — they help someone spot the item.
    name: "stated size is withheld, condition and location are not",
    input:
      "Grey Patagonia fleece, size medium, a little faded but in good shape. Found on a bench outside Snell.",
    opts: {},
    external:
      "Grey Patagonia fleece, a little faded but in good shape. Found on a bench outside Snell.",
    withheld: ["SIZE"],
  },
  {
    name: "evasion — spaced serial, spelled digits, Cyrillic homoglyph",
    input:
      "blue case, s e r i a l  i s  F 2 L X, nuid is zero zero one two three four five six seven, оwner sticker",
    opts: {},
    external: "blue case.",
    withheld: ["IDENTIFIER", "ATTACHMENT_DECOR"],
  },
  {
    name: "trailing clause after a contents list survives",
    input:
      "Lost my black leather wallet, has my Charlie card and debit card inside, please help",
    opts: {},
    external: "Lost my black leather wallet, please help.",
    withheld: ["NAMED_CONTENTS"],
  },
  {
    name: "medical item redacts but urgency survives",
    input: "black pouch with an insulin pen inside, urgent",
    opts: {},
    external: "black pouch, urgent.",
    withheld: ["NAMED_CONTENTS"],
  },

  // ── Contents-list scoping ─────────────────────────────────────────────────
  {
    name: "contents list — only the last clause says 'inside'",
    input: "backpack with keys, wallet and a laptop inside",
    opts: {},
    external: "backpack.",
    withheld: ["NAMED_CONTENTS"],
  },
  {
    name: "contents list closes at the clause that states containment",
    input: "grey North Face jacket with a hood, found by the stairs",
    opts: {},
    external: "grey North Face jacket, found by the stairs.",
    withheld: ["NAMED_CONTENTS"],
  },

  // ── False-positive canaries: these must NOT redact ────────────────────────
  {
    name: "FP — room number, year, and a calculator model",
    input: "Room 204, found a 2024 planner and a TI-84",
    opts: {},
    external: "Room 204, found a 2024 planner and a TI-84",
    withheld: [],
  },
  {
    name: "FP — measurements and a course code",
    input: "13-inch MacBook, 32oz Hydroflask, CHEM 2311 notebook",
    opts: {},
    external: "13-inch MacBook, 32oz Hydroflask, CHEM 2311 notebook",
    withheld: [],
  },
  {
    name: "FP — category demotion for a legitimate Husky Card listing",
    input: "Husky Card found near Snell",
    opts: { category: "Husky Card" },
    external: "Husky Card found near Snell",
    withheld: [],
  },
  {
    name: "FP canary — nothing to withhold, byte-identical round trip",
    input:
      "Grey Patagonia fleece, a little faded but in good shape. Found on a bench outside Snell.",
    opts: {},
    external:
      "Grey Patagonia fleece, a little faded but in good shape. Found on a bench outside Snell.",
    withheld: [],
  },
  {
    name: "a first name may stay public",
    input: "black backpack, name tag says Jamie",
    opts: {},
    external: "black backpack, name tag says Jamie",
    withheld: [],
  },
  {
    name: "a full name may not",
    input: "black backpack, name tag says Jamie Rodriguez",
    opts: {},
    external: "black backpack.",
    withheld: ["ENGRAVING"],
  },
  {
    name: "initials are a full name, not a first name",
    input: "blue jacket, the initials A.K. inside the flap",
    opts: {},
    external: "blue jacket.",
    withheld: ["ENGRAVING"],
  },
  {
    name: "an engraving is withheld even with no name stated",
    input: "silver ring, engraved on the inner band",
    opts: {},
    external: "silver ring.",
    withheld: ["ENGRAVING"],
  },
  {
    name: "shoe size is a stated size",
    input: "running shoes, men's 10, blue laces",
    opts: {},
    external: "running shoes, blue laces.",
    withheld: ["SIZE"],
  },
  {
    name: "FP — an adjectival size is not a stated size",
    input: "Large navy Fjallraven Kanken backpack, found near the printers",
    opts: {},
    external: "Large navy Fjallraven Kanken backpack, found near the printers",
    withheld: [],
  },
  {
    name: "FP — bare condition words are not located damage",
    input: "old scratched up water bottle, pretty worn",
    opts: {},
    external: "old scratched up water bottle, pretty worn",
    withheld: [],
  },
  {
    name: "FP — a decimal is not a sentence boundary",
    input: "clear water bottle, about 1.5 litres, lid is cloudy",
    opts: {},
    external: "clear water bottle, about 1.5 litres, lid is cloudy",
    withheld: [],
  },

  // ── Things that must redact ───────────────────────────────────────────────
  {
    name: "Husky Card category does NOT demote an NUID",
    input: "Husky Card, NUID 001234567",
    opts: { category: "Husky Card" },
    external: "Husky Card.",
    withheld: ["IDENTIFIER"],
  },
  {
    name: "initials are not split into a leaking skeleton",
    input: "silver ring, engraved J.R. on the inner band",
    opts: {},
    external: "silver ring.",
    withheld: ["ENGRAVING"],
  },
  {
    name: "located damage redacts, item identity survives",
    input: "black Hydroflask with a dent near the bottom",
    opts: {},
    external: "black Hydroflask.",
    withheld: ["NAMED_CONTENTS"],
  },
  {
    name: "phone number is contact info",
    input: "blue notebook, my number is 617-555-0143",
    opts: {},
    external: "blue notebook.",
    withheld: ["IDENTIFIER"],
  },
  {
    name: "email address is contact info",
    input: "grey laptop sleeve, email me at student@northeastern.edu",
    opts: {},
    external: "grey laptop sleeve.",
    withheld: ["CONTACT"],
  },
  {
    name: "four digits redact only with card context",
    input: "brown wallet, card ends in 4821",
    opts: {},
    external: "brown wallet.",
    withheld: ["IDENTIFIER"],
  },
  {
    // "airtag in the front pouch" states containment AND is decor; containment
    // has the higher reporting priority, so both chips show.
    name: "AirTag and stickers are high-value verification details",
    input: "black Samsonite suitcase, airtag in the front pouch, three enamel pins",
    opts: {},
    external: "black Samsonite suitcase.",
    withheld: ["NAMED_CONTENTS", "ATTACHMENT_DECOR"],
  },

  // ── Structural edge cases ─────────────────────────────────────────────────
  {
    name: "empty input",
    input: "",
    opts: {},
    external: "",
    withheld: [],
  },
  {
    name: "separators only",
    input: ", , .",
    opts: {},
    external: ", , .",
    withheld: [],
  },
  {
    name: "no separators at all — one clause, all or nothing",
    input: "small black umbrella",
    opts: {},
    external: "small black umbrella",
    withheld: [],
  },
  {
    name: "maximal 400-char description",
    input:
      "Large navy Fjallraven Kanken backpack, slightly faded from sun, found on the second floor of Snell Library near the printers around 3pm, has a math textbook and a calculator inside, a white AirPods case in the front pocket, three enamel pins on the strap, a hairline crack along the bottom-right corner, and the initials A.K. written inside the flap in silver sharpie, please return it to the desk",
    opts: {},
    external:
      "Large navy Fjallraven Kanken backpack, slightly faded from sun, found on the second floor of Snell Library near the printers around 3pm, please return it to the desk.",
    withheld: ["NAMED_CONTENTS", "ATTACHMENT_DECOR", "DAMAGE", "ENGRAVING"],
  },
];

/**
 * Title / found_at cases for the detect-only reject gate. These fields are
 * bounced with a 422 rather than redacted, because a redacted title is useless
 * on a feed card and there is no second field to move the detail into.
 */
export const TITLE_CORPUS = [
  { input: "Black Jansport backpack", opts: {}, rejected: false },
  { input: "Blue Hydroflask", opts: {}, rejected: false },
  { input: "Husky Card", opts: { category: "Husky Card" }, rejected: false },
  { input: "Room 204 keys", opts: {}, rejected: false },
  { input: "iPhone serial F2LX9K2M", opts: {}, rejected: true },
  { input: "Wallet, PIN is 4821", opts: {}, rejected: true },
  { input: "Backpack with laptop inside", opts: {}, rejected: true },
  { input: "Keys with blue dolphin keychain", opts: {}, rejected: true },
];
