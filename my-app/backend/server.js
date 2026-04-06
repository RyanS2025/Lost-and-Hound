import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";
import cookieParser from "cookie-parser";
import crypto from "crypto";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();

app.use(helmet());

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RATE LIMITING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Three tiers: general (all routes), write (creating posts/messages), strict (reports/deletions).

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

app.use("/api/", generalLimiter);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INPUT VALIDATION HELPERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function sanitize(str, maxLength = 500) {
  if (typeof str !== "string") return "";
  return str.trim().slice(0, maxLength);
}

function validateRequired(fields, body) {
  for (const f of fields) {
    if (!body[f] || (typeof body[f] === "string" && !body[f].trim())) {
      return f;
    }
  }
  return null;
}

const PROFILE_NAME_MAX_LENGTH = 25;

const VALID_CAMPUS_IDS = new Set([
  "oakland", "san_jose", "miami", "boston", "burlington",
  "portland", "charlotte", "new_york", "toronto", "london", "arlington", "seattle",
]);

const VALID_CATEGORIES = new Set([
  "Husky Card", "Jacket", "Wallet/Purse", "Bag", "Keys", "Electronics", "Other",
]);

// Valid listing types: 'found' = poster found someone else's item,
// 'lost' = poster lost their own item and is looking for it.
const VALID_LISTING_TYPES = new Set(["found", "lost"]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function dbError(res, error, label = "") {
  console.error(`[DB error${label ? " " + label : ""}]`, error?.message || error);
  return res.status(500).json({ error: "Internal server error" });
}

function logModAction(modUserId, action, targetId, details) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    mod_user_id: modUserId,
    action,
    target_id: targetId,
    details,
  }));
}

function buildDeviceTokenCookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge,
    path: "/",
  };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTH MIDDLEWARE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return res.status(401).json({ error: "Invalid token" });
  }

  req.accessToken = token;
  req.user = data.user;
  next();
}

function decodeJwtPayload(token) {
  if (!token || typeof token !== "string") return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function isAal2Token(token) {
  const payload = decodeJwtPayload(token);
  return payload?.aal === "aal2";
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2FA MIDDLEWARE — validates device token issued after OTP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function require2FA(req, res, next) {
  const raw = req.headers["x-device-token"];
  if (raw && typeof raw === "string" && raw.length >= 10) {
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");

    const { data } = await supabase
      .from("trusted_devices")
      .select("expires_at")
      .eq("user_id", req.user.id)
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (data && new Date(data.expires_at) >= new Date()) {
      return next();
    }
  }

  // Fallback: allow requests from a current Supabase MFA-authenticated session.
  if (isAal2Token(req.accessToken)) {
    return next();
  }

  return res.status(403).json({ error: "2FA_REQUIRED" });
}

async function requireModerator(req, res, next) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_moderator")
    .eq("id", req.user.id)
    .single();

  if (!profile?.is_moderator) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

// Block banned users from taking actions (creating posts, sending messages, etc.)
// Does NOT block reading data — banned users can still view the feed
async function requireNotBanned(req, res, next) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("banned_until")
    .eq("id", req.user.id)
    .single();

  if (profile?.banned_until) {
    const isPermanent = profile.banned_until === "9999-12-31T23:59:59Z" ||
                        profile.banned_until === "9999-12-31T23:59:59+00:00";
    const stillBanned = isPermanent || new Date(profile.banned_until) > new Date();

    if (stillBanned) {
      return res.status(403).json({ error: "Your account is currently suspended." });
    }
  }

  next();
}

// Verify the requesting user is a participant in the conversation
async function requireConversationParticipant(req, res, next) {
  const convoId = req.params.id;
  const userId = req.user.id;

  const { data: convo } = await supabase
    .from("conversations")
    .select("participant_1, participant_2")
    .eq("id", convoId)
    .single();

  if (!convo) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  if (convo.participant_1 !== userId && convo.participant_2 !== userId) {
    return res.status(403).json({ error: "You are not a participant in this conversation" });
  }

  req.conversation = convo;
  next();
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 2FA ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// After MFA verification, the client receives a device token (hashed before storage) that
// lasts 24h (or 30 days if "remember me"). Subsequent requests send this token in
// X-Device-Token so the user doesn't have to re-verify on every session.

// Check whether the device token in the request is still trusted.
// If it is, the client can skip showing the OTP screen.
app.post("/api/auth/check-device", requireAuth, async (req, res) => {
  const raw = req.headers["x-device-token"];
  if (!raw || typeof raw !== "string") return res.json({ trusted: false });

  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const { data } = await supabase
    .from("trusted_devices")
    .select("expires_at")
    .eq("user_id", req.user.id)
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!data || new Date(data.expires_at) < new Date()) {
    return res.json({ trusted: false });
  }
  res.json({ trusted: true });
});

// Issue a trusted-device token after Supabase MFA (aal2) is complete.
app.post("/api/auth/trust-device", requireAuth, async (req, res) => {
  if (!isAal2Token(req.accessToken)) {
    return res.status(403).json({ error: "MFA_REQUIRED" });
  }

  const rememberDevice = !!req.body?.rememberDevice;
  const userId = req.user.id;

  const rawToken  = crypto.randomUUID() + "-" + crypto.randomBytes(16).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const ttlMs    = rememberDevice ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Date.now() + ttlMs).toISOString();
  const deviceInfo = req.headers["user-agent"]?.slice(0, 200) || null;

  await supabase
    .from("trusted_devices")
    .delete()
    .eq("user_id", userId)
    .lt("expires_at", new Date().toISOString());

  const { error: insertErr } = await supabase.from("trusted_devices").insert({
    user_id:     userId,
    token_hash:  tokenHash,
    expires_at:  expiresAt,
    device_info: deviceInfo,
  });
  if (insertErr) {
    console.error("trust-device insert error:", insertErr);
    return res.status(500).json({ error: "Failed to issue device token" });
  }

  res.json({ verified: true, rememberDevice: !!rememberDevice, deviceToken: rawToken });
});

