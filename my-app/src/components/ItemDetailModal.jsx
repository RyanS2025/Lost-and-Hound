import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, Chip, Modal, IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FlagIcon from "@mui/icons-material/Flag";
import ReportModal from "./ReportModal";
import MapPinPicker from "./MapPinPicker";
import { useAuth } from "../AuthContext";
import { formatRelativeDate, DEFAULT_TIME_ZONE } from "../utils/timezone";
import apiFetch from "../utils/apiFetch";

const IMPORTANCE_LABELS = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };
const LISTING_TYPE_LABELS = { found: "Found", lost: "Lost" };
const LISTING_TYPE_COLORS = { found: "#0891b2", lost: "#4f46e5" };

function parseCoordinates(coordStr) {
  if (!coordStr || typeof coordStr !== "string") return null;
  const match = coordStr.match(/([\d.]+)°?\s*([NS])\s+([\d.]+)°?\s*([EW])/i);
  if (!match) {
    try {
      const obj = typeof coordStr === "string" ? JSON.parse(coordStr) : coordStr;
      if (obj.lat != null && obj.lng != null) return { lat: Number(obj.lat), lng: Number(obj.lng) };
    } catch { /* ignore */ }
    return null;
  }
  let lat = parseFloat(match[1]);
  let lng = parseFloat(match[3]);
  if (match[2].toUpperCase() === "S") lat = -lat;
  if (match[4].toUpperCase() === "W") lng = -lng;
  return { lat, lng };
}

