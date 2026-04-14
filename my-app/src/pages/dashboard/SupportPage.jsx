import { useOutletContext } from "react-router-dom";
import {
  Box, Button, Alert, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from "@mui/material";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import SupportTicketsSection from "../../components/dashboard/SupportTicketsSection";
import SectionPageHeader from "../../components/dashboard/SectionPageHeader";
import { useTicketList } from "./useTicketList";

const chipBase = {
  display: "inline-flex", alignItems: "center",
  px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12, fontWeight: 700,
};

export default function SupportPage() {
  const { isDark, timeZone, moderators } = useOutletContext();
  const {
    tickets, loading, hasMore, loadingMore, page, setPage,
    statusTab, setStatusTab,
    actionError, deleteTarget, setDeleteTarget,
    fetchTickets, handleStatus, deleteTicket,
  } = useTicketList("Support");

  const unclaimedOpen = tickets.filter((t) => t.status === "open" && !t.claimed_by);
  const counts = {
    open:        tickets.filter((t) => t.status === "open").length,
    unclaimed:   unclaimedOpen.length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved:    tickets.filter((t) => t.status === "resolved").length,
  };

  return (
    <>
      <SectionPageHeader
        icon={<SupportAgentIcon sx={{ color: "#16a34a", fontSize: 20 }} />}
        title="Support"
        subtitle="User help requests awaiting moderator response."
        isDark={isDark}
      />

      {/* Stats bar */}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Box sx={{ ...chipBase, background: isDark ? "#3a2f22" : "#fffbeb", color: isDark ? "#f6c66a" : "#92400e", border: `1px solid ${isDark ? "rgba(245,158,11,0.5)" : "#fcd34d"}` }}>
          Open · {counts.open}
        </Box>
        {counts.unclaimed > 0 ? (
          <Box sx={{ ...chipBase, background: isDark ? "#3a2200" : "#fff7ed", color: isDark ? "#fb923c" : "#c2410c", border: `1px solid ${isDark ? "rgba(251,146,60,0.5)" : "#fdba74"}` }}>
            Unclaimed · {counts.unclaimed}
          </Box>
        ) : (
          <Box sx={{ ...chipBase, background: isDark ? "#1e2a3a" : "#f0fdf4", color: isDark ? "#6ee7b7" : "#166534", border: `1px solid ${isDark ? "rgba(110,231,183,0.4)" : "#bbf7d0"}` }}>
            All Claimed
          </Box>
        )}
        <Box sx={{ ...chipBase, background: isDark ? "#1e2a3a" : "#eff6ff", color: isDark ? "#93c5fd" : "#1d4ed8", border: `1px solid ${isDark ? "rgba(147,197,253,0.4)" : "#bfdbfe"}` }}>
          In Progress · {counts.in_progress}
        </Box>
        <Box sx={{ ...chipBase, background: isDark ? "#1f3527" : "#f0fdf4", color: isDark ? "#6ee7b7" : "#166534", border: `1px solid ${isDark ? "rgba(110,231,183,0.4)" : "#bbf7d0"}` }}>
          Resolved · {counts.resolved}
        </Box>
      </Box>

      {/* Unclaimed alert */}
      {!loading && unclaimedOpen.length > 0 && (
        <Alert
          severity="warning"
          sx={{
            mb: 2,
            background: isDark ? "rgba(146,64,14,0.18)" : "#fffbeb",
            border: isDark ? "1px solid rgba(245,158,11,0.35)" : "1px solid #fcd34d",
            "& .MuiAlert-message": { fontWeight: 600, fontSize: 13 },
          }}
        >
          {unclaimedOpen.length} {unclaimedOpen.length === 1 ? "ticket is" : "tickets are"} waiting to be claimed — pick one up and start helping.
        </Alert>
      )}

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
        ticketType="Support"
        moderators={moderators}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        slotProps={{ paper: { sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this ticket?</DialogTitle>
        <DialogContent>
          <DialogContentText>This will permanently remove the support ticket. This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteTicket} sx={{ fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
