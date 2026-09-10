import express from "express";
import { supabase } from "../lib/supabase.js";
import { dbError } from "../lib/validation.js";
import { requireAuth, require2FA, requireModerator } from "../middleware/auth.js";

const router = express.Router();

// Dashboard summary — lightweight counts for the overview page
router.get("/api/dashboard/summary", requireAuth, require2FA, requireModerator, async (req, res) => {
  const userId = req.user.id;
  try {
    const [reportsRes, ticketsRes, myWorkRes] = await Promise.all([
      supabase.from("reports").select("id, status, reason, details").limit(5000),
      supabase.from("support_tickets").select("id, ticket_type, status, severity, deadline, claimed_by").limit(5000),
      supabase.from("support_tickets").select("id, status, deadline").eq("assignee_id", userId).not("status", "in", '("closed","resolved")'),
    ]);

    const reports = reportsRes.data || [];
    const tickets = ticketsRes.data || [];
    const myWork  = myWorkRes.data || [];

    const isStolen = (r) => {
      const reason  = (r.reason  || "").toLowerCase();
      const details = (r.details || "").toLowerCase();
      return reason.includes("stolen") || details.includes("stolen")
          || reason.includes("theft")  || details.includes("theft");
    };

    const regular = reports.filter(r => !isStolen(r));
    const stolen  = reports.filter(r =>  isStolen(r));
    const feedback = tickets.filter(t => t.ticket_type === "Feedback");
    const bugs     = tickets.filter(t => t.ticket_type === "Bug Report");
    const support  = tickets.filter(t => t.ticket_type === "Support");
    const now = new Date();

    res.json({
      reports: {
        pending:   regular.filter(r => r.status === "pending").length,
        reviewed:  regular.filter(r => r.status === "reviewed").length,
        dismissed: regular.filter(r => r.status === "dismissed").length,
      },
      stolen: {
        pending: stolen.filter(r => r.status === "pending").length,
        total:   stolen.length,
      },
      feedback: {
        open:        feedback.filter(t => t.status === "open").length,
        in_progress: feedback.filter(t => t.status === "in_progress").length,
      },
      bugs: {
        open:        bugs.filter(t => t.status === "open").length,
        in_progress: bugs.filter(t => t.status === "in_progress").length,
        critical:    bugs.filter(t => t.severity === "critical" && !["closed","resolved"].includes(t.status)).length,
      },
      support: {
        open:        support.filter(t => t.status === "open").length,
        unclaimed:   support.filter(t => t.status === "open" && !t.claimed_by).length,
        in_progress: support.filter(t => t.status === "in_progress").length,
      },
      myWork: {
        total:   myWork.length,
        overdue: myWork.filter(t => t.deadline && new Date(t.deadline) < now).length,
      },
    });
  } catch (err) {
    console.error("Dashboard summary error:", err);
    res.status(500).json({ error: "Failed to load summary" });
  }
});

export default router;
