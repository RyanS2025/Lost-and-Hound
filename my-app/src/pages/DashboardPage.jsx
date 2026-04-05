import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, Chip, Tabs, Tab,
  CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions,
  IconButton, Collapse, Select, MenuItem, FormControl, TextField, Modal,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import FlagIcon from "@mui/icons-material/Flag";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import BugReportIcon from "@mui/icons-material/BugReport";
import FeedbackIcon from "@mui/icons-material/RateReview";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import ShieldIcon from "@mui/icons-material/Shield";
import PeopleIcon from "@mui/icons-material/People";
import ArticleIcon from "@mui/icons-material/Article";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GavelIcon from "@mui/icons-material/Gavel";
import UndoIcon from "@mui/icons-material/Undo";
import { useAuth } from "../AuthContext";
import apiFetch from "../utils/apiFetch";
import MapPinPicker from "../components/MapPinPicker";
import {
  DEFAULT_TIME_ZONE,
  formatDateTime,
  formatRelativeDate,
  formatTime,
} from "../utils/timezone";

// --- Constants ---
const STATUS_CONFIG = {
  pending: { bg: "#fff3cd", color: "#92400e", border: "#ffc107" },
  reviewed: { bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  dismissed: { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

const STATUS_CONFIG_DARK = {
  pending: { bg: "#3a2f22", color: "#f6c66a", border: "rgba(245,158,11,0.5)" },
  reviewed: { bg: "#1f3527", color: "#6ee7b7", border: "rgba(110,231,183,0.42)" },
  dismissed: { bg: "#2c3138", color: "#cbd5e1", border: "rgba(148,163,184,0.45)" },
};

const IMPORTANCE_LABELS = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };

const DECISION_OPTIONS = [
  { value: "no_violation", label: "No Violation", color: "#16a34a", description: "Dismiss report — no action taken" },
  { value: "violation_3", label: "3 Day Ban", color: "#f59e0b", description: "Remove content + ban user for 3 days" },
  { value: "violation_30", label: "30 Day Ban", color: "#dc2626", description: "Remove content + ban user for 30 days" },
  { value: "violation_permanent", label: "Permanent Ban", color: "#7f1d1d", description: "Remove content + permanently ban user" },
];

const STOLEN_DECISION_OPTIONS = [
  { value: "no_violation", label: "Insufficient Theft Evidence", color: "#16a34a", description: "Dismiss theft claim and keep content active" },
  { value: "violation_3", label: "Likely False Claim (3 Day Ban)", color: "#f59e0b", description: "Remove content and issue a short suspension for suspected false ownership claim" },
  { value: "violation_30", label: "Confirmed Fraud Claim (30 Day Ban)", color: "#dc2626", description: "Remove content and apply longer suspension for confirmed fraudulent claim" },
  { value: "violation_permanent", label: "Severe Theft/Fraud (Permanent Ban)", color: "#7f1d1d", description: "Remove content and permanently ban user for severe theft-related abuse" },
];

function isStolenReport(report) {
  const reason = (report?.reason || "").toLowerCase();
  const details = (report?.details || "").toLowerCase();
  return reason.includes("stolen") || details.includes("stolen") || reason.includes("theft") || details.includes("theft");
}

function parseCoordinates(coordStr) {
  if (!coordStr || typeof coordStr !== "string") return null;
  const match = coordStr.match(/([\d.]+)°?\s*([NS])\s+([\d.]+)°?\s*([EW])/i);
  if (!match) {
    try {
      const obj = typeof coordStr === "string" ? JSON.parse(coordStr) : coordStr;
      if (obj.lat != null && obj.lng != null) return { lat: Number(obj.lat), lng: Number(obj.lng) };
    } catch {
      return null;
    }
    return null;
  }
  let lat = parseFloat(match[1]);
  let lng = parseFloat(match[3]);
  if (match[2].toUpperCase() === "S") lat = -lat;
  if (match[4].toUpperCase() === "W") lng = -lng;
  return { lat, lng };
}

function DashboardListingModal({ listing, open, onClose, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  if (!listing) return null;

  const pinCoords = (listing.lat && listing.lng)
    ? { lat: listing.lat, lng: listing.lng }
    : parseCoordinates(listing.locations?.coordinates);

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: isDark ? "#1A1A1B" : "#fff", borderRadius: 4, p: "26px", width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto", outline: "none",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
        mx: 1.5,
        boxSizing: "border-box",
        width: { xs: "calc(100% - 24px)", sm: "100%" },
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.25, overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {listing.title}
            </Typography>
            <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>
              Posted by {listing.poster_name} · {formatRelativeDate(listing.date, timeZone, { compact: true })}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
            <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
          </Box>
        </Box>

        {listing.image_url
          ? <Box component="img" src={listing.image_url} alt={listing.title} sx={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 2, mb: 2, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc" }} />
          : <Box sx={{ width: "100%", height: 120, background: isDark ? "#2D2D2E" : "#f5f0f0", borderRadius: 2, mb: 2, display: "flex", alignItems: "center", justifyContent: "center", border: isDark ? "1px dashed rgba(255,255,255,0.2)" : "1.5px dashed #dac8c8" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No photo provided</Typography>
            </Box>
        }

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          {listing.importance && <Chip label={IMPORTANCE_LABELS[listing.importance]} size="small" sx={{ background: IMPORTANCE_COLORS[listing.importance] + "22", color: IMPORTANCE_COLORS[listing.importance], fontWeight: 800 }} />}
          {listing.category && <Chip label={listing.category} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: "#A84D48", fontWeight: 700 }} />}
          {listing.resolved && <Chip label="Resolved" size="small" sx={{ background: isDark ? "#1f3527" : "#dcfce7", color: isDark ? "#6ee7b7" : "#16a34a", border: isDark ? "1px solid rgba(110,231,183,0.42)" : "none", fontWeight: 800 }} />}
        </Box>

        <Paper variant="outlined" sx={{ p: 2, mb: 2, background: isDark ? "#232324" : "#fdf7f7", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc", borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>LOCATION</Typography>
          <Typography fontWeight={700} fontSize={14} sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}>{listing.locations?.name ?? "Unknown location"}</Typography>
          <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>Found at: {listing.found_at || "No specific spot"}</Typography>

          {pinCoords ? (
            <Box sx={{ mt: 1.5 }}>
              <MapPinPicker
                value={pinCoords}
                height={120}
                interactive={false}
                showCoords={false}
                zoom={17}
                center={pinCoords}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 1.5, background: isDark ? "#2D2D2E" : "#ede8e8", borderRadius: 1.5, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No exact location pinned</Typography>
            </Box>
          )}
        </Paper>

        <Box>
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>DESCRIPTION</Typography>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} lineHeight={1.65} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
            {listing.description}
          </Typography>
        </Box>
      </Box>
    </Modal>
  );
}

// --- Stat Card ---
function StatCard({ icon, label, value, color, isDark = false, compact = false }) {
  return (
    <Paper variant="outlined" sx={{
      p: compact ? 1.5 : 2.5,
      borderRadius: 2.5,
      borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc",
      background: isDark ? "#1A1A1B" : "#fff",
      display: "flex",
      alignItems: "center",
      gap: compact ? 1.25 : 2,
      flex: 1,
      minWidth: 0,
    }}>
      <Box sx={{
        width: compact ? 36 : 44, height: compact ? 36 : 44, borderRadius: 2, flexShrink: 0,
        background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant={compact ? "h6" : "h5"} fontWeight={900} sx={{ lineHeight: 1.2 }}>{value}</Typography>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ fontSize: compact ? 10 : 12 }}>{label}</Typography>
      </Box>
    </Paper>
  );
}

// --- Empty State ---
function EmptySection({ icon, title, description, isDark = false }) {
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

// --- 404 ---
function AccessDenied({ isDark = false }) {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100dvh - 140px)", p: { xs: 1.5, sm: 3 } }}>
      <Paper elevation={0} sx={{ p: 4, pt: 0, borderRadius: 3, textAlign: "center", maxWidth: 380, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc", overflow: "visible", background: isDark ? "#1A1A1B" : "#fff" }}>
        <Box component="img" src="/404Image.png" alt="Lost husky" sx={{ width: "100%", maxWidth: 260, mx: "auto", display: "block", mt: -6, mb: -2 }} />
        <Typography variant="h3" fontWeight={900} sx={{ mb: 0.5, color: isDark ? "#D7DADC" : "#3d2020" }}>404</Typography>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: isDark ? "#D7DADC" : "#3d2020" }}>Page not found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>The page you're looking for doesn't exist or has been moved.</Typography>
        <Button variant="contained" onClick={() => navigate("/")} sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 700, borderRadius: 2, px: 4 }}>GO HOME</Button>
      </Paper>
    </Box>
  );
}

