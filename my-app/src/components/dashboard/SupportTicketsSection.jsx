import { useState, useEffect } from "react";
import {
  Box, Typography, Paper, Button, Chip, Tabs, Tab, CircularProgress, Alert,
} from "@mui/material";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import RefreshIcon from "@mui/icons-material/Refresh";
import { formatRelativeDate } from "../../utils/timezone";
import {
  TICKET_STATUS_CONFIG,
  TICKET_STATUS_CONFIG_DARK,
  SEVERITY_OPTIONS,
  SEVERITY_OPTIONS_DARK,
} from "./dashboardConstants";
import TicketDetailModal from "./TicketDetailModal";

export function EmptySection({ icon, title, description, isDark = false }) {
  return (
    <Paper variant="outlined" sx={{
      p: { xs: 3, sm: 5 }, borderRadius: 2.5,
      borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc", borderStyle: "dashed",
      background: isDark ? "#1A1A1B" : "#fff",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: "50%", mb: 2,
        background: isDark ? "#2D2D2E" : "#f5eded", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </Box>
      <Typography fontWeight={700} sx={{ mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </Paper>
  );
}

function TicketCard({ ticket, onSelect, isDark, timeZone }) {
  const statusCfg = (isDark ? TICKET_STATUS_CONFIG_DARK : TICKET_STATUS_CONFIG)[ticket.status] ?? TICKET_STATUS_CONFIG.open;
  const replyCount = ticket.support_replies?.length ?? 0;
  const severityCfg = ticket.severity
    ? (isDark ? SEVERITY_OPTIONS_DARK : SEVERITY_OPTIONS).find(s => s.value === ticket.severity)
    : null;

  return (
    <Paper
      variant="outlined"
      onClick={() => onSelect(ticket)}
      sx={{
        borderRadius: 2.5,
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "#ecdcdc",
        background: isDark ? "#1A1A1B" : "#fff",
        p: { xs: 1.5, sm: 2 },
        cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
        "&:hover": {
          boxShadow: isDark ? "0 2px 16px rgba(0,0,0,0.45)" : "0 2px 12px rgba(168,77,72,0.1)",
          borderColor: isDark ? "rgba(255,69,0,0.4)" : "#c8908c",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mb: 0.75 }}>
        {ticket.ticket_type && (
          <Chip label={ticket.ticket_type} size="small" sx={{ fontWeight: 700, fontSize: 11, background: isDark ? "rgba(168,77,72,0.2)" : "#A84D4815", color: isDark ? "#FF6B3D" : "#A84D48", border: isDark ? "1px solid rgba(168,77,72,0.3)" : "1px solid #d4a0a0" }} />
        )}
        <Chip label={ticket.category} size="small" sx={{ fontWeight: 700, fontSize: 11, background: isDark ? "rgba(255,255,255,0.08)" : "#f5eded", color: isDark ? "#D7DADC" : "#5e3030", border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e5d0d0" }} />
        <Chip label={statusCfg.label} size="small" sx={{ fontWeight: 700, fontSize: 11, background: statusCfg.bg, color: statusCfg.color, border: `1px solid ${statusCfg.border}` }} />
        {severityCfg && (
          <Chip label={severityCfg.label} size="small" sx={{ fontWeight: 700, fontSize: 11, background: severityCfg.bg, color: severityCfg.color, border: `1px solid ${severityCfg.border}` }} />
        )}
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: isDark ? "#818384" : "#aaa", flexShrink: 0 }}>
          {formatRelativeDate(ticket.created_at, timeZone, { compact: true })}
        </Typography>
      </Box>

      <Typography fontWeight={800} fontSize={14} sx={{ mb: 0.25, color: isDark ? "#D7DADC" : "#2d1a1a", overflowWrap: "anywhere" }}>
        {ticket.ticket_title}
      </Typography>

      {(ticket.name || ticket.email) && (
        <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: isDark ? "#818384" : "#999" }}>
          {[ticket.name, ticket.email].filter(Boolean).join(" · ")}
        </Typography>
      )}

      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", mt: 0.25 }}>
        {replyCount > 0 && (
          <Typography variant="caption" sx={{ color: "text.disabled" }}>
            {replyCount} {replyCount === 1 ? "reply" : "replies"}
          </Typography>
        )}
        <Typography variant="caption" sx={{
          color: ticket.claimed_by ? (isDark ? "#FF6B3D" : "#A84D48") : "text.disabled",
          fontStyle: ticket.claimed_by ? "normal" : "italic",
          fontWeight: ticket.claimed_by ? 600 : 400,
        }}>
          {ticket.claimed_by ? `Claimed · ${ticket.claimed_by}` : "Unclaimed"}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function SupportTicketsSection({ tickets, loading, hasMore, loadingMore, onLoadMore, statusTab, onTabChange, onFetch, onUpdateStatus, onDelete, actionError, isDark, timeZone, ticketType, moderators }) {
  const [selectedTicket, setSelectedTicket] = useState(null);

  useEffect(() => { onFetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find((t) => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
      else setSelectedTicket(null);
    }
  }, [tickets]); // eslint-disable-line react-hooks/exhaustive-deps

  const typeFiltered = ticketType ? tickets.filter((t) => t.ticket_type === ticketType) : tickets;
  const filtered = typeFiltered.filter((t) => t.status === statusTab);
  const counts = {
    open:        typeFiltered.filter((t) => t.status === "open").length,
    in_progress: typeFiltered.filter((t) => t.status === "in_progress").length,
    resolved:    typeFiltered.filter((t) => t.status === "resolved").length,
    closed:      typeFiltered.filter((t) => t.status === "closed").length,
  };

  return (
    <>
      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      <Box sx={{
        display: "flex", justifyContent: "space-between",
        alignItems: { xs: "stretch", sm: "center" },
        flexDirection: { xs: "column", sm: "row" },
        gap: 1, mb: 2,
      }}>
        <Tabs
          value={statusTab}
          onChange={(_, v) => onTabChange(v)}
          variant="scrollable"
          allowScrollButtonsMobile
          sx={{
            minHeight: { xs: 32, sm: 36 },
            "& .MuiTab-root": { fontWeight: 700, textTransform: "none", minHeight: { xs: 32, sm: 36 }, fontSize: { xs: 12, sm: 13 }, px: { xs: 1.25, sm: 2 } },
            "& .Mui-selected": { color: "#A84D48" },
            "& .MuiTabs-indicator": { backgroundColor: "#A84D48" },
          }}
        >
          <Tab value="open"        label={`Open (${counts.open})`} />
          <Tab value="in_progress" label={`In Progress (${counts.in_progress})`} />
          <Tab value="resolved"    label={`Resolved (${counts.resolved})`} />
          <Tab value="closed"      label={`Closed (${counts.closed})`} />
        </Tabs>
        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
          onClick={onFetch}
          disabled={loading}
          sx={{ color: "#A84D48", fontWeight: 700, fontSize: 12, alignSelf: { xs: "flex-end", sm: "center" } }}
        >
          Refresh
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress sx={{ color: "#A84D48" }} />
        </Box>
      ) : filtered.length === 0 ? (
        <EmptySection
          icon={<SupportAgentIcon sx={{ color: "#A84D48", fontSize: 28 }} />}
          title={`No ${statusTab.replace("_", " ")} tickets`}
          description="No support tickets in this status right now."
          isDark={isDark}
        />
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          {filtered.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onSelect={setSelectedTicket}
              isDark={isDark}
              timeZone={timeZone}
            />
          ))}
        </Box>
      )}

      {hasMore && !loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <Button
            onClick={onLoadMore}
            disabled={loadingMore}
            size="small"
            sx={{ color: "#A84D48", fontWeight: 700, fontSize: 12, textTransform: "none", border: "1px solid rgba(168,77,72,0.35)", borderRadius: 2, px: 2.5 }}
          >
            {loadingMore ? <CircularProgress size={14} sx={{ color: "#A84D48", mr: 0.75 }} /> : null}
            {loadingMore ? "Loading…" : "Load more tickets"}
          </Button>
        </Box>
      )}

      <TicketDetailModal
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdateStatus={onUpdateStatus}
        onDelete={(id) => { setSelectedTicket(null); onDelete(id); }}
        onReply={onFetch}
        isDark={isDark}
        timeZone={timeZone}
        moderators={moderators}
      />
    </>
  );
}
