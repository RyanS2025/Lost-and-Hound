import express from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth, require2FA, requireOwner } from "../middleware/auth.js";
import { dbError } from "../lib/validation.js";
import { sendBroadcastPush } from "../lib/pushNotifications.js";

const router = express.Router();

// Register or update a OneSignal player_id for the current user.
router.post("/api/push-tokens", requireAuth, async (req, res) => {
  const { playerId } = req.body;
  if (!playerId || typeof playerId !== "string") {
    return res.status(400).json({ error: "playerId is required" });
  }

  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { user_id: req.user.id, player_id: playerId },
      { onConflict: "user_id" }
    );

  if (error) return dbError(res, error, "POST /api/push-tokens");
  res.json({ ok: true });
});

// Remove push token on logout.
router.delete("/api/push-tokens", requireAuth, async (req, res) => {
  await supabase.from("push_tokens").delete().eq("user_id", req.user.id);
  res.json({ ok: true });
});

// Mod-only manual trigger for the daily lost items broadcast
router.post("/api/push/broadcast-lost-items", requireAuth, require2FA, requireOwner, async (_req, res) => {
  const { count } = await supabase
    .from("listings")
    .select("item_id", { count: "exact", head: true })
    .neq("resolved", true);

  const n = count ?? 0;
  await sendBroadcastPush(
    "Lost & Hound",
    `There are currently ${n} active posts. Can you lend a paw? \u{1F43E}`,
    { type: "broadcast_lost_items" }
  );
  res.json({ ok: true, count: n });
});

export default router;
