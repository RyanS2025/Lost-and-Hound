import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useOutletContext } from "react-router-dom";
import {
  Box, Typography, Paper, Chip, CircularProgress,
} from "@mui/material";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FlagIcon from "@mui/icons-material/Flag";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import FeedbackIcon from "@mui/icons-material/RateReview";
import BugReportIcon from "@mui/icons-material/BugReport";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BarChartIcon from "@mui/icons-material/BarChart";
import apiFetch from "../../utils/apiFetch";

// Module-level cache — survives component unmount/remount (navigation away and back)
let summaryCache = null;

function StatChip({ label, value, urgent = false, isDark }) {
  return (
    <Chip
      label={`${label}: ${value}`}
      size="small"
      sx={{
        fontWeight: 700,
        fontSize: 12,
        background: urgent && value > 0
          ? (isDark ? "rgba(220,38,38,0.2)" : "#fef2f2")
          : (isDark ? "rgba(255,255,255,0.08)" : "#f5f5f5"),
        color: urgent && value > 0
          ? (isDark ? "#f87171" : "#dc2626")
          : (isDark ? "#D7DADC" : "#444"),
        border: urgent && value > 0
          ? (isDark ? "1px solid rgba(220,38,38,0.4)" : "1px solid #fca5a5")
          : (isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e0e0e0"),
      }}
    />
  );
}

function SectionCard({ to, icon, title, description, stats, accentColor, isDark, loading }) {
  return (
    <Box
      component={Link}
      to={to}
      sx={{ textDecoration: "none", display: "block" }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          borderRadius: 3,
          borderColor: isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc",
          background: isDark ? "#1A1A1B" : "#fff",
          height: "100%",
          cursor: "pointer",
          transition: "box-shadow 0.15s, border-color 0.15s, transform 0.15s",
          "&:hover": {
            boxShadow: isDark
              ? `0 4px 20px rgba(0,0,0,0.4)`
              : `0 4px 16px ${accentColor}22`,
            borderColor: isDark ? `${accentColor}66` : accentColor,
            transform: "translateY(-2px)",
          },
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 2, flexShrink: 0,
              background: `${accentColor}18`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {icon}
            </Box>
            <Typography fontWeight={800} fontSize={15} sx={{ color: isDark ? "#D7DADC" : "#1a1a1a" }}>
              {title}
            </Typography>
          </Box>
          <ArrowForwardIcon sx={{ fontSize: 18, color: isDark ? "#555" : "#ccc", transition: "color 0.15s", ".MuiPaper-root:hover &": { color: accentColor } }} />
        </Box>

        {/* Description */}
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13, lineHeight: 1.5 }}>
          {description}
        </Typography>

        {/* Stats */}
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: "auto" }}>
          {loading ? (
            <Chip size="small" label="Loading…" sx={{ fontSize: 12, background: isDark ? "rgba(255,255,255,0.06)" : "#f5f5f5", color: "text.disabled" }} />
          ) : (
            stats.map((s) => (
              <StatChip key={s.label} label={s.label} value={s.value} urgent={s.urgent} isDark={isDark} />
            ))
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default function DashboardOverviewPage() {
  const { isDark } = useOutletContext();
  const [summary, setSummary] = useState(summaryCache);
  const [loading, setLoading] = useState(!summaryCache);

  useEffect(() => {
    if (summaryCache) {
      // Already have data — show it immediately and revalidate silently
      apiFetch("/api/dashboard/summary")
        .then((d) => { summaryCache = d; setSummary(d); })
        .catch(() => {});
      return;
    }
    apiFetch("/api/dashboard/summary")
      .then((d) => { summaryCache = d; setSummary(d); })
      .catch(() => setSummary(null))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const s = summary;

  const sections = [
    {
      to: "/moderation/reports",
      icon: <FlagIcon sx={{ color: "#f59e0b", fontSize: 20 }} />,
      title: "Reports",
      description: "User and listing reports requiring moderation decisions.",
      accentColor: "#f59e0b",
      stats: [
        { label: "Pending",   value: s?.reports.pending   ?? 0, urgent: true },
        { label: "Reviewed",  value: s?.reports.reviewed  ?? 0 },
        { label: "Dismissed", value: s?.reports.dismissed ?? 0 },
      ],
    },
    {
      to: "/moderation/stolen",
      icon: <PriorityHighIcon sx={{ color: "#dc2626", fontSize: 20 }} />,
      title: "Stolen Reports",
      description: "Theft and ownership disputes — highest priority queue.",
      accentColor: "#dc2626",
      stats: [
        { label: "Pending", value: s?.stolen.pending ?? 0, urgent: true },
        { label: "Total",   value: s?.stolen.total   ?? 0 },
      ],
    },
    {
      to: "/moderation/feedback",
      icon: <FeedbackIcon sx={{ color: "#6366f1", fontSize: 20 }} />,
      title: "Feedback",
      description: "User suggestions and platform improvement requests.",
      accentColor: "#6366f1",
      stats: [
        { label: "Open",        value: s?.feedback.open        ?? 0, urgent: true },
        { label: "In Progress", value: s?.feedback.in_progress ?? 0 },
      ],
    },
    {
      to: "/moderation/bugs",
      icon: <BugReportIcon sx={{ color: "#A84D48", fontSize: 20 }} />,
      title: "Bug Reports",
      description: "Reported bugs tracked through the engineering board.",
      accentColor: "#A84D48",
      stats: [
        { label: "Open",        value: s?.bugs.open        ?? 0, urgent: true },
        { label: "Critical",    value: s?.bugs.critical    ?? 0, urgent: true },
        { label: "In Progress", value: s?.bugs.in_progress ?? 0 },
      ],
    },
    {
      to: "/moderation/support",
      icon: <SupportAgentIcon sx={{ color: "#16a34a", fontSize: 20 }} />,
      title: "Support",
      description: "User help requests awaiting moderator response.",
      accentColor: "#16a34a",
      stats: [
        { label: "Open",        value: s?.support.open        ?? 0, urgent: true },
        { label: "Unclaimed",   value: s?.support.unclaimed   ?? 0, urgent: true },
        { label: "In Progress", value: s?.support.in_progress ?? 0 },
      ],
    },
    {
      to: "/moderation/my-work",
      icon: <AssignmentIcon sx={{ color: "#8b5cf6", fontSize: 20 }} />,
      title: "My Work",
      description: "Tickets assigned to you — your personal queue.",
      accentColor: "#8b5cf6",
      stats: [
        { label: "Assigned", value: s?.myWork.total   ?? 0 },
        { label: "Overdue",  value: s?.myWork.overdue ?? 0, urgent: true },
      ],
    },
    {
      to: "/moderation/stats",
      icon: <BarChartIcon sx={{ color: "#0ea5e9", fontSize: 20 }} />,
      title: "Statistics",
      description: "User growth, referral sources, and platform health.",
      accentColor: "#0ea5e9",
      stats: [],
    },
  ];

  return (
    <>
      {loading && !summary && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#A84D48" }} />
        </Box>
      )}

      <Box sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "1fr 1fr 1fr" },
        gap: { xs: 1.5, sm: 2 },
      }}>
        {sections.map((section) => (
          <SectionCard
            key={section.to}
            {...section}
            isDark={isDark}
            loading={loading && !summary}
          />
        ))}
      </Box>
    </>
  );
}
