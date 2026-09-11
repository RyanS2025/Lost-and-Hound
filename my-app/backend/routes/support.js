import express from "express";
import { supabase } from "../lib/supabase.js";
import { verifyUploadToken, storagePathFromPublicUrl, pathBelongsToSubject } from "../lib/uploadToken.js";
import { requireAuth, require2FA, requireModerator, requireNotBanned } from "../middleware/auth.js";
import { writeLimiter, strictLimiter } from "../middleware/rateLimiters.js";
import { sanitize, dbError } from "../lib/validation.js";
import { sendPushNotification } from "../lib/pushNotifications.js";
import { sendReplyNotificationEmail, sendTicketConfirmationEmail } from "../lib/email.js";

const router = express.Router();

// ── Support-only constants ───────────────────────────────────

const VALID_TICKET_TYPES = new Set(["Support", "Bug Report", "Feedback"]);

const VALID_SUPPORT_CATEGORIES = new Set([
  // Support
  "Login / Access Issue",
  "Account or Profile Issue",
  "Listing Problem",
  "Messaging Issue",
  "Technical Problem",
  // Bug Report
  "UI / Display Issue",
  "App Crash / Freeze",
  "Feature Not Working",
  "Performance Issue",
  // Feedback
  "Feature Request",
  "Usability Improvement",
  "Design Suggestion",
  "General Feedback",
  // Shared
  "Other",
]);

const SUPPORT_TITLE_MAX = 100;
const SUPPORT_DESC_MAX = 500;
const SUPPORT_NAME_MAX = 50;
const SUPPORT_VALID_STATUSES = new Set(["open", "in_progress", "resolved", "closed"]);

const TICKET_ID_RE = /^\d+$/;
const TICKET_CODE_RE = /^\d{5}$/;

// Generates a random 5-digit code (10000–99999) for user-facing ticket lookup
function generateTicketCode() {
  return String(Math.floor(10000 + Math.random() * 90000));
}

// POST /api/support — authenticated user submits a ticket
router.post("/api/support", writeLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const { ticketType, name, category, subject, description, image_url } = req.body;

  if (!ticketType || !category || !subject || !description) {
    return res.status(400).json({ error: "ticketType, category, subject, and description are required." });
  }
  if (!VALID_TICKET_TYPES.has(ticketType)) {
    return res.status(400).json({ error: "Invalid ticketType." });
  }
  if (!VALID_SUPPORT_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Invalid category." });
  }

  const safeTitle = sanitize(subject, SUPPORT_TITLE_MAX);
  const safeDesc = sanitize(description, SUPPORT_DESC_MAX);

  if (!safeTitle) return res.status(400).json({ error: "Subject is required." });
  if (!safeDesc) return res.status(400).json({ error: "Description is required." });

  // ── Verified-image attach ───────────────────────────────────────────────
  // Matching our storage prefix proves the object is in our bucket; it does
  // NOT prove the object was screened, or that this user uploaded it. Both
  // come from the token /api/verify-image issued.
  let safeImageUrl = null;
  let imageRedacted = false;

  const uploadToken = sanitize(req.body.upload_token, 600);

  if (image_url) {
    const objectPath = storagePathFromPublicUrl(sanitize(image_url, 600));
    if (!objectPath || !pathBelongsToSubject(objectPath, req.user.id)) {
      return res.status(400).json({ error: "Invalid image URL." });
    }
    const check = verifyUploadToken(uploadToken, { subject: req.user.id });
    if (!check.ok || check.kind !== "ok" || check.path !== objectPath) {
      return res.status(400).json({
        error: "That photo wasn't verified. Please re-attach it and try again.",
        code: "IMAGE_NOT_VERIFIED",
      });
    }
    safeImageUrl = sanitize(image_url, 600);
  } else if (req.body.image_redacted === true) {
    const check = verifyUploadToken(uploadToken, { subject: req.user.id });
    if (!check.ok || check.kind !== "blocked") {
      return res.status(400).json({ error: "Invalid redaction token.", code: "IMAGE_NOT_VERIFIED" });
    }
    imageRedacted = true;
  }

  const { data: inserted, error } = await supabase.from("support_tickets").insert({
    user_id: req.user.id,
    name: name ? sanitize(name, SUPPORT_NAME_MAX) : null,
    email: req.user.email || null,
    ticket_type: ticketType,
    category,
    ticket_title: safeTitle,
    ticket_desc: safeDesc,
    image_url: safeImageUrl,
    image_redacted: imageRedacted,
    ticket_code: generateTicketCode(),
  }).select("ticket_code");

  if (error) return dbError(res, error, "POST /api/support");
  const code = inserted?.[0]?.ticket_code;
  // Fire-and-forget — never block the response on email delivery
  sendTicketConfirmationEmail({
    toEmail: req.user.email,
    toName: name ? sanitize(name, SUPPORT_NAME_MAX) : null,
    ticketCode: code,
    ticketType,
    category,
  });
  res.status(201).json({ success: true, ticketCode: code });
});

