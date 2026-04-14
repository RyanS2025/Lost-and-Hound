import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box, Typography, Paper, CircularProgress, Button, Tooltip,
} from "@mui/material";
import BarChartIcon from "@mui/icons-material/BarChart";
import PeopleIcon from "@mui/icons-material/People";
import ConfirmationNumberIcon from "@mui/icons-material/ConfirmationNumber";
import FlagIcon from "@mui/icons-material/Flag";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import RefreshIcon from "@mui/icons-material/Refresh";
import apiFetch from "../../utils/apiFetch";
import SectionPageHeader from "../../components/dashboard/SectionPageHeader";

const REFERRAL_LABELS = {
  word_of_mouth:        "Word of mouth",
  social_media:         "Instagram / Social media",
  northeastern_website: "Northeastern website",
  professor_class:      "Professor or class",
  flyer_poster:         "Flyer or poster",
  oasis_event:          "Oasis event",
  other:                "Other",
};

const REFERRAL_COLOR = "#A84D48";
const BAR_COLORS = ["#A84D48", "#c0615c", "#d4827e", "#e8a4a1", "#f5c9c7", "#dc2626", "#f59e0b"];

// ── Stat card ────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accentColor, isDark }) {
  return (
    <Paper variant="outlined" sx={{
      p: { xs: 2, sm: 2.5 }, borderRadius: 3,
      borderColor: isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc",
      background: isDark ? "#1A1A1B" : "#fff",
      display: "flex", alignItems: "center", gap: 1.75,
    }}>
      <Box sx={{
        width: 42, height: 42, borderRadius: 2, flexShrink: 0,
        background: `${accentColor}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, sm: 26 }, lineHeight: 1, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
          {value ?? "—"}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, color: isDark ? "#818384" : "#888", fontSize: 13 }}>
          {label}
        </Typography>
        {sub && (
          <Typography variant="caption" sx={{ color: isDark ? "#6ee7b7" : "#16a34a", fontWeight: 600 }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

// ── CSS bar chart row ────────────────────────────────────────
function BarRow({ label, count, total, color, isDark }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
      <Tooltip title={label} placement="top-start" enterDelay={400}>
        <Typography sx={{ width: 180, flexShrink: 0, fontSize: 13, fontWeight: 600, color: isDark ? "#D7DADC" : "#333", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", cursor: "default" }}>
          {label}
        </Typography>
      </Tooltip>
      <Tooltip
        title={`${count.toLocaleString()} (${pct}%)`}
        placement="top"
        arrow
      >
        <Box sx={{ flex: 1, height: 10, background: isDark ? "rgba(255,255,255,0.07)" : "#f0eded", borderRadius: 99, overflow: "hidden", cursor: "default" }}>
          <Box sx={{
            height: "100%", borderRadius: 99,
            width: `${pct}%`,
            background: color,
            transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
            minWidth: count > 0 ? 6 : 0,
            "&:hover": { filter: "brightness(1.15)" },
          }} />
        </Box>
      </Tooltip>
      <Typography sx={{ width: 56, textAlign: "right", fontSize: 12, fontWeight: 700, color: isDark ? "#818384" : "#888", flexShrink: 0 }}>
        {count} <Typography component="span" sx={{ fontWeight: 400, color: "text.disabled", fontSize: 11 }}>({pct}%)</Typography>
      </Typography>
    </Box>
  );
}

// ── 30-day sparkline ─────────────────────────────────────────
function Sparkline({ byDay, isDark }) {
  const dates = Object.keys(byDay || {});
  const values = Object.values(byDay || {});
  if (!values.length) return null;
  const max = Math.max(...values, 1);

  return (
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: "2px", height: 48, mt: 1 }}>
      {values.map((v, i) => {
        const dateLabel = new Date(dates[i] + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
        return (
          <Tooltip
            key={i}
            title={`${dateLabel}: ${v} new user${v !== 1 ? "s" : ""}`}
            placement="top"
            arrow
          >
            <Box
              sx={{
                flex: 1, borderRadius: "2px 2px 0 0",
                height: `${Math.max(4, (v / max) * 100)}%`,
                background: v > 0
                  ? (isDark ? "rgba(168,77,72,0.7)" : "#A84D48")
                  : (isDark ? "rgba(255,255,255,0.06)" : "#f0eded"),
                transition: "height 0.4s ease",
                cursor: "default",
                "&:hover": {
                  background: v > 0
                    ? (isDark ? "rgba(168,77,72,1)" : "#8a3d39")
                    : (isDark ? "rgba(255,255,255,0.12)" : "#e0dcdc"),
                },
              }}
            />
          </Tooltip>
        );
      })}
    </Box>
  );
}

let statsCache = null;

export default function StatsPage() {
  const { isDark } = useOutletContext();
  const [data, setData] = useState(statsCache);
  const [loading, setLoading] = useState(!statsCache);
  const [error, setError] = useState("");

  const fetchStats = async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const d = await apiFetch("/api/stats/overview");
      statsCache = d;
      setData(d);
    } catch {
      setError("Failed to load stats.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (statsCache) {
      fetchStats(true); // revalidate silently
    } else {
      fetchStats();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const referralEntries = data
    ? Object.entries(data.referrals.counts)
        .sort(([, a], [, b]) => b - a)
    : [];

  return (
    <>
      <SectionPageHeader
        icon={<BarChartIcon sx={{ color: "#A84D48", fontSize: 20 }} />}
        title="Statistics"
        subtitle="Platform health, growth, and referral breakdown."
        isDark={isDark}
      />

      {/* Refresh */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          size="small"
          startIcon={<RefreshIcon sx={{ fontSize: 14 }} />}
          onClick={() => fetchStats()}
          disabled={loading}
          sx={{ fontSize: 12, textTransform: "none", color: "text.secondary", "&:hover": { background: isDark ? "#343536" : "#f5f5f5" } }}
        >
          Refresh
        </Button>
      </Box>

      {loading && !data && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress sx={{ color: "#A84D48" }} />
        </Box>
      )}

      {error && (
        <Typography color="error" sx={{ mb: 2, fontSize: 13 }}>{error}</Typography>
      )}

      {data && (
        <>
          {/* ── Stat cards ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(4, 1fr)" }, gap: { xs: 1.5, sm: 2 }, mb: 3 }}>
            <StatCard
              icon={<PeopleIcon sx={{ color: "#A84D48", fontSize: 20 }} />}
              label="Total Users"
              value={data.users.total}
              sub={data.users.new7 > 0 ? `+${data.users.new7} this week` : null}
              accentColor="#A84D48"
              isDark={isDark}
            />
            <StatCard
              icon={<TrendingUpIcon sx={{ color: "#6366f1", fontSize: 20 }} />}
              label="New (30 days)"
              value={data.users.new30}
              accentColor="#6366f1"
              isDark={isDark}
            />
            <StatCard
              icon={<ConfirmationNumberIcon sx={{ color: "#16a34a", fontSize: 20 }} />}
              label="Total Tickets"
              value={data.tickets.total}
              sub={data.tickets.open > 0 ? `${data.tickets.open} open` : "All resolved"}
              accentColor="#16a34a"
              isDark={isDark}
            />
            <StatCard
              icon={<FlagIcon sx={{ color: "#f59e0b", fontSize: 20 }} />}
              label="Reports"
              value={data.reports.total}
              sub={data.reports.pending > 0 ? `${data.reports.pending} pending` : null}
              accentColor="#f59e0b"
              isDark={isDark}
            />
          </Box>

          {/* ── Two-column lower section ── */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>

            {/* Referral sources */}
            <Paper variant="outlined" sx={{
              p: { xs: 2, sm: 2.5 }, borderRadius: 3,
              borderColor: isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc",
              background: isDark ? "#1A1A1B" : "#fff",
            }}>
              <Typography fontWeight={800} fontSize={15} sx={{ mb: 0.5, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
                How Users Found Us
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, mb: 2 }}>
                {data.referrals.total} response{data.referrals.total !== 1 ? "s" : ""} collected
              </Typography>
              {referralEntries.length === 0 ? (
                <Typography variant="body2" color="text.disabled" sx={{ py: 3, textAlign: "center" }}>
                  No referral data yet.
                </Typography>
              ) : (
                referralEntries.map(([source, count], i) => (
                  <BarRow
                    key={source}
                    label={REFERRAL_LABELS[source] ?? source}
                    count={count}
                    total={data.referrals.total}
                    color={BAR_COLORS[i % BAR_COLORS.length]}
                    isDark={isDark}
                  />
                ))
              )}
            </Paper>

            {/* Ticket breakdown + user sparkline */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>

              {/* Ticket breakdown */}
              <Paper variant="outlined" sx={{
                p: { xs: 2, sm: 2.5 }, borderRadius: 3,
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc",
                background: isDark ? "#1A1A1B" : "#fff",
              }}>
                <Typography fontWeight={800} fontSize={15} sx={{ mb: 2, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
                  Tickets by Type
                </Typography>
                <BarRow label="Bug Reports" count={data.tickets.bugs}     total={data.tickets.total} color="#A84D48" isDark={isDark} />
                <BarRow label="Support"     count={data.tickets.support}  total={data.tickets.total} color="#16a34a" isDark={isDark} />
                <BarRow label="Feedback"    count={data.tickets.feedback} total={data.tickets.total} color="#6366f1" isDark={isDark} />
              </Paper>

              {/* 30-day signups sparkline */}
              <Paper variant="outlined" sx={{
                p: { xs: 2, sm: 2.5 }, borderRadius: 3,
                borderColor: isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc",
                background: isDark ? "#1A1A1B" : "#fff",
              }}>
                <Typography fontWeight={800} fontSize={15} sx={{ color: isDark ? "#D7DADC" : "#1a1a1a" }}>
                  New Signups — Last 30 Days
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, mb: 1 }}>
                  {data.users.new30} new user{data.users.new30 !== 1 ? "s" : ""}
                </Typography>
                <Sparkline byDay={data.users.byDay} isDark={isDark} />
                <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.5 }}>
                  <Typography variant="caption" color="text.disabled">30 days ago</Typography>
                  <Typography variant="caption" color="text.disabled">Today</Typography>
                </Box>
              </Paper>

            </Box>
          </Box>
        </>
      )}
    </>
  );
}
