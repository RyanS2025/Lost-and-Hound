import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box, Button, Alert, Select, MenuItem, FormControl, InputLabel,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from "@mui/material";
import BugReportIcon from "@mui/icons-material/BugReport";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import SupportTicketsSection from "../../components/dashboard/SupportTicketsSection";
import SectionPageHeader from "../../components/dashboard/SectionPageHeader";
import { useTicketList } from "./useTicketList";
import { SEVERITY_OPTIONS } from "../../components/dashboard/dashboardConstants";

const chipBase = {
  display: "inline-flex", alignItems: "center",
  px: 1.5, py: 0.5, borderRadius: 99, fontSize: 12, fontWeight: 700,
};

export default function BugsPage() {
  const { isDark, timeZone, moderators } = useOutletContext();
  const [severityFilter, setSeverityFilter] = useState("");
  const {
    tickets, loading, hasMore, loadingMore, page, setPage,
    statusTab, setStatusTab,
    actionError, deleteTarget, setDeleteTarget,
    fetchTickets, handleStatus, deleteTicket,
  } = useTicketList("Bug Report");

  // All-ticket counts (unfiltered by severity) for the stats bar
  const allCounts = {
    open:        tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    critical:    tickets.filter((t) => t.status === "open" && t.severity === "critical").length,
    resolved:    tickets.filter((t) => t.status === "resolved").length,
  };

  // Critical/high open bugs that need attention
  const urgentBugs = tickets.filter(
    (t) => t.status === "open" && (t.severity === "critical" || t.severity === "high")
  );

  // Apply severity filter for the main list
  const filteredTickets = severityFilter
    ? tickets.filter((t) => t.severity === severityFilter)
    : tickets;

  return (
    <>
      <SectionPageHeader
        icon={<BugReportIcon sx={{ color: "#A84D48", fontSize: 20 }} />}
        title="Bug Reports"
        subtitle="Reported bugs tracked through the engineering board."
        isDark={isDark}
      />

      {/* Stats bar */}
      <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
        <Box sx={{ ...chipBase, background: isDark ? "#3a2f22" : "#fffbeb", color: isDark ? "#f6c66a" : "#92400e", border: `1px solid ${isDark ? "rgba(245,158,11,0.5)" : "#fcd34d"}` }}>
          Open · {allCounts.open}
        </Box>
        <Box sx={{ ...chipBase, background: isDark ? "#1e2a3a" : "#eff6ff", color: isDark ? "#93c5fd" : "#1d4ed8", border: `1px solid ${isDark ? "rgba(147,197,253,0.4)" : "#bfdbfe"}` }}>
          In Progress · {allCounts.in_progress}
        </Box>
        {allCounts.critical > 0 && (
          <Box sx={{ ...chipBase, background: isDark ? "#3b1a1a" : "#fef2f2", color: isDark ? "#f87171" : "#b91c1c", border: `1px solid ${isDark ? "rgba(239,68,68,0.4)" : "#fca5a5"}` }}>
            Critical · {allCounts.critical}
          </Box>
        )}
        <Box sx={{ ...chipBase, background: isDark ? "#1f3527" : "#f0fdf4", color: isDark ? "#6ee7b7" : "#166534", border: `1px solid ${isDark ? "rgba(110,231,183,0.4)" : "#bbf7d0"}` }}>
          Resolved · {allCounts.resolved}
        </Box>

        {/* Severity filter */}
        <FormControl size="small" sx={{ ml: "auto", minWidth: 140 }}>
          <InputLabel sx={{ fontSize: 12, color: "text.secondary" }}>Severity</InputLabel>
          <Select
            value={severityFilter}
            label="Severity"
            onChange={(e) => setSeverityFilter(e.target.value)}
            sx={{
              fontSize: 12, borderRadius: 2,
              "& .MuiOutlinedInput-notchedOutline": { borderColor: isDark ? "rgba(255,255,255,0.2)" : "#e0e0e0" },
              background: isDark ? "#1e1e1f" : "#fff",
            }}
          >
            <MenuItem value="" sx={{ fontSize: 12 }}>All severities</MenuItem>
            {SEVERITY_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: 12 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: "50%", background: o.color, flexShrink: 0 }} />
                  {o.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Needs Attention — critical/high open bugs */}
      {!loading && statusTab === "open" && urgentBugs.length > 0 && !severityFilter && (
        <Alert
          icon={<WarningAmberIcon sx={{ fontSize: 18 }} />}
          severity="error"
          sx={{
            mb: 2,
            background: isDark ? "rgba(185,28,28,0.15)" : "#fef2f2",
            border: isDark ? "1px solid rgba(239,68,68,0.4)" : "1px solid #fca5a5",
            "& .MuiAlert-message": { fontWeight: 600, fontSize: 13 },
          }}
        >
          {urgentBugs.length} critical/high priority {urgentBugs.length === 1 ? "bug needs" : "bugs need"} immediate attention.
          {urgentBugs.some((b) => b.severity === "critical") && " At least one is marked Critical."}
        </Alert>
      )}

      <SupportTicketsSection
        tickets={filteredTickets}
        loading={loading}
        hasMore={hasMore && !severityFilter}
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
        ticketType="Bug Report"
        moderators={moderators}
      />

      <Dialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        slotProps={{ paper: { sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", m: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this ticket?</DialogTitle>
        <DialogContent>
          <DialogContentText>This will permanently remove the bug report. This cannot be undone.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteTicket} sx={{ fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
