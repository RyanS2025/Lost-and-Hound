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
const INVISIBLE_RE = /[\u00AD\u034F\u115F\u1160\u17B4\u17B5\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const normalize = (t) => t.replace(INVISIBLE_RE, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Strip invisible/zero-width characters and trim. Use instead of .trim() for required-field checks. */
export const stripInvisible = (s) => (s || "").replace(INVISIBLE_RE, "").trim();

// Built once and cached — sorting longer entries first prevents partial shadowing
let _alphaRe = null;  // \bword\b regex for pure-alpha single words
let _others = null;   // normalized phrase/l33tspeak list for substring matching

function getMatcher() {
  if (_alphaRe !== null) return { _alphaRe, _others };

  const alpha = [];
  const other = [];

  for (const w of allWords) {
    (/^[a-z]+$/.test(w) ? alpha : other).push(w);
  }

  // Sort longer words first so more specific matches take priority
  alpha.sort((a, b) => b.length - a.length);
  other.sort((a, b) => b.length - a.length);

  _alphaRe = alpha.length
    ? new RegExp(`\\b(${alpha.map(esc).join("|")})\\b`, "i")
    : /(?!)/; // never-matching fallback

  _others = other.map(normalize);

  return { _alphaRe, _others };
}

/**
 * Returns true if the text contains any word from the profanity list.
 * Uses word-boundary matching for pure-alpha words (avoids false positives
 * like "bass" → "ass") and substring matching for phrases and l33tspeak variants.
 */
export function containsProfanity(text) {
  if (!text || typeof text !== "string") return false;
  const n = normalize(text);
  const { _alphaRe, _others } = getMatcher();
  return _alphaRe.test(n) || _others.some((o) => n.includes(o));
}
