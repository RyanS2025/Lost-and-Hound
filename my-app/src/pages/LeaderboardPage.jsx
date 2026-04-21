import { useState, useEffect, useCallback } from "react";
import {
  Box, Typography, Paper, CircularProgress, Select, MenuItem,
  FormControl, InputLabel, Chip, Divider, Avatar,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import StarIcon from "@mui/icons-material/Star";
import apiFetch from "../utils/apiFetch";
import { useAuth } from "../AuthContext";
import { CAMPUSES } from "../constants/campuses";

const MEDAL_COLORS = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };
const MEDAL_BG = { 1: "rgba(255,215,0,0.12)", 2: "rgba(192,192,192,0.12)", 3: "rgba(205,127,50,0.12)" };

function rankLabel(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function UserRow({ entry, isCurrentUser, effectiveTheme }) {
  const isDark = effectiveTheme === "dark";
  const isMedal = entry.rank <= 3;
  const name = `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim() || "Unknown User";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        background: isCurrentUser
          ? isDark ? "rgba(255,69,0,0.13)" : "rgba(168,77,72,0.09)"
          : isMedal
            ? MEDAL_BG[entry.rank]
            : "transparent",
        border: isCurrentUser
          ? `1.5px solid ${isDark ? "rgba(255,69,0,0.45)" : "rgba(168,77,72,0.35)"}`
          : isMedal
            ? `1px solid ${MEDAL_COLORS[entry.rank]}33`
            : "1px solid transparent",
        transition: "background 0.15s",
      }}
    >
      <Typography
        sx={{
          width: 36,
          textAlign: "center",
          fontWeight: 800,
          fontSize: isMedal ? 22 : 15,
          color: isMedal ? MEDAL_COLORS[entry.rank] : (isDark ? "#818384" : "#888"),
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {rankLabel(entry.rank)}
      </Typography>

      <Avatar
        sx={{
          width: 36,
          height: 36,
          fontSize: 14,
          fontWeight: 800,
          bgcolor: isDark ? "#2D2D2E" : "#e8dede",
          color: isDark ? "#D7DADC" : "#5a3030",
          flexShrink: 0,
          border: isCurrentUser ? `2px solid ${isDark ? "#FF4500" : "#A84D48"}` : "none",
        }}
      >
        {initials}
      </Avatar>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight={isCurrentUser ? 800 : 600}
          noWrap
          sx={{ color: isDark ? "#D7DADC" : "#2d2d2d" }}
        >
          {name}
          {isCurrentUser && (
            <Typography component="span" variant="caption" sx={{ ml: 1, color: isDark ? "#FF4500" : "#A84D48", fontWeight: 700 }}>
              You
            </Typography>
          )}
        </Typography>
        {entry.default_campus && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {CAMPUSES.find((c) => c.id === entry.default_campus)?.name ?? entry.default_campus}
          </Typography>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        <StarIcon sx={{ fontSize: 15, color: isDark ? "#FF4500" : "#A84D48" }} />
        <Typography
          variant="body2"
          fontWeight={800}
          sx={{ color: isDark ? "#FF4500" : "#A84D48", minWidth: 32, textAlign: "right" }}
        >
          {entry.points ?? 0}
        </Typography>
      </Box>
    </Box>
  );
}

export default function LeaderboardPage({ effectiveTheme }) {
  const isDark = effectiveTheme === "dark";
  const { user } = useAuth();

  const [campus, setCampus] = useState("global");
  const [leaderboard, setLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = campus !== "global" ? `?campus=${campus}` : "";
      const data = await apiFetch(`/api/leaderboard${params}`);
      setLeaderboard(data.leaderboard ?? []);
      setCurrentUser(data.currentUser ?? null);
    } catch (err) {
      setError(err.message || "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [campus]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const cardBorder = isDark ? "1px solid rgba(255,255,255,0.12)" : "1.5px solid #ecdcdc";
  const cardBg = isDark ? "#1A1A1B" : "#fff";
  const cardShadow = isDark
    ? "0 10px 36px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.3)"
    : "0 8px 32px rgba(168,77,72,0.1), 0 2px 8px rgba(0,0,0,0.06)";

  const isCurrentUserInTop = leaderboard.some((u) => u.id === user?.id);

  return (
    <Box sx={{ maxWidth: 640, mx: "auto", px: { xs: 2, sm: 3 }, py: 4 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <EmojiEventsIcon sx={{ fontSize: 34, color: isDark ? "#FFD700" : "#b8860b" }} />
        <Box>
          <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.2 }}>
            Leaderboard
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Earn points by posting & returning lost items
          </Typography>
        </Box>
      </Box>

      {/* Points guide */}
      <Paper
        elevation={0}
        sx={{ mb: 3, p: 2, borderRadius: 2, border: cardBorder, background: cardBg, boxShadow: cardShadow }}
      >
        <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: "block", textTransform: "uppercase", letterSpacing: 0.8 }}>
          How to earn points
        </Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          {[
            { label: "Post a found item", pts: "+15" },
            { label: "Mark item returned", pts: "+25" },
            { label: "Post a lost item", pts: "+5" },
          ].map(({ label, pts }) => (
            <Chip
              key={label}
              label={`${pts}  ${label}`}
              size="small"
              sx={{
                fontWeight: 700,
                fontSize: 12,
                bgcolor: isDark ? "#2D2D2E" : "#f5eeee",
                color: isDark ? "#FF4500" : "#A84D48",
              }}
            />
          ))}
        </Box>
      </Paper>

      {/* Campus filter */}
      <FormControl size="small" sx={{ mb: 3, minWidth: 200 }}>
        <InputLabel>Campus</InputLabel>
        <Select value={campus} label="Campus" onChange={(e) => setCampus(e.target.value)}>
          <MenuItem value="global">Global (All Campuses)</MenuItem>
          {CAMPUSES.map((c) => (
            <MenuItem key={c.id} value={c.id}>{c.name} — {c.state}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Leaderboard list */}
      <Paper elevation={0} sx={{ borderRadius: 3, border: cardBorder, background: cardBg, boxShadow: cardShadow, overflow: "hidden" }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={32} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} />
          </Box>
        ) : error ? (
          <Box sx={{ py: 5, textAlign: "center" }}>
            <Typography color="error" variant="body2">{error}</Typography>
          </Box>
        ) : leaderboard.length === 0 ? (
          <Box sx={{ py: 6, textAlign: "center" }}>
            <EmojiEventsIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
            <Typography color="text.secondary" variant="body2">
              No entries yet. Be the first to earn points!
            </Typography>
          </Box>
        ) : (
          <Box sx={{ p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}>
            {leaderboard.map((entry, idx) => (
              <Box key={entry.id}>
                <UserRow
                  entry={entry}
                  isCurrentUser={entry.id === user?.id}
                  effectiveTheme={effectiveTheme}
                />
                {idx === 2 && leaderboard.length > 3 && (
                  <Divider sx={{ my: 1, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />
                )}
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {/* Current user's rank when outside top 50 */}
      {!loading && !error && currentUser && !isCurrentUserInTop && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", pl: 1 }}>
            Your rank
          </Typography>
          <Paper elevation={0} sx={{ borderRadius: 2, border: cardBorder, background: cardBg, p: 1 }}>
            <UserRow entry={currentUser} isCurrentUser effectiveTheme={effectiveTheme} />
          </Paper>
        </Box>
      )}
    </Box>
  );
}
