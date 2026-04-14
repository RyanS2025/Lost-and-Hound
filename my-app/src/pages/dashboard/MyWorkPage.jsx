import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box, Typography, Paper, Button, CircularProgress, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import apiFetch from "../../utils/apiFetch";
import { myWorkCache } from "../../utils/dashboardPrefetch";
import { SEVERITY_OPTIONS, SEVERITY_OPTIONS_DARK } from "../../components/dashboard/dashboardConstants";
import TicketDetailModal from "../../components/dashboard/TicketDetailModal";
import SectionPageHeader from "../../components/dashboard/SectionPageHeader";

// ─── Progress Ring ────────────────────────────────────────────────────────────

function ProgressRing({ resolved, total, inProgress, open, overdue, onRefresh, isDark }) {
  const R = 46;
  const STROKE = 8;
  const r = R - STROKE / 2;
  const circ = 2 * Math.PI * r;
  const pct = total > 0 ? resolved / total : 0;
  const dashOffset = circ * (1 - pct);

  return (
    <Box sx={{
      p: { xs: 2, sm: 2.5 },
      borderRadius: 3,
      background: isDark ? "#1A1A1B" : "#fff",
      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ecdcdc",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 1.5,
    }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8 }}>
          Progress
        </Typography>
        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 13 }} />}
          onClick={onRefresh}
          sx={{ fontSize: 11, textTransform: "none", color: "text.secondary", minWidth: 0, px: 0.75, py: 0.25,
            "&:hover": { background: isDark ? "#343536" : "#f5f5f5" } }}
        >
          Refresh
        </Button>
      </Box>

      {/* SVG donut ring */}
      <Box sx={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width={R * 2} height={R * 2} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={R} cy={R} r={r} fill="none"
            stroke={isDark ? "rgba(255,255,255,0.07)" : "#f0eded"}
            strokeWidth={STROKE}
          />
          <circle
            cx={R} cy={R} r={r} fill="none"
            stroke="#A84D48" strokeWidth={STROKE} strokeLinecap="round"
            strokeDasharray={`${circ} ${circ}`}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1)" }}
          />
        </svg>
        <Box sx={{ position: "absolute", textAlign: "center" }}>
          <Typography sx={{ fontSize: 22, fontWeight: 800, lineHeight: 1, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
            {Math.round(pct * 100)}%
          </Typography>
          <Typography sx={{ fontSize: 10, color: "text.secondary", mt: 0.25 }}>done</Typography>
        </Box>
      </Box>

      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
        {resolved} of {total} resolved
      </Typography>

      {/* Status breakdown chips */}
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "center" }}>
        {inProgress > 0 && (
          <Box sx={{ fontSize: 11, fontWeight: 600, px: 1.25, py: 0.4, borderRadius: 99,
            background: isDark ? "#3a2f22" : "#fffbeb", color: isDark ? "#f6c66a" : "#92400e",
            border: `1px solid ${isDark ? "#b7791f" : "#fcd34d"}` }}>
            In Progress · {inProgress}
          </Box>
        )}
        {open > 0 && (
          <Box sx={{ fontSize: 11, fontWeight: 600, px: 1.25, py: 0.4, borderRadius: 99,
            background: isDark ? "#1e2a1e" : "#f0fdf4", color: isDark ? "#6ee7b7" : "#166534",
            border: `1px solid ${isDark ? "#276749" : "#bbf7d0"}` }}>
            Open · {open}
          </Box>
        )}
        {overdue > 0 && (
          <Box sx={{ fontSize: 11, fontWeight: 600, px: 1.25, py: 0.4, borderRadius: 99,
            background: isDark ? "#3b1a1a" : "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5" }}>
            Overdue · {overdue}
          </Box>
        )}
        {total === 0 && (
          <Typography sx={{ fontSize: 12, color: "text.disabled" }}>No tickets assigned</Typography>
        )}
      </Box>
    </Box>
  );
}

// ─── Deadline Calendar ────────────────────────────────────────────────────────

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Su","Mo","Tu","We","Th","Fr","Sa"];

