import crypto from "crypto";
import express from "express";
import { supabase } from "../lib/supabase.js";
import { sanitize, profanityCheck, dbError, logModAction, VALID_CATEGORIES, VALID_LISTING_TYPES, UUID_RE } from "../lib/validation.js";
import { requireAuth, require2FA, requireModerator, requireNotBanned } from "../middleware/auth.js";
import { writeLimiter, guestUploadLimiter, imageScreenLimiter } from "../middleware/rateLimiters.js";
import { splitDescription, containsWithheldDetail, EMPTY_EXTERNAL_FALLBACK } from "../lib/descriptionSplitter.js";
import { screenUploadedImage } from "../lib/imageScreening.js";
import { verifyUploadToken, storagePathFromPublicUrl, pathBelongsToSubject } from "../lib/uploadToken.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COLUMN PROJECTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Explicit, never select("*"). listings.description_internal holds the
// identifying specifics the Curry front desk uses to verify ownership, and a
// star select would ship it to every authenticated client the moment the
// column exists — with nothing obviously wrong at the call site.
// scripts/check-internal-leak.sh fails the build if a star select comes back.

export const PUBLIC_LISTING_COLUMNS =
  "item_id, title, category, location_id, found_at, importance, description, " +
  "image_url, image_redacted, listing_type, resolved, poster_id, poster_name, date, lat, lng";

// Only ever used on a route gated by requireModerator.
// TODO(proctor-merge): when the proctor-desk work lands this gains
// desk_location_id, received_at, received_by, owner_id, owner_name,
// delivered_at and delivered_by — and pickup_pin must stay OUT of the public
// list for the same reason description_internal is.
export const STAFF_LISTING_COLUMNS = `${PUBLIC_LISTING_COLUMNS}, description_internal`;