// POST /api/support/guest — unauthenticated user submits a ticket (from login page)
router.post("/api/support/guest", strictLimiter, async (req, res) => {
  const { ticketType, name, email, category, subject, description, image_url } = req.body;

  if (!ticketType || !name || !email || !category || !subject || !description) {
    return res.status(400).json({ error: "ticketType, name, email, category, subject, and description are required." });
  }
  if (!VALID_TICKET_TYPES.has(ticketType)) {
    return res.status(400).json({ error: "Invalid ticketType." });
  }
  if (!VALID_SUPPORT_CATEGORIES.has(category)) {
    return res.status(400).json({ error: "Invalid category." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const safeName = sanitize(name, SUPPORT_NAME_MAX);
  const safeTitle = sanitize(subject, SUPPORT_TITLE_MAX);
  const safeDesc = sanitize(description, SUPPORT_DESC_MAX);

  if (!safeName) return res.status(400).json({ error: "Name is required." });
  if (!safeTitle) return res.status(400).json({ error: "Subject is required." });
  if (!safeDesc) return res.status(400).json({ error: "Description is required." });

  // ── Verified-image attach (guest) ───────────────────────────────────────
  // "guest" is not an identity, so the token binds to the path rather than to
  // a person. Object names carry a random suffix precisely so that one guest
  // cannot name another's attachment here.
  let safeImageUrl = null;
  let imageRedacted = false;

  const uploadToken = sanitize(req.body.upload_token, 600);

  if (image_url) {
    const objectPath = storagePathFromPublicUrl(sanitize(image_url, 600));
    if (!objectPath || !pathBelongsToSubject(objectPath, "guest")) {
      return res.status(400).json({ error: "Invalid image URL." });
    }
    const check = verifyUploadToken(uploadToken, { subject: "guest" });
    if (!check.ok || check.kind !== "ok" || check.path !== objectPath) {
      return res.status(400).json({
        error: "That photo wasn't verified. Please re-attach it and try again.",
        code: "IMAGE_NOT_VERIFIED",
      });
    }
    safeImageUrl = sanitize(image_url, 600);
  } else if (req.body.image_redacted === true) {
    const check = verifyUploadToken(uploadToken, { subject: "guest" });
    if (!check.ok || check.kind !== "blocked") {
      return res.status(400).json({ error: "Invalid redaction token.", code: "IMAGE_NOT_VERIFIED" });
    }
    imageRedacted = true;
  }

  const { data: inserted, error } = await supabase.from("support_tickets").insert({
    name: safeName,
    email: email.trim().toLowerCase(),
    ticket_type: ticketType,
    category,
    ticket_title: safeTitle,
    ticket_desc: safeDesc,
    image_url: safeImageUrl,
    image_redacted: imageRedacted,
    ticket_code: generateTicketCode(),
  }).select("ticket_code");

  if (error) return dbError(res, error, "POST /api/support/guest");
  const code = inserted?.[0]?.ticket_code;
  sendTicketConfirmationEmail({
    toEmail: email.trim().toLowerCase(),
    toName: safeName,
    ticketCode: code,
    ticketType,
    category,
  });
  res.status(201).json({ success: true, ticketCode: code });
});

// GET /api/support-tickets/guest-status — guest ticket lookup by email + ticket ID
router.get("/api/support-tickets/guest-status", strictLimiter, async (req, res) => {
  const email = sanitize(req.query.email || "", 200).trim().toLowerCase();
  const ticketCode = sanitize(req.query.ticketCode || "", 5).trim();

  if (!email || !ticketCode) {
    return res.status(400).json({ error: "Email and ticket code are required." });
  }
  if (!TICKET_CODE_RE.test(ticketCode)) {
    return res.status(400).json({ error: "Ticket code must be a 5-digit number." });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, ticket_code, ticket_type, category, ticket_title, ticket_desc, status, claimed_by, image_url, image_redacted, created_at, support_replies(id, is_moderator, message, created_at)")
    .eq("ticket_code", ticketCode)
    .eq("email", email)
    .single();

  // Return same error regardless of whether email or code is wrong — prevents enumeration
  if (error || !data) {
    return res.status(404).json({ error: "No ticket found with that email and code." });
  }

  res.json({ ticket: data });
});

// POST /api/support-tickets/guest-reply — guest submits a reply using email + ticket code
router.post("/api/support-tickets/guest-reply", strictLimiter, async (req, res) => {
  const email = sanitize(req.body.email || "", 200).trim().toLowerCase();
  const ticketCode = sanitize(req.body.ticketCode || "", 5).trim();
  const message = sanitize(req.body.message || "", 1000).trim();

  if (!email || !ticketCode || !message) {
    return res.status(400).json({ error: "Email, ticket code, and message are required." });
  }
  if (!TICKET_CODE_RE.test(ticketCode)) {
    return res.status(400).json({ error: "Ticket code must be a 5-digit number." });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: "Invalid email address." });
  }

  const { data: ticket, error: fetchErr } = await supabase
    .from("support_tickets")
    .select("id, status, email, ticket_code")
    .eq("ticket_code", ticketCode)
    .eq("email", email)
    .single();

  if (fetchErr || !ticket) {
    return res.status(404).json({ error: "No ticket found with that email and code." });
  }
  if (ticket.status === "closed") {
    return res.status(400).json({ error: "Cannot reply to a closed ticket." });
  }

  const { data, error } = await supabase
    .from("support_replies")
    .insert({ ticket_id: ticket.id, user_id: null, is_moderator: false, message })
    .select();

  if (error) return dbError(res, error, "POST /api/support-tickets/guest-reply");
  res.status(201).json(data[0]);
});

// GET /api/support — list tickets (moderators only)
router.get("/api/support", requireAuth, require2FA, requireModerator, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 100;
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("support_tickets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return dbError(res, error, "GET /api/support");
  res.json({ tickets: data || [], total: count ?? 0, hasMore: offset + limit < (count ?? 0) });
});

// PATCH /api/support/:id/status — update ticket status (moderators only)
router.patch("/api/support/:id/status", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!TICKET_ID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { status } = req.body;
  if (!status || !SUPPORT_VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status. Must be one of: open, in_progress, resolved, closed." });
  }

  const { error } = await supabase
    .from("support_tickets")
    .update({ status })
    .eq("id", req.params.id);

  if (error) return dbError(res, error, "PATCH /api/support/:id/status");
  res.json({ success: true });
});

// DELETE /api/support/:id — delete ticket (moderators only)
router.delete("/api/support/:id", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!TICKET_ID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { error } = await supabase
    .from("support_tickets")
    .delete()
    .eq("id", req.params.id);

  if (error) return dbError(res, error, "DELETE /api/support/:id");
  res.json({ success: true });
});