function DeadlineCalendar({ tickets, onSelectTicket, isDark }) {
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const [calDate, setCalDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [upcomingOpen, setUpcomingOpen] = useState(false);
  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Build "YYYY-MM-DD" → ticket[] map
  const deadlineMap = {};
  tickets.forEach((t) => {
    if (!t.deadline) return;
    const d = new Date(t.deadline);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!deadlineMap[key]) deadlineMap[key] = [];
    deadlineMap[key].push(t);
  });

  const upcomingCount = Object.entries(deadlineMap)
    .filter(([k]) => k >= todayKey)
    .reduce((s, [, v]) => s + v.length, 0);

  // Padding nulls + day numbers
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <Box sx={{
      p: { xs: 2, sm: 2.5 },
      borderRadius: 3,
      background: isDark ? "#1A1A1B" : "#fff",
      border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ecdcdc",
    }}>
      {/* Month navigation header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 13, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8 }}>
          Deadlines
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Typography sx={{ fontSize: 12, fontWeight: 600, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
            {MONTH_NAMES[month].slice(0, 3)} {year}
          </Typography>
          <Box
            component="button"
            onClick={() => setCalDate(new Date(year, month - 1, 1))}
            sx={{ border: "none", background: "none", cursor: "pointer", p: 0.25, borderRadius: 1,
              display: "inline-flex", alignItems: "center", color: "text.secondary",
              "&:hover": { background: isDark ? "#333" : "#f0f0f0" } }}
          >
            <ChevronLeftIcon sx={{ fontSize: 16 }} />
          </Box>
          <Box
            component="button"
            onClick={() => setCalDate(new Date(year, month + 1, 1))}
            sx={{ border: "none", background: "none", cursor: "pointer", p: 0.25, borderRadius: 1,
              display: "inline-flex", alignItems: "center", color: "text.secondary",
              "&:hover": { background: isDark ? "#333" : "#f0f0f0" } }}
          >
            <ChevronRightIcon sx={{ fontSize: 16 }} />
          </Box>
        </Box>
      </Box>

      {/* Weekday labels */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", mb: 0.5 }}>
        {DAY_LABELS.map((l) => (
          <Typography key={l} sx={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "text.disabled", py: 0.25 }}>
            {l}
          </Typography>
        ))}
      </Box>

      {/* Day cells */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "2px" }}>
        {cells.map((day, i) => {
          if (day === null) return <Box key={`pad-${i}`} />;

          const cellKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayTickets = deadlineMap[cellKey] || [];
          const isToday = cellKey === todayKey;
          const hasDeadline = dayTickets.length > 0;
          const isPast = cellKey < todayKey;

          if (!hasDeadline) {
            return (
              <Box
                key={cellKey}
                sx={{
                  aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%",
                  background: isToday ? (isDark ? "rgba(255,255,255,0.08)" : "#f5f5f5") : "transparent",
                  border: isToday
                    ? `1.5px solid ${isDark ? "rgba(255,255,255,0.18)" : "#d0d0d0"}`
                    : "1.5px solid transparent",
                }}
              >
                <Typography sx={{
                  fontSize: 11, fontWeight: isToday ? 700 : 400, lineHeight: 1, userSelect: "none",
                  color: isToday ? (isDark ? "#D7DADC" : "#1a1a1a") : (isDark ? "#666" : "#aaa"),
                }}>
                  {day}
                </Typography>
              </Box>
            );
          }

          return (
            <Tooltip
              key={cellKey}
              title={
                <Box sx={{ p: 0.25 }}>
                  {dayTickets.map((t) => (
                    <Typography key={t.id} sx={{ fontSize: 11, lineHeight: 1.7 }}>
                      · {t.ticket_title || "(No title)"}
                    </Typography>
                  ))}
                </Box>
              }
              placement="top"
              arrow
            >
              <Box
                onClick={() => onSelectTicket(dayTickets[0])}
                sx={{
                  aspectRatio: "1", display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: "50%", position: "relative", cursor: "pointer",
                  background: isDark ? "rgba(168,77,72,0.28)" : "#fde8e8",
                  border: "1.5px solid transparent",
                  "&:hover": { background: isDark ? "rgba(168,77,72,0.5)" : "#fbd0d0" },
                  transition: "background 0.12s",
                }}
              >
                <Typography sx={{
                  fontSize: 11, fontWeight: 700, lineHeight: 1, userSelect: "none",
                  color: isPast ? (isDark ? "#f87171" : "#dc2626") : "#A84D48",
                }}>
                  {day}
                </Typography>
                <Box sx={{
                  position: "absolute", bottom: "2px",
                  width: 3, height: 3, borderRadius: "50%",
                  background: isPast ? "#ef4444" : "#A84D48",
                }} />
              </Box>
            </Tooltip>
          );
        })}
      </Box>

      {/* Footer count */}
      <Box sx={{ mt: 1.5, textAlign: "center" }}>
        {upcomingCount > 0 ? (
          <Typography
            onClick={() => setUpcomingOpen(true)}
            sx={{ fontSize: 11, color: "#A84D48", fontWeight: 600, cursor: "pointer",
              textDecoration: "underline", textUnderlineOffset: 2,
              "&:hover": { color: "#8b3a36" } }}
          >
            {upcomingCount} upcoming deadline{upcomingCount !== 1 ? "s" : ""}
          </Typography>
        ) : (
          <Typography sx={{ fontSize: 11, color: "text.disabled" }}>
            No upcoming deadlines
          </Typography>
        )}
      </Box>

      {/* Upcoming deadlines modal */}
      <Dialog
        open={upcomingOpen}
        onClose={() => setUpcomingOpen(false)}
        slotProps={{ paper: { sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", m: 2, minWidth: 300, maxWidth: 420 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 15, pb: 1 }}>Upcoming Deadlines</DialogTitle>
        <DialogContent sx={{ pt: 0 }}>
          {Object.entries(deadlineMap)
            .filter(([k]) => k >= todayKey)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, ts]) => {
              const [y, m, d] = key.split("-").map(Number);
              const label = new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
              return (
                <Box key={key} sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#A84D48", textTransform: "uppercase", letterSpacing: 0.6, mb: 0.5 }}>
                    {label}
                  </Typography>
                  {ts.map((t) => (
                    <Box
                      key={t.id}
                      onClick={() => { setUpcomingOpen(false); onSelectTicket(t); }}
                      sx={{
                        px: 1.5, py: 1, borderRadius: 2, cursor: "pointer", mb: 0.5,
                        background: isDark ? "#242425" : "#fdf8f8",
                        border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8",
                        "&:hover": { background: isDark ? "#2e2e2f" : "#fde8e8" },
                        transition: "background 0.12s",
                      }}
                    >
                      <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.3 }}>
                        {t.ticket_title || "(No title)"}
                      </Typography>
                      {t.category && (
                        <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.25 }}>{t.category}</Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              );
            })}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setUpcomingOpen(false)} sx={{ color: "text.secondary", fontSize: 12, textTransform: "none" }}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── MyWorkPage ───────────────────────────────────────────────────────────────

