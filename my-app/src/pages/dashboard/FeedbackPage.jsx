import { useOutletContext } from "react-router-dom";
import {
  Box, Button, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from "@mui/material";
import FeedbackIcon from "@mui/icons-material/RateReview";
import SupportTicketsSection from "../../components/dashboard/SupportTicketsSection";
import SectionPageHeader from "../../components/dashboard/SectionPageHeader";
import { useTicketList } from "./useTicketList";

const chipBase = {
  display: "inline-flex", alignItems: "center",
  px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12, fontWeight: 700,
};

function StatsBar({ counts, isDark }) {
  const chips = [
    { label: "Open",        count: counts.open,        bg: isDark ? "#3a2f22" : "#fffbeb", color: isDark ? "#f6c66a" : "#92400e", border: isDark ? "rgba(245,158,11,0.5)" : "#fcd34d", urgent: true },
    { label: "In Progress", count: counts.in_progress, bg: isDark ? "#1e2a3a" : "#eff6ff", color: isDark ? "#93c5fd" : "#1d4ed8", border: isDark ? "rgba(147,197,253,0.4)" : "#bfdbfe" },
    { label: "Resolved",    count: counts.resolved,    bg: isDark ? "#1f3527" : "#f0fdf4", color: isDark ? "#6ee7b7" : "#166534", border: isDark ? "rgba(110,231,183,0.4)" : "#bbf7d0" },
    { label: "Closed",      count: counts.closed,      bg: isDark ? "#2c3138" : "#f8fafc", color: isDark ? "#cbd5e1" : "#64748b", border: isDark ? "rgba(148,163,184,0.4)" : "#e2e8f0" },
  ];
  return (
    <Box sx={{ display: "flex", gap: 1, mb: 2.5, flexWrap: "wrap", alignItems: "center" }}>
      {chips.map(({ label, count, bg, color, border }) => (
        <Box key={label} sx={{ ...chipBase, background: bg, color, border: `1px solid ${border}` }}>
          {label} · {count}
        </Box>
      ))}
    </Box>
  );
}

export default function FeedbackPage() {
  const { isDark, timeZone, moderators } = useOutletContext();
  const {
    tickets, loading, hasMore, loadingMore, page, setPage,
    statusTab, setStatusTab,
    actionError, deleteTarget, setDeleteTarget,
    fetchTickets, handleStatus, deleteTicket,
  } = useTicketList("Feedback");

  const counts = {
    open:        tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved:    tickets.filter((t) => t.status === "resolved").length,
    closed:      tickets.filter((t) => t.status === "closed").length,
  };

  return (
    <>
      <SectionPageHeader
        icon={<FeedbackIcon sx={{ color: "#6366f1", fontSize: 20 }} />}
        title="Feedback"
        subtitle="User suggestions and platform improvement requests."
        isDark={isDark}
      />

      <StatsBar counts={counts} isDark={isDark} />

      <SupportTicketsSection
        tickets={tickets}
        loading={loading}
        hasMore={hasMore}
        loadingMore={loadingMore}
        onLoadMore={() => { setPage((p) => p + 1); fetchTickets(page + 1, true); }}
        statusTab={statusTab}
        onTabChange={setStatusTab}
        onFetch={() => fetchTickets(1)}
        onUpdateStatus={handleStatus}
        onDelete={setDeleteTarget}
        actionError={actionError}
        isDark={isDark}
        timeZone={timeZone}
        ticketType="Feedback"
        moderators={moderators}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        slotProps={{ paper: { sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this ticket?</DialogTitle>
        <DialogContent>
          <DialogContentText>This will permanently remove the feedback ticket. This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteTicket} sx={{ fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