// --- Post Detail Panel ---
function PostDetail({ listing, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!listing) {
    return (
      <Box sx={{ p: 3, background: isDark ? "#232324" : "#faf8f8", borderRadius: 2, border: isDark ? "1px dashed rgba(255,255,255,0.16)" : "1px dashed #e0d6d6", textAlign: "center" }}>
        <Typography variant="body2" color="text.disabled" fontWeight={600}>This listing has been deleted.</Typography>
      </Box>
    );
  }
  return (
    <>
      <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc", background: isDark ? "#232324" : "#fdf7f7", overflow: "hidden" }}>
      {listing.image_url && (
        <Box component="img" src={listing.image_url} alt={listing.title} sx={{ width: "100%", height: { xs: 140, sm: 180 }, objectFit: "cover" }} />
      )}
      <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
          <Typography fontWeight={800} fontSize={{ xs: 14, sm: 16 }}>{listing.title}</Typography>
          {listing.resolved && <Chip label="Resolved" size="small" sx={{ background: isDark ? "#1f3527" : "#dcfce7", color: isDark ? "#6ee7b7" : "#16a34a", border: isDark ? "1px solid rgba(110,231,183,0.42)" : "none", fontWeight: 800, fontSize: 10 }} />}
        </Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          {listing.locations?.name ?? "Unknown location"} · {listing.found_at || "No specific spot"}
        </Typography>
        <Typography variant="caption" sx={{ color: isDark ? "#a59493" : "#aaa", fontWeight: 600, display: "block", mb: 1 }}>
          Posted by {listing.poster_name} · {formatRelativeDate(listing.date, timeZone, { compact: true })}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
          {listing.importance && (
            <Chip label={IMPORTANCE_LABELS[listing.importance]} size="small"
              sx={{ background: IMPORTANCE_COLORS[listing.importance] + "22", color: IMPORTANCE_COLORS[listing.importance], fontWeight: 800, fontSize: 10 }} />
          )}
          {listing.category && <Chip label={listing.category} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: isDark ? "#B8BABD" : "#a07070", fontWeight: 700, fontSize: 10 }} />}
        </Box>
        {listing.description && (
          <>
            <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.5 }}>DESCRIPTION</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: 13 }}>{listing.description}</Typography>
          </>
        )}

        <Button
          size="small"
          onClick={() => setModalOpen(true)}
          sx={{ mt: 1.5, color: "#A84D48", fontWeight: 700, textTransform: "none", px: 0, minWidth: 0, "&:hover": { background: "transparent", textDecoration: "underline" } }}
        >
          Open Full Post
        </Button>
      </Box>
      </Paper>

      <DashboardListingModal listing={listing} open={modalOpen} onClose={() => setModalOpen(false)} isDark={isDark} timeZone={timeZone} />
    </>
  );
}