app.post("/api/auth/clear-device", requireAuth, async (req, res) => {
  const raw = req.headers["x-device-token"];
  if (raw && typeof raw === "string") {
    const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    await supabase
      .from("trusted_devices")
      .delete()
      .eq("user_id", req.user.id)
      .eq("token_hash", tokenHash);
  }
  res.json({ success: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PASSWORD RESET
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/auth/reset-password", strictLimiter, requireAuth, async (req, res) => {
  const { password } = req.body;

  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password is required" });
  }

  if (password.length < 6 || password.length > 32) {
    return res.status(400).json({ error: "Password must be between 6 and 32 characters" });
  }

  const { error } = await supabase.auth.admin.updateUserById(req.user.id, { password });

  if (error) return dbError(res, error, "POST /api/auth/reset-password");
  res.json({ success: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CLEANUP COOLDOWN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let lastCleanupTime = 0;
const CLEANUP_COOLDOWN = 60 * 60 * 1000; // 1 hour

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROFILE ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GET auto-creates a profile on first login using Supabase user metadata.
// DELETE cascades through listings, messages, conversations, reports, devices, and storage.

app.get("/api/profile", requireAuth, require2FA, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, default_campus, is_moderator, banned_until, ban_reason")
    .eq("id", req.user.id)
    .single();

  if (error && error.code === "PGRST116") {
    const meta = req.user.user_metadata;
    if (meta?.first_name && meta?.last_name) {
      const { data: created, error: upsertErr } = await supabase
        .from("profiles")
        .upsert(
          {
            id: req.user.id,
            first_name: sanitize(meta.first_name, PROFILE_NAME_MAX_LENGTH),
            last_name: sanitize(meta.last_name, PROFILE_NAME_MAX_LENGTH),
            default_campus: "boston",
          },
          { onConflict: "id" }
        )
        .select("first_name, last_name, default_campus, is_moderator, banned_until, ban_reason")
        .single();

      if (upsertErr) return res.status(500).json({ error: "Failed to create profile" });
      return res.json(created);
    }
    return res.status(404).json({ error: "Profile not found" });
  }

  if (error) return dbError(res, error, "GET /api/profile");
  res.json(data);
});

app.patch("/api/profile", requireAuth, require2FA, async (req, res) => {
  if (
    typeof req.body.first_name === "string" && req.body.first_name.trim().length > PROFILE_NAME_MAX_LENGTH ||
    typeof req.body.last_name === "string" && req.body.last_name.trim().length > PROFILE_NAME_MAX_LENGTH
  ) {
    return res.status(400).json({
      error: `First name and last name must be ${PROFILE_NAME_MAX_LENGTH} characters or fewer`,
    });
  }

  const first_name = sanitize(req.body.first_name, PROFILE_NAME_MAX_LENGTH);
  const last_name = sanitize(req.body.last_name, PROFILE_NAME_MAX_LENGTH);

  if (!first_name || !last_name) {
    return res.status(400).json({ error: "First name and last name are required" });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ first_name, last_name })
    .eq("id", req.user.id)
    .select("first_name, last_name, default_campus, is_moderator")
    .single();

  if (error) return dbError(res, error, "PATCH /api/profile");
  res.json(data);
});

app.patch("/api/profile/campus", requireAuth, require2FA, async (req, res) => {
  const default_campus = sanitize(req.body.default_campus, 50);

  if (!default_campus) {
    return res.status(400).json({ error: "Campus is required" });
  }

  if (!VALID_CAMPUS_IDS.has(default_campus)) {
    return res.status(400).json({ error: "Invalid campus" });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ default_campus })
    .eq("id", req.user.id);

  if (error) return dbError(res, error, "PATCH /api/profile/campus");
  res.json({ default_campus });
});

app.delete("/api/profile", strictLimiter, requireAuth, require2FA, async (req, res) => {
  const userId = req.user.id;
  const errors = [];

  // 1. Delete user's listings
  const { error: listingsErr } = await supabase
    .from("listings")
    .delete()
    .eq("poster_id", userId);
  if (listingsErr) errors.push({ step: "listings", message: listingsErr.message });

  // 2. Delete messages in conversations the user is part of, then the conversations
  const { data: convos } = await supabase
    .from("conversations")
    .select("id")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

  if (convos && convos.length > 0) {
    const convoIds = convos.map((c) => c.id);

    const { error: msgsErr } = await supabase
      .from("messages")
      .delete()
      .in("conversation_id", convoIds);
    if (msgsErr) errors.push({ step: "messages", message: msgsErr.message });

    const { error: hiddenErr } = await supabase
      .from("hidden_conversations")
      .delete()
      .in("conversation_id", convoIds);
    if (hiddenErr) errors.push({ step: "hidden_conversations", message: hiddenErr.message });

    const { error: convosErr } = await supabase
      .from("conversations")
      .delete()
      .in("id", convoIds);
    if (convosErr) errors.push({ step: "conversations", message: convosErr.message });
  }

  // 3. Delete any remaining hidden_conversations for this user
  const { error: hiddenUserErr } = await supabase
    .from("hidden_conversations")
    .delete()
    .eq("user_id", userId);
  if (hiddenUserErr) errors.push({ step: "hidden_conversations_user", message: hiddenUserErr.message });

  // 4. Delete reports filed by this user (reported-against reports are kept for mod history)
  const { error: reportsErr } = await supabase
    .from("reports")
    .delete()
    .eq("reporter_id", userId);
  if (reportsErr) errors.push({ step: "reports", message: reportsErr.message });

  // 5. Delete trusted devices
  const { error: devicesErr } = await supabase
    .from("trusted_devices")
    .delete()
    .eq("user_id", userId);
  if (devicesErr) errors.push({ step: "trusted_devices", message: devicesErr.message });

  // 6. Delete uploaded images from storage
  const { data: storageFiles } = await supabase.storage
    .from("listing-images")
    .list(userId);

  if (storageFiles && storageFiles.length > 0) {
    const filePaths = storageFiles.map((f) => `${userId}/${f.name}`);
    const { error: storageErr } = await supabase.storage
      .from("listing-images")
      .remove(filePaths);
    if (storageErr) errors.push({ step: "storage", message: storageErr.message });
  }

  // 7. Delete profile
  const { error: profileErr } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (profileErr) errors.push({ step: "profile", message: profileErr.message });

  // 8. Delete auth user from Supabase Auth
  const { error: authErr } = await supabase.auth.admin.deleteUser(userId);
  if (authErr) errors.push({ step: "auth_user", message: authErr.message });

  if (errors.length > 0) {
    console.error(`[Account deletion partial failure] user=${userId}`, errors);
    // If the profile and auth user were deleted, still consider it a success
    // but log the partial failures for manual cleanup
    if (profileErr || authErr) {
      return res.status(500).json({ error: "Failed to fully delete account. Please contact support." });
    }
  }

  res.json({ success: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LISTING ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Listings are either 'found' (poster found someone else's item) or 'lost' (poster lost their own).
// The poster can mark their listing resolved. A cleanup job ages out old listings automatically.

app.get("/api/listings", requireAuth, require2FA, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  // Optional ?listing_type=found|lost filter. Omitting it (or passing any other
  // value) returns all listings, preserving the existing default behavior.
  const listing_type = req.query.listing_type;

  let query = supabase
    .from("listings")
    .select("*, locations(name, coordinates, campus)", { count: "exact" })
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  // Only narrow the query when a valid type is explicitly requested.
  if (VALID_LISTING_TYPES.has(listing_type)) {
    query = query.eq("listing_type", listing_type);
  }

  const { data, error, count } = await query;

  if (error) return dbError(res, error, "GET /api/listings");
  res.json({ data: data || [], page, limit, total: count ?? 0, hasMore: offset + limit < (count ?? 0) });
});

app.post("/api/listings", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const title = sanitize(req.body.title, 50);
  const category = sanitize(req.body.category, 50);
  const location_id = req.body.location_id;
  const found_at = sanitize(req.body.found_at, 50);
  const importance = req.body.importance;
  const description = sanitize(req.body.description, 250);
  const image_url = req.body.image_url || null;
  const lat = req.body.lat;
  const lng = req.body.lng;

  // Default to 'found' if the client sends anything other than a valid type.
  // This keeps all existing posts working without requiring them to send the field.
  const listing_type = VALID_LISTING_TYPES.has(req.body.listing_type)
    ? req.body.listing_type
    : "found";

  if (!title || !category || !location_id || !found_at || !description) {
    return res.status(400).json({ error: "Missing required fields: title, category, location_id, found_at, description" });
  }

  if (!VALID_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Invalid category" });
  }

  if (![1, 2, 3].includes(importance)) {
    return res.status(400).json({ error: "Importance must be 1, 2, or 3" });
  }

  if (image_url !== null) {
    const ALLOWED_IMAGE_ORIGINS = (process.env.ALLOWED_IMAGE_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    let parsedUrl;
    try { parsedUrl = new URL(image_url); } catch { return res.status(400).json({ error: "Invalid image URL" }); }
    const allowed = ALLOWED_IMAGE_ORIGINS.some((o) => parsedUrl.origin === o) ||
      parsedUrl.hostname.endsWith(".supabase.co");
    if (!allowed) return res.status(400).json({ error: "Invalid image URL" });
  }

  if (lat != null && (typeof lat !== "number" || lat < -90 || lat > 90)) {
    return res.status(400).json({ error: "Invalid latitude" });
  }
  if (lng != null && (typeof lng !== "number" || lng < -180 || lng > 180)) {
    return res.status(400).json({ error: "Invalid longitude" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", req.user.id)
    .single();

  const poster_name = profile
    ? `${profile.first_name} ${profile.last_name}`
    : req.user.email;

  const insertData = {
    title,
    category,
    location_id,
    found_at,
    importance,
    description,
    image_url,
    listing_type,
    resolved: false,
    poster_id: req.user.id,
    poster_name,
    date: new Date().toISOString(),
  };

  if (lat != null) insertData.lat = lat;
  if (lng != null) insertData.lng = lng;

  const { data, error } = await supabase
    .from("listings")
    .insert([insertData])
    .select("*, locations(name, coordinates, campus)")
    .single();

  if (error) return dbError(res, error, "POST /api/listings");
  res.json(data);
});

app.patch("/api/listings/:item_id/resolve", requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const { data: listing } = await supabase
    .from("listings")
    .select("item_id, poster_id, resolved")
    .eq("item_id", req.params.item_id)
    .maybeSingle();

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  if (listing.poster_id !== req.user.id) {
    return res.status(403).json({ error: "Only the original poster can mark an item as returned" });
  }

  const { error } = await supabase
    .from("listings")
    .update({ resolved: true })
    .eq("item_id", req.params.item_id);

  if (error) return dbError(res, error, "PATCH /api/listings/resolve");
  res.json({ success: true });
});

app.delete("/api/listings/:item_id", requireAuth, require2FA, requireModerator, async (req, res) => {
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("item_id", req.params.item_id);

  if (error) return dbError(res, error, "DELETE /api/listings");
  logModAction(req.user.id, "delete_listing", req.params.item_id, { deleted_listing_id: req.params.item_id });
  res.json({ success: true });
});

// Cleanup with cooldown — runs at most once per hour
app.post("/api/listings/cleanup", requireAuth, require2FA, async (req, res) => {
  const now = Date.now();

  if (now - lastCleanupTime < CLEANUP_COOLDOWN) {
    return res.json({ success: true, skipped: true });
  }

  lastCleanupTime = now;

  const resolvedCutoff   = new Date(now - 10 * 86400000).toISOString();
  const unresolvedCutoff = new Date(now - 30 * 86400000).toISOString();

  const { error: resolvedError } = await supabase
    .from("listings")
    .delete()
    .eq("resolved", true)
    .lt("date", resolvedCutoff);

  if (resolvedError) return dbError(res, resolvedError, "POST /api/listings/cleanup");

  const { error: unresolvedError } = await supabase
    .from("listings")
    .delete()
    .eq("resolved", false)
    .lt("date", unresolvedCutoff);

  if (unresolvedError) return dbError(res, unresolvedError, "POST /api/listings/cleanup");

  res.json({ success: true });
});

app.post("/api/upload-url", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const filename = sanitize(req.body.filename, 200);

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const ext = filename.split(".").pop().toLowerCase();
  const allowedExts = ["jpg", "jpeg", "png", "webp", "gif"];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: "Only image files are allowed (jpg, jpeg, png, webp, gif)" });
  }

  // Validate MIME type from the client (first line of defense)
  const contentType = sanitize(req.body.contentType, 100);
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (contentType && !allowedMimes.includes(contentType)) {
    return res.status(400).json({ error: "Invalid image type" });
  }

  const fileSize = parseInt(req.body.fileSize);
  if (fileSize && fileSize > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image must be under 5MB" });
  }

  const path = `${req.user.id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("listing-images")
    .createSignedUploadUrl(path);

  if (error) return dbError(res, error, "POST /api/upload-url");

  const { data: publicUrlData } = supabase.storage
    .from("listing-images")
    .getPublicUrl(path);

  res.json({
    signedUrl: data.signedUrl,
    publicUrl: publicUrlData.publicUrl,
    path,
  });
});

// Verify uploaded image is actually an image by checking magic bytes
// Called after the file is uploaded to storage but before creating the listing
app.post("/api/verify-image", requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const filePath = sanitize(req.body.path, 500);
  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  // Ensure user can only verify their own uploads
  if (!filePath.startsWith(req.user.id + "/")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabase.storage
    .from("listing-images")
    .download(filePath);

  if (error || !data) {
    return res.status(404).json({ error: "File not found" });
  }

  // Read the first 12 bytes to check magic number signatures
  const buffer = Buffer.from(await data.arrayBuffer());
  const header = buffer.subarray(0, 12);

  const isJpeg = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  const isPng = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  const isGif = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46;
  const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
              && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;

  if (!isJpeg && !isPng && !isGif && !isWebp) {
    // Not a real image — delete it from storage
    await supabase.storage.from("listing-images").remove([filePath]);
    return res.status(400).json({ error: "File is not a valid image. Upload rejected." });
  }

  res.json({ valid: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOCATIONS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/locations", requireAuth, require2FA, async (req, res) => {
  const { campus } = req.query;

  let query = supabase
    .from("locations")
    .select("location_id, name, coordinates, campus")
    .order("name", { ascending: true });

  if (campus) {
    const sanitizedCampus = sanitize(campus, 50);
    if (!VALID_CAMPUS_IDS.has(sanitizedCampus)) {
      return res.status(400).json({ error: "Invalid campus" });
    }
    query = query.eq("campus", sanitizedCampus);
  }

  const { data, error } = await query;
  if (error) return dbError(res, error, "GET /api/locations");
  res.json(data);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONVERSATIONS & MESSAGE ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /conversations is find-or-create: reopening an existing conversation returns its id.
// Closing a conversation inserts a system message, then deletes it — hidden_conversations
// records which users have "closed" a thread so it doesn't reappear in their inbox.

app.get("/api/conversations", requireAuth, require2FA, async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  const { data: convos, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) return dbError(res, error, "GET /api/conversations");
  if (!convos || convos.length === 0) {
    return res.json({ conversations: [], profiles: {}, listings: {}, page, limit, total: 0, hasMore: false });
  }

  const { data: hiddenData } = await supabase
    .from("hidden_conversations")
    .select("conversation_id")
    .eq("user_id", userId);

  const hiddenIds = new Set((hiddenData || []).map((h) => h.conversation_id));
  const visible = convos.filter((c) => !hiddenIds.has(c.id));

  const total = visible.length;
  const offset = (page - 1) * limit;
  const paginated = visible.slice(offset, offset + limit);

  const otherIds = paginated.map((c) =>
    c.participant_1 === userId ? c.participant_2 : c.participant_1
  );

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", otherIds);

  const profileMap = {};
  (profileData || []).forEach((p) => { profileMap[p.id] = p; });

  const listingIds = paginated.map((c) => c.listing_id).filter(Boolean);
  const listingMap = {};
  if (listingIds.length > 0) {
    const { data: listingData } = await supabase
      .from("listings")
      .select("item_id, title")
      .in("item_id", listingIds);
    (listingData || []).forEach((l) => { listingMap[l.item_id] = l; });
  }

  res.json({ conversations: paginated, profiles: profileMap, listings: listingMap, page, limit, total, hasMore: offset + limit < total });
});

// Must be a participant to view
app.get("/api/conversations/:id", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (error) return res.status(404).json({ error: "Conversation not found" });

  const userId = req.user.id;
  const otherId = data.participant_1 === userId ? data.participant_2 : data.participant_1;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .eq("id", otherId)
    .single();

  let listing = null;
  if (data.listing_id) {
    const { data: l } = await supabase
      .from("listings")
      .select("item_id, title")
      .eq("item_id", data.listing_id)
      .single();
    listing = l;
  }

  res.json({ conversation: data, profile, listing });
});

// Find or create — banned users cannot start conversations
app.post("/api/conversations", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const { listing_id, other_user_id } = req.body;
  const userId = req.user.id;

  if (!listing_id || !other_user_id) {
    return res.status(400).json({ error: "listing_id and other_user_id are required" });
  }

  if (other_user_id === userId) {
    return res.status(400).json({ error: "Cannot create a conversation with yourself" });
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listing_id)
    .eq("participant_1", userId)
    .maybeSingle();

  if (existing) return res.json({ id: existing.id, created: false });

  const { data: created, error } = await supabase
    .from("conversations")
    .insert({
      listing_id,
      participant_1: userId,
      participant_2: other_user_id,
    })
    .select("id")
    .single();

  if (error) return dbError(res, error, "POST /api/conversations");
  res.json({ id: created.id, created: true });
});

// Close convo — must be a participant
app.delete("/api/conversations/:id", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
  const convoId = req.params.id;
  const userId = req.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", userId)
    .single();

  const name = profile ? `${profile.first_name} ${profile.last_name}` : "Someone";

  await supabase.from("messages").insert({
    conversation_id: convoId,
    sender_id: userId,
    content: `${name} has closed this conversation.`,
    is_system: true,
  });

  await supabase.from("hidden_conversations").insert({
    user_id: userId,
    conversation_id: convoId,
  });

  await supabase.from("messages").delete().eq("conversation_id", convoId);
  await supabase.from("conversations").delete().eq("id", convoId);

  res.json({ success: true });
});

// Get messages — must be a participant
app.get("/api/conversations/:id/messages", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("messages")
    .select("*", { count: "exact" })
    .eq("conversation_id", req.params.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return dbError(res, error, "GET /api/conversations/messages");

  const { count: hiddenCount } = await supabase
    .from("hidden_conversations")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", req.params.id);

  // Reverse so messages display oldest-first in the UI
  res.json({ messages: (data || []).reverse(), isClosed: (hiddenCount ?? 0) > 0, page, limit, total: count ?? 0, hasMore: offset + limit < (count ?? 0) });
});

// Total count of unread messages across all of the user's visible conversations.
// Used by the navbar badge — lightweight head-count query, no message content returned.
app.get("/api/messages/unread-count", requireAuth, require2FA, async (req, res) => {
  console.log(`[unread-count] reached — user=${req.user?.id}`);
  const userId = req.user.id;

  // Find all conversations the user is in
  const { data: convos, error: convoErr } = await supabase
    .from("conversations")
    .select("id")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

  if (convoErr) return dbError(res, convoErr, "GET /api/messages/unread-count");
  if (!convos || convos.length === 0) return res.json({ count: 0 });

  // Exclude hidden/closed conversations
  const { data: hiddenData } = await supabase
    .from("hidden_conversations")
    .select("conversation_id")
    .eq("user_id", userId);

  const hiddenIds = new Set((hiddenData || []).map((h) => h.conversation_id));
  const visibleIds = convos.map((c) => c.id).filter((id) => !hiddenIds.has(id));
  if (visibleIds.length === 0) return res.json({ count: 0 });

  // Count messages sent by others that this user hasn't read yet
  const { count, error } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("conversation_id", visibleIds)
    .neq("sender_id", userId)
    .eq("read", false);

  if (error) return dbError(res, error, "GET /api/messages/unread-count");
  res.json({ count: count ?? 0 });
});

// Mark all unread messages in a conversation as read (those sent by the other participant).
app.patch("/api/conversations/:id/read", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
  const { error } = await supabase
    .from("messages")
    .update({ read: true })
    .eq("conversation_id", req.params.id)
    .neq("sender_id", req.user.id)
    .eq("read", false);

  if (error) return dbError(res, error, "PATCH /api/conversations/read");
  res.json({ ok: true });
});

// Send messages — must be a participant, must not be banned
app.post("/api/conversations/:id/messages", writeLimiter, requireAuth, require2FA, requireNotBanned, requireConversationParticipant, async (req, res) => {
  const content = sanitize(req.body.content, 500);

  if (!content) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: req.params.id,
      sender_id: req.user.id,
      content,
    })
    .select("*")
    .single();

  if (error) return dbError(res, error, "POST /api/conversations/messages");
  res.json(data);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REPORTS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Users submit reports against a listing or another user. Moderators review them and
// issue a decision: no violation, or a 3-day / 30-day / permanent ban. Bans can be reversed.
// For theft reports, GET /reports enriches the response with conversation context so
// moderators can see who first contacted the poster about the item.

app.post("/api/reports", strictLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const reason = sanitize(req.body.reason, 200);
  const details = sanitize(req.body.details, 2000) || null;
  const reported_listing_id = req.body.reported_listing_id || null;
  let reported_user_id = req.body.reported_user_id || null;

  if (!reason) {
    return res.status(400).json({ error: "Reason is required" });
  }

  if (!reported_listing_id && !reported_user_id) {
    return res.status(400).json({ error: "Must report either a listing or a user" });
  }

  if (reported_listing_id && !reported_user_id) {
    const { data: listingTarget } = await supabase
      .from("listings")
      .select("poster_id")
      .eq("item_id", reported_listing_id)
      .maybeSingle();

    // Snapshot the reported user for listing reports so email lookups survive later listing deletion.
    if (listingTarget?.poster_id) {
      reported_user_id = listingTarget.poster_id;
    }
  }

  if (reported_user_id === req.user.id) {
    return res.status(400).json({ error: "Cannot report yourself" });
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: req.user.id,
      reported_listing_id,
      reported_user_id,
      reason,
      details,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) return dbError(res, error, "POST /api/reports");
  res.json(data);
});

app.get("/api/reports", requireAuth, require2FA, requireModerator, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("reports")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return dbError(res, error, "GET /api/reports");
  if (!data || data.length === 0) return res.json({ reports: [], listings: {}, page, limit, total: count ?? 0, hasMore: false });

  const userIds = new Set();
  data.forEach((r) => {
    if (r.reporter_id) userIds.add(r.reporter_id);
    if (r.reported_user_id) userIds.add(r.reported_user_id);
  });

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [...userIds]);

  const profileMap = {};
  (profilesData || []).forEach((p) => { profileMap[p.id] = p; });

  const listingIds = data.map((r) => r.reported_listing_id).filter(Boolean);
  const listingMap = {};
  if (listingIds.length > 0) {
    const { data: listingsData } = await supabase
      .from("listings")
      .select("*, locations(name, coordinates, campus)")
      .in("item_id", listingIds);
    (listingsData || []).forEach((l) => { listingMap[l.item_id] = l; });
  }

  const isStolenReport = (report) => {
    const reason = (report?.reason || "").toLowerCase();
    const details = (report?.details || "").toLowerCase();
    return reason.includes("stolen") || details.includes("stolen") || reason.includes("theft") || details.includes("theft");
  };

  const stolenListingIds = data
    .filter((r) => isStolenReport(r) && r.reported_listing_id)
    .map((r) => r.reported_listing_id);

  const stolenClaimantByListingId = {};
  const firstConvoByListingId = {};
  if (stolenListingIds.length > 0) {
    const { data: convoData } = await supabase
      .from("conversations")
      .select("listing_id, participant_1, participant_2, created_at")
      .in("listing_id", stolenListingIds)
      .order("created_at", { ascending: true });

    for (const convo of convoData || []) {
      if (convo?.listing_id && !firstConvoByListingId[convo.listing_id]) {
        firstConvoByListingId[convo.listing_id] = convo;
      }

      if (!convo?.listing_id || stolenClaimantByListingId[convo.listing_id]) continue;
      const listingPosterId = listingMap[convo.listing_id]?.poster_id || null;

      if (listingPosterId && convo.participant_1 !== listingPosterId) {
        stolenClaimantByListingId[convo.listing_id] = convo.participant_1;
      } else if (listingPosterId && convo.participant_2 !== listingPosterId) {
        stolenClaimantByListingId[convo.listing_id] = convo.participant_2;
      } else {
        stolenClaimantByListingId[convo.listing_id] = convo.participant_1 || convo.participant_2 || null;
      }
    }
  }

  const emailUserIds = new Set();
  for (const r of data) {
    if (r.reporter_id) emailUserIds.add(r.reporter_id);
    if (r.reported_user_id) emailUserIds.add(r.reported_user_id);
    if (r.reported_listing_id && listingMap[r.reported_listing_id]?.poster_id) {
      emailUserIds.add(listingMap[r.reported_listing_id].poster_id);
    }
    if (r.reported_listing_id && stolenClaimantByListingId[r.reported_listing_id]) {
      emailUserIds.add(stolenClaimantByListingId[r.reported_listing_id]);
    }
  }

  const emailMap = {};
  const unresolvedEmailIds = new Set();
  await Promise.all(
    [...emailUserIds].map(async (uid) => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(uid);
        if (!userErr && userData?.user?.email) {
          emailMap[uid] = userData.user.email;
          return;
        }
        unresolvedEmailIds.add(uid);
      } catch {
        // Keep missing emails as null so dashboard can render a fallback label.
        unresolvedEmailIds.add(uid);
      }
    })
  );

  // Fallback for any unresolved IDs: scan auth users pages and map matching IDs.
  if (unresolvedEmailIds.size > 0) {
    let page = 1;
    const perPage = 200;

    while (unresolvedEmailIds.size > 0) {
      const { data: usersPage, error: usersErr } = await supabase.auth.admin.listUsers({ page, perPage });
      if (usersErr) break;

      const users = usersPage?.users || [];
      if (users.length === 0) break;

      for (const u of users) {
        if (u?.id && unresolvedEmailIds.has(u.id) && u.email) {
          emailMap[u.id] = u.email;
          unresolvedEmailIds.delete(u.id);
        }
      }

      if (users.length < perPage) break;
      page += 1;
    }
  }

  const enriched = data.map((r) => ({
    ...r,
    reporter: profileMap[r.reporter_id] || null,
    reportedUser: profileMap[r.reported_user_id] || null,
    reportedListing: listingMap[r.reported_listing_id] || null,
    stolenContext: (() => {
      if (!isStolenReport(r)) return null;

      const listingId = r.reported_listing_id;
      const listingPosterId = listingMap[listingId]?.poster_id || null;
      const firstConvo = listingId ? firstConvoByListingId[listingId] : null;

      const inferredReportedFromConvo = firstConvo
        ? (firstConvo.participant_1 === r.reporter_id
          ? firstConvo.participant_2
          : (firstConvo.participant_2 === r.reporter_id ? firstConvo.participant_1 : null))
        : null;

      const reportedPersonId = r.reported_user_id || listingPosterId || inferredReportedFromConvo || null;
      const claimedMinePersonId = listingId
        ? (stolenClaimantByListingId[listingId] || r.reporter_id || null)
        : (r.reporter_id || null);
      const reporterId = r.reporter_id || null;

      return {
        reportedPersonId,
        claimedMinePersonId,
        reporterId,
        reportedPersonEmail: reportedPersonId ? (emailMap[reportedPersonId] || null) : null,
        claimedMinePersonEmail: claimedMinePersonId ? (emailMap[claimedMinePersonId] || null) : null,
        reporterEmail: reporterId ? (emailMap[reporterId] || null) : null,
      };
    })(),
  }));

  res.json({ reports: enriched, listings: listingMap, page, limit, total: count ?? 0, hasMore: offset + limit < (count ?? 0) });
});

app.patch("/api/reports/:id/status", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const status = sanitize(req.body.status, 20);
  const validStatuses = ["pending", "reviewed", "dismissed"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be: pending, reviewed, or dismissed" });
  }

  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", req.params.id);

  if (error) return dbError(res, error, "PATCH /api/reports/status");
  res.json({ success: true });
});

app.delete("/api/reports/:id", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", req.params.id);

  if (error) return dbError(res, error, "DELETE /api/reports");
  logModAction(req.user.id, "delete_report", req.params.id, { deleted_report_id: req.params.id });
  res.json({ success: true });
});

app.post("/api/reports/:id/decision", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { decision, mod_note } = req.body;
  const validDecisions = ["no_violation", "violation_3", "violation_30", "violation_permanent"];

  if (!validDecisions.includes(decision)) {
    return res.status(400).json({ error: "Invalid decision" });
  }

  const { data: report, error: reportErr } = await supabase
    .from("reports")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (reportErr) return res.status(404).json({ error: "Report not found" });

  if (decision === "no_violation") {
    await supabase.from("reports").update({ status: "dismissed" }).eq("id", report.id);
    logModAction(req.user.id, "report_decision", req.params.id, {
      decision,
      banned_user_id: null,
      mod_note: mod_note ?? null,
    });
    return res.json({ success: true, action: "dismissed" });
  }

  let banned_until;
  if (decision === "violation_3") {
    banned_until = new Date(Date.now() + 3 * 86400000).toISOString();
  } else if (decision === "violation_30") {
    banned_until = new Date(Date.now() + 30 * 86400000).toISOString();
  } else {
    banned_until = "9999-12-31T23:59:59Z";
  }

  const isPost = !!report.reported_listing_id;

  let banUserId;
  if (isPost) {
    const { data: listing } = await supabase
      .from("listings")
      .select("poster_id")
      .eq("item_id", report.reported_listing_id)
      .single();
    banUserId = listing?.poster_id;
  } else {
    banUserId = report.reported_user_id;
  }

  if (isPost && report.reported_listing_id) {
    await supabase.from("listings").delete().eq("item_id", report.reported_listing_id);
  } else if (!isPost && report.reporter_id && report.reported_user_id) {
    const { data: convos } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant_1.eq.${report.reporter_id},participant_2.eq.${report.reported_user_id}),` +
        `and(participant_1.eq.${report.reported_user_id},participant_2.eq.${report.reporter_id})`
      );
    if (convos) {
      for (const c of convos) {
        await supabase.from("messages").delete().eq("conversation_id", c.id);
        await supabase.from("conversations").delete().eq("id", c.id);
      }
    }
  }

  if (banUserId) {
    const banLabel =
      decision === "violation_3" ? "3-day ban" :
      decision === "violation_30" ? "30-day ban" : "Permanent ban";

    const ban_reason = mod_note
      ? `${banLabel}: ${sanitize(mod_note, 500)}`
      : `${banLabel}: ${report.reason}`;

    await supabase
      .from("profiles")
      .update({ banned_until, ban_reason })
      .eq("id", banUserId);
  }

  const column = isPost ? "reported_listing_id" : "reported_user_id";
  const targetId = isPost ? report.reported_listing_id : report.reported_user_id;

  await supabase
    .from("reports")
    .update({ status: "reviewed" })
    .eq(column, targetId);

  logModAction(req.user.id, "report_decision", req.params.id, {
    decision,
    banned_user_id: banUserId ?? null,
    mod_note: mod_note ?? null,
  });

  res.json({ success: true, action: "violation", banned_user_id: banUserId });
});

app.post("/api/reports/:id/reverse-ban", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { data: report, error: reportErr } = await supabase
    .from("reports")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (reportErr) return res.status(404).json({ error: "Report not found" });

  const isPost = !!report.reported_listing_id;
  let banUserId;

  if (isPost) {
    const { data: listing } = await supabase
      .from("listings")
      .select("poster_id")
      .eq("item_id", report.reported_listing_id)
      .maybeSingle();
    banUserId = listing?.poster_id;
  } else {
    banUserId = report.reported_user_id;
  }

  if (!banUserId) return res.status(400).json({ error: "Cannot determine user to unban" });

  const { error: unbanErr } = await supabase
    .from("profiles")
    .update({ banned_until: null, ban_reason: null })
    .eq("id", banUserId);

  if (unbanErr) return dbError(res, unbanErr, "POST /api/reports/reverse-ban");

  await supabase.from("reports").update({ status: "pending" }).eq("id", report.id);

  logModAction(req.user.id, "reverse_ban", req.params.id, { unbanned_user_id: banUserId });

  res.json({ success: true });
});

app.get("/api/reports/ban-info/:userId", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.userId)) return res.status(400).json({ error: "Invalid userId" });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, banned_until, ban_reason")
    .eq("id", req.params.userId)
    .single();

  if (error) return res.status(404).json({ error: "User not found" });
  res.json(data);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOD MESSAGE VIEWER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Moderator-only endpoint to read the conversation between a reporter and a reported user,