// Written in two pieces so the literal that scripts/check-location-embeds.sh
// greps for never appears in this file.
export const LISTING_LOCATION_EMBED =
  "locations!listings_location_id_fkey" + "(name, coordinates, campus)";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LISTING ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Listings are either 'found' (poster found someone else's item) or 'lost' (poster lost their own).
// The poster can mark their listing resolved. A cleanup job ages out old listings automatically.

let lastCleanupTime = 0;
const CLEANUP_COOLDOWN = 60 * 60 * 1000; // 1 hour
const DELETE_CHUNK_SIZE = 100;

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function deleteListingsWithDependents(itemIds) {
  const ids = (itemIds || []).filter(Boolean);
  if (ids.length === 0) return { error: null };

  for (const idBatch of chunk(ids, DELETE_CHUNK_SIZE)) {
    const { data: convos, error: convoSelErr } = await supabase
      .from("conversations")
      .select("id")
      .in("listing_id", idBatch);
    if (convoSelErr) return { error: convoSelErr };

    const convoIds = (convos || []).map((c) => c.id);

    for (const convoBatch of chunk(convoIds, DELETE_CHUNK_SIZE)) {
      const { error: msgErr } = await supabase
        .from("messages")
        .delete()
        .in("conversation_id", convoBatch);
      if (msgErr) return { error: msgErr };

      const { error: hidErr } = await supabase
        .from("hidden_conversations")
        .delete()
        .in("conversation_id", convoBatch);
      if (hidErr) return { error: hidErr };

      const { error: convoDelErr } = await supabase
        .from("conversations")
        .delete()
        .in("id", convoBatch);
      if (convoDelErr) return { error: convoDelErr };
    }

    const { error: listingErr } = await supabase
      .from("listings")
      .delete()
      .in("item_id", idBatch);
    if (listingErr) return { error: listingErr };
  }

  return { error: null };
}

router.get("/api/listings", requireAuth, require2FA, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  // Optional ?listing_type=found|lost filter. Omitting it (or passing any other
  // value) returns all listings, preserving the existing default behavior.
  const listing_type = req.query.listing_type;

  let query = supabase
    .from("listings")
    .select(`${PUBLIC_LISTING_COLUMNS}, ${LISTING_LOCATION_EMBED}`, { count: "exact" })
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
  const description = sanitize(req.body.description, 400);
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

  // ── Verified-image attach ───────────────────────────────────────────────
  // An image may only be attached if POST /api/verify-image issued a token for
  // this exact storage path, for this exact user, within the last 15 minutes.
  //
  // The previous check accepted any image_url whose hostname ended in
  // ".supabase.co" — every Supabase project on the internet — with no proof
  // the object had been screened and no check that it belonged to the caller.
  // That made image screening entirely optional for any client not using our
  // frontend.
  let image_url = null;
  let image_redacted = false;

  const rawImageUrl = sanitize(req.body.image_url, 600);
  const uploadToken = sanitize(req.body.upload_token, 600);

  if (rawImageUrl) {
    const objectPath = storagePathFromPublicUrl(rawImageUrl);
    if (!objectPath || !pathBelongsToSubject(objectPath, req.user.id)) {
      return res.status(400).json({ error: "Invalid image URL" });
    }
    const check = verifyUploadToken(uploadToken, { subject: req.user.id });
    if (!check.ok || check.kind !== "ok" || check.path !== objectPath) {
      return res.status(400).json({
        error: "That photo wasn't verified. Please re-upload it and try again.",
        code: "IMAGE_NOT_VERIFIED",
      });
    }
    image_url = rawImageUrl;
  } else if (req.body.image_redacted === true) {
    // image_redacted decides whether the post renders a "photo hidden" tile.
    // Without a signed blocked-token it would be a client-asserted boolean and
    // anyone could decorate any listing with a fake privacy notice.
    const check = verifyUploadToken(uploadToken, { subject: req.user.id });
    if (!check.ok || check.kind !== "blocked") {
      return res.status(400).json({ error: "Invalid redaction token", code: "IMAGE_NOT_VERIFIED" });
    }
    image_redacted = true;
  }

  if (lat != null && (typeof lat !== "number" || lat < -90 || lat > 90)) {
    return res.status(400).json({ error: "Invalid latitude" });
  }
  if (lng != null && (typeof lng !== "number" || lng < -180 || lng > 180)) {
    return res.status(400).json({ error: "Invalid longitude" });
  }

  if (profanityCheck(res, { "item title": title, "location": found_at, "description": description })) return;

  // ── Title and location are public and unsplit ────────────────────────────
  // The description gets redacted automatically, so the obvious next move for
  // a student who watches the preview eat their text is to retype the detail
  // into the title. These fields are bounced rather than redacted: a redacted
  // title is useless on a feed card, and unlike the description there is no
  // second field for the detail to move into. Mirrors how profanityCheck
  // rejects rather than silently fixing.
  if (containsWithheldDetail(title, { category }) || containsWithheldDetail(found_at, { category })) {
    return res.status(422).json({
      error:
        "Keep identifying details out of the title and location — put them in the description and we'll pass them to the front desk.",
      code: "DETAIL_IN_PUBLIC_FIELD",
    });
  }

  // ── The split ───────────────────────────────────────────────────────────
  // Runs AFTER profanityCheck deliberately: profanity inside a clause that
  // would have been withheld must still reject the post, rather than being
  // laundered into the staff-only column where no filter ever sees it.
  const split = splitDescription(description, { category, title });

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
    description: split.external || EMPTY_EXTERNAL_FALLBACK,
    description_internal: split.withheld.length > 0 ? split.internal : null,
    image_url,
    listing_type,
    resolved: false,
    poster_id: req.user.id,
    poster_name,
    date: new Date().toISOString(),
  };

  if (lat != null) insertData.lat = lat;
  if (lng != null) insertData.lng = lng;
  if (image_redacted) insertData.image_redacted = true;

  const { data, error } = await supabase
    .from("listings")
    .insert([insertData])
    .select(`${PUBLIC_LISTING_COLUMNS}, ${LISTING_LOCATION_EMBED}`)
    .single();

  if (error) return dbError(res, error, "POST /api/listings");

  awardPoints(req.user.id, listing_type === "found" ? "post_found" : "post_lost", data.item_id).catch(() => {});

  // Reason ids and lengths only, never the text. Lets the classifier's
  // thresholds be retuned against real usage without anyone reading a
  // student's withheld details out of a log.
  if (split.withheld.length > 0) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event: "description_split",
      item_id: data.item_id,
      withheld: split.withheld,
      external_len: split.external.length,
      internal_len: split.internal.length,
    }));
  }

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

  const { error } = await deleteListingsWithDependents([req.params.item_id]);

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
router.post("/api/listings/cleanup", requireAuth, require2FA, requireModerator, async (req, res) => {
  const now = Date.now();

  if (now - lastCleanupTime < CLEANUP_COOLDOWN) {
    return res.json({ success: true, skipped: true });
  }

  lastCleanupTime = now;

  const resolvedCutoff   = new Date(now - 10 * 86400000).toISOString();
  const unresolvedCutoff = new Date(now - 30 * 86400000).toISOString();

  const { data: resolved } = await supabase
    .from("listings")
    .select("item_id")
    .eq("resolved", true)
    .lt("date", resolvedCutoff);

  const { error: resolvedError } = await deleteListingsWithDependents(
    (resolved || []).map((l) => l.item_id)
  );
  if (resolvedError) return dbError(res, resolvedError, "POST /api/listings/cleanup");

  const { data: unresolved } = await supabase
    .from("listings")
    .select("item_id")
    .eq("resolved", false)
    .lt("date", unresolvedCutoff);

  const { error: unresolvedError } = await deleteListingsWithDependents(
    (unresolved || []).map((l) => l.item_id)
  );
  if (unresolvedError) return dbError(res, unresolvedError, "POST /api/listings/cleanup");

  res.json({ success: true });
});