// SUPPORT TICKETS ENDPOINTS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Fetch all support tickets with replies (moderators only)
router.get("/api/support-tickets", requireAuth, require2FA, requireModerator, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const ticketType = req.query.ticket_type || null;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("support_tickets")
      .select("id, ticket_code, user_id, ticket_type, category, ticket_title, ticket_desc, name, email, status, image_url, image_redacted, claimed_by, resolved_by, resolved_at, severity, assignee, assignee_id, environment, estimated_effort, repro_steps, fix_notes, fix_pr_url, deadline, created_at, support_replies(id, is_moderator, message, created_at)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (ticketType) query = query.eq("ticket_type", ticketType);

    const { data, error, count } = await query;
    if (error) return dbError(res, error, "fetching support tickets");
    res.json({ tickets: data, hasMore: (count ?? 0) > offset + limit, total: count ?? 0 });
  } catch (error) {
    dbError(res, error, "fetching support tickets");
  }
});

// Fetch current user's own support tickets
router.get("/api/support-tickets/mine", requireAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("support_tickets")
      .select("id, ticket_code, ticket_type, category, ticket_title, ticket_desc, status, claimed_by, image_url, image_redacted, created_at, support_replies(id, is_moderator, message, created_at)", { count: "exact" })
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return dbError(res, error, "fetching user support tickets");
    res.json({ tickets: data, hasMore: (count ?? 0) > offset + limit });
  } catch (error) {
    dbError(res, error, "fetching user support tickets");
  }
});

