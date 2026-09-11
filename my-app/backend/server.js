// MUST be the first import. ESM evaluates every imported module before this
// file's body runs, and ./lib/supabase.js reads process.env at module scope —
// so a `dotenv.config()` call further down loads the .env file too late to be
// of any use to it. The side-effect form runs during import evaluation, in
// declaration order, which is early enough.
//
// On Railway there is no .env file and dotenv quietly does nothing; the
// platform's injected variables are already in process.env. This only changes
// behaviour for local development, where it makes my-app/backend/.env work.
import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import path from "path";
import { fileURLToPath } from "url";

import { supabase } from "./lib/supabase.js";
import { generalLimiter } from "./middleware/rateLimiters.js";
import { sendUnreadMessageEmail } from "./lib/email.js";
import { sendBroadcastPush } from "./lib/pushNotifications.js";

import statsRouter from "./routes/stats.js";
import authRouter from "./routes/auth.js";
import passkeysRouter from "./routes/passkeys.js";
import profileRouter from "./routes/profile.js";
import listingsRouter from "./routes/listings.js";
import locationsRouter from "./routes/locations.js";
import messagesRouter from "./routes/messages.js";
import blockingRouter from "./routes/blocking.js";
import reportsRouter from "./routes/reports.js";
import supportRouter from "./routes/support.js";
import dashboardRouter from "./routes/dashboard.js";
import pushRouter from "./routes/push.js";
import financesRouter from "./routes/finances.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── Security headers ──────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://maps.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      connectSrc: ["'self'", "https://*.supabase.co", "wss://*.supabase.co", "https://maps.googleapis.com"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
}));

// ── CORS ──────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));

// ── Rate limiting ─────────────────────────────────────────
app.use("/api/", generalLimiter);

// ── API routes ────────────────────────────────────────────
app.use(statsRouter);
app.use(authRouter);
app.use(passkeysRouter);
app.use(profileRouter);
app.use(listingsRouter);
app.use(locationsRouter);
app.use(messagesRouter);
app.use(blockingRouter);
app.use(reportsRouter);
app.use(supportRouter);
app.use(dashboardRouter);
app.use(pushRouter);
app.use(financesRouter);

// ── API 404 catch-all ─────────────────────────────────────
app.all("/api/{*path}", (req, res) => {
  console.log(`[404] No route matched: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Not found" });
});

// ── Static frontend (Vite build output) ───────────────────
const distPath = path.join(__dirname, "../dist");

app.use(express.static(distPath, {
  maxAge: "1y",
  immutable: true,
  index: false,
}));

// SPA catch-all — serve index.html for all non-API routes
app.get("{*path}", (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

// ── Cron: unread message email notifications (hourly) ─────
async function processUnreadMessageNotifications() {
  const { resend } = await import("./lib/resend.js");
  if (!resend || !process.env.RESEND_FROM) return;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: msgs, error: msgsErr } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id")
    .eq("read", false)
    .eq("email_notified", false)
    .lt("created_at", cutoff);

  if (msgsErr) { console.error("[UnreadNotif] Query error:", msgsErr.message); return; }
  if (!msgs?.length) return;

  const convIds = [...new Set(msgs.map((m) => m.conversation_id))];
  const { data: convos } = await supabase
    .from("conversations")
    .select("id, participant_1, participant_2")
    .in("id", convIds);
  if (!convos?.length) return;

  const convMap = Object.fromEntries(convos.map((c) => [c.id, c]));

  const byRecipient = {};
  for (const msg of msgs) {
    const conv = convMap[msg.conversation_id];
    if (!conv) continue;
    const recipient = conv.participant_1 === msg.sender_id ? conv.participant_2 : conv.participant_1;
    if (!byRecipient[recipient]) byRecipient[recipient] = { messageIds: [], convIds: new Set() };
    byRecipient[recipient].messageIds.push(msg.id);
    byRecipient[recipient].convIds.add(msg.conversation_id);
  }

  const recipientIds = Object.keys(byRecipient);
  if (!recipientIds.length) return;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email_notifications_enabled")
    .in("id", recipientIds);
  const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]));

  const notifiedIds = [];

  for (const [recipientId, { messageIds, convIds }] of Object.entries(byRecipient)) {
    try {
      const { data: { user: authUser } } = await supabase.auth.admin.getUserById(recipientId);
      const email = authUser?.email;
      if (!email) continue;

      const profile = profileMap[recipientId];
      if (profile?.email_notifications_enabled === false) continue;

      const name = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || null : null;

      await sendUnreadMessageEmail({
        toEmail: email,
        toName: name,
        messageCount: messageIds.length,
        conversationCount: convIds.size,
      });

      notifiedIds.push(...messageIds);
    } catch (err) {
      console.error(`[UnreadNotif] Failed for user ${recipientId}:`, err?.message);
    }
  }

  if (notifiedIds.length > 0) {
    await supabase.from("messages").update({ email_notified: true }).in("id", notifiedIds);
    console.log(`[UnreadNotif] Notified ${Object.keys(byRecipient).length} users, ${notifiedIds.length} messages marked.`);
  }
}

cron.schedule("0 * * * *", () => {
  processUnreadMessageNotifications().catch((err) =>
    console.error("[UnreadNotif] Cron error:", err)
  );
});

// Daily lost items broadcast at 10am ET (15:00 UTC)
cron.schedule("0 15 * * *", () => {
  supabase
    .from("listings")
    .select("item_id", { count: "exact", head: true })
    .neq("resolved", true)
    .then(({ count }) => {
      if (!count || count === 0) return;
      return sendBroadcastPush(
        "Lost & Hound",
        `There are currently ${count} active posts. Can you lend a paw? 🐾`,
        { type: "broadcast_lost_items" }
      );
    })
    .catch((err) => console.error("[BroadcastCron]", err));
});

// ── Start server ──────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
