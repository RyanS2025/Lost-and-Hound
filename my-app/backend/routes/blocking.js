import express from "express";
import { supabase } from "../lib/supabase.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// Returns all user IDs that should be hidden from the current user's feed/messages
// — both users they've blocked AND users who've blocked them.
// Backend service key bypasses RLS so both directions are readable.
router.get("/api/blocked-ids", requireAuth, async (req, res) => {
  const [myBlocks, blockersOfMe] = await Promise.all([
    supabase.from("blocked_users").select("blocked_id").eq("blocker_id", req.user.id),
    supabase.from("blocked_users").select("blocker_id").eq("blocked_id", req.user.id),
  ]);
  const ids = [
    ...(myBlocks.data ?? []).map(r => r.blocked_id),
    ...(blockersOfMe.data ?? []).map(r => r.blocker_id),
  ];
  res.json({ ids: [...new Set(ids)] });
});

router.post("/api/users/:id/block", requireAuth, async (req, res) => {
  const blockedId = req.params.id;
  if (blockedId === req.user.id) return res.status(400).json({ error: "Cannot block yourself" });
  const { error } = await supabase
    .from("blocked_users")
    .upsert({ blocker_id: req.user.id, blocked_id: blockedId });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

router.delete("/api/users/:id/block", requireAuth, async (req, res) => {
  const { error } = await supabase
    .from("blocked_users")
    .delete()
    .eq("blocker_id", req.user.id)
    .eq("blocked_id", req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

export default router;
