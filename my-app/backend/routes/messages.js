import express from "express";
import { supabase } from "../lib/supabase.js";
import { sanitize, profanityCheck, dbError, UUID_RE } from "../lib/validation.js";
import { sendPushNotification } from "../lib/pushNotifications.js";
import { requireAuth, require2FA, requireNotBanned, requireConversationParticipant } from "../middleware/auth.js";
import { writeLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONVERSATIONS & MESSAGE ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// POST /conversations is find-or-create: reopening an existing conversation returns its id.
// Closing a conversation inserts a system message, then deletes it — hidden_conversations
// records which users have "closed" a thread so it doesn't reappear in their inbox.

router.get("/api/conversations", requireAuth, require2FA, async (req, res) => {
  const userId = req.user.id;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  // Fetch conversations, hidden list, and blocked users in parallel
  const [convosResult, hiddenResult, myBlocksResult, blockersOfMeResult] = await Promise.all([
    supabase.from("conversations").select("*").or(`participant_1.eq.${userId},participant_2.eq.${userId}`).order("created_at", { ascending: false }),
    supabase.from("hidden_conversations").select("conversation_id").eq("user_id", userId),
    supabase.from("blocked_users").select("blocked_id").eq("blocker_id", userId),
    supabase.from("blocked_users").select("blocker_id").eq("blocked_id", userId),
  ]);

  if (convosResult.error) return dbError(res, convosResult.error, "GET /api/conversations");
  const convos = convosResult.data;
  if (!convos || convos.length === 0) {
    return res.json({ conversations: [], profiles: {}, listings: {}, page, limit, total: 0, hasMore: false });
  }

  const hiddenIds = new Set((hiddenResult.data || []).map((h) => h.conversation_id));
  const blockedUserIds = new Set([
    ...(myBlocksResult.data ?? []).map(r => r.blocked_id),
    ...(blockersOfMeResult.data ?? []).map(r => r.blocker_id),
  ]);

  const visible = convos.filter((c) => {
    if (hiddenIds.has(c.id)) return false;
    const otherId = c.participant_1 === userId ? c.participant_2 : c.participant_1;
    return !blockedUserIds.has(otherId);
  });

  const total = visible.length;
  const offset = (page - 1) * limit;
  const paginated = visible.slice(offset, offset + limit);

  const otherIds = paginated.map((c) =>
    c.participant_1 === userId ? c.participant_2 : c.participant_1
  );
  const listingIds = paginated.map((c) => c.listing_id).filter(Boolean);

  // Fetch profiles and listings in parallel
  const [profileResult, listingResult] = await Promise.all([
    supabase.from("profiles").select("id, first_name, last_name").in("id", otherIds),
    listingIds.length > 0
      ? supabase.from("listings").select("item_id, title").in("item_id", listingIds)
      : Promise.resolve({ data: [] }),
  ]);

  const profileMap = {};
  (profileResult.data || []).forEach((p) => { profileMap[p.id] = p; });
  const listingMap = {};
  (listingResult.data || []).forEach((l) => { listingMap[l.item_id] = l; });

  // Fetch unread counts per conversation in parallel
  const unreadCounts = {};
  if (paginated.length > 0) {
    const unreadResults = await Promise.all(
      paginated.map((c) =>
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("conversation_id", c.id).neq("sender_id", userId).eq("read", false)
      )
    );
    paginated.forEach((c, i) => { unreadCounts[c.id] = unreadResults[i].count ?? 0; });
  }

  res.json({ conversations: paginated, profiles: profileMap, listings: listingMap, unreadCounts, page, limit, total, hasMore: offset + limit < total });
});

// Must be a participant to view
router.get("/api/conversations/:id", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
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
router.post("/api/conversations", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const { listing_id, other_user_id } = req.body;
  const userId = req.user.id;

  if (!listing_id || !other_user_id) {
    return res.status(400).json({ error: "listing_id and other_user_id are required" });
  }

  if (!UUID_RE.test(other_user_id) || !UUID_RE.test(listing_id)) {
    return res.status(400).json({ error: "Invalid ID format" });
  }

  if (other_user_id === userId) {
    return res.status(400).json({ error: "Cannot create a conversation with yourself" });
  }

  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("listing_id", listing_id)
    .or(
      `and(participant_1.eq.${userId},participant_2.eq.${other_user_id}),` +
      `and(participant_1.eq.${other_user_id},participant_2.eq.${userId})`
    )
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
router.delete("/api/conversations/:id", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
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

  const { count } = await supabase
    .from("hidden_conversations")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", convoId);

  if (count >= 2) {
    await supabase.from("messages").delete().eq("conversation_id", convoId);
    await supabase.from("conversations").delete().eq("id", convoId);
  }

  res.json({ success: true });
});

// Get messages — must be a participant
router.get("/api/conversations/:id/messages", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  // Fetch messages and closed status in parallel
  const [msgResult, hiddenResult] = await Promise.all([
    supabase.from("messages").select("*", { count: "exact" }).eq("conversation_id", req.params.id).order("created_at", { ascending: false }).range(offset, offset + limit - 1),
    supabase.from("hidden_conversations").select("id", { count: "exact", head: true }).eq("conversation_id", req.params.id),
  ]);

  if (msgResult.error) return dbError(res, msgResult.error, "GET /api/conversations/messages");

  // Reverse so messages display oldest-first in the UI
  res.json({ messages: (msgResult.data || []).reverse(), isClosed: (hiddenResult.count ?? 0) > 0, page, limit, total: msgResult.count ?? 0, hasMore: offset + limit < (msgResult.count ?? 0) });
});

// Total count of unread messages across all of the user's visible conversations.
// Used by the navbar badge — lightweight head-count query, no message content returned.
router.get("/api/messages/unread-count", requireAuth, require2FA, async (req, res) => {
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
router.patch("/api/conversations/:id/read", requireAuth, require2FA, requireConversationParticipant, async (req, res) => {
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
router.post("/api/conversations/:id/messages", writeLimiter, requireAuth, require2FA, requireNotBanned, requireConversationParticipant, async (req, res) => {
  const content = sanitize(req.body.content, 500);

  if (!content) {
    return res.status(400).json({ error: "Message cannot be empty" });
  }

  if (profanityCheck(res, { "message": content })) return;

  // Check if either party has blocked the other
  const otherId = req.conversation.participant_1 === req.user.id
    ? req.conversation.participant_2
    : req.conversation.participant_1;
  const { data: blockRows } = await supabase
    .from("blocked_users")
    .select("id")
    .or(`and(blocker_id.eq.${req.user.id},blocked_id.eq.${otherId}),and(blocker_id.eq.${otherId},blocked_id.eq.${req.user.id})`);
  if (blockRows?.length > 0) return res.status(403).json({ error: "Messaging is not available in this conversation." });

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

  // Send push notification to the other participant (otherId already computed above)
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("first_name")
    .eq("id", req.user.id)
    .single();

  const senderName = senderProfile?.first_name || "Someone";
  const preview = content.length > 80 ? content.slice(0, 80) + "..." : content;
  sendPushNotification(otherId, senderName, preview, { conversationId: req.params.id }).catch(() => {});

  res.json(data);
});

export default router;
