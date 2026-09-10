import express from "express";
import { supabase } from "../lib/supabase.js";
import { generalLimiter, strictLimiter } from "../middleware/rateLimiters.js";
import { requireAuth, require2FA, requireModerator } from "../middleware/auth.js";

const router = express.Router();

const REFERRAL_SOURCES = new Set([
  "word_of_mouth", "social_media", "northeastern_website",
  "professor_class", "flyer_poster", "oasis_event", "other",
]);

// GET /api/stats/user-count — no auth, shown on the login page community counter
router.get("/api/stats/user-count", generalLimiter, async (_req, res) => {
  try {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if (error) return res.json({ count: 0 });
    res.json({ count: count ?? 0 });
  } catch {
    res.json({ count: 0 });
  }
});

// GET /api/stats/overview — mod-only, used by the Stats page
router.get("/api/stats/overview", requireAuth, require2FA, requireModerator, async (_req, res) => {
  try {
    const [usersRes, ticketsRes, reportsRes, referralsRes] = await Promise.all([
      supabase.from("profiles").select("id, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(5000),
      supabase.from("support_tickets").select("id, ticket_type, status", { count: "exact" }).limit(5000),
      supabase.from("reports").select("id, status", { count: "exact" }).limit(5000),
      supabase.from("referral_sources").select("source").limit(5000),
    ]);

    const users    = usersRes.data    || [];
    const tickets  = ticketsRes.data  || [];
    const reports  = reportsRes.data  || [];
    const refs     = referralsRes.data || [];

    // Referral counts by source
    const referralCounts = {};
    for (const r of refs) referralCounts[r.source] = (referralCounts[r.source] || 0) + 1;

    // New users in last 7 and 30 days
    const now   = new Date();
    const day7  = new Date(now - 7  * 86400000);
    const day30 = new Date(now - 30 * 86400000);
    const newUsers7  = users.filter(u => new Date(u.created_at) >= day7).length;
    const newUsers30 = users.filter(u => new Date(u.created_at) >= day30).length;

    // Users per day for the last 30 days (for sparkline)
    const usersByDay = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      usersByDay[key] = 0;
    }
    for (const u of users) {
      const key = new Date(u.created_at).toISOString().slice(0, 10);
      if (key in usersByDay) usersByDay[key]++;
    }

    res.json({
      users: {
        total:    usersRes.count  ?? users.length,
        new7:     newUsers7,
        new30:    newUsers30,
        byDay:    usersByDay,
      },
      tickets: {
        total:    ticketsRes.count ?? tickets.length,
        bugs:     tickets.filter(t => t.ticket_type === "Bug Report").length,
        support:  tickets.filter(t => t.ticket_type === "Support").length,
        feedback: tickets.filter(t => t.ticket_type === "Feedback").length,
        open:     tickets.filter(t => t.status === "open").length,
      },
      reports: {
        total:   reportsRes.count ?? reports.length,
        pending: reports.filter(r => r.status === "pending").length,
      },
      referrals: {
        total:  refs.length,
        counts: referralCounts,
      },
    });
  } catch (err) {
    console.error("Stats overview error:", err);
    res.status(500).json({ error: "Failed to load stats" });
  }
});

// POST /api/referral — no auth; logs source only (no profile writes on unauthenticated endpoint)
router.post("/api/referral", strictLimiter, async (req, res) => {
  const { source } = req.body || {};
  if (!source || !REFERRAL_SOURCES.has(source)) {
    return res.status(400).json({ error: "Invalid source" });
  }
  const { error } = await supabase.from("referral_sources").insert({ source });
  if (error) return res.status(500).json({ error: "Failed to save referral" });
  res.json({ success: true });
});

// POST /api/referral/user — auth required; one-time poll for existing users
// Records source (optional) and marks profile as answered so poll never shows again
router.post("/api/referral/user", requireAuth, require2FA, async (req, res) => {
  const { source } = req.body || {};
  try {
    if (source && REFERRAL_SOURCES.has(source)) {
      await supabase.from("referral_sources").insert({ source });
    }
    await supabase.from("profiles").update({ referral_answered: true }).eq("id", req.user.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to record response." });
  }
});

export default router;