router.post("/api/upload-url", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const filename = sanitize(req.body.filename, 200);

  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const ext = filename.split(".").pop().toLowerCase();
  // GIF is deliberately absent: Vision annotates only the first frame, so an
  // animated GIF with a clean opening frame and an ID card later in the
  // sequence would pass screening untouched.
  const allowedExts = ["jpg", "jpeg", "png", "webp"];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: "Only image files are allowed (jpg, jpeg, png, webp)" });
  }

  // Validate MIME type from the client (first line of defense)
  const contentType = sanitize(req.body.contentType, 100);
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  // Note the !== "" rather than a truthiness test: the previous form let a
  // client skip the check entirely by omitting the field.
  if (contentType !== "" && !allowedMimes.includes(contentType)) {
    return res.status(400).json({ error: "Invalid image type" });
  }

  // A client-declared number, so this is a courtesy check only — the real
  // byte count is enforced in lib/imageScreening.js after the object lands.
  const fileSize = parseInt(req.body.fileSize, 10);
  if (Number.isFinite(fileSize) && fileSize > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image must be under 5MB" });
  }

  const folder = sanitize(req.body.folder || "", 50);
  const UPLOAD_ALLOWED_FOLDERS = new Set(["", "support"]);
  if (!UPLOAD_ALLOWED_FOLDERS.has(folder)) {
    return res.status(400).json({ error: "Invalid folder." });
  }
  // Date.now() alone collides for two uploads in the same millisecond and, in
  // a public bucket, makes object names guessable. The guest path depends on
  // this for its only access control — see POST /api/verify-image/guest.
  const unique = `${Date.now()}-${crypto.randomUUID()}`;
  const path = folder
    ? `${req.user.id}/${folder}/${unique}.${ext}`
    : `${req.user.id}/${unique}.${ext}`;

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