const SEVERITY_VALUES = new Set(["critical", "high", "medium", "low"]);
const ENVIRONMENT_VALUES = new Set(["web", "ios", "android", "all"]);
const EFFORT_VALUES = new Set(["xs", "s", "m", "l", "xl"]);

// List all moderators (for assignee dropdown)
router.get("/api/moderators", requireAuth, require2FA, requireModerator, async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("is_moderator", true)
      .order("first_name");
    if (error) return dbError(res, error, "GET /api/moderators");
    res.json({ moderators: data.map(m => ({ id: m.id, name: `${m.first_name || ""} ${m.last_name || ""}`.trim() || "Moderator" })) });
  } catch (err) {
    dbError(res, err, "GET /api/moderators");
  }
});

// My Work — tickets assigned to the requesting moderator
router.get("/api/support-tickets/my-work", requireAuth, require2FA, requireModerator, async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 50, 100);
    const page   = Math.max(parseInt(req.query.page)  || 1, 1);
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from("support_tickets")
      .select("id, ticket_code, user_id, ticket_type, category, ticket_title, ticket_desc, name, email, status, image_url, image_redacted, claimed_by, resolved_by, resolved_at, severity, assignee, assignee_id, environment, estimated_effort, repro_steps, fix_notes, fix_pr_url, deadline, created_at, support_replies(id, is_moderator, message, created_at)", { count: "exact" })
      .eq("assignee_id", req.user.id)
      .not("status", "eq", "closed")
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) return dbError(res, error, "GET /api/support-tickets/my-work");
    res.json({ tickets: data, hasMore: offset + limit < (count ?? 0), total: count ?? 0 });
  } catch (err) {
    dbError(res, err, "GET /api/support-tickets/my-work");
  }
});

