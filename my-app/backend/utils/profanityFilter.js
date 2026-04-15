// Word list from github.com/zautumnz/profane-words (WTFPL) via npm
import words from "profane-words";

// Terms the npm package omits (clinical/anatomical) but are inappropriate
// on a university lost-and-found platform.
const CUSTOM_WORDS = [
  // anatomy
  "vagina", "vulva", "labia", "penis", "testicles", "scrotum", "clitoris", "clit",
  "boobs", "boobies", "breast", "nipple", "nipples", "areola",
  "balls", "genitals", "genitalia", "pubic",
  // sexual
  "sex",
  // explicit content
  "nude", "naked", "nudes",
  "porn", "porno", "pornography",
  "dildo", "vibrator", "butt plug",
  "horny", "boner", "erection",
  "masturbate", "masturbation", "masturbating",
  "orgasm", "ejaculate", "ejaculation", "cumshot",
  // harassment / grooming signals
  "send pics", "send nudes", "show me",

  // --- filter evasion attempts ---
  // ass variants
  "assh", "assho", "asshole", "a**", "a$$", "a55", "@ss", "@$$", "@55",
  // fuck variants
  "fuk", "fvck", "phuck", "f*ck", "f**k", "fu**", "f***", "f4ck",
  // shit variants
  "shi", "sht", "sh*t", "sh!t", "$hit", "$h!t", "5hit", "5h1t",
  // bitch variants
  "biatch", "b*tch", "b**ch", "b!tch", "b1tch",
  // cunt variants
  "cvnt", "c*nt", "c**t",
  // dick variants
  "d*ck", "d**k", "d!ck", "d1ck",
  // cock variants
  "c*ck", "c0ck",
  // sex/penis variants
  "s3x", "s*x", "p3n1s", "p*nis",
];

const allWords = [...words, ...CUSTOM_WORDS];

const esc = (w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Invisible / zero-width Unicode characters commonly used to evade filters:
// U+00AD soft hyphen, U+034F combining grapheme joiner, U+115F/U+1160 hangul fillers,
// U+17B4/U+17B5 Khmer vowel inherents, U+180E Mongolian vowel separator,
// U+200B-U+200F zero-width space / non-joiner / joiner / LRM / RLM,
// U+202A-U+202E bidi embedding controls, U+2060-U+2064 invisible math operators,
// U+2066-U+2069 bidi isolate controls, U+FEFF BOM / zero-width no-break space.
const INVISIBLE_RE = /[\u00AD\u034F\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

const normalize = (t) => t.replace(INVISIBLE_RE, "").toLowerCase().replace(/\s+/g, " ").trim();

let _alphaRe = null;
let _others = null;

function getMatcher() {
  if (_alphaRe !== null) return { _alphaRe, _others };

  const alpha = [];
  const other = [];

  for (const w of allWords) {
    (/^[a-z]+$/.test(w) ? alpha : other).push(w);
  }

  alpha.sort((a, b) => b.length - a.length);
  other.sort((a, b) => b.length - a.length);

  _alphaRe = alpha.length
    ? new RegExp(`\\b(${alpha.map(esc).join("|")})\\b`, "i")
    : /(?!)/;

  _others = other.map(normalize);

  return { _alphaRe, _others };
}

/**
 * Returns true if the text contains any entry from the profanity list.
 * Pure-alpha single words use \b word-boundary matching to avoid false positives.
 * Phrases, l33tspeak, and special-char variants use substring matching.
 */
export function containsProfanity(text) {
  if (!text || typeof text !== "string") return false;
  const n = normalize(text);
  const { _alphaRe, _others } = getMatcher();
  return _alphaRe.test(n) || _others.some((o) => n.includes(o));
}
