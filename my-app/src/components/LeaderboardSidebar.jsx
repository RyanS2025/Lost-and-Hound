import { useState, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import {
  Box, Typography, Paper, CircularProgress, Avatar, Divider,
  Chip, IconButton, Button, Dialog, DialogContent,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import StarIcon from "@mui/icons-material/Star";
import CloseIcon from "@mui/icons-material/Close";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import apiFetch from "../utils/apiFetch";
import { useAuth } from "../AuthContext";

const MEDAL_COLORS_DARK = { 1: "#FFD700", 2: "#C0C0C0", 3: "#CD7F32" };
const MEDAL_COLORS_LIGHT = { 1: "#b8860b", 2: "#71717a", 3: "#92400e" };
const MEDAL_BG = { 1: "rgba(255,215,0,0.12)", 2: "rgba(192,192,192,0.12)", 3: "rgba(205,127,50,0.12)" };

const TIERS_DARK = [
  { label: "Top Dog",    emoji: "🏆", min: 500, color: "#FFD700", bg: "rgba(255,215,0,0.13)" },
  { label: "Bloodhound", emoji: "🐶", min: 300, color: "#FF4500", bg: "rgba(255,69,0,0.12)" },
  { label: "Retriever",  emoji: "🦴", min: 150, color: "#7C3AED", bg: "rgba(124,58,237,0.12)" },
  { label: "Tracker",    emoji: "🔍", min: 75,  color: "#0891b2", bg: "rgba(8,145,178,0.12)" },
  { label: "Scout",      emoji: "🐕", min: 25,  color: "#16a34a", bg: "rgba(22,163,74,0.12)" },
  { label: "Pup",        emoji: "🐾", min: 0,   color: "#6b7280", bg: "rgba(107,114,128,0.10)" },
];

const TIERS_LIGHT = [
  { label: "Top Dog",    emoji: "🏆", min: 500, color: "#b8860b", bg: "rgba(184,134,11,0.10)" },
  { label: "Bloodhound", emoji: "🐶", min: 300, color: "#c9340a", bg: "rgba(201,52,10,0.10)" },
  { label: "Retriever",  emoji: "🦴", min: 150, color: "#6d28d9", bg: "rgba(109,40,217,0.10)" },
  { label: "Tracker",    emoji: "🔍", min: 75,  color: "#0e7490", bg: "rgba(14,116,144,0.10)" },
  { label: "Scout",      emoji: "🐕", min: 25,  color: "#15803d", bg: "rgba(21,128,61,0.10)" },
  { label: "Pup",        emoji: "🐾", min: 0,   color: "#4b5563", bg: "rgba(75,85,99,0.10)" },
];

function getTier(points, isDark) {
  const tiers = isDark ? TIERS_DARK : TIERS_LIGHT;
  return tiers.find((t) => (points ?? 0) >= t.min);
}

function rankLabel(rank) {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
}

function CompactRow({ entry, isCurrentUser, isDark, compact }) {
  const isMedal = entry.rank <= 3;
  const tier = getTier(entry.points, isDark);
  const medalColors = isDark ? MEDAL_COLORS_DARK : MEDAL_COLORS_LIGHT;
  const name = `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim() || "Unknown";
  const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        px: 1.5,
        py: compact ? 0.75 : 1,
        borderRadius: 1.5,
        background: isCurrentUser
          ? isDark ? "rgba(255,69,0,0.13)" : "rgba(168,77,72,0.09)"
          : isMedal ? MEDAL_BG[entry.rank] : "transparent",
        border: isCurrentUser
          ? `1.5px solid ${isDark ? "rgba(255,69,0,0.45)" : "rgba(168,77,72,0.35)"}`
          : "1px solid transparent",
      }}
    >
      <Typography
        sx={{
          width: compact ? 26 : 28,
          textAlign: "center",
          fontWeight: 800,
          fontSize: isMedal ? (compact ? 17 : 18) : 13,
          color: isMedal ? medalColors[entry.rank] : (isDark ? "#818384" : "#888"),
          flexShrink: 0,
          lineHeight: 1,
        }}
      >
        {rankLabel(entry.rank)}
      </Typography>

      <Avatar
        sx={{
          width: compact ? 26 : 28,
          height: compact ? 26 : 28,
          fontSize: 11,
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
          variant="caption"
          fontWeight={isCurrentUser ? 800 : 600}
          noWrap
          sx={{ color: isDark ? "#D7DADC" : "#2d2d2d", display: "block", lineHeight: 1.3, fontSize: 12 }}
        >
          {name}
          {isCurrentUser && (
            <Typography component="span" sx={{ ml: 0.5, color: isDark ? "#FF4500" : "#A84D48", fontWeight: 700, fontSize: 10 }}>
              You
            </Typography>
          )}
        </Typography>
        <Typography sx={{ fontSize: 10, color: tier.color, fontWeight: 700, lineHeight: 1.2 }}>
          {tier.emoji} {tier.label}
        </Typography>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, flexShrink: 0 }}>
        <StarIcon sx={{ fontSize: 12, color: isDark ? "#FF4500" : "#A84D48" }} />
        <Typography
          sx={{ fontSize: 12, fontWeight: 800, color: isDark ? "#FF4500" : "#A84D48" }}
        >
          {entry.points ?? 0}
        </Typography>
      </Box>
    </Box>
  );
}


const LeaderboardSidebar = forwardRef(function LeaderboardSidebar({ effectiveTheme, modalOnly }, ref) {
  const isDark = effectiveTheme === "dark";
  const { user } = useAuth();
  const [fullLeaderboard, setFullLeaderboard] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  useImperativeHandle(ref, () => ({ openModal: () => setModalOpen(true) }));

  const fetchLeaderboard = useCallback(async () => {
    try {
      const data = await apiFetch("/api/leaderboard");
      setFullLeaderboard(data.leaderboard ?? []);
      setCurrentUser(data.currentUser ?? null);
    } catch {
      // silent fail for sidebar
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const leaderboard = fullLeaderboard.slice(0, 10);
  const cardBorder = isDark ? "1px solid rgba(255,255,255,0.12)" : "1.5px solid #ecdcdc";
  const cardBg = isDark ? "#1A1A1B" : "#fff";
  const accent = isDark ? "#FF4500" : "#A84D48";
  const isCurrentUserInTop = leaderboard.some((u) => u.id === user?.id);
  const isCurrentUserInFull = fullLeaderboard.some((u) => u.id === user?.id);

  return (
    <>
      {!modalOnly && <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {/* Leaderboard card */}
        <Paper
          elevation={0}
          sx={{ borderRadius: 2.5, border: cardBorder, bgcolor: cardBg, overflow: "hidden" }}
        >
          <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 1, borderBottom: cardBorder }}>
            <EmojiEventsIcon sx={{ fontSize: 20, color: isDark ? "#FFD700" : "#b8860b" }} />
            <Typography variant="body2" fontWeight={900}>Leaderboard</Typography>
          </Box>

          {loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} sx={{ color: accent }} />
            </Box>
          ) : leaderboard.length === 0 ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography variant="caption" color="text.secondary">No entries yet</Typography>
            </Box>
          ) : (
            <Box sx={{ p: 0.75, display: "flex", flexDirection: "column", gap: 0.25 }}>
              {leaderboard.map((entry, idx) => (
                <Box key={entry.id}>
                  <CompactRow entry={entry} isCurrentUser={entry.id === user?.id} isDark={isDark} compact={!isCurrentUserInTop} />
                  {idx === 2 && leaderboard.length > 3 && (
                    <Divider sx={{ my: 0.5, borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
                  )}
                </Box>
              ))}
            </Box>
          )}

          {/* Current user outside top 10 */}
          {!loading && currentUser && !isCurrentUserInTop && (
            <Box sx={{ px: 0.75, pb: 0.75 }}>
              <Divider sx={{ mb: 0.5, borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
              <CompactRow entry={currentUser} isCurrentUser isDark={isDark} compact />
            </Box>
          )}

          {/* Open Full Leaderboard button */}
          {!loading && leaderboard.length > 0 && (
            <Box sx={{ px: 1, pb: 1 }}>
              <Button
                fullWidth
                size="small"
                onClick={() => setModalOpen(true)}
                startIcon={<OpenInFullIcon sx={{ fontSize: 14 }} />}
                sx={{
                  color: accent,
                  fontWeight: 700,
                  fontSize: 12,
                  borderRadius: 1.5,
                  textTransform: "none",
                  bgcolor: isDark ? "rgba(255,69,0,0.08)" : "rgba(168,77,72,0.06)",
                  "&:hover": { bgcolor: isDark ? "rgba(255,69,0,0.15)" : "rgba(168,77,72,0.12)" },
                }}
              >
                Open Full Leaderboard
              </Button>
            </Box>
          )}
        </Paper>
      </Box>}

      {/* Full Leaderboard Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            bgcolor: cardBg,
            border: cardBorder,
            borderRadius: 3,
            overflow: "hidden",
          },
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: cardBorder }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <EmojiEventsIcon sx={{ fontSize: 28, color: isDark ? "#FFD700" : "#b8860b" }} />
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>Leaderboard</Typography>
              <Typography variant="caption" color="text.secondary">Top players & how to earn points</Typography>
            </Box>
          </Box>
          <IconButton onClick={() => setModalOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: 0 }}>
          <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, minHeight: { sm: 400 } }}>
            {/* Rankings */}
            <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2.5 }, overflowY: "auto", maxHeight: { xs: "50vh", sm: "70vh" } }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1, display: "block", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Top 50
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                {fullLeaderboard.map((entry, idx) => (
                  <Box key={entry.id}>
                    <CompactRow entry={entry} isCurrentUser={entry.id === user?.id} isDark={isDark} />
                    {idx === 2 && fullLeaderboard.length > 3 && (
                      <Divider sx={{ my: 0.5, borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" }} />
                    )}
                  </Box>
                ))}
              </Box>

              {currentUser && !isCurrentUserInFull && (
                <Box sx={{ mt: 1 }}>
                  <Divider sx={{ mb: 0.75, borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)" }} />
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>Your rank</Typography>
                  <CompactRow entry={currentUser} isCurrentUser isDark={isDark} />
                </Box>
              )}
            </Box>

            {/* Points & Ranks info */}
            <Box sx={{
              width: { xs: "100%", sm: 240 },
              flexShrink: 0,
              borderLeft: { xs: "none", sm: cardBorder },
              borderTop: { xs: cardBorder, sm: "none" },
              p: 2,
              bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
            }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, display: "block", textTransform: "uppercase", letterSpacing: 0.8 }}>
                How to earn points
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2.5 }}>
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
                      color: accent,
                      justifyContent: "flex-start",
                      height: 30,
                    }}
                  />
                ))}
              </Box>

              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, display: "block", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Ranks
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {(isDark ? TIERS_DARK : TIERS_LIGHT).map((tier, i, arr) => (
                  <Box key={tier.label} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ width: 26, height: 26, borderRadius: 1.5, bgcolor: tier.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                        {tier.emoji}
                      </Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: tier.color }}>
                        {tier.label}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: 11, color: "text.secondary", fontWeight: 600 }}>
                      {tier.min === 500 ? "500+" : tier.min === 0 ? "0–24" : `${tier.min}–${arr[i - 1].min - 1}`} pts
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
});

export default LeaderboardSidebar;