// Update a support ticket (status + optional engineering fields) — moderators only
router.patch("/api/support-tickets/:id", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!TICKET_ID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { status, severity, assignee, assignee_id, environment, estimated_effort, repro_steps, fix_notes, fix_pr_url, deadline } = req.body;

  // status is optional — can PATCH only engineering fields
  if (status !== undefined && !SUPPORT_VALID_STATUSES.has(status)) {
    return res.status(400).json({ error: "Invalid status." });
  }

  const ENG_FIELDS = ["severity", "assignee", "assignee_id", "environment", "estimated_effort", "repro_steps", "fix_notes", "fix_pr_url", "deadline"];
  const isEngEdit = ENG_FIELDS.some(f => req.body[f] !== undefined);

  try {
    // Ownership check: if ticket has an assignee_id set and this is an eng edit,
    // only the assigned moderator (or any mod changing only status) can edit eng fields.
    if (isEngEdit) {
      const { data: current } = await supabase
        .from("support_tickets")
        .select("assignee_id")
        .eq("id", req.params.id)
        .single();
      if (current?.assignee_id && current.assignee_id !== req.user.id) {
        return res.status(403).json({ error: "This ticket is assigned to another moderator. Only the assigned moderator can edit engineering details." });
      }
    }

    const updates = {};
    if (status !== undefined) updates.status = status;

    // Engineering fields — each validated before applying
    if (severity !== undefined) {
      if (severity !== null && !SEVERITY_VALUES.has(severity)) return res.status(400).json({ error: "Invalid severity." });
      updates.severity = severity;
    }
    if (environment !== undefined) {
      if (environment !== null && !ENVIRONMENT_VALUES.has(environment)) return res.status(400).json({ error: "Invalid environment." });
      updates.environment = environment;
    }
    if (estimated_effort !== undefined) {
      if (estimated_effort !== null && !EFFORT_VALUES.has(estimated_effort)) return res.status(400).json({ error: "Invalid effort value." });
      updates.estimated_effort = estimated_effort;
    }
    if (assignee !== undefined) {
      updates.assignee = assignee ? String(assignee).trim().slice(0, 80) || null : null;
    }
    if (assignee_id !== undefined) {
      updates.assignee_id = assignee_id || null;
    }
    if (repro_steps !== undefined) {
      updates.repro_steps = repro_steps ? String(repro_steps).trim().slice(0, 1000) || null : null;
    }
    if (fix_notes !== undefined) {
      updates.fix_notes = fix_notes ? String(fix_notes).trim().slice(0, 1000) || null : null;
    }
    if (fix_pr_url !== undefined) {
      if (fix_pr_url !== null && !String(fix_pr_url).startsWith("https://")) {
        return res.status(400).json({ error: "fix_pr_url must start with https://" });
      }
      updates.fix_pr_url = fix_pr_url ? String(fix_pr_url).trim().slice(0, 300) : null;
    }
    if (deadline !== undefined) {
      updates.deadline = deadline || null; // ISO string or null
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "Nothing to update." });

    // Auto-claim on start; record resolver on resolve
    if (status === "in_progress" || status === "resolved") {
      const { data: mod } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", req.user.id)
        .single();
      const modName = mod
        ? `${mod.first_name || ""} ${mod.last_name || ""}`.trim() || "Moderator"
        : "Moderator";

      if (status === "in_progress") {
        const { data: current } = await supabase
          .from("support_tickets")
          .select("claimed_by")
          .eq("id", req.params.id)
          .single();
        if (current && !current.claimed_by) updates.claimed_by = modName;
      }
      if (status === "resolved") {
        updates.resolved_by = modName;
        updates.resolved_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from("support_tickets")
      .update(updates)
      .eq("id", req.params.id)
      .select("id, status, claimed_by, resolved_by, resolved_at, severity, assignee, assignee_id, environment, estimated_effort, repro_steps, fix_notes, fix_pr_url, deadline");

    if (error) return dbError(res, error, "updating support ticket");
    if (!data || data.length === 0) return res.status(404).json({ error: "Ticket not found." });
    res.json(data[0]);
  } catch (error) {
    dbError(res, error, "updating support ticket");
  }
});

// Get replies for a support ticket (ticket owner or moderator)
router.get("/api/support-tickets/:id/replies", requireAuth, async (req, res) => {
  if (!TICKET_ID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const { data: ticket } = await supabase.from("support_tickets").select("id, user_id").eq("id", req.params.id).single();
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });

    const { data: profile } = await supabase.from("profiles").select("is_moderator").eq("id", req.user.id).single();
    const isModerator = profile?.is_moderator === true;

    if (ticket.user_id !== req.user.id && !isModerator) return res.status(403).json({ error: "Forbidden." });

    const { data, error } = await supabase
      .from("support_replies")
      .select("id, user_id, is_moderator, message, created_at")
      .eq("ticket_id", req.params.id)
      .order("created_at", { ascending: true });

    if (error) return dbError(res, error, "GET replies");
    res.json({ replies: data });
  } catch (err) {
    dbError(res, err, "GET replies");
  }
});

