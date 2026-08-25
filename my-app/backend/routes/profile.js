import express from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, require2FA } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/rateLimiters.js";
import { sanitize, profanityCheck, dbError, PROFILE_NAME_MAX_LENGTH, VALID_CAMPUS_IDS } from "../lib/validation.js";

const router = express.Router();

router.get("/api/profile", requireAuth, require2FA, async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("first_name, last_name, default_campus, is_moderator, is_owner, banned_until, ban_reason, referral_answered")
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
            referral_answered: true, // new signups answered the required dropdown at registration
          },
          { onConflict: "id" }
        )
        .select("first_name, last_name, default_campus, is_moderator, is_owner, banned_until, ban_reason, referral_answered")
        .single();

      if (upsertErr) return res.status(500).json({ error: "Failed to create profile" });
      return res.json(created);
    }
    return res.status(404).json({ error: "Profile not found" });
  }

  if (error) return dbError(res, error, "GET /api/profile");
  res.json(data);
});

router.patch("/api/profile", requireAuth, require2FA, async (req, res) => {
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

  if (profanityCheck(res, { "first name": first_name, "last name": last_name })) return;

  const { data, error } = await supabase
    .from("profiles")
    .update({ first_name, last_name })
    .eq("id", req.user.id)
    .select("first_name, last_name, default_campus, is_moderator, is_owner")
    .single();

  if (error) return dbError(res, error, "PATCH /api/profile");
  res.json(data);
});

router.patch("/api/profile/campus", requireAuth, require2FA, async (req, res) => {
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

router.patch("/api/settings/notifications", requireAuth, async (req, res) => {
  const { emailNotifications, pushNotifications, broadcastNotifications } = req.body;
  const updates = {};
  if (typeof emailNotifications     === "boolean") updates.email_notifications_enabled      = emailNotifications;
  if (typeof pushNotifications      === "boolean") updates.push_notifications_enabled       = pushNotifications;
  if (typeof broadcastNotifications === "boolean") updates.broadcast_notifications_enabled  = broadcastNotifications;
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields" });

  const { error } = await supabase.from("profiles").update(updates).eq("id", req.user.id);
  if (error) return dbError(res, error, "PATCH /api/settings/notifications");
  res.json({ ok: true });
});

router.delete("/api/profile", strictLimiter, requireAuth, require2FA, async (req, res) => {
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

export default router;