export default function MyWorkPage() {
  const { isDark, timeZone, moderators } = useOutletContext();
  const [tickets, setTickets] = useState(myWorkCache.data || []);
  const [loading, setLoading] = useState(!myWorkCache.data);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchMyWork = async (silent = false, pg = 1) => {
    if (!silent && myWorkCache.data && pg === 1) {
      setTickets(myWorkCache.data);
    }
    if (!silent && pg === 1) setLoading(true);
    if (pg > 1) setLoadingMore(true);
    try {
      const d = await apiFetch(`/api/support-tickets/my-work?page=${pg}&limit=50`);
      const t = d?.tickets || [];
      const h = d?.hasMore ?? false;
      if (pg === 1) { myWorkCache.data = t; setTickets(t); }
      else setTickets((prev) => { const next = [...prev, ...t]; myWorkCache.data = next; return next; });
      setHasMore(h);
      setPage(pg);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (myWorkCache.data) {
      fetchMyWork(true);
    } else {
      fetchMyWork(false);
    }
    const id = setInterval(() => fetchMyWork(true), 30_000);
    return () => clearInterval(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync selected ticket when list re-fetches
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find((t) => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
      else setSelectedTicket(null);
    }
  }, [tickets]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStatus = async (ticketId, newStatus) => {
    try {
      const updated = await apiFetch(`/api/support-tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setTickets((prev) => {
        const next = prev.map((t) => t.id === ticketId ? { ...t, ...updated } : t);
        myWorkCache.data = next;
        return next;
      });
    } catch {
      // silently fail
    }
  };

  const deleteTicket = async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/support-tickets/${deleteTarget}`, { method: "DELETE" });
      setTickets((prev) => {
        const next = prev.filter((t) => t.id !== deleteTarget);
        myWorkCache.data = next;
        return next;
      });
      setSelectedTicket(null);
    } catch {
      // silently fail
    }
    setDeleteTarget(null);
  };

  const now = new Date();
  const overdue = tickets.filter((t) => t.deadline && new Date(t.deadline) < now);
  const active  = tickets.filter((t) => !t.deadline || new Date(t.deadline) >= now);
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;
  const openCount       = tickets.filter((t) => t.status === "open").length;
  const resolvedCount   = tickets.filter((t) => t.status === "resolved").length;

  const chipBase = {
    display: "inline-flex", alignItems: "center", gap: 0.5,
    px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12, fontWeight: 700,
  };

  const STATUS_LABEL = { open: "Open", in_progress: "In Progress", resolved: "Resolved" };
  const STATUS_COLOR = {
    open:        { bg: isDark ? "#2d3748" : "#eff6ff", color: isDark ? "#90cdf4" : "#1d4ed8", border: isDark ? "#4a5568" : "#bfdbfe" },
    in_progress: { bg: isDark ? "#3a2f22" : "#fffbeb", color: isDark ? "#f6c66a" : "#92400e", border: isDark ? "#b7791f" : "#fcd34d" },
    resolved:    { bg: isDark ? "#1f3527" : "#f0fdf4", color: isDark ? "#6ee7b7" : "#166534", border: isDark ? "#276749" : "#bbf7d0" },
  };

  const renderRow = (t) => {
    const isOverdue = !!t.deadline && new Date(t.deadline) < now;
    const sevOpt = (isDark ? SEVERITY_OPTIONS_DARK : SEVERITY_OPTIONS).find((o) => o.value === t.severity);
    const replyCount = t.support_replies?.length ?? 0;
    const modReplies = t.support_replies?.filter((r) => r.is_moderator).length ?? 0;
    const deadlineDate = t.deadline ? new Date(t.deadline) : null;
    const sc = STATUS_COLOR[t.status] || STATUS_COLOR.open;

    return (
      <Paper
        key={t.id}
        onClick={() => setSelectedTicket(t)}
        sx={{
          p: { xs: 1.25, sm: 1.75 }, mb: 1, cursor: "pointer", borderRadius: 2,
          background: isDark ? "#1e1e1f" : "#fff",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #eee",
          borderLeft: isOverdue ? "4px solid #ef4444" : "4px solid transparent",
          "&:hover": { background: isDark ? "#2a2a2b" : "#fdf8f8", borderColor: isOverdue ? "#ef4444" : isDark ? "rgba(168,77,72,0.4)" : "#e8d5d5" },
          transition: "background 0.15s, border-color 0.15s",
        }}
      >
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, gap: 1, flexWrap: "wrap" }}>
          {sevOpt && (
            <Box sx={{ ...chipBase, fontSize: 11, background: sevOpt.bg, color: sevOpt.color, border: `1px solid ${sevOpt.border}`, flexShrink: 0 }}>
              {sevOpt.label}
            </Box>
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: { xs: 13, sm: 14 }, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {t.ticket_title || "(No title)"}
            </Typography>
            {t.category && (
              <Typography sx={{ fontSize: 11, color: "text.secondary", mt: 0.25 }}>{t.category}</Typography>
            )}
          </Box>
          <Box sx={{ ...chipBase, fontSize: 11, background: sc.bg, color: sc.color, border: `1px solid ${sc.border}`, flexShrink: 0 }}>
            {STATUS_LABEL[t.status] || t.status}
          </Box>
          {deadlineDate && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, flexShrink: 0 }}>
              <AccessTimeIcon sx={{ fontSize: 13, color: isOverdue ? "#ef4444" : "text.secondary" }} />
              <Typography sx={{ fontSize: 12, color: isOverdue ? "#ef4444" : "text.secondary", fontWeight: isOverdue ? 700 : 400 }}>
                {deadlineDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </Typography>
            </Box>
          )}
          {replyCount > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.4, flexShrink: 0 }}>
              <ChatBubbleOutlineIcon sx={{ fontSize: 13, color: "text.secondary" }} />
              <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{modReplies}/{replyCount}</Typography>
            </Box>
          )}
        </Box>
      </Paper>
    );
  };

  return (
    <>
      <SectionPageHeader
        icon={<AssignmentIcon sx={{ color: "#8b5cf6", fontSize: 20 }} />}
        title="My Work"
        subtitle="Tickets assigned to you — your personal queue."
        isDark={isDark}
      />

      {/* Two-column layout: tickets left, stats right */}
      <Box sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", lg: "1fr 300px" },
        gap: { xs: 3, lg: 3 },
        alignItems: "start",
      }}>
        {/* LEFT — ticket list */}
        <Box>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
              <CircularProgress size={28} sx={{ color: "#A84D48" }} />
            </Box>
          )}

          {!loading && tickets.length === 0 && (
            <Box sx={{ textAlign: "center", py: 8 }}>
              <AssignmentIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1.5 }} />
              <Typography color="text.secondary" fontWeight={600}>No tickets assigned to you</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                Assign yourself to a bug or support ticket to track it here.
              </Typography>
            </Box>
          )}

          {!loading && overdue.length > 0 && (
            <>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#ef4444", textTransform: "uppercase", letterSpacing: 0.8, mb: 1 }}>
                Overdue
              </Typography>
              {overdue.map(renderRow)}
            </>
          )}

          {!loading && active.length > 0 && (
            <>
              {overdue.length > 0 && (
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.8, mt: 2, mb: 1 }}>
                  Active
                </Typography>
              )}
              {active.map(renderRow)}
            </>
          )}

          {hasMore && !loading && (
            <Box sx={{ textAlign: "center", mt: 2 }}>
              <Button
                size="small"
                onClick={() => fetchMyWork(false, page + 1)}
                disabled={loadingMore}
                sx={{ fontSize: 12, textTransform: "none", color: "text.secondary", "&:hover": { background: isDark ? "#343536" : "#f5f5f5" } }}
              >
                {loadingMore ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                Load More
              </Button>
            </Box>
          )}
        </Box>

        {/* RIGHT — progress ring + calendar, sticky on desktop */}
        <Box sx={{
          display: "flex", flexDirection: "column", gap: 2,
          position: { lg: "sticky" }, top: { lg: 24 },
          order: { xs: -1, lg: 0 },
        }}>
          <ProgressRing
            resolved={resolvedCount}
            total={tickets.length}
            inProgress={inProgressCount}
            open={openCount}
            overdue={overdue.length}
            onRefresh={fetchMyWork}
            isDark={isDark}
          />
          <DeadlineCalendar
            tickets={tickets}
            onSelectTicket={setSelectedTicket}
            isDark={isDark}
          />
        </Box>
      </Box>

      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdateStatus={handleStatus}
        onDelete={(id) => { setSelectedTicket(null); setDeleteTarget(id); }}
        onReply={fetchMyWork}
        isDark={isDark}
        timeZone={timeZone}
        moderators={moderators}
      />

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}
        slotProps={{ paper: { sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", m: 2 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this ticket?</DialogTitle>
        <DialogContent>
          <DialogContentText>This will permanently remove the ticket. This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteTicket} sx={{ fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