// Post a reply as the ticket owner (authenticated user, not moderator)
router.post("/api/support-tickets/:id/reply", requireAuth, writeLimiter, async (req, res) => {
  if (!TICKET_ID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });
  const { message } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: "Message is required." });

  try {
    const { data: ticket } = await supabase.from("support_tickets").select("id, user_id, status").eq("id", req.params.id).single();
    if (!ticket) return res.status(404).json({ error: "Ticket not found." });
    if (ticket.user_id !== req.user.id) return res.status(403).json({ error: "Forbidden." });
    if (ticket.status === "closed") return res.status(400).json({ error: "Cannot reply to a closed ticket." });

    const { data, error } = await supabase
      .from("support_replies")
      .insert({ ticket_id: Number(req.params.id), user_id: req.user.id, is_moderator: false, message: sanitize(message, 1000) })
      .select();

    if (error) return dbError(res, error, "POST user reply");
    res.status(201).json(data[0]);
  } catch (err) {
    dbError(res, err, "POST user reply");
  }
});

// Post a reply to a support ticket (moderators only)
router.post("/api/support-tickets/:id/replies", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!TICKET_ID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  try {
    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .select("id, status, claimed_by, email, name, ticket_title, ticket_code, user_id")
      .eq("id", req.params.id)
      .single();

    if (ticketError || !ticket) return res.status(404).json({ error: "Ticket not found." });
    if (ticket.status === "closed") return res.status(400).json({ error: "Cannot reply to a closed ticket." });

    // Check if this is the first moderator reply (for email notification)
    const { count: existingModReplies } = await supabase
      .from("support_replies")
      .select("id", { count: "exact", head: true })
      .eq("ticket_id", req.params.id)
      .eq("is_moderator", true);
    const isFirstModReply = (existingModReplies ?? 0) === 0;

    const safeMessage = sanitize(message, 1000);

    const { data, error } = await supabase
      .from("support_replies")
      .insert({
        ticket_id: Number(req.params.id),
        is_moderator: true,
        message: safeMessage,
      })
      .select();

    if (error) return dbError(res, error, "posting reply");

    // Auto-advance open tickets to in_progress when a moderator replies
    const updates = {};
    if (ticket.status === "open") updates.status = "in_progress";

    // Auto-claim: first moderator to reply becomes the owner
    let moderatorName = "Support Team";
    if (!ticket.claimed_by) {
      const { data: mod } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", req.user.id)
        .single();
      moderatorName = mod
        ? `${mod.first_name || ""} ${mod.last_name || ""}`.trim() || "Support Team"
        : "Support Team";
      updates.claimed_by = moderatorName;
    } else {
      moderatorName = ticket.claimed_by;
    }

    if (Object.keys(updates).length > 0) {
      await supabase.from("support_tickets").update(updates).eq("id", req.params.id);
    }

    // Send email only on the first mod reply — fire-and-forget
    if (isFirstModReply && ticket.email) {
      sendReplyNotificationEmail({
        toEmail: ticket.email,
        toName: ticket.name || null,
        ticketTitle: ticket.ticket_title,
        ticketCode: ticket.ticket_code,
        replyMessage: safeMessage,
        moderatorName,
      });
    }

    // Push notification to authenticated ticket owner on every mod reply
    if (ticket.user_id) {
      const replyPreview = safeMessage.length > 100 ? safeMessage.slice(0, 97) + "…" : safeMessage;
      sendPushNotification(
        ticket.user_id,
        "Support reply from the team",
        replyPreview,
        { type: "support_reply", ticketId: ticket.id }
      ).catch(() => {});
    }

    res.status(201).json(data[0]);
  } catch (error) {
    dbError(res, error, "posting reply");
  }
});

export default router;
