import express from "express";
import { supabase } from "../lib/supabase.js";
import { STAFF_LISTING_COLUMNS, LISTING_LOCATION_EMBED } from "./listings.js";
import { sanitize, profanityCheck, UUID_RE, dbError, logModAction } from "../lib/validation.js";
import { sendPushNotification } from "../lib/pushNotifications.js";
import { requireAuth, require2FA, requireModerator, requireNotBanned } from "../middleware/auth.js";
import { strictLimiter } from "../middleware/rateLimiters.js";

const router = express.Router();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REPORTS ROUTES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Users submit reports against a listing or another user. Moderators review them and
// issue a decision: no violation, or a 3-day / 30-day / permanent ban. Bans can be reversed.
// For theft reports, GET /reports enriches the response with conversation context so
// moderators can see who first contacted the poster about the item.

router.post("/api/reports", strictLimiter, requireAuth, require2FA, requireNotBanned, async (req, res) => {
  const reason = sanitize(req.body.reason, 200);
  const details = sanitize(req.body.details, 2000) || null;
  const reported_listing_id = req.body.reported_listing_id || null;
  let reported_user_id = req.body.reported_user_id || null;

  if (!reason) {
    return res.status(400).json({ error: "Reason is required" });
  }

  if (!reported_listing_id && !reported_user_id) {
    return res.status(400).json({ error: "Must report either a listing or a user" });
  }

  if (reported_listing_id && !reported_user_id) {
    const { data: listingTarget } = await supabase
      .from("listings")
      .select("poster_id")
      .eq("item_id", reported_listing_id)
      .maybeSingle();

    // Snapshot the reported user for listing reports so email lookups survive later listing deletion.
    if (listingTarget?.poster_id) {
      reported_user_id = listingTarget.poster_id;
    }
  }

  if (reported_user_id === req.user.id) {
    return res.status(400).json({ error: "Cannot report yourself" });
  }

  const { data, error } = await supabase
    .from("reports")
    .insert({
      reporter_id: req.user.id,
      reported_listing_id,
      reported_user_id,
      reason,
      details,
      status: "pending",
    })
    .select("*")
    .single();

  if (error) return dbError(res, error, "POST /api/reports");
  res.json(data);
});

