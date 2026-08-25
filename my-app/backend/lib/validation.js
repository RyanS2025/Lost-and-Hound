import { containsProfanity } from "../utils/profanityFilter.js";

export const INVISIBLE_CHARS_RE = /[­͏ᅟᅠ឴឵᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

export function sanitize(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  return str.replace(INVISIBLE_CHARS_RE, "").trim().slice(0, maxLength);
}

export function profanityCheck(res, fields) {
  for (const [label, value] of Object.entries(fields)) {
    if (value && containsProfanity(value)) {
      res.status(422).json({ error: `Your ${label} contains inappropriate language.` });
      return true;
    }
  }
  return false;
}

export function validateRequired(fields, body) {
  for (const f of fields) {
    if (!body[f] || (typeof body[f] === "string" && !body[f].trim())) {
      return f;
    }
  }
  return null;
}

export const PROFILE_NAME_MAX_LENGTH = 25;

export const VALID_CAMPUS_IDS = new Set([
  "oakland", "san_jose", "miami", "boston", "burlington",
  "portland", "charlotte", "new_york", "toronto", "london", "arlington", "seattle",
]);

export const VALID_CATEGORIES = new Set([
  "Husky Card", "Jacket", "Wallet/Purse", "Bag", "Keys", "Electronics", "Other",
]);

export const VALID_LISTING_TYPES = new Set(["found", "lost"]);

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function dbError(res, error, label = "") {
  console.error(`[DB error${label ? " " + label : ""}]`, error?.message || error);
  return res.status(500).json({ error: "Internal server error" });
}

export function logModAction(modUserId, action, targetId, details) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    mod_user_id: modUserId,
    action,
    target_id: targetId,
    details,
  }));
}

export function buildDeviceTokenCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge,
    path: "/",
  };
}
