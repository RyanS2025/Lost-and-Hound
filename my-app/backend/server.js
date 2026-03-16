import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://thelostandhound.com",
    "https://www.thelostandhound.com",
  ],
}));
app.use(express.json());

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// RATE LIMITING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// General: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Strict: 20 requests per 15 minutes (for writes like creating posts, sending messages)
const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please slow down." },
});

// Very strict: 5 requests per 15 minutes (for reports, account deletion)
const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again later." },
});

// Apply general limiter to all routes
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

  req.user = data.user;
  next();
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
// CLEANUP COOLDOWN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let lastCleanupTime = 0;
const CLEANUP_COOLDOWN = 60 * 60 * 1000; // 1 hour

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PROFILE ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/profile", requireAuth, async (req, res) => {
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
            first_name: sanitize(meta.first_name, 50),
            last_name: sanitize(meta.last_name, 50),
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

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch("/api/profile", requireAuth, async (req, res) => {
  const first_name = sanitize(req.body.first_name, 50);
  const last_name = sanitize(req.body.last_name, 50);

  if (!first_name || !last_name) {
    return res.status(400).json({ error: "First name and last name are required" });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ first_name, last_name })
    .eq("id", req.user.id)
    .select("first_name, last_name, default_campus, is_moderator")
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch("/api/profile/campus", requireAuth, async (req, res) => {
  const default_campus = sanitize(req.body.default_campus, 50);

  if (!default_campus) {
    return res.status(400).json({ error: "Campus is required" });
  }

  const { error } = await supabase
    .from("profiles")
    .update({ default_campus })
    .eq("id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ default_campus });
});

app.delete("/api/profile", strictLimiter, requireAuth, async (req, res) => {
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LISTING ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/listings", requireAuth, async (req, res) => {
  const { data, error } = await supabase
    .from("listings")
    .select("*, locations(name, coordinates, campus)")
    .order("date", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.post("/api/listings", writeLimiter, requireAuth, requireNotBanned, async (req, res) => {
  const title = sanitize(req.body.title, 100);
  const category = sanitize(req.body.category, 50);
  const location_id = req.body.location_id;
  const found_at = sanitize(req.body.found_at, 200);
  const importance = req.body.importance;
  const description = sanitize(req.body.description, 2000);
  const image_url = req.body.image_url || null;
  const lat = req.body.lat;
  const lng = req.body.lng;

  if (!title || !category || !location_id || !found_at || !description) {
    return res.status(400).json({ error: "Missing required fields: title, category, location_id, found_at, description" });
  }

  if (![1, 2, 3].includes(importance)) {
    return res.status(400).json({ error: "Importance must be 1, 2, or 3" });
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

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.patch("/api/listings/:item_id/resolve", requireAuth, requireNotBanned, async (req, res) => {
  const { error } = await supabase
    .from("listings")
    .update({ resolved: true })
    .eq("item_id", req.params.item_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete("/api/listings/:item_id", requireAuth, requireModerator, async (req, res) => {
  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("item_id", req.params.item_id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// Cleanup with cooldown — runs at most once per hour
app.post("/api/listings/cleanup", requireAuth, async (req, res) => {
  const now = Date.now();

  if (now - lastCleanupTime < CLEANUP_COOLDOWN) {
    return res.json({ success: true, skipped: true });
  }

  lastCleanupTime = now;

  const cutoff = new Date(now - 30 * 86400000).toISOString();

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("resolved", true)
    .lt("date", cutoff);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post("/api/upload-url", writeLimiter, requireAuth, requireNotBanned, async (req, res) => {
  const filename = sanitize(req.body.filename, 200);

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const ext = filename.split(".").pop().toLowerCase();
  const allowedExts = ["jpg", "jpeg", "png", "webp", "gif"];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: "Only image files are allowed (jpg, jpeg, png, webp, gif)" });
  }

  const path = `${req.user.id}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("listing-images")
    .createSignedUploadUrl(path);

  if (error) return res.status(500).json({ error: error.message });

  const { data: publicUrlData } = supabase.storage
    .from("listing-images")
    .getPublicUrl(path);

  res.json({
    signedUrl: data.signedUrl,
    token: data.token,
    publicUrl: publicUrlData.publicUrl,
    path,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOCATIONS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/locations", requireAuth, async (req, res) => {
  const { campus } = req.query;

  let query = supabase
    .from("locations")
    .select("location_id, name, coordinates, campus")
    .order("name", { ascending: true });

  if (campus) query = query.eq("campus", sanitize(campus, 50));

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONVERSATIONS & MESSAGE ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.get("/api/conversations", requireAuth, async (req, res) => {
  const userId = req.user.id;

  const { data: convos, error } = await supabase
    .from("conversations")
    .select("*")
    .or(`participant_1.eq.${userId},participant_2.eq.${userId}`);

  if (error) return res.status(500).json({ error: error.message });
  if (!convos || convos.length === 0) {
    return res.json({ conversations: [], profiles: {}, listings: {} });
  }

  const { data: hiddenData } = await supabase
    .from("hidden_conversations")
    .select("conversation_id")
    .eq("user_id", userId);

  const hiddenIds = new Set((hiddenData || []).map((h) => h.conversation_id));
  const visible = convos.filter((c) => !hiddenIds.has(c.id));

  const otherIds = visible.map((c) =>
    c.participant_1 === userId ? c.participant_2 : c.participant_1
  );

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", otherIds);

  const profileMap = {};
  (profileData || []).forEach((p) => { profileMap[p.id] = p; });

  const listingIds = visible.map((c) => c.listing_id).filter(Boolean);
  const listingMap = {};
  if (listingIds.length > 0) {
    const { data: listingData } = await supabase
      .from("listings")
      .select("item_id, title")
      .in("item_id", listingIds);
    (listingData || []).forEach((l) => { listingMap[l.item_id] = l; });
  }

  res.json({ conversations: visible, profiles: profileMap, listings: listingMap });
});

// Must be a participant to view
app.get("/api/conversations/:id", requireAuth, requireConversationParticipant, async (req, res) => {
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
app.post("/api/conversations", writeLimiter, requireAuth, requireNotBanned, async (req, res) => {
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

  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: created.id, created: true });
});

// Close convo — must be a participant
app.delete("/api/conversations/:id", requireAuth, requireConversationParticipant, async (req, res) => {
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
app.get("/api/conversations/:id/messages", requireAuth, requireConversationParticipant, async (req, res) => {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", req.params.id)
    .order("created_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const { count } = await supabase
    .from("hidden_conversations")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", req.params.id);

  res.json({ messages: data || [], isClosed: (count ?? 0) > 0 });
});

// Send messages — must be a participant, must not be banned
app.post("/api/conversations/:id/messages", writeLimiter, requireAuth, requireNotBanned, requireConversationParticipant, async (req, res) => {
  const content = sanitize(req.body.content, 5000);

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

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REPORTS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

app.post("/api/reports", strictLimiter, requireAuth, requireNotBanned, async (req, res) => {
  const reason = sanitize(req.body.reason, 200);
  const details = sanitize(req.body.details, 2000) || null;
  const reported_listing_id = req.body.reported_listing_id || null;
  const reported_user_id = req.body.reported_user_id || null;

  if (!reason) {
    return res.status(400).json({ error: "Reason is required" });
  }

  if (!reported_listing_id && !reported_user_id) {
    return res.status(400).json({ error: "Must report either a listing or a user" });
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

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

app.get("/api/reports", requireAuth, requireModerator, async (req, res) => {
  const { data, error } = await supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.json({ reports: [], listings: {} });

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

  const enriched = data.map((r) => ({
    ...r,
    reporter: profileMap[r.reporter_id] || null,
    reportedUser: profileMap[r.reported_user_id] || null,
    reportedListing: listingMap[r.reported_listing_id] || null,
  }));

  res.json({ reports: enriched, listings: listingMap });
});

app.patch("/api/reports/:id/status", requireAuth, requireModerator, async (req, res) => {
  const status = sanitize(req.body.status, 20);
  const validStatuses = ["pending", "reviewed", "dismissed"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be: pending, reviewed, or dismissed" });
  }

  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.delete("/api/reports/:id", requireAuth, requireModerator, async (req, res) => {
  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", req.params.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

app.post("/api/reports/:id/decision", requireAuth, requireModerator, async (req, res) => {
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

  res.json({ success: true, action: "violation", banned_user_id: banUserId });
});

app.post("/api/reports/:id/reverse-ban", requireAuth, requireModerator, async (req, res) => {
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

  if (unbanErr) return res.status(500).json({ error: "Failed to reverse ban" });

  await supabase.from("reports").update({ status: "pending" }).eq("id", report.id);

  res.json({ success: true });
});

app.get("/api/reports/ban-info/:userId", requireAuth, requireModerator, async (req, res) => {
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

app.get("/api/mod/messages", requireAuth, requireModerator, async (req, res) => {
  const { reporter, reported } = req.query;
  if (!reporter || !reported) {
    return res.status(400).json({ error: "Missing reporter/reported params" });
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));