// used to provide evidence context when reviewing harassment or theft reports.

app.get("/api/mod/messages", requireAuth, require2FA, requireModerator, async (req, res) => {
  const { reporter, reported } = req.query;
  if (!reporter || !reported) {
    return res.status(400).json({ error: "Missing reporter/reported params" });
  }

  if (!UUID_RE.test(reporter) || !UUID_RE.test(reported)) {
    return res.status(400).json({ error: "Invalid reporter or reported id" });
  }

  const { data: convos } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_1.eq.${reporter},participant_2.eq.${reported}),` +
      `and(participant_1.eq.${reported},participant_2.eq.${reporter})`
    );

  if (!convos || convos.length === 0) {
    return res.json({ messages: [], profiles: {} });
  }

  const convoIds = convos.map((c) => c.id);

  const { data: msgs } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", convoIds)
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [reporter, reported]);

  const profileMap = {};
  (profileData || []).forEach((p) => { profileMap[p.id] = p; });

  res.json({ messages: msgs || [], profiles: profileMap });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPPORT TICKETS ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Fetch all support tickets (moderators only, includes reply counts)
app.get("/api/support-tickets", requireAuth, require2FA, requireModerator, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, category, description, status, created_at, support_replies(id, user_id, is_moderator, message, created_at)")
      .order("created_at", { ascending: false });

    if (error) return dbError(res, error, "fetching support tickets");

    res.json({ tickets: data });
  } catch (error) {
    dbError(res, error, "fetching support tickets");
  }
});

// Fetch current user's own support tickets
app.get("/api/support-tickets/mine", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, category, description, status, created_at, support_replies(id, user_id, is_moderator, message, created_at)")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return dbError(res, error, "fetching user support tickets");

    res.json({ tickets: data });
  } catch (error) {
    dbError(res, error, "fetching user support tickets");
  }
});

// Create a new support ticket
app.post("/api/support-tickets", requireAuth, async (req, res) => {
  const { category, description } = req.body;

  if (!category || !description) {
    return res.status(400).json({ error: "Category and description are required." });
  }

  try {
    const { data, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: req.user.id,
        category: sanitize(category, 50),
        description: sanitize(description, 500),
        status: "open",
      })
      .select();

    if (error) return dbError(res, error, "creating support ticket");

    res.status(201).json(data[0]);
  } catch (error) {
    dbError(res, error, "creating support ticket");
  }
});

// Update a support ticket status (moderators only)
app.patch("/api/support-tickets/:id", requireAuth, require2FA, requireModerator, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const VALID_STATUSES = ["open", "in_progress", "resolved", "closed"];
  if (!status || !VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${VALID_STATUSES.join(", ")}.` });
  }

  try {
    const { data, error } = await supabase
      .from("support_tickets")
      .update({ status })
      .eq("id", id)
      .select();

    if (error) return dbError(res, error, "updating support ticket");
    if (!data || data.length === 0) return res.status(404).json({ error: "Ticket not found." });

    res.json(data[0]);
  } catch (error) {
    dbError(res, error, "updating support ticket");
  }
});