// --- Message Thread Panel ---
function MessageThread({ reporterId, reportedUserId, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    if (!reporterId || !reportedUserId) { setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);
      try {
        const payload = await apiFetch(
          `/api/mod/messages?reporter=${encodeURIComponent(reporterId)}&reported=${encodeURIComponent(reportedUserId)}`
        );
        setMessages(payload?.messages || []);
        setProfiles(payload?.profiles || {});
      } catch {
        setMessages([]);
        setProfiles({});
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [reporterId, reportedUserId]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}><CircularProgress size={20} sx={{ color: "#A84D48" }} /></Box>;
  }

  if (messages.length === 0) {
    return (
      <Box sx={{ p: 3, background: isDark ? "#232324" : "#faf8f8", borderRadius: 2, border: isDark ? "1px dashed rgba(255,255,255,0.16)" : "1px dashed #e0d6d6", textAlign: "center" }}>
        <Typography variant="body2" color="text.disabled" fontWeight={600}>No messages found between these users.</Typography>
      </Box>
    );
  }

  const getName = (id) => {
    const p = profiles[id];
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc", background: isDark ? "#232324" : "#fdf7f7", overflow: "hidden" }}>
      <Box sx={{
        px: { xs: 1.5, sm: 2 }, py: 1.5,
        borderBottom: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #ecdcdc",
        display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 0.5,
      }}>
        <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5 }}>
          CONVERSATION ({messages.length})
        </Typography>
        <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ fontSize: 11 }}>
          {getName(reporterId)} ↔ {getName(reportedUserId)}
        </Typography>
      </Box>
      <Box sx={{ p: { xs: 1.5, sm: 2 }, maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
        {messages.map((msg) => {
          if (msg.is_system) {
            return (
              <Box key={msg.id} sx={{ alignSelf: "center", my: 0.25 }}>
                <Typography variant="caption" sx={{ px: 1.5, py: 0.25, borderRadius: 99, background: isDark ? "#2D2D2E" : "#f0e8e8", color: isDark ? "#818384" : "#999", fontSize: 11 }}>
                  {msg.content}
                </Typography>
              </Box>
            );
          }
          const isReported = msg.sender_id === reportedUserId;
          return (
            <Box key={msg.id} sx={{ alignSelf: isReported ? "flex-start" : "flex-end", maxWidth: { xs: "85%", sm: "75%" } }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: isReported ? "#dc2626" : isDark ? "#818384" : "#666", fontSize: 10, display: "block", mb: 0.25 }}>
                {isReported ? `⚠ ${getName(msg.sender_id)}` : getName(msg.sender_id)}
              </Typography>
              <Box sx={{
                p: "8px 12px", borderRadius: 2.5,
                background: isReported ? (isDark ? "#4a2a2a" : "#fef2f2") : (isDark ? "#2D2D2E" : "#f5eded"),
                border: isReported ? (isDark ? "1px solid rgba(252,165,165,0.6)" : "1px solid #fca5a5") : isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e0d6d6",
              }}>
                <Typography fontSize={13} sx={{ color: isReported ? "#ffd4d4" : isDark ? "#D7DADC" : "#333" }}>{msg.content}</Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, mt: 0.25, display: "block" }}>
                {formatTime(msg.created_at, timeZone)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

// --- Decision Panel ---
function DecisionPanel({ report, onDecision, processing, isDark = false }) {
  const [decision, setDecision] = useState("");
  const [modNote, setModNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isStolenClaim = isStolenReport(report);
  const decisionOptions = isStolenClaim ? STOLEN_DECISION_OPTIONS : DECISION_OPTIONS;

  const selectedOption = decisionOptions.find((o) => o.value === decision);
  const isViolation = decision && decision !== "no_violation";

  const handleConfirm = () => {
    setConfirmOpen(false);
    onDecision(report, decision, modNote.trim());
    setDecision("");
    setModNote("");
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 1.5, sm: 2 }, borderRadius: 2, borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc", background: isDark ? "#1A1A1B" : "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <GavelIcon sx={{ color: "#A84D48", fontSize: 20 }} />
        <Typography fontWeight={800} fontSize={14}>{isStolenClaim ? "Stolen Claim Decision" : "Make a Decision"}</Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, alignItems: "stretch", flexDirection: { xs: "column", sm: "row" }, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 260 }, flex: { xs: 1, sm: "unset" } }}>
          <Select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            displayEmpty
            renderValue={(val) => {
              if (!val) return <Typography variant="body2" color="text.disabled">Select action...</Typography>;
              const opt = decisionOptions.find((o) => o.value === val);
              return <Typography variant="body2" fontWeight={700} sx={{ color: opt?.color }}>{opt?.label}</Typography>;
            }}
          >
            {decisionOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ color: opt.color }}>{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{opt.description}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          disabled={!decision || processing}
          onClick={() => {
            if (isViolation) {
              setConfirmOpen(true);
            } else {
              onDecision(report, decision, modNote.trim());
              setDecision("");
              setModNote("");
            }
          }}
          sx={{
            background: isViolation ? "#dc2626" : "#16a34a",
            "&:hover": { background: isViolation ? "#b91c1c" : "#15803d" },
            fontWeight: 700, borderRadius: 2, px: 3,
            width: { xs: "100%", sm: "auto" },
            "&.Mui-disabled": { background: isDark ? "#3A3A3C" : "#e0e0e0", color: isDark ? "#818384" : undefined },
          }}
        >
          {processing ? <CircularProgress size={18} color="inherit" /> : "Apply Decision"}
        </Button>
      </Box>

      {isViolation && (
        <TextField
          placeholder={isStolenClaim
            ? "Moderator note for theft decision (optional — defaults to report reason)"
            : "Reason shown to banned user (optional — defaults to report reason)"}
          value={modNote}
          onChange={(e) => setModNote(e.target.value)}
          fullWidth
          size="small"
          multiline
          rows={2}
          sx={{ mt: 1.5 }}
        />
      )}

      {selectedOption && (
        <Typography variant="caption" sx={{ mt: 1, display: "block", color: selectedOption.color, fontWeight: 600 }}>
          {selectedOption.description}
        </Typography>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{ sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", color: isDark ? "#D7DADC" : "inherit", m: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>{isStolenClaim ? "Confirm Stolen-Claim Action" : "Confirm Violation Action"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {isStolenClaim
              ? (
                <>
                  This will apply a stolen-claim enforcement action: <strong>remove reported content</strong> and{" "}
                  <strong>{decision === "violation_permanent" ? "permanently ban" : `ban for ${decision === "violation_3" ? "3 days" : "30 days"}`}</strong>{" "}
                  the offending user. This cannot be undone.
                </>
              )
              : (
                <>
                  This will <strong>permanently delete</strong> the reported content and{" "}
                  <strong>{decision === "violation_permanent" ? "permanently ban" : `ban for ${decision === "violation_3" ? "3 days" : "30 days"}`}</strong>{" "}
                  the offending user. This cannot be undone.
                </>
              )}
          </DialogContentText>
          {modNote.trim() && (
            <Box sx={{ mt: 2, p: 1.5, background: isDark ? "#232324" : "#fdf7f7", borderRadius: 1.5, border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid #ecdcdc" }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">Ban reason shown to user:</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{modNote.trim()}</Typography>
            </Box>
          )}
          {!modNote.trim() && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              No custom reason — will default to: "{report.reason}"
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleConfirm} sx={{ fontWeight: 600 }}>
            Confirm &amp; Apply
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

// --- Reverse Ban Panel ---
function ReverseBanPanel({ report, onReverseBan, processing, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [banInfo, setBanInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const isPost = !!report.reported_listing_id;
  const banUserId = isPost
    ? report.reportedListing?.poster_id
    : report.reported_user_id;

  useEffect(() => {
    if (!banUserId) { setLoading(false); return; }
    const fetchBanInfo = async () => {
      try {
        const data = await apiFetch(`/api/reports/ban-info/${encodeURIComponent(banUserId)}`);
        setBanInfo(data);
      } catch {
        setBanInfo(null);
      } finally {
        setLoading(false);
      }
    };
    fetchBanInfo();
  }, [banUserId]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}><CircularProgress size={18} sx={{ color: "#A84D48" }} /></Box>;
  }

  if (!banInfo?.banned_until) return null;

  const isPermanent = banInfo.banned_until === "9999-12-31T23:59:59+00:00" || banInfo.banned_until === "9999-12-31T23:59:59Z";
  const banExpired = !isPermanent && new Date(banInfo.banned_until) < new Date();

  const banLabel = isPermanent
    ? "Permanently banned"
    : banExpired
      ? "Ban expired"
      : `Banned until ${formatDateTime(banInfo.banned_until, timeZone)}`;

  return (
    <>
      <Paper variant="outlined" sx={{
        p: { xs: 1.5, sm: 2 }, borderRadius: 2,
        borderColor: isDark ? "rgba(245,158,11,0.4)" : "#fbbf24",
        background: isDark ? "#2a2520" : "#fffbeb",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <UndoIcon sx={{ color: "#d97706", fontSize: 20 }} />
          <Typography fontWeight={800} fontSize={14} sx={{ color: isDark ? "#fbbf24" : "#92400e" }}>
            Ban Status
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexDirection: { xs: "column", sm: "row" } }}>
          <Box sx={{ flex: 1, minWidth: 0, width: { xs: "100%", sm: "auto" } }}>
            <Typography variant="body2" fontWeight={700}>
              {banInfo.first_name} {banInfo.last_name}
            </Typography>
            <Typography variant="caption" sx={{ color: isPermanent ? "#dc2626" : "#d97706", fontWeight: 700 }}>
              {banLabel}
            </Typography>
            {banInfo.ban_reason && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                Reason: {banInfo.ban_reason}
              </Typography>
            )}
          </Box>

          <Button
            variant="outlined"
            size="small"
            startIcon={processing ? <CircularProgress size={14} color="inherit" /> : <UndoIcon sx={{ fontSize: 16 }} />}
            disabled={processing}
            onClick={() => setConfirmOpen(true)}
            sx={{
              color: "#d97706",
              borderColor: "#d97706",
              fontWeight: 700,
              fontSize: 12,
              borderRadius: 2,
              width: { xs: "100%", sm: "auto" },
              "&:hover": { background: "rgba(217,119,6,0.08)", borderColor: "#b45309" },
              "&.Mui-disabled": { borderColor: isDark ? "#3A3A3C" : "#e0e0e0" },
            }}
          >
            Reverse Ban
          </Button>
        </Box>
      </Paper>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{ sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", color: isDark ? "#D7DADC" : "inherit", m: 2 } }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Reverse Ban?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will remove the ban on <strong>{banInfo.first_name} {banInfo.last_name}</strong> and
            move this report back to <strong>Pending</strong> for re-evaluation.
            The user will immediately regain access to the platform.
          </DialogContentText>
          {banInfo.ban_reason && (
            <Box sx={{ mt: 2, p: 1.5, background: isDark ? "#232324" : "#fdf7f7", borderRadius: 1.5, border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid #ecdcdc" }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">Original ban reason:</Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{banInfo.ban_reason}</Typography>
            </Box>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: "block" }}>
            Note: Deleted content (posts or messages) will not be restored.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => { setConfirmOpen(false); onReverseBan(report); }}
            sx={{ fontWeight: 600, background: "#d97706", "&:hover": { background: "#b45309" } }}
          >
            Confirm Unban
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// --- Report Card ---
function ReportCard({ report, fullListing, groupedReports = null, onUpdateStatus, onDelete, onDecision, onReverseBan, processing, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  const [expanded, setExpanded] = useState(false);
  const [groupExpanded, setGroupExpanded] = useState(false);
  const [reviewModalReport, setReviewModalReport] = useState(null);
  const isPost = !!report.reported_listing_id;
  const isStolen = isStolenReport(report);
  const hasGroupedReports = isPost && Array.isArray(groupedReports) && groupedReports.length > 1;
  const statusStyle = isDark
    ? (STATUS_CONFIG_DARK[report.status] || STATUS_CONFIG_DARK.pending)
    : (STATUS_CONFIG[report.status] || STATUS_CONFIG.pending);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2.5, borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc", background: isDark ? "#1A1A1B" : "#fff", transition: "box-shadow 0.15s", "&:hover": { boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.35)" : "0 2px 12px rgba(168,77,72,0.1)" } }}>
      <Box sx={{ p: { xs: 1.75, sm: 2.5 } }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5, flexWrap: "wrap", gap: 0.75 }}>
          <Box sx={{ display: "flex", gap: 0.75, alignItems: "center" }}>
            <Chip label={isPost ? "Post" : "User"} size="small"
              sx={{ fontWeight: 800, fontSize: 11, background: isPost ? (isDark ? "#343536" : "#f5eded") : (isDark ? "#31283f" : "#ede8f5"), color: isPost ? "#A84D48" : isDark ? "#c4a5ff" : "#6b21a8" }} />
            <Chip label={report.status} size="small"
              sx={{ fontWeight: 700, fontSize: 11, textTransform: "capitalize", background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }} />
            {hasGroupedReports && (
              <Chip
                label={`${groupedReports.length} reports`}
                size="small"
                sx={{
                  fontWeight: 800,
                  fontSize: 11,
                  background: isDark ? "#2D2D2E" : "#f3f4f6",
                  color: isDark ? "#D7DADC" : "#374151",
                  border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #d1d5db",
                }}
              />
            )}
          </Box>
          <Typography variant="caption" color="text.disabled" fontWeight={600} sx={{ fontSize: 11 }}>{formatDateTime(report.created_at, timeZone)}</Typography>
        </Box>

        {/* Reason */}
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
          {report.reason}
        </Typography>
        {report.details && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5, fontSize: { xs: 13, sm: 14 }, whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{report.details}</Typography>}

        {/* Reporter + target — stack on mobile */}
        <Box sx={{ display: "flex", gap: { xs: 1.5, sm: 3 }, mb: 1.5, flexDirection: { xs: "column", sm: "row" } }}>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary">Reported by</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {report.reporter ? `${report.reporter.first_name} ${report.reporter.last_name}` : "Unknown"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary">{isPost ? "Post" : "User"}</Typography>
            <Typography variant="body2" fontWeight={600} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {isPost
                ? (report.reportedListing?.title || "Deleted listing")
                : (report.reportedUser ? `${report.reportedUser.first_name} ${report.reportedUser.last_name}` : "Unknown user")}
            </Typography>
          </Box>
        </Box>

        {isStolen && (
          <Paper
            variant="outlined"
            sx={{
              mb: 1.5,
              p: 1.25,
              borderRadius: 2,
              background: isDark ? "rgba(146,64,14,0.2)" : "#fffbeb",
              borderColor: isDark ? "rgba(245,158,11,0.5)" : "#fcd34d",
            }}
          >
            <Typography variant="caption" fontWeight={800} sx={{ color: isDark ? "#f6c66a" : "#92400e", letterSpacing: 0.4, display: "block", mb: 0.5 }}>
              STOLEN REPORT CONTACTS
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Reported person: {report.stolenContext?.reportedPersonEmail || "Email unavailable"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Claimed "This is Mine": {report.stolenContext?.claimedMinePersonEmail || "Email unavailable"}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Reporter: {report.stolenContext?.reporterEmail || "Email unavailable"}
            </Typography>
          </Paper>
        )}

        {hasGroupedReports && (
          <>
            <Button
              size="small"
              onClick={() => setGroupExpanded((v) => !v)}
              sx={{
                color: "#A84D48",
                fontWeight: 700,
                fontSize: 12,
                mb: 0.75,
                px: 0,
                minWidth: 0,
                "&:hover": { background: "transparent", textDecoration: "underline" },
              }}
            >
              {groupExpanded ? "Hide related reports" : `Show all reports for this post (${groupedReports.length})`}
            </Button>

            <Collapse in={groupExpanded}>
              <Paper
                variant="outlined"
                sx={{
                  mb: 1.5,
                  p: 1.25,
                  borderRadius: 2,
                  background: isDark ? "#232324" : "#faf8f8",
                  borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc",
                }}
              >
                <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.4, display: "block", mb: 0.75 }}>
                  ALL REPORTS FOR THIS POST
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                  {groupedReports.map((r) => (
                    <Box
                      key={r.id}
                      onClick={() => setReviewModalReport(r)}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        background: isDark ? "#1A1A1B" : "#fff",
                        border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ece1e1",
                        cursor: "pointer",
                        transition: "border-color 0.15s ease, transform 0.15s ease",
                        "&:hover": {
                          borderColor: isDark ? "rgba(255,255,255,0.26)" : "#d8b2b0",
                          transform: "translateY(-1px)",
                        },
                      }}
                    >
                      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap", mb: 0.4 }}>
                        <Typography variant="caption" fontWeight={700} color="text.secondary">
                          {r.reporter ? `${r.reporter.first_name} ${r.reporter.last_name}` : "Unknown reporter"}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {formatDateTime(r.created_at, timeZone)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" fontWeight={700} sx={{ fontSize: 12.5, lineHeight: 1.4 }}>
                        {r.reason}
                      </Typography>
                      {r.details && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.3 }}>
                          {r.details}
                        </Typography>
                      )}
                      <Typography variant="caption" sx={{ display: "block", mt: 0.6, color: "#A84D48", fontWeight: 700 }}>
                        Click to review this report
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            </Collapse>
          </>
        )}

        <Dialog
          open={!!reviewModalReport}
          onClose={() => setReviewModalReport(null)}
          fullWidth
          maxWidth="sm"
          PaperProps={{
            sx: {
              background: isDark ? "#1A1A1B" : "#fff",
              border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #ecdcdc",
              m: 2,
            },
          }}
        >
          <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
            Review Report
            <IconButton
              onClick={() => setReviewModalReport(null)}
              size="small"
              sx={{ position: "absolute", right: 12, top: 12 }}
              aria-label="Close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "#ecdcdc" }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.25 }}>
              Reporter
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.25 }}>
              {reviewModalReport?.reporter ? `${reviewModalReport.reporter.first_name} ${reviewModalReport.reporter.last_name}` : "Unknown"}
            </Typography>

            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.25 }}>
              Submitted
            </Typography>
            <Typography variant="body2" sx={{ mb: 1.25 }}>
              {reviewModalReport?.created_at ? formatDateTime(reviewModalReport.created_at, timeZone) : "Unknown"}
            </Typography>

            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.25 }}>
              Reason
            </Typography>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1.25 }}>
              {reviewModalReport?.reason || "No reason provided"}
            </Typography>

            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mb: 0.25 }}>
              Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", mb: 1.25 }}>
              {reviewModalReport?.details || "No additional details provided."}
            </Typography>

            {isStolenReport(reviewModalReport) && (
              <Paper
                variant="outlined"
                sx={{
                  mt: 0.5,
                  p: 1.25,
                  borderRadius: 1.5,
                  background: isDark ? "rgba(146,64,14,0.2)" : "#fffbeb",
                  borderColor: isDark ? "rgba(245,158,11,0.45)" : "#fcd34d",
                }}
              >
                <Typography variant="caption" fontWeight={800} sx={{ color: isDark ? "#f6c66a" : "#92400e", display: "block", mb: 0.4 }}>
                  STOLEN REPORT CONTACTS
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Reported person: {reviewModalReport?.stolenContext?.reportedPersonEmail || "Email unavailable"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Claimed "This is Mine": {reviewModalReport?.stolenContext?.claimedMinePersonEmail || "Email unavailable"}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  Reporter: {reviewModalReport?.stolenContext?.reporterEmail || "Email unavailable"}
                </Typography>
              </Paper>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setReviewModalReport(null)} sx={{ color: "text.secondary" }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Expand toggle */}
        <Button
          size="small"
          endIcon={<ExpandMoreIcon sx={{ fontSize: 16, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />}
          onClick={() => setExpanded(!expanded)}
          sx={{ color: "#A84D48", fontWeight: 700, fontSize: 12, mb: 0.5, "&:hover": { background: "rgba(168,77,72,0.08)" } }}
        >
          {expanded ? "Hide" : "Review Content"}
        </Button>

        {/* Expanded content */}
        <Collapse in={expanded}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 1.5, mt: 1 }}>
            {isPost ? (
              <PostDetail listing={fullListing} isDark={isDark} timeZone={timeZone} />
            ) : (
              <MessageThread reporterId={report.reporter_id} reportedUserId={report.reported_user_id} isDark={isDark} timeZone={timeZone} />
            )}

            {report.status === "pending" && (
              <DecisionPanel report={report} onDecision={onDecision} processing={processing} isDark={isDark} />
            )}

            {report.status === "reviewed" && (
              <ReverseBanPanel report={report} onReverseBan={onReverseBan} processing={processing} isDark={isDark} timeZone={timeZone} />
            )}
          </Box>
        </Collapse>

        {/* Quick actions */}
        <Box sx={{
          display: "flex", gap: { xs: 0.5, sm: 1 }, pt: 1.5,
          borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8",
          alignItems: "center", flexWrap: "wrap",
        }}>
          {report.status === "pending" && (
            <>
              <Button size="small" startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
                onClick={() => onUpdateStatus(report.id, "reviewed")}
                sx={{ color: "#16a34a", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(22,163,74,0.08)" } }}>
                Reviewed
              </Button>
              <Button size="small" startIcon={<CancelIcon sx={{ fontSize: 16 }} />}
                onClick={() => onUpdateStatus(report.id, "dismissed")}
                sx={{ color: "#64748b", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(100,116,139,0.08)" } }}>
                Dismiss
              </Button>
            </>
          )}
          {(report.status === "reviewed" || report.status === "dismissed") && (
            <Button size="small" onClick={() => onUpdateStatus(report.id, "pending")}
              sx={{ color: "#92400e", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(146,64,14,0.08)" } }}>
              Reopen
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <IconButton size="small" onClick={() => onDelete(report.id)} sx={{ color: isDark ? "#818384" : "#ccc", "&:hover": { color: "#dc2626" } }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
}

// ============================================================
// TICKET STATUS CONFIG
// ============================================================
const TICKET_STATUS_CONFIG = {
  open:        { label: "Open",        bg: "#fff3cd", color: "#92400e", border: "#ffc107" },
  in_progress: { label: "In Progress", bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  resolved:    { label: "Resolved",    bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  closed:      { label: "Closed",      bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};
const TICKET_STATUS_CONFIG_DARK = {
  open:        { label: "Open",        bg: "#3a2f22", color: "#f6c66a", border: "rgba(245,158,11,0.5)" },
  in_progress: { label: "In Progress", bg: "#1e2a3a", color: "#93c5fd", border: "rgba(147,197,253,0.45)" },
  resolved:    { label: "Resolved",    bg: "#1f3527", color: "#6ee7b7", border: "rgba(110,231,183,0.42)" },
  closed:      { label: "Closed",      bg: "#2c3138", color: "#cbd5e1", border: "rgba(148,163,184,0.45)" },
};

// ============================================================
// TICKET CARD
// ============================================================
function TicketCard({ ticket, onUpdateStatus, onDelete, processing, isDark, timeZone }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = (isDark ? TICKET_STATUS_CONFIG_DARK : TICKET_STATUS_CONFIG)[ticket.status] ?? TICKET_STATUS_CONFIG.open;
  const cardBg = isDark ? "#1A1A1B" : "#fff";
  const cardBorder = isDark ? "rgba(255,255,255,0.12)" : "#ecdcdc";

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        borderColor: cardBorder,
        background: cardBg,
        p: { xs: 1.5, sm: 2 },
        transition: "box-shadow 0.15s",
        "&:hover": { boxShadow: isDark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 2px 12px rgba(168,77,72,0.08)" },
      }}
    >
      {/* Top row */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, flexWrap: "wrap", mb: 0.75 }}>
        {ticket.ticket_type && (
          <Chip
            label={ticket.ticket_type}
            size="small"
            sx={{
              fontWeight: 700, fontSize: 11,
              background: isDark ? "rgba(168,77,72,0.2)" : "#A84D4815",
              color: isDark ? "#FF6B3D" : "#A84D48",
              border: isDark ? "1px solid rgba(168,77,72,0.3)" : "1px solid #d4a0a0",
            }}
          />
        )}
        <Chip
          label={ticket.category}
          size="small"
          sx={{
            fontWeight: 700, fontSize: 11,
            background: isDark ? "rgba(255,255,255,0.08)" : "#f5eded",
            color: isDark ? "#D7DADC" : "#5e3030",
            border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e5d0d0",
          }}
        />
        <Chip
          label={statusCfg.label}
          size="small"
          sx={{
            fontWeight: 700, fontSize: 11,
            background: statusCfg.bg,
            color: statusCfg.color,
            border: `1px solid ${statusCfg.border}`,
          }}
        />
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" sx={{ color: isDark ? "#818384" : "#aaa", flexShrink: 0 }}>
          {formatRelativeDate(ticket.created_at, timeZone, { compact: true })}
        </Typography>
      </Box>

      {/* Subject */}
      <Typography fontWeight={800} fontSize={14} sx={{ mb: 0.5, color: isDark ? "#D7DADC" : "#2d1a1a", overflowWrap: "anywhere" }}>
        {ticket.subject}
      </Typography>

      {/* Submitter */}
      <Typography variant="caption" sx={{ color: isDark ? "#818384" : "#999", display: "block", mb: 0.5 }}>
        {ticket.name || "Anonymous"}{ticket.email ? ` · ${ticket.email}` : ""}
      </Typography>

      {/* Expand toggle */}
      <Button
        size="small"
        endIcon={<ExpandMoreIcon sx={{ fontSize: 16, transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }} />}
        onClick={() => setExpanded(!expanded)}
        sx={{ color: "#A84D48", fontWeight: 700, fontSize: 12, mb: 0.5, "&:hover": { background: "rgba(168,77,72,0.08)" } }}
      >
        {expanded ? "Hide" : "View Details"}
      </Button>

      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 1, mb: 1.5, p: 1.5, borderRadius: 2,
            background: isDark ? "#232324" : "#fdf7f7",
            border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8",
          }}
        >
          <Typography variant="body2" sx={{ color: isDark ? "#C8CACC" : "#5e5e5e", lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {ticket.description}
          </Typography>
        </Box>
      </Collapse>

      {/* Actions */}
      <Box sx={{
        display: "flex", gap: { xs: 0.5, sm: 1 }, pt: 1.5,
        borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f0e8e8",
        alignItems: "center", flexWrap: "wrap",
      }}>
        {ticket.status === "open" && (
          <Button size="small" onClick={() => onUpdateStatus(ticket.id, "in_progress")} disabled={processing}
            sx={{ color: "#1e40af", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(30,64,175,0.08)" } }}>
            Start
          </Button>
        )}
        {ticket.status === "in_progress" && (
          <Button size="small" onClick={() => onUpdateStatus(ticket.id, "resolved")} disabled={processing}
            sx={{ color: "#16a34a", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(22,163,74,0.08)" } }}>
            Resolve
          </Button>
        )}
        {(ticket.status === "open" || ticket.status === "in_progress") && (
          <Button size="small" onClick={() => onUpdateStatus(ticket.id, "closed")} disabled={processing}
            sx={{ color: "#64748b", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(100,116,139,0.08)" } }}>
            Close
          </Button>
        )}
        {(ticket.status === "resolved" || ticket.status === "closed") && (
          <Button size="small" onClick={() => onUpdateStatus(ticket.id, "open")} disabled={processing}
            sx={{ color: "#92400e", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(146,64,14,0.08)" } }}>
            Reopen
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton size="small" onClick={() => onDelete(ticket.id)} sx={{ color: isDark ? "#818384" : "#ccc", "&:hover": { color: "#dc2626" } }}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>
    </Paper>
  );
}

// ============================================================
// SUPPORT TICKETS SECTION
// ============================================================
function SupportTicketsSection({ tickets, loading, statusTab, onTabChange, onFetch, onUpdateStatus, onDelete, actionError, isDark, timeZone, ticketType }) {
  useEffect(() => { onFetch(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
              onUpdateStatus={onUpdateStatus}
              onDelete={onDelete}
              processing={false}
              isDark={isDark}
              timeZone={timeZone}
            />
          ))}
        </Box>
      )}
    </>
  );
}

// ============================================================
// DASHBOARD PAGE
// ============================================================
export default function DashboardPage({ effectiveTheme = "light", timeZone = DEFAULT_TIME_ZONE }) {
  const isDark = effectiveTheme === "dark";
  const isMobile = useMediaQuery("(max-width:600px)");
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState("reports");

  // Support ticket state
  const [tickets, setTickets] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusTab, setTicketStatusTab] = useState("open");
  const [feedbackStatusTab, setFeedbackStatusTab] = useState("open");
  const [bugStatusTab, setBugStatusTab] = useState("open");
  const [ticketActionError, setTicketActionError] = useState("");
  const [ticketDeleteTarget, setTicketDeleteTarget] = useState(null);

  const fetchTickets = async () => {
    setTicketsLoading(true);
    setTicketActionError("");
    try {
      const payload = await apiFetch("/api/support?page=1&limit=100");
      setTickets(payload?.tickets || []);
    } catch {
      setTicketActionError("Failed to load support tickets.");
      setTickets([]);
    } finally {
      setTicketsLoading(false);
    }
  };

  const updateTicketStatus = async (ticketId, newStatus) => {
    setTicketActionError("");
    try {
      await apiFetch(`/api/support/${ticketId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setTickets((prev) => prev.map((t) => (t.id === ticketId ? { ...t, status: newStatus } : t)));
    } catch {
      setTicketActionError("Failed to update ticket.");
    }
  };

  const deleteTicket = async () => {
    if (!ticketDeleteTarget) return;
    setTicketActionError("");
    try {
      await apiFetch(`/api/support/${ticketDeleteTarget}`, { method: "DELETE" });
      setTickets((prev) => prev.filter((t) => t.id !== ticketDeleteTarget));
    } catch {
      setTicketActionError("Failed to delete ticket.");
    }
    setTicketDeleteTarget(null);
  };

  const [reports, setReports] = useState([]);
  const [fullListings, setFullListings] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [reportTab, setReportTab] = useState("pending");
  const [actionError, setActionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const fetchReports = async (page = 1, append = false) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    setActionError("");

    try {
      const payload = await apiFetch(`/api/reports?page=${page}&limit=10`);
      const loadedReports = payload?.reports || [];
      const loadedListings = payload?.listings || {};
      setReports(prev => append ? [...prev, ...loadedReports] : loadedReports);
      setFullListings(prev => append ? { ...prev, ...loadedListings } : loadedListings);
      setHasMore(payload?.hasMore ?? false);
      setCurrentPage(page);
    } catch {
      setActionError("Failed to load reports.");
      if (!append) {
        setReports([]);
        setFullListings({});
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { if (profile?.is_moderator) fetchReports(); }, [profile]);

  const updateStatus = async (reportId, newStatus) => {
    setActionError("");
    try {
      await apiFetch(`/api/reports/${reportId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r)));
    } catch {
      setActionError("Failed to update report.");
    }
  };

  const deleteReport = async () => {
    if (!deleteTarget) return;
    setActionError("");
    try {
      await apiFetch(`/api/reports/${deleteTarget}`, { method: "DELETE" });
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget));
    } catch {
      setActionError("Failed to delete report.");
    }
    setDeleteTarget(null);
  };

  const handleDecision = async (report, decision, modNote) => {
    setProcessing(true);
    setActionError("");

    try {
      await apiFetch(`/api/reports/${report.id}/decision`, {
        method: "POST",
        body: JSON.stringify({ decision, mod_note: modNote || null }),
      });
      await fetchReports();
      setReportTab(decision === "no_violation" ? "dismissed" : "reviewed");
    } catch {
      setActionError("Failed to apply decision. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleReverseBan = async (report) => {
    setProcessing(true);
    setActionError("");

    try {
      await apiFetch(`/api/reports/${report.id}/reverse-ban`, { method: "POST" });
      await fetchReports();
      setReportTab("pending");
    } catch {
      setActionError("Failed to reverse ban. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  // --- Derived ---
  const stolenReports = reports.filter(isStolenReport);
  const regularReports = reports.filter((r) => !isStolenReport(r));

  const counts = {
    pending: regularReports.filter((r) => r.status === "pending").length,
    reviewed: regularReports.filter((r) => r.status === "reviewed").length,
    dismissed: regularReports.filter((r) => r.status === "dismissed").length,
  };
  const stolenCounts = {
    pending: stolenReports.filter((r) => r.status === "pending").length,
    reviewed: stolenReports.filter((r) => r.status === "reviewed").length,
    dismissed: stolenReports.filter((r) => r.status === "dismissed").length,
  };

  const activeCollection = section === "stolen" ? stolenReports : regularReports;
  const activeCounts = section === "stolen" ? stolenCounts : counts;
  const filteredReports = activeCollection.filter((r) => r.status === reportTab);
  const allPostReportsByPostId = activeCollection.reduce((acc, report) => {
    if (!report.reported_listing_id) return acc;
    const key = String(report.reported_listing_id);
    if (!acc[key]) acc[key] = [];
    acc[key].push(report);
    return acc;
  }, {});

  const groupedRenderItems = (() => {
    const byPost = new Map();
    const singles = [];

    for (const report of filteredReports) {
      if (report.reported_listing_id) {
        const key = String(report.reported_listing_id);
        if (!byPost.has(key)) byPost.set(key, report);
      } else {
        singles.push(report);
      }
    }

    const groupedPosts = [...byPost.entries()].map(([postId, primaryReport]) => ({
      primaryReport,
      relatedReports: (allPostReportsByPostId[postId] || [primaryReport]).slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
      sortDate: new Date(primaryReport.created_at).getTime(),
    }));

    const groupedSingles = singles.map((report) => ({
      primaryReport: report,
      relatedReports: null,
      sortDate: new Date(report.created_at).getTime(),
    }));

    return [...groupedPosts, ...groupedSingles].sort((a, b) => b.sortDate - a.sortDate);
  })();
  const postReports = regularReports.filter((r) => !!r.reported_listing_id).length;
  const userReports = regularReports.filter((r) => !!r.reported_user_id).length;
  const stolenPending = stolenCounts.pending;

  // --- Guard ---
  if (!profile) return null;
  if (!profile.is_moderator) return <AccessDenied isDark={isDark} />;

  const sections = [
    { id: "reports", label: "Reports", icon: <FlagIcon sx={{ fontSize: 18 }} /> },
    { id: "stolen", label: "Stolen", icon: <PriorityHighIcon sx={{ fontSize: 18 }} /> },
    { id: "feedback", label: "Feedback", icon: <FeedbackIcon sx={{ fontSize: 18 }} /> },
    { id: "bugs", label: "Bugs", icon: <BugReportIcon sx={{ fontSize: 18 }} /> },
    { id: "support-categories", label: "Support", icon: <SupportAgentIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <Box sx={{
      display: "flex", justifyContent: "center", width: "100%",
      px: { xs: 1, sm: 2, md: 3 },
      py: { xs: 1, sm: 2, md: 3 },
      color: isDark ? "#D7DADC" : "inherit",
    }}>
      <Box sx={{ width: "100%", maxWidth: 960 }}>

        {/* ====== Header ====== */}
        <Box sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 1.25, sm: 2 },
          mb: 0.5,
        }}>
          <Box sx={{
            width: { xs: 36, sm: 44 }, height: { xs: 36, sm: 44 }, borderRadius: 2, flexShrink: 0,
            background: isDark ? "rgba(255,255,255,0.08)" : "#A84D4815",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldIcon sx={{ color: "#A84D48", fontSize: { xs: 20, sm: 24 } }} />
          </Box>
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={900}>Moderation Dashboard</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>
              Manage reports, feedback, and platform health.
            </Typography>
          </Box>
        </Box>

        {/* ====== Stat Cards — 2x2 grid on mobile, 4-col on desktop ====== */}
        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(5, 1fr)" },
          gap: { xs: 1, sm: 2 },
          my: { xs: 2, sm: 3 },
        }}>
          <StatCard icon={<FlagIcon sx={{ color: "#f59e0b", fontSize: isMobile ? 18 : 22 }} />} label="Pending" value={counts.pending} color="#f59e0b" isDark={isDark} compact={isMobile} />
          <StatCard icon={<ArticleIcon sx={{ color: "#A84D48", fontSize: isMobile ? 18 : 22 }} />} label="Post Reports" value={postReports} color="#A84D48" isDark={isDark} compact={isMobile} />
          <StatCard icon={<PeopleIcon sx={{ color: "#6b21a8", fontSize: isMobile ? 18 : 22 }} />} label="User Reports" value={userReports} color="#6b21a8" isDark={isDark} compact={isMobile} />
          <StatCard icon={<CheckCircleIcon sx={{ color: "#16a34a", fontSize: isMobile ? 18 : 22 }} />} label="Reviewed" value={counts.reviewed} color="#16a34a" isDark={isDark} compact={isMobile} />
          <StatCard icon={<PriorityHighIcon sx={{ color: "#dc2626", fontSize: isMobile ? 18 : 22 }} />} label="Stolen Pending" value={stolenPending} color="#dc2626" isDark={isDark} compact={isMobile} />
        </Box>

        {/* ====== Section tabs ====== */}
        <Box sx={{
          display: "flex", gap: { xs: 0.5, sm: 1 }, mb: { xs: 2, sm: 3 },
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.12)" : "1.5px solid #f0e8e8",
          pb: 1.5, overflowX: "auto",
          "&::-webkit-scrollbar": { height: 4 },
        }}>
          {sections.map((s) => (
            <Button key={s.id} startIcon={s.icon} onClick={() => setSection(s.id)}
              sx={{
                fontWeight: 700, fontSize: { xs: 12, sm: 13 }, textTransform: "none",
                color: section === s.id ? "#A84D48" : isDark ? "#818384" : "#999",
                background: section === s.id ? "#A84D4810" : "transparent",
                borderRadius: 2, px: { xs: 1.25, sm: 2 }, flexShrink: 0,
                minWidth: 0,
                "&:hover": { background: section === s.id ? "#A84D4818" : isDark ? "#343536" : "#f5f5f5" },
              }}>
              {s.label}
            </Button>
          ))}
        </Box>

        {/* ====== Reports section ====== */}
        {(section === "reports" || section === "stolen") && (
          <>
            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

            {section === "stolen" && (
              <Alert
                severity="warning"
                sx={{
                  mb: 2,
                  border: isDark ? "1px solid rgba(245,158,11,0.45)" : "1px solid #fcd34d",
                  background: isDark ? "rgba(146,64,14,0.22)" : "#fffbeb",
                  "& .MuiAlert-message": { fontWeight: 600 },
                }}
              >
                Theft-related reports are high priority and should be reviewed first.
              </Alert>
            )}

            <Box sx={{
              display: "flex", justifyContent: "space-between",
              alignItems: { xs: "stretch", sm: "center" },
              flexDirection: { xs: "column", sm: "row" },
              gap: 1, mb: 2,
            }}>
              <Tabs
                value={reportTab}
                onChange={(_, v) => setReportTab(v)}
                variant="scrollable"
                allowScrollButtonsMobile
                sx={{
                  minHeight: { xs: 32, sm: 36 },
                  "& .MuiTab-root": {
                    fontWeight: 700, textTransform: "none",
                    minHeight: { xs: 32, sm: 36 },
                    fontSize: { xs: 12, sm: 13 },
                    px: { xs: 1.25, sm: 2 },
                  },
                  "& .Mui-selected": { color: "#A84D48" },
                  "& .MuiTabs-indicator": { backgroundColor: "#A84D48" },
                }}
              >
                <Tab value="pending" label={`Pending (${activeCounts.pending})`} />
                <Tab value="reviewed" label={`Reviewed (${activeCounts.reviewed})`} />
                <Tab value="dismissed" label={`Dismissed (${activeCounts.dismissed})`} />
              </Tabs>
              <Button
                size="small"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={fetchReports}
                disabled={loading}
                sx={{ color: "#A84D48", fontWeight: 700, fontSize: 12, alignSelf: { xs: "flex-end", sm: "center" } }}
              >
                Refresh
              </Button>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}><CircularProgress sx={{ color: "#A84D48" }} /></Box>
            ) : groupedRenderItems.length === 0 ? (
              <EmptySection
                icon={section === "stolen" ? <PriorityHighIcon sx={{ color: "#dc2626", fontSize: 28 }} /> : <FlagIcon sx={{ color: "#A84D48", fontSize: 28 }} />}
                title={section === "stolen" ? `No ${reportTab} stolen reports` : `No ${reportTab} reports`}
                description={section === "stolen"
                  ? "No theft-related reports in this status right now."
                  : "All clear! Check back later or switch tabs."}
                isDark={isDark}
              />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {groupedRenderItems.map(({ primaryReport, relatedReports }) => (
                  <ReportCard
                    key={primaryReport.id}
                    report={primaryReport}
                    groupedReports={relatedReports}
                    fullListing={fullListings[primaryReport.reported_listing_id] || null}
                    onUpdateStatus={updateStatus} onDelete={setDeleteTarget}
                    onDecision={handleDecision} onReverseBan={handleReverseBan}
                    processing={processing} isDark={isDark} timeZone={timeZone}
                  />
                ))}
                {hasMore && (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 2, mb: 1 }}>
                    <Button
                      variant="outlined"
                      onClick={() => fetchReports(currentPage + 1, true)}
                      disabled={loadingMore}
                      sx={{
                        color: isDark ? "#FF4500" : "#A84D48",
                        borderColor: isDark ? "rgba(255,69,0,0.4)" : "#A84D48",
                        fontWeight: 700,
                        borderRadius: 2,
                        textTransform: "none",
                        "&:hover": { borderColor: isDark ? "#FF4500" : "#8f3e3a", background: isDark ? "rgba(255,69,0,0.08)" : "rgba(168,77,72,0.06)" },
                      }}
                    >
                      {loadingMore ? <CircularProgress size={20} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} /> : "Load More Reports"}
                    </Button>
                  </Box>
                )}
              </Box>
            )}
          </>
        )}

        {section === "feedback" && (
          <SupportTicketsSection
            tickets={tickets}
            loading={ticketsLoading}
            statusTab={feedbackStatusTab}
            onTabChange={setFeedbackStatusTab}
            onFetch={fetchTickets}
            onUpdateStatus={updateTicketStatus}
            onDelete={setTicketDeleteTarget}
            actionError={ticketActionError}
            isDark={isDark}
            timeZone={timeZone}
            ticketType="Feedback"
          />
        )}
        {section === "bugs" && (
          <SupportTicketsSection
            tickets={tickets}
            loading={ticketsLoading}
            statusTab={bugStatusTab}
            onTabChange={setBugStatusTab}
            onFetch={fetchTickets}
            onUpdateStatus={updateTicketStatus}
            onDelete={setTicketDeleteTarget}
            actionError={ticketActionError}
            isDark={isDark}
            timeZone={timeZone}
            ticketType="Bug Report"
          />
        )}
        {section === "support-categories" && (
          <SupportTicketsSection
            tickets={tickets}
            loading={ticketsLoading}
            statusTab={ticketStatusTab}
            onTabChange={setTicketStatusTab}
            onFetch={fetchTickets}
            onUpdateStatus={updateTicketStatus}
            ticketType="Support"
            onDelete={setTicketDeleteTarget}
            actionError={ticketActionError}
            isDark={isDark}
            timeZone={timeZone}
          />
        )}
      </Box>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} PaperProps={{ sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", m: 2 } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this report?</DialogTitle>
        <DialogContent><DialogContentText>This will permanently remove the report. This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteReport} sx={{ fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!ticketDeleteTarget} onClose={() => setTicketDeleteTarget(null)} slotProps={{ paper: { sx: { background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "none", m: 2 } } }}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this ticket?</DialogTitle>
        <DialogContent><DialogContentText>This will permanently remove the support ticket. This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTicketDeleteTarget(null)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteTicket} sx={{ fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}