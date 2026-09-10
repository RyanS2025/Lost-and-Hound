import crypto from "crypto";
import { supabase } from "../lib/supabase.js";

export async function requireAuth(req, res, next) {
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

export function decodeJwtPayload(token) {
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

export function isAal2Token(token) {
  const payload = decodeJwtPayload(token);
  return payload?.aal === "aal2";
}

export async function require2FA(req, res, next) {
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

  if (isAal2Token(req.accessToken)) {
    return next();
  }

  return res.status(403).json({ error: "2FA_REQUIRED" });
}

export async function requireModerator(req, res, next) {
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

export async function requireOwner(req, res, next) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", req.user.id)
    .single();

  if (!profile?.is_owner) {
    return res.status(403).json({ error: "Forbidden" });
  }

  next();
}

export async function requireNotBanned(req, res, next) {
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

export async function requireConversationParticipant(req, res, next) {
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