// Post a reply to a support ticket (moderator or ticket owner)
app.post("/api/support-tickets/:id/replies", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    // Verify the ticket exists and the requester is either the owner or a moderator
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, user_id, status")
      .eq("id", id)
      .single();

    if (ticketError || !ticket) return res.status(404).json({ error: "Ticket not found." });

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_moderator")
      .eq("id", req.user.id)
      .single();

    const isModerator = !!profile?.is_moderator;

    if (!isModerator && ticket.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden." });
    }

    if (ticket.status === "closed") {
      return res.status(400).json({ error: "Cannot reply to a closed ticket." });
    }

    const { data, error } = await supabase
      .from("support_replies")
      .insert({
        ticket_id: id,
        user_id: req.user.id,
        is_moderator: isModerator,
        message: sanitize(message, 1000),
      })
      .select();

    if (error) return dbError(res, error, "posting reply");

    // If a moderator replies and ticket is still open, move it to in_progress
    if (isModerator && ticket.status === "open") {
      await supabase.from("support_tickets").update({ status: "in_progress" }).eq("id", id);
    }

    res.status(201).json(data[0]);
  } catch (error) {
    dbError(res, error, "posting reply");
  }
});

// Catch-all: log any request that didn't match a route
app.use((req, res) => {
  console.log(`[404] No route matched: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Not found" });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));