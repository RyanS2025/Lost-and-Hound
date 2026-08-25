import express from "express";
import { supabase } from "../lib/supabase.js";
import { sanitize, profanityCheck, dbError, logModAction, VALID_CATEGORIES, VALID_LISTING_TYPES } from "../lib/validation.js";
import { requireAuth, require2FA, requireModerator, requireNotBanned } from "../middleware/auth.js";
import { writeLimiter, guestUploadLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LISTING ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Listings are either 'found' (poster found someone else's item) or 'lost' (poster lost their own).
// The poster can mark their listing resolved. A cleanup job ages out old listings automatically.

let lastCleanupTime = 0;
const CLEANUP_COOLDOWN = 60 * 60 * 1000; // 1 hour

router.get("/api/listings", requireAuth, require2FA, async (req, res) => {
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEADERBOARD — POINTS HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const POINT_VALUES = { post_found: 15, post_lost: 5, resolved: 25 };

async function awardPoints(userId, eventType, listingId = null) {
  const points = POINT_VALUES[eventType];
  if (!points) return;
  await supabase.from("point_events").insert([{ user_id: userId, event_type: eventType, points, listing_id: listingId }]);
  await supabase.rpc("increment_user_points", { uid: userId, delta: points });
}

router.post("/api/listings", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
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

  if (profanityCheck(res, { "item title": title, "location": found_at, "description": description })) return;

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

  awardPoints(req.user.id, listing_type === "found" ? "post_found" : "post_lost", data.item_id).catch(() => {});

  res.json(data);
});

router.patch("/api/listings/:item_id/resolve", requireAuth, require2FA, requireNotBanned, async (req, res) => {
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

  const { data: updated, error } = await supabase
    .from("listings")
    .update({ resolved: true })
    .eq("item_id", req.params.item_id)
    .eq("resolved", false)
    .select("item_id")
    .maybeSingle();

  if (error) return dbError(res, error, "PATCH /api/listings/resolve");

  if (updated) {
    awardPoints(req.user.id, "resolved", updated.item_id).catch(() => {});
  }

  res.json({ success: true });
});

// GET /api/leaderboard?campus=boston — top 50 confirmed users by points; optional campus filter
router.get("/api/leaderboard", requireAuth, require2FA, async (req, res) => {
  const campus = req.query.campus || null;

  const { data, error } = await supabase.rpc("get_leaderboard", { campus_filter: campus });
  if (error) return dbError(res, error, "GET /api/leaderboard");

  const ranked = (data || []).map((u, i) => ({ ...u, rank: i + 1 }));

  // If the current user isn't in the top 50, fetch their rank separately
  let currentUser = ranked.find(u => u.id === req.user.id) || null;
  if (!currentUser) {
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, points, default_campus")
      .eq("id", req.user.id)
      .single();
    if (myProfile) {
      const { data: aheadCount } = await supabase.rpc("get_rank_of_user", { uid: req.user.id, campus_filter: campus });
      currentUser = { ...myProfile, rank: (aheadCount ?? 0) + 1 };
    }
  }

  res.json({ leaderboard: ranked, currentUser });
});

router.delete("/api/listings/:item_id", requireAuth, require2FA, requireModerator, async (req, res) => {
  // Fetch image_url before deleting so we can clean up storage afterward
  const { data: listing } = await supabase
    .from("listings")
    .select("image_url")
    .eq("item_id", req.params.item_id)
    .maybeSingle();

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("item_id", req.params.item_id);

  if (error) return dbError(res, error, "DELETE /api/listings");

  // Delete the image from storage — fire-and-forget, don't block the response
  if (listing?.image_url) {
    const storagePrefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/listing-images/`;
    if (listing.image_url.startsWith(storagePrefix)) {
      const imagePath = listing.image_url.slice(storagePrefix.length);
      supabase.storage.from("listing-images").remove([imagePath]).catch(() => {});
    }
  }

  logModAction(req.user.id, "delete_listing", req.params.item_id, { deleted_listing_id: req.params.item_id });
  res.json({ success: true });
});

// Cleanup with cooldown — runs at most once per hour
router.post("/api/listings/cleanup", requireAuth, require2FA, async (req, res) => {
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

router.post("/api/upload-url", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
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

  const folder = sanitize(req.body.folder || "", 50);
  const UPLOAD_ALLOWED_FOLDERS = new Set(["", "support"]);
  if (!UPLOAD_ALLOWED_FOLDERS.has(folder)) {
    return res.status(400).json({ error: "Invalid folder." });
  }
  const path = folder
    ? `${req.user.id}/${folder}/${Date.now()}.${ext}`
    : `${req.user.id}/${Date.now()}.${ext}`;

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
router.post("/api/verify-image", requireAuth, require2FA, requireNotBanned, async (req, res) => {
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

  // Track Vision API usage (month granularity for free-tier monitoring)
  const visionMonth = new Date().toISOString().slice(0, 7);
  await supabase.rpc("increment_vision_usage", { p_month: visionMonth });

  // SafeSearch — screen for adult/violent/racy content before accepting the upload
  if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_CLOUD_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ image: { content: buffer.toString("base64") }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }],
        }),
      }
    );
    const visionData = await visionRes.json();
    const safe = visionData.responses?.[0]?.safeSearchAnnotation;
    const REJECT = new Set(["LIKELY", "VERY_LIKELY"]);
    if (safe && (REJECT.has(safe.adult) || REJECT.has(safe.violence) || safe.racy === "VERY_LIKELY")) {
      await supabase.storage.from("listing-images").remove([filePath]);
      return res.status(422).json({ error: "This image cannot be uploaded as it may contain inappropriate content." });
    }
  }

  res.json({ valid: true });
});

// Guest image upload — no auth required, scoped to guest/support/ path
router.post("/api/upload-url/guest", guestUploadLimiter, async (req, res) => {
  const filename = sanitize(req.body.filename, 200);
  if (!filename) return res.status(400).json({ error: "Filename is required" });

  const ext = filename.split(".").pop().toLowerCase();
  const allowedExts = ["jpg", "jpeg", "png", "webp", "gif"];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: "Only image files are allowed (jpg, jpeg, png, webp, gif)" });
  }

  const contentType = sanitize(req.body.contentType, 100);
  const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (contentType && !allowedMimes.includes(contentType)) {
    return res.status(400).json({ error: "Invalid image type" });
  }

  const fileSize = parseInt(req.body.fileSize);
  if (fileSize && fileSize > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image must be under 5MB" });
  }

  const path = `guest/support/${Date.now()}.${ext}`;
  const { data, error } = await supabase.storage.from("listing-images").createSignedUploadUrl(path);
  if (error) return dbError(res, error, "POST /api/upload-url/guest");

  const { data: publicUrlData } = supabase.storage.from("listing-images").getPublicUrl(path);
  res.json({ signedUrl: data.signedUrl, publicUrl: publicUrlData.publicUrl, path });
});

// Guest image verification — no auth, only allows guest/support/ paths
router.post("/api/verify-image/guest", guestUploadLimiter, async (req, res) => {
  const filePath = sanitize(req.body.path, 500);
  if (!filePath) return res.status(400).json({ error: "File path is required" });

  // Scope enforcement: guests can only verify their own guest/support/ uploads
  if (!filePath.startsWith("guest/support/")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabase.storage.from("listing-images").download(filePath);
  if (error || !data) return res.status(404).json({ error: "File not found" });

  const buffer = Buffer.from(await data.arrayBuffer());
  const header = buffer.subarray(0, 12);

  const isJpeg = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF;
  const isPng  = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
  const isGif  = header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46;
  const isWebp = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
              && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50;

  if (!isJpeg && !isPng && !isGif && !isWebp) {
    await supabase.storage.from("listing-images").remove([filePath]);
    return res.status(400).json({ error: "File is not a valid image. Upload rejected." });
  }

  // Track Vision API usage (month granularity for free-tier monitoring)
  const guestVisionMonth = new Date().toISOString().slice(0, 7);
  await supabase.rpc("increment_vision_usage", { p_month: guestVisionMonth });

  // SafeSearch — screen for adult/violent/racy content before accepting the upload
  if (process.env.GOOGLE_CLOUD_VISION_API_KEY) {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_CLOUD_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ image: { content: buffer.toString("base64") }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }],
        }),
      }
    );
    const visionData = await visionRes.json();
    const safe = visionData.responses?.[0]?.safeSearchAnnotation;
    const REJECT = new Set(["LIKELY", "VERY_LIKELY"]);
    if (safe && (REJECT.has(safe.adult) || REJECT.has(safe.violence) || safe.racy === "VERY_LIKELY")) {
      await supabase.storage.from("listing-images").remove([filePath]);
      return res.status(422).json({ error: "This image cannot be uploaded as it may contain inappropriate content." });
    }
  }

  res.json({ valid: true });
});

export default router;