router.get("/api/reports", requireAuth, require2FA, requireModerator, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const { data, error, count } = await supabase
    .from("reports")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return dbError(res, error, "GET /api/reports");
  if (!data || data.length === 0) return res.json({ reports: [], listings: {}, page, limit, total: count ?? 0, hasMore: false });

  const userIds = new Set();
  data.forEach((r) => {
    if (r.reporter_id) userIds.add(r.reporter_id);
    if (r.reported_user_id) userIds.add(r.reported_user_id);
  });

  const { data: profilesData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [...userIds]);

  const profileMap = {};
  (profilesData || []).forEach((p) => { profileMap[p.id] = p; });

  const listingIds = data.map((r) => r.reported_listing_id).filter(Boolean);
  const listingMap = {};
  if (listingIds.length > 0) {
    const { data: listingsData } = await supabase
      .from("listings")
      // Staff projection: this route is gated by requireModerator above, and
      // the moderator UI shows the withheld details alongside the public text.
      .select(`${STAFF_LISTING_COLUMNS}, ${LISTING_LOCATION_EMBED}`)
      .in("item_id", listingIds);
    (listingsData || []).forEach((l) => { listingMap[l.item_id] = l; });
  }

  const isStolenReport = (report) => {
    const reason = (report?.reason || "").toLowerCase();
    const details = (report?.details || "").toLowerCase();
    return reason.includes("stolen") || details.includes("stolen") || reason.includes("theft") || details.includes("theft");
  };

  const stolenListingIds = data
    .filter((r) => isStolenReport(r) && r.reported_listing_id)
    .map((r) => r.reported_listing_id);

  const stolenClaimantByListingId = {};
  const firstConvoByListingId = {};
  if (stolenListingIds.length > 0) {
    const { data: convoData } = await supabase
      .from("conversations")
      .select("listing_id, participant_1, participant_2, created_at")
      .in("listing_id", stolenListingIds)
      .order("created_at", { ascending: true });

    for (const convo of convoData || []) {
      if (convo?.listing_id && !firstConvoByListingId[convo.listing_id]) {
        firstConvoByListingId[convo.listing_id] = convo;
      }

      if (!convo?.listing_id || stolenClaimantByListingId[convo.listing_id]) continue;
      const listingPosterId = listingMap[convo.listing_id]?.poster_id || null;

      if (listingPosterId && convo.participant_1 !== listingPosterId) {
        stolenClaimantByListingId[convo.listing_id] = convo.participant_1;
      } else if (listingPosterId && convo.participant_2 !== listingPosterId) {
        stolenClaimantByListingId[convo.listing_id] = convo.participant_2;
      } else {
        stolenClaimantByListingId[convo.listing_id] = convo.participant_1 || convo.participant_2 || null;
      }
    }
  }

  const emailUserIds = new Set();
  for (const r of data) {
    if (r.reporter_id) emailUserIds.add(r.reporter_id);
    if (r.reported_user_id) emailUserIds.add(r.reported_user_id);
    if (r.reported_listing_id && listingMap[r.reported_listing_id]?.poster_id) {
      emailUserIds.add(listingMap[r.reported_listing_id].poster_id);
    }
    if (r.reported_listing_id && stolenClaimantByListingId[r.reported_listing_id]) {
      emailUserIds.add(stolenClaimantByListingId[r.reported_listing_id]);
    }
  }

  const emailMap = {};
  const unresolvedEmailIds = new Set();
  await Promise.all(
    [...emailUserIds].map(async (uid) => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.admin.getUserById(uid);
        if (!userErr && userData?.user?.email) {
          emailMap[uid] = userData.user.email;
          return;
        }
        unresolvedEmailIds.add(uid);
      } catch {
        // Keep missing emails as null so dashboard can render a fallback label.
        unresolvedEmailIds.add(uid);
      }
    })
  );

  // Fallback for any unresolved IDs: scan auth users pages and map matching IDs.
  if (unresolvedEmailIds.size > 0) {
    let page = 1;
    const perPage = 200;

    while (unresolvedEmailIds.size > 0) {
      const { data: usersPage, error: usersErr } = await supabase.auth.admin.listUsers({ page, perPage });
      if (usersErr) break;

      const users = usersPage?.users || [];
      if (users.length === 0) break;

      for (const u of users) {
        if (u?.id && unresolvedEmailIds.has(u.id) && u.email) {
          emailMap[u.id] = u.email;
          unresolvedEmailIds.delete(u.id);
        }
      }

      if (users.length < perPage) break;
      page += 1;
    }
  }

  const enriched = data.map((r) => ({
    ...r,
    reporter: profileMap[r.reporter_id] || null,
    reportedUser: profileMap[r.reported_user_id] || null,
    reportedListing: listingMap[r.reported_listing_id] || null,
    stolenContext: (() => {
      if (!isStolenReport(r)) return null;

      const listingId = r.reported_listing_id;
      const listingPosterId = listingMap[listingId]?.poster_id || null;
      const firstConvo = listingId ? firstConvoByListingId[listingId] : null;

      const inferredReportedFromConvo = firstConvo
        ? (firstConvo.participant_1 === r.reporter_id
          ? firstConvo.participant_2
          : (firstConvo.participant_2 === r.reporter_id ? firstConvo.participant_1 : null))
        : null;

      const reportedPersonId = r.reported_user_id || listingPosterId || inferredReportedFromConvo || null;
      const claimedMinePersonId = listingId
        ? (stolenClaimantByListingId[listingId] || r.reporter_id || null)
        : (r.reporter_id || null);
      const reporterId = r.reporter_id || null;

      return {
        reportedPersonId,
        claimedMinePersonId,
        reporterId,
        reportedPersonEmail: reportedPersonId ? (emailMap[reportedPersonId] || null) : null,
        claimedMinePersonEmail: claimedMinePersonId ? (emailMap[claimedMinePersonId] || null) : null,
        reporterEmail: reporterId ? (emailMap[reporterId] || null) : null,
      };
    })(),
  }));

  res.json({ reports: enriched, listings: listingMap, page, limit, total: count ?? 0, hasMore: offset + limit < (count ?? 0) });
});

router.patch("/api/reports/:id/status", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const status = sanitize(req.body.status, 20);
  const validStatuses = ["pending", "reviewed", "dismissed"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status. Must be: pending, reviewed, or dismissed" });
  }

  const { error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", req.params.id);

  if (error) return dbError(res, error, "PATCH /api/reports/status");
  res.json({ success: true });
});

router.delete("/api/reports/:id", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { error } = await supabase
    .from("reports")
    .delete()
    .eq("id", req.params.id);

  if (error) return dbError(res, error, "DELETE /api/reports");
  logModAction(req.user.id, "delete_report", req.params.id, { deleted_report_id: req.params.id });
  res.json({ success: true });
});

