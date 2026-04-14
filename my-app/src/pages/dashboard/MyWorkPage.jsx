import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box, Typography, Paper, Button, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import RefreshIcon from "@mui/icons-material/Refresh";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import apiFetch from "../../utils/apiFetch";
import { SEVERITY_OPTIONS, SEVERITY_OPTIONS_DARK } from "../../components/dashboard/dashboardConstants";
import TicketDetailModal from "../../components/dashboard/TicketDetailModal";
import SectionPageHeader from "../../components/dashboard/SectionPageHeader";

export default function MyWorkPage() {
  const { isDark, timeZone, moderators } = useOutletContext();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const cacheRef = useRef(null);

  const fetchMyWork = async () => {
    if (cacheRef.current) {
      setTickets(cacheRef.current);
      apiFetch("/api/support-tickets/my-work")
        .then((d) => {
          const t = d?.tickets || [];
          cacheRef.current = t;
          setTickets(t);
        })
        .catch(() => {});
      return;
    }
    setLoading(true);
    try {
      const d = await apiFetch("/api/support-tickets/my-work");
      const t = d?.tickets || [];
      cacheRef.current = t;
      setTickets(t);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyWork();
    const id = setInterval(fetchMyWork, 60_000);
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
        cacheRef.current = next;
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
        cacheRef.current = next;
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

      {/* Summary chips */}
      <Box sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap" }}>
        <Box sx={{ ...chipBase, background: isDark ? "#2d3748" : "#eff6ff", color: isDark ? "#90cdf4" : "#1d4ed8", border: `1px solid ${isDark ? "#4a5568" : "#bfdbfe"}` }}>
          In Progress · {inProgressCount}
        </Box>
        <Box sx={{ ...chipBase, background: isDark ? "#1e2a1e" : "#f0fdf4", color: isDark ? "#6ee7b7" : "#166534", border: `1px solid ${isDark ? "#276749" : "#bbf7d0"}` }}>
          Open · {openCount}
        </Box>
        {overdue.length > 0 && (
          <Box sx={{ ...chipBase, background: isDark ? "#3b1a1a" : "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5" }}>
            Overdue · {overdue.length}
          </Box>
        )}
        <Box sx={{ ml: "auto" }}>
          <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 14 }} />} onClick={fetchMyWork}
            sx={{ fontSize: 12, textTransform: "none", color: "text.secondary", "&:hover": { background: isDark ? "#343536" : "#f5f5f5" } }}>
            Refresh
          </Button>
        </Box>
      </Box>

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