export default function ItemDetailModal({ item, onClose, onClaim, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [returning, setReturning] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isOwner = user?.id && item?.poster_id === user.id;

  if (!item) return null;

  const pinCoords = (item.lat && item.lng)
    ? { lat: item.lat, lng: item.lng }
    : parseCoordinates(item.locations?.coordinates);

  return (
    <Modal open={!!item} onClose={onClose} sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Box sx={{
        background: isDark ? "#1A1A1B" : "#fff", borderRadius: 4, p: "26px", maxWidth: 520,
        maxHeight: "90dvh", overflowY: "auto", outline: "none",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
        boxSizing: "border-box",
        width: { xs: "calc(100% - 32px)", sm: "100%" },
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.25, overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {item.title}
            </Typography>
            <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>
              Posted by {item.poster_name} · {formatRelativeDate(item.date, timeZone)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
            <IconButton onClick={() => setReportOpen(true)} size="small" sx={{ color: isDark ? "#818384" : "#999", "&:hover": { color: "#A84D48" } }}>
              <FlagIcon fontSize="small" />
            </IconButton>
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          </Box>
        </Box>

        {item.image_url
          ? <Box component="img" src={item.image_url} alt={item.title} onClick={() => setLightboxOpen(true)}
              sx={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 2, mb: 2, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc", cursor: "zoom-in" }} />
          : <Box sx={{ width: "100%", height: 120, background: isDark ? "#2D2D2E" : "#f5f0f0", borderRadius: 2, mb: 2, display: "flex", alignItems: "center", justifyContent: "center", border: isDark ? "1px dashed rgba(255,255,255,0.2)" : "1.5px dashed #dac8c8" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No photo provided</Typography>
            </Box>
        }

        <Modal open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
          <Box onClick={() => setLightboxOpen(false)} sx={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", p: 2, cursor: "zoom-out" }}>
            <Box component="img" src={item.image_url} alt={item.title} sx={{ maxWidth: "100%", maxHeight: "90dvh", objectFit: "contain", borderRadius: 2 }} />
          </Box>
        </Modal>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <Chip label={IMPORTANCE_LABELS[item.importance]} size="small" sx={{ background: IMPORTANCE_COLORS[item.importance] + "22", color: IMPORTANCE_COLORS[item.importance], fontWeight: 800 }} />
          <Chip label={item.category} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: "#A84D48", fontWeight: 700 }} />
          {item.listing_type && (
            <Chip
              label={LISTING_TYPE_LABELS[item.listing_type] ?? item.listing_type}
              size="small"
              sx={{
                background: (LISTING_TYPE_COLORS[item.listing_type] ?? "#888") + "22",
                color: LISTING_TYPE_COLORS[item.listing_type] ?? "#888",
                border: `1px solid ${(LISTING_TYPE_COLORS[item.listing_type] ?? "#888")}44`,
                fontWeight: 800,
              }}
            />
          )}
          {item.resolved && <Chip label="Resolved" size="small" sx={{ background: isDark ? "#1f3527" : "#dcfce7", color: isDark ? "#6ee7b7" : "#16a34a", border: isDark ? "1px solid rgba(110,231,183,0.42)" : "none", fontWeight: 800 }} />}
        </Box>

        <Paper variant="outlined" sx={{ p: 2, mb: 2, background: isDark ? "#232324" : "#fdf7f7", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc", borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>LOCATION</Typography>
          <Typography fontWeight={700} fontSize={14}>{item.locations?.name ?? "Unknown location"}</Typography>
          <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>
            {item.listing_type === "lost" ? "Last seen at" : "Found at"}: {item.found_at}
          </Typography>
          {pinCoords ? (
            <Box sx={{ mt: 1.5 }}>
              <MapPinPicker value={pinCoords} height={120} interactive={false} showCoords={false} zoom={17} center={pinCoords} />
            </Box>
          ) : (
            <Box sx={{ mt: 1.5, background: isDark ? "#2D2D2E" : "#ede8e8", borderRadius: 1.5, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No exact location pinned</Typography>
            </Box>
          )}
        </Paper>

        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>DESCRIPTION</Typography>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} lineHeight={1.65} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
            {item.description}
          </Typography>
        </Box>

        {!item.resolved && !isOwner && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.75, mb: 1.5, borderRadius: 1.5, background: isDark ? "#3a2f22" : "#fff3cd", border: isDark ? "1px solid rgba(245,158,11,0.5)" : "1px solid #ffc107" }}>
            <Typography variant="caption" sx={{ color: isDark ? "#f6c66a" : "#7d4e00", fontWeight: 600, lineHeight: 1.4 }}>
              {item.listing_type === "lost"
                ? "Only the original poster can mark this item as found."
                : "Only the original poster can mark this item as returned."}
            </Typography>
          </Box>
        )}

        <Box sx={{ display: "flex", gap: 1.5 }}>
          {isOwner && (
            <Button variant="contained" fullWidth disabled={item.resolved || returning}
              onClick={async () => { setReturning(true); await onClaim(item.item_id); setReturning(false); }}
              sx={{ background: item.resolved ? "#16a34a" : "#A84D48", "&:hover": { background: item.resolved ? "#15803d" : "#8f3e3a" }, fontWeight: 800, borderRadius: 2 }}
            >
              {item.resolved
                ? (item.listing_type === "lost" ? "Already Found" : "Already Returned")
                : returning ? "Marking..."
                : (item.listing_type === "lost" ? "I Found This!" : "Returned Item")}
            </Button>
          )}
          {!isOwner && (
            <Button variant="outlined"
              sx={{ borderColor: isDark ? "rgba(255,255,255,0.2)" : "#ecdcdc", color: "#A84D48", fontWeight: 800, borderRadius: 2, flexShrink: 0, width: "100%" }}
              onClick={async () => {
                try {
                  const result = await apiFetch("/api/conversations", {
                    method: "POST",
                    body: JSON.stringify({ listing_id: item.item_id, other_user_id: item.poster_id }),
                  });
                  navigate(`/messages?conversation=${result.id}`);
                } catch (err) {
                  console.error("Create conversation error:", err);
                }
              }}
            >
              Message
            </Button>
          )}
        </Box>

        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} type="post" targetId={item.item_id} targetLabel={item.title} />
      </Box>
    </Modal>
  );
}