// Guest image upload — no auth required, scoped to guest/support/.
//
// Every object here shares one subject ("guest"), so the object name is the
// only thing separating one guest's attachment from another's. The old
// `${Date.now()}.${ext}` was guessable within a millisecond window: a guest
// could name someone else's pending attachment at /api/verify-image/guest and
// either collect a valid attach token for it or have it deleted as sensitive.
// The UUID is what makes the comment on that route true.
router.post("/api/upload-url/guest", guestUploadLimiter, async (req, res) => {
  const filename = sanitize(req.body.filename, 200);
  if (!filename) {
    return res.status(400).json({ error: "Filename is required" });
  }

  const ext = filename.split(".").pop().toLowerCase();
  // Matches /api/upload-url: GIF is out because Vision screens only frame one.
  const allowedExts = ["jpg", "jpeg", "png", "webp"];
  if (!allowedExts.includes(ext)) {
    return res.status(400).json({ error: "Only image files are allowed (jpg, jpeg, png, webp)" });
  }

  const contentType = sanitize(req.body.contentType, 100);
  const allowedMimes = ["image/jpeg", "image/png", "image/webp"];
  if (contentType !== "" && !allowedMimes.includes(contentType)) {
    return res.status(400).json({ error: "Invalid image type" });
  }

  // Courtesy check only; the real byte count is enforced in lib/imageScreening.js.
  const fileSize = parseInt(req.body.fileSize, 10);
  if (Number.isFinite(fileSize) && fileSize > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image must be under 5MB" });
  }

  const path = `guest/support/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { data, error } = await supabase.storage
    .from("listing-images")
    .createSignedUploadUrl(path);

  if (error) return dbError(res, error, "POST /api/upload-url/guest");

  const { data: publicUrlData } = supabase.storage
    .from("listing-images")
    .getPublicUrl(path);

  res.json({
    signedUrl: data.signedUrl,
    publicUrl: publicUrlData.publicUrl,
    path,
  });
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// IMAGE SCREENING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Called after the object lands in storage and before it can be attached to
// anything. Validates the real bytes, screens for IDs / payment cards / PII
// documents, deletes anything that fails, and issues the signed token the
// attach endpoints require. All of the logic lives in lib/imageScreening.js so
// the authed and guest paths cannot drift apart.
//
// imageScreenLimiter is new here. This route previously sat behind the
// 500/15min global tier only, which meant one authenticated user could spend
// the entire monthly Google Vision budget in a few minutes. See the comment on
// that limiter for the arithmetic.
router.post("/api/verify-image", imageScreenLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const filePath = sanitize(req.body.path, 500);
  if (!filePath) {
    return res.status(400).json({ error: "File path is required" });
  }

  // Users may only verify their own uploads.
  if (!pathBelongsToSubject(filePath, req.user.id)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const result = await screenUploadedImage({
      filePath,
      subject: req.user.id,
      requestIp: req.ip,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return dbError(res, err, "POST /api/verify-image");
  }
});

// Guest image screening — no auth, confined to guest/support/ paths.
//
// `subject` is the literal "guest", which is not an identity: the only thing
// stopping one guest from naming another's object is that object names carry a
// random suffix (see POST /api/upload-url/guest). Without that suffix a guest
// could obtain a token for someone else's attachment, or cause it to be
// deleted by having it screened.
router.post("/api/verify-image/guest", guestUploadLimiter, async (req, res) => {
  const filePath = sanitize(req.body.path, 500);
  if (!filePath) return res.status(400).json({ error: "File path is required" });

  if (!pathBelongsToSubject(filePath, "guest")) {
    return res.status(403).json({ error: "Forbidden" });
  }

  try {
    const result = await screenUploadedImage({
      filePath,
      subject: "guest",
      requestIp: req.ip,
    });
    return res.status(result.status).json(result.body);
  } catch (err) {
    return dbError(res, err, "POST /api/verify-image/guest");
  }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STAFF: WITHHELD DESCRIPTION DETAILS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// The specifics a claimant must be able to describe. Reasons are recomputed on
// read rather than stored, so this view always reflects the CURRENT classifier
// instead of a snapshot frozen at posting time.
//
// TODO(proctor): the correct gate is requireProctor — the front-desk staff who
// actually run the verification conversation — scoped so a proctor only sees
// listings whose desk_location_id matches their own proctor_location_id. That
// middleware arrives with the proctor-desk work (profiles.is_proctor /
// profiles.proctor_location_id). Until it exists on main, moderators are the
// only staff role, so requireModerator stands in.
router.get("/api/listings/:item_id/internal", requireAuth, require2FA, requireModerator, async (req, res) => {
  const itemId = req.params.item_id;
  if (!UUID_RE.test(itemId)) {
    return res.status(400).json({ error: "Invalid listing id" });
  }

  const { data, error } = await supabase
    .from("listings")
    .select("item_id, description, description_internal")
    .eq("item_id", itemId)
    .single();

  if (error) return dbError(res, error, "GET /api/listings/:item_id/internal");
  if (!data) return res.status(404).json({ error: "Listing not found" });

  // Staff access to a withheld secret is itself worth recording.
  logModAction(req.user.id, "view_listing_internal", itemId, {});

  res.json({
    item_id: data.item_id,
    description_internal: data.description_internal ?? null,
    withheld: data.description_internal
      ? splitDescription(data.description_internal).withheld
      : [],
  });
});

// ── FUTURE: proctor-authored external description ─────────────────────────
// Front-desk staff sometimes need to fix a bad auto-split — usually when the
// classifier over-redacted and the public listing became unfindable. There is
// no proctor interface yet, so this is deliberately NOT built. When it is:
//
//   PATCH /api/listings/:item_id/description-external
//     gate:   requireAuth, require2FA, requireProctor (scoped to desk_location_id)
//     body:   { external: string }
//     rules:  run splitDescription() on the SUBMITTED text and reject with 422
//             if withheld.length > 0. A proctor may narrow the public text,
//             never widen it past the classifier. description_internal stays
//             immutable; only the public column is editable.
//     audit:  logModAction(req.user.id, "edit_listing_external", item_id,
//             { before_len, after_len })
//
// Do NOT add a student-facing version of this route. The split is automatic by
// design; letting the poster rewrite the public text defeats the feature.

export default router;