router.post("/api/reports/:id/decision", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { decision, mod_note } = req.body;
  const validDecisions = ["no_violation", "violation_3", "violation_30", "violation_permanent"];

  if (!validDecisions.includes(decision)) {
    return res.status(400).json({ error: "Invalid decision" });
  }

  const { data: report, error: reportErr } = await supabase
    .from("reports")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (reportErr) return res.status(404).json({ error: "Report not found" });

  if (decision === "no_violation") {
    await supabase.from("reports").update({ status: "dismissed" }).eq("id", report.id);
    logModAction(req.user.id, "report_decision", req.params.id, {
      decision,
      banned_user_id: null,
      mod_note: mod_note ?? null,
    });
    return res.json({ success: true, action: "dismissed" });
  }

  let banned_until;
  if (decision === "violation_3") {
    banned_until = new Date(Date.now() + 3 * 86400000).toISOString();
  } else if (decision === "violation_30") {
    banned_until = new Date(Date.now() + 30 * 86400000).toISOString();
  } else {
    banned_until = "9999-12-31T23:59:59Z";
  }

  const isPost = !!report.reported_listing_id;

  let banUserId;
  if (isPost) {
    const { data: listing } = await supabase
      .from("listings")
      .select("poster_id")
      .eq("item_id", report.reported_listing_id)
      .single();
    banUserId = listing?.poster_id;
  } else {
    banUserId = report.reported_user_id;
  }

  if (isPost && report.reported_listing_id) {
    await supabase.from("listings").delete().eq("item_id", report.reported_listing_id);
  } else if (!isPost && report.reporter_id && report.reported_user_id) {
    const { data: convos } = await supabase
      .from("conversations")
      .select("id")
      .or(
        `and(participant_1.eq.${report.reporter_id},participant_2.eq.${report.reported_user_id}),` +
        `and(participant_1.eq.${report.reported_user_id},participant_2.eq.${report.reporter_id})`
      );
    if (convos) {
      for (const c of convos) {
        await supabase.from("messages").delete().eq("conversation_id", c.id);
        await supabase.from("conversations").delete().eq("id", c.id);
      }
    }
  }

  if (banUserId) {
    const banLabel =
      decision === "violation_3" ? "3-day ban" :
      decision === "violation_30" ? "30-day ban" : "Permanent ban";

    const ban_reason = mod_note
      ? `${banLabel}: ${sanitize(mod_note, 500)}`
      : `${banLabel}: ${report.reason}`;

    await supabase
      .from("profiles")
      .update({ banned_until, ban_reason })
      .eq("id", banUserId);
  }

  const column = isPost ? "reported_listing_id" : "reported_user_id";
  const targetId = isPost ? report.reported_listing_id : report.reported_user_id;

  await supabase
    .from("reports")
    .update({ status: "reviewed" })
    .eq(column, targetId);

  logModAction(req.user.id, "report_decision", req.params.id, {
    decision,
    banned_user_id: banUserId ?? null,
    mod_note: mod_note ?? null,
  });

  res.json({ success: true, action: "violation", banned_user_id: banUserId });
});

router.post("/api/reports/:id/reverse-ban", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: "Invalid id" });

  const { data: report, error: reportErr } = await supabase
    .from("reports")
    .select("*")
    .eq("id", req.params.id)
    .single();

  if (reportErr) return res.status(404).json({ error: "Report not found" });

  const isPost = !!report.reported_listing_id;
  let banUserId;

  if (isPost) {
    const { data: listing } = await supabase
      .from("listings")
      .select("poster_id")
      .eq("item_id", report.reported_listing_id)
      .maybeSingle();
    banUserId = listing?.poster_id;
  } else {
    banUserId = report.reported_user_id;
  }

  if (!banUserId) return res.status(400).json({ error: "Cannot determine user to unban" });

  const { error: unbanErr } = await supabase
    .from("profiles")
    .update({ banned_until: null, ban_reason: null })
    .eq("id", banUserId);

  if (unbanErr) return dbError(res, unbanErr, "POST /api/reports/reverse-ban");

  await supabase.from("reports").update({ status: "pending" }).eq("id", report.id);

  logModAction(req.user.id, "reverse_ban", req.params.id, { unbanned_user_id: banUserId });

  res.json({ success: true });
});

router.get("/api/reports/ban-info/:userId", requireAuth, require2FA, requireModerator, async (req, res) => {
  if (!UUID_RE.test(req.params.userId)) return res.status(400).json({ error: "Invalid userId" });

  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, banned_until, ban_reason")
    .eq("id", req.params.userId)
    .single();

  if (error) return res.status(404).json({ error: "User not found" });
  res.json(data);
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MOD MESSAGE VIEWER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Moderator-only endpoint to read the conversation between a reporter and a reported user,
// used to provide evidence context when reviewing harassment or theft reports.

router.get("/api/mod/messages", requireAuth, require2FA, requireModerator, async (req, res) => {
  const { reporter, reported } = req.query;
  if (!reporter || !reported) {
    return res.status(400).json({ error: "Missing reporter/reported params" });
  }

  if (!UUID_RE.test(reporter) || !UUID_RE.test(reported)) {
    return res.status(400).json({ error: "Invalid reporter or reported id" });
  }

  const { data: convos } = await supabase
    .from("conversations")
    .select("id")
    .or(
      `and(participant_1.eq.${reporter},participant_2.eq.${reported}),` +
      `and(participant_1.eq.${reported},participant_2.eq.${reporter})`
    );

  if (!convos || convos.length === 0) {
    return res.json({ messages: [], profiles: {} });
  }

  const convoIds = convos.map((c) => c.id);

  const { data: msgs } = await supabase
    .from("messages")
    .select("*")
    .in("conversation_id", convoIds)
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: profileData } = await supabase
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", [reporter, reported]);

  const profileMap = {};
  (profileData || []).forEach((p) => { profileMap[p.id] = p; });

  res.json({ messages: msgs || [], profiles: profileMap });
});

export default router;
