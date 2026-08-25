import express from "express";
import crypto from "crypto";
import { supabase } from "../lib/supabase.js";
import { requireAuth, isAal2Token } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/rateLimiters.js";
import { dbError } from "../lib/validation.js";

const router = express.Router();

router.post("/api/auth/check-device", requireAuth, async (req, res) => {
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
router.post("/api/auth/trust-device", requireAuth, async (req, res) => {
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

router.post("/api/auth/clear-device", requireAuth, async (req, res) => {
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

router.post("/api/auth/reset-password", strictLimiter, requireAuth, async (req, res) => {
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

export default router;
