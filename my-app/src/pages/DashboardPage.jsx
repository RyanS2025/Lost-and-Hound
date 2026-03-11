import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, Chip, Tabs, Tab,
  CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions,
  IconButton, Collapse, Select, MenuItem, FormControl, TextField,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import FlagIcon from "@mui/icons-material/Flag";
import BugReportIcon from "@mui/icons-material/BugReport";
import FeedbackIcon from "@mui/icons-material/RateReview";
import ShieldIcon from "@mui/icons-material/Shield";
import PeopleIcon from "@mui/icons-material/People";
import ArticleIcon from "@mui/icons-material/Article";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import GavelIcon from "@mui/icons-material/Gavel";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";

// --- Constants ---
const STATUS_CONFIG = {
  pending: { bg: "#fff3cd", color: "#92400e", border: "#ffc107" },
  reviewed: { bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  dismissed: { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

const IMPORTANCE_LABELS = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };

const DECISION_OPTIONS = [
  { value: "no_violation", label: "No Violation", color: "#16a34a", description: "Dismiss report — no action taken" },
  { value: "violation_3", label: "Violation — 3 Day Ban", color: "#f59e0b", description: "Remove content + ban user for 3 days" },
  { value: "violation_30", label: "Violation — 30 Day Ban", color: "#dc2626", description: "Remove content + ban user for 30 days" },
  { value: "violation_permanent", label: "Violation — Permanent Ban", color: "#7f1d1d", description: "Remove content + permanently ban user" },
];

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatShortDate(d) {
  if (!d) return "";
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

// --- Stat Card ---
function StatCard({ icon, label, value, color }) {
  return (
    <Paper variant="outlined" sx={{
      p: 2.5, borderRadius: 2.5, borderColor: "#ecdcdc",
      display: "flex", alignItems: "center", gap: 2, flex: 1, minWidth: 0,
    }}>
      <Box sx={{
        width: 44, height: 44, borderRadius: 2, flexShrink: 0,
        background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.2 }}>{value}</Typography>
        <Typography variant="caption" fontWeight={600} color="text.secondary">{label}</Typography>
      </Box>
    </Paper>
  );
}

// --- Empty State ---
function EmptySection({ icon, title, description }) {
  return (
    <Paper variant="outlined" sx={{
      p: 5, borderRadius: 2.5, borderColor: "#ecdcdc", borderStyle: "dashed",
      display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center",
    }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: "50%", mb: 2,
        background: "#f5eded", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </Box>
      <Typography fontWeight={700} sx={{ mb: 0.5 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </Paper>
  );
}

// --- 404 ---
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "calc(100vh - 140px)", p: 3 }}>
      <Paper elevation={0} sx={{ p: 4, pt: 0, borderRadius: 3, textAlign: "center", maxWidth: 380, border: "1.5px solid #ecdcdc", overflow: "visible" }}>
        <Box component="img" src="/404Image.png" alt="Lost husky" sx={{ width: "100%", maxWidth: 260, mx: "auto", display: "block", mt: -6, mb: -2 }} />
        <Typography variant="h3" fontWeight={900} sx={{ mb: 0.5, color: "#3d2020" }}>404</Typography>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: "#3d2020" }}>Page not found</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>The page you're looking for doesn't exist or has been moved.</Typography>
        <Button variant="contained" onClick={() => navigate("/")} sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 700, borderRadius: 2, px: 4 }}>GO HOME</Button>
      </Paper>
    </Box>
  );
}

// --- Post Detail Panel ---
function PostDetail({ listing }) {
  if (!listing) {
    return (
      <Box sx={{ p: 3, background: "#faf8f8", borderRadius: 2, border: "1px dashed #e0d6d6", textAlign: "center" }}>
        <Typography variant="body2" color="text.disabled" fontWeight={600}>This listing has been deleted.</Typography>
      </Box>
    );
  }
  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: "#ecdcdc", background: "#fdf7f7", overflow: "hidden" }}>
      {/* Image */}
      {listing.image_url && (
        <Box component="img" src={listing.image_url} alt={listing.title} sx={{ width: "100%", height: 180, objectFit: "cover" }} />
      )}
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
          <Typography fontWeight={800} fontSize={16}>{listing.title}</Typography>
          {listing.resolved && <Chip label="Resolved" size="small" sx={{ background: "#dcfce7", color: "#16a34a", fontWeight: 800, fontSize: 10 }} />}
        </Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} display="block" sx={{ mb: 0.5 }}>
          {listing.locations?.name ?? "Unknown location"} · {listing.found_at || "No specific spot"}
        </Typography>
        <Typography variant="caption" sx={{ color: "#aaa", fontWeight: 600, display: "block", mb: 1 }}>
          Posted by {listing.poster_name} · {formatShortDate(listing.date)}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, mb: 1.5, flexWrap: "wrap" }}>
          {listing.importance && (
            <Chip label={IMPORTANCE_LABELS[listing.importance]} size="small"
              sx={{ background: IMPORTANCE_COLORS[listing.importance] + "22", color: IMPORTANCE_COLORS[listing.importance], fontWeight: 800, fontSize: 10 }} />
          )}
          {listing.category && <Chip label={listing.category} size="small" sx={{ background: "#f5eded", color: "#a07070", fontWeight: 700, fontSize: 10 }} />}
        </Box>
        {listing.description && (
          <>
            <Typography variant="caption" fontWeight={800} color="#a07070" sx={{ letterSpacing: 0.5, display: "block", mb: 0.5 }}>DESCRIPTION</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, fontSize: 13 }}>{listing.description}</Typography>
          </>
        )}
      </Box>
    </Paper>
  );
}

// --- Message Thread Panel ---
function MessageThread({ reporterId, reportedUserId }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState({});

  useEffect(() => {
    if (!reporterId || !reportedUserId) { setLoading(false); return; }
    const fetch = async () => {
      setLoading(true);

      // Find conversation between reporter and reported user
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${reporterId},participant_2.eq.${reportedUserId}),and(participant_1.eq.${reportedUserId},participant_2.eq.${reporterId})`
        );

      if (!convos || convos.length === 0) {
        setMessages([]);
        setLoading(false);
        return;
      }

      const convoIds = convos.map((c) => c.id);

      // Fetch messages from those conversations
      const { data: msgs } = await supabase
        .from("messages")
        .select("*")
        .in("conversation_id", convoIds)
        .order("created_at", { ascending: true })
        .limit(50);

      setMessages(msgs || []);

      // Fetch both user profiles
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", [reporterId, reportedUserId]);

      const map = {};
      (profileData || []).forEach((p) => { map[p.id] = p; });
      setProfiles(map);
      setLoading(false);
    };
    fetch();
  }, [reporterId, reportedUserId]);

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}><CircularProgress size={20} sx={{ color: "#A84D48" }} /></Box>;
  }

  if (messages.length === 0) {
    return (
      <Box sx={{ p: 3, background: "#faf8f8", borderRadius: 2, border: "1px dashed #e0d6d6", textAlign: "center" }}>
        <Typography variant="body2" color="text.disabled" fontWeight={600}>No messages found between these users.</Typography>
      </Box>
    );
  }

  const getName = (id) => {
    const p = profiles[id];
    return p ? `${p.first_name} ${p.last_name}` : "Unknown";
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, borderColor: "#ecdcdc", background: "#fdf7f7", overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: "1px solid #ecdcdc", display: "flex", justifyContent: "space-between" }}>
        <Typography variant="caption" fontWeight={800} color="#a07070" sx={{ letterSpacing: 0.5 }}>
          CONVERSATION ({messages.length} messages)
        </Typography>
        <Typography variant="caption" color="text.disabled" fontWeight={600}>
          {getName(reporterId)} ↔ {getName(reportedUserId)}
        </Typography>
      </Box>
      <Box sx={{ p: 2, maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0.75 }}>
        {messages.map((msg) => {
          if (msg.is_system) {
            return (
              <Box key={msg.id} sx={{ alignSelf: "center", my: 0.25 }}>
                <Typography variant="caption" sx={{ px: 1.5, py: 0.25, borderRadius: 99, background: "#f0e8e8", color: "#999", fontSize: 11 }}>
                  {msg.content}
                </Typography>
              </Box>
            );
          }
          const isReported = msg.sender_id === reportedUserId;
          return (
            <Box key={msg.id} sx={{ alignSelf: isReported ? "flex-start" : "flex-end", maxWidth: "75%" }}>
              <Typography variant="caption" fontWeight={700} sx={{ color: isReported ? "#dc2626" : "#666", fontSize: 10, display: "block", mb: 0.25 }}>
                {isReported ? `⚠ ${getName(msg.sender_id)}` : getName(msg.sender_id)}
              </Typography>
              <Box sx={{
                p: "8px 12px", borderRadius: 2.5,
                background: isReported ? "#fef2f2" : "#f5eded",
                border: isReported ? "1px solid #fca5a5" : "1px solid #e0d6d6",
              }}>
                <Typography fontSize={13} sx={{ color: isReported ? "#991b1b" : "#333" }}>{msg.content}</Typography>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10, mt: 0.25, display: "block" }}>
                {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

// --- Decision Panel ---
function DecisionPanel({ report, onDecision, processing }) {
  const [decision, setDecision] = useState("");
  const [modNote, setModNote] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedOption = DECISION_OPTIONS.find((o) => o.value === decision);
  const isViolation = decision && decision !== "no_violation";

  const handleConfirm = () => {
    setConfirmOpen(false);
    onDecision(report, decision, modNote.trim());
    setDecision("");
    setModNote("");
  };

  return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, borderColor: "#ecdcdc", background: "#fff" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <GavelIcon sx={{ color: "#A84D48", fontSize: 20 }} />
        <Typography fontWeight={800} fontSize={14}>Make a Decision</Typography>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 260 }}>
          <Select
            value={decision}
            onChange={(e) => setDecision(e.target.value)}
            displayEmpty
            renderValue={(val) => {
              if (!val) return <Typography variant="body2" color="text.disabled">Select action...</Typography>;
              const opt = DECISION_OPTIONS.find((o) => o.value === val);
              return <Typography variant="body2" fontWeight={700} sx={{ color: opt?.color }}>{opt?.label}</Typography>;
            }}
          >
            {DECISION_OPTIONS.map((opt) => (
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
            "&.Mui-disabled": { background: "#e0e0e0" },
          }}
        >
          {processing ? <CircularProgress size={18} color="inherit" /> : "Apply Decision"}
        </Button>
      </Box>

      {/* Moderator note */}
      {isViolation && (
        <TextField
          placeholder="Reason shown to banned user (optional — defaults to report reason)"
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

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Confirm Violation Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will <strong>permanently delete</strong> the reported content and{" "}
            <strong>{decision === "violation_permanent" ? "permanently ban" : `ban for ${decision === "violation_3" ? "3 days" : "30 days"}`}</strong>{" "}
            the offending user. This cannot be undone.
          </DialogContentText>
          {modNote.trim() && (
            <Box sx={{ mt: 2, p: 1.5, background: "#fdf7f7", borderRadius: 1.5, border: "1px solid #ecdcdc" }}>
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

// --- Report Card ---
function ReportCard({ report, fullListing, onUpdateStatus, onDelete, onDecision, processing }) {
  const [expanded, setExpanded] = useState(false);
  const isPost = !!report.reported_listing_id;
  const statusStyle = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2.5, borderColor: "#ecdcdc", transition: "box-shadow 0.15s", "&:hover": { boxShadow: "0 2px 12px rgba(168,77,72,0.1)" } }}>
      <Box sx={{ p: 2.5 }}>
        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Chip label={isPost ? "Post" : "User"} size="small"
              sx={{ fontWeight: 800, fontSize: 11, background: isPost ? "#f5eded" : "#ede8f5", color: isPost ? "#A84D48" : "#6b21a8" }} />
            <Chip label={report.status} size="small"
              sx={{ fontWeight: 700, fontSize: 11, textTransform: "capitalize", background: statusStyle.bg, color: statusStyle.color, border: `1px solid ${statusStyle.border}` }} />
          </Box>
          <Typography variant="caption" color="text.disabled" fontWeight={600}>{formatDate(report.created_at)}</Typography>
        </Box>

        {/* Reason */}
        <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>{report.reason}</Typography>
        {report.details && <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>{report.details}</Typography>}

        {/* Reporter + target */}
        <Box sx={{ display: "flex", gap: 3, mb: 1.5, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary">Reported by</Typography>
            <Typography variant="body2" fontWeight={600}>
              {report.reporter ? `${report.reporter.first_name} ${report.reporter.last_name}` : "Unknown"}
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" fontWeight={700} color="text.secondary">{isPost ? "Post" : "User"}</Typography>
            <Typography variant="body2" fontWeight={600}>
              {isPost
                ? (report.reportedListing?.title || "Deleted listing")
                : (report.reportedUser ? `${report.reportedUser.first_name} ${report.reportedUser.last_name}` : "Unknown user")}
            </Typography>
          </Box>
        </Box>

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
            {/* Show reported content */}
            {isPost ? (
              <PostDetail listing={fullListing} />
            ) : (
              <MessageThread reporterId={report.reporter_id} reportedUserId={report.reported_user_id} />
            )}

            {/* Decision panel — only for pending reports */}
            {report.status === "pending" && (
              <DecisionPanel report={report} onDecision={onDecision} processing={processing} />
            )}
          </Box>
        </Collapse>

        {/* Quick actions */}
        <Box sx={{ display: "flex", gap: 1, pt: 1.5, borderTop: "1px solid #f0e8e8", alignItems: "center" }}>
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
          <IconButton size="small" onClick={() => onDelete(report.id)} sx={{ color: "#ccc", "&:hover": { color: "#dc2626" } }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Paper>
  );
}

// ============================================================
// DASHBOARD PAGE
// ============================================================
export default function DashboardPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState("reports");
  const [reports, setReports] = useState([]);
  const [fullListings, setFullListings] = useState({});
  const [loading, setLoading] = useState(true);
  const [reportTab, setReportTab] = useState("pending");
  const [actionError, setActionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [processing, setProcessing] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    setActionError("");

    const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false });

    if (error) { setActionError("Failed to load reports."); setLoading(false); return; }
    if (!data || data.length === 0) { setReports([]); setFullListings({}); setLoading(false); return; }

    const userIds = new Set();
    data.forEach((r) => {
      if (r.reporter_id) userIds.add(r.reporter_id);
      if (r.reported_user_id) userIds.add(r.reported_user_id);
    });

    const { data: profilesData } = await supabase.from("profiles").select("id, first_name, last_name").in("id", [...userIds]);
    const profileMap = {};
    (profilesData || []).forEach((p) => { profileMap[p.id] = p; });

    const listingIds = data.map((r) => r.reported_listing_id).filter(Boolean);
    let listingMap = {};
    if (listingIds.length > 0) {
      const { data: listingsData } = await supabase.from("listings").select("*, locations(name, coordinates, campus)").in("item_id", listingIds);
      (listingsData || []).forEach((l) => { listingMap[l.item_id] = l; });
    }

    setReports(data.map((r) => ({
      ...r,
      reporter: profileMap[r.reporter_id] || null,
      reportedUser: profileMap[r.reported_user_id] || null,
      reportedListing: listingMap[r.reported_listing_id] || null,
    })));
    setFullListings(listingMap);
    setLoading(false);
  };

  useEffect(() => { if (profile?.is_moderator) fetchReports(); }, [profile]);

  const updateStatus = async (reportId, newStatus) => {
    setActionError("");
    const { error } = await supabase.from("reports").update({ status: newStatus }).eq("id", reportId);
    if (error) { setActionError("Failed to update report."); return; }
    setReports((prev) => prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r)));
  };

  const deleteReport = async () => {
    if (!deleteTarget) return;
    setActionError("");
    const { error } = await supabase.from("reports").delete().eq("id", deleteTarget);
    if (error) { setActionError("Failed to delete report."); } else { setReports((prev) => prev.filter((r) => r.id !== deleteTarget)); }
    setDeleteTarget(null);
  };

  // --- Core decision handler ---
  const handleDecision = async (report, decision, modNote) => {
    setProcessing(true);
    setActionError("");

    const isPost = !!report.reported_listing_id;

    if (decision === "no_violation") {
      // Just dismiss the report
      await updateStatus(report.id, "dismissed");
      setProcessing(false);
      return;
    }

    // Calculate ban duration
    let bannedUntil;
    if (decision === "violation_3") {
      bannedUntil = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    } else if (decision === "violation_30") {
      bannedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else {
      bannedUntil = "9999-12-31T23:59:59Z"; // permanent
    }

    // Determine who to ban
    const banUserId = isPost
      ? report.reportedListing?.poster_id  // ban the poster
      : report.reported_user_id;           // ban the reported user

    // 1. Delete the reported content
    if (isPost && report.reported_listing_id) {
      await supabase.from("listings").delete().eq("item_id", report.reported_listing_id);
      setFullListings((prev) => {
        const copy = { ...prev };
        delete copy[report.reported_listing_id];
        return copy;
      });
    } else if (!isPost && report.reporter_id && report.reported_user_id) {
      // Delete messages in conversations between reporter and reported user
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(
          `and(participant_1.eq.${report.reporter_id},participant_2.eq.${report.reported_user_id}),and(participant_1.eq.${report.reported_user_id},participant_2.eq.${report.reporter_id})`
        );
      if (convos) {
        for (const c of convos) {
          await supabase.from("messages").delete().eq("conversation_id", c.id);
          await supabase.from("conversations").delete().eq("id", c.id);
        }
      }
    }

    // 2. Ban the user
    if (banUserId) {
      const banLabel = decision === "violation_3" ? "3-day ban" : decision === "violation_30" ? "30-day ban" : "Permanent ban";
      const banReason = modNote
        ? `${banLabel}: ${modNote}`
        : `${banLabel}: ${report.reason}`;
      await supabase
        .from("profiles")
        .update({
          banned_until: bannedUntil,
          ban_reason: banReason,
        })
        .eq("id", banUserId);
    }

    // 3. Mark this report and all related reports as reviewed
    const relatedReports = reports.filter((r) =>
      (isPost && r.reported_listing_id === report.reported_listing_id) ||
      (!isPost && r.reported_user_id === report.reported_user_id)
    );
    const relatedIds = relatedReports.map((r) => r.id);
    
    // Batch update in DB
    const { error: statusError } = await supabase
      .from("reports")
      .update({ status: "reviewed" })
      .in("id", relatedIds);

    if (statusError) {
      setActionError("Content removed and user banned, but failed to update report status. Try refreshing.");
      setProcessing(false);
      return;
    }

    // Update local state
    setReports((prev) =>
      prev.map((r) =>
        relatedIds.includes(r.id) ? { ...r, status: "reviewed" } : r
      )
    );

    // Switch to reviewed tab so moderator sees the result
    setReportTab("reviewed");
    setProcessing(false);
  };

  // --- Derived ---
  const counts = {
    pending: reports.filter((r) => r.status === "pending").length,
    reviewed: reports.filter((r) => r.status === "reviewed").length,
    dismissed: reports.filter((r) => r.status === "dismissed").length,
  };
  const filteredReports = reports.filter((r) => r.status === reportTab);
  const postReports = reports.filter((r) => !!r.reported_listing_id).length;
  const userReports = reports.filter((r) => !!r.reported_user_id).length;

  // --- Guard ---
  if (!profile) return null;
  if (!profile.is_moderator) return <AccessDenied />;

  const sections = [
    { id: "reports", label: "Reports", icon: <FlagIcon sx={{ fontSize: 18 }} /> },
    { id: "feedback", label: "Feedback", icon: <FeedbackIcon sx={{ fontSize: 18 }} /> },
    { id: "bugs", label: "Bug Reports", icon: <BugReportIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", p: 3 }}>
      <Box sx={{ width: "100%", maxWidth: 960 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 0.5 }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 2, background: "#A84D4815", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldIcon sx={{ color: "#A84D48", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={900}>Moderation Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">Manage reports, feedback, and platform health.</Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", gap: 2, my: 3, flexWrap: "wrap" }}>
          <StatCard icon={<FlagIcon sx={{ color: "#f59e0b", fontSize: 22 }} />} label="Pending" value={counts.pending} color="#f59e0b" />
          <StatCard icon={<ArticleIcon sx={{ color: "#A84D48", fontSize: 22 }} />} label="Post Reports" value={postReports} color="#A84D48" />
          <StatCard icon={<PeopleIcon sx={{ color: "#6b21a8", fontSize: 22 }} />} label="User Reports" value={userReports} color="#6b21a8" />
          <StatCard icon={<CheckCircleIcon sx={{ color: "#16a34a", fontSize: 22 }} />} label="Reviewed" value={counts.reviewed} color="#16a34a" />
        </Box>

        <Box sx={{ display: "flex", gap: 1, mb: 3, borderBottom: "1.5px solid #f0e8e8", pb: 1.5 }}>
          {sections.map((s) => (
            <Button key={s.id} startIcon={s.icon} onClick={() => setSection(s.id)}
              sx={{ fontWeight: 700, fontSize: 13, textTransform: "none", color: section === s.id ? "#A84D48" : "#999", background: section === s.id ? "#A84D4810" : "transparent", borderRadius: 2, px: 2, "&:hover": { background: section === s.id ? "#A84D4818" : "#f5f5f5" } }}>
              {s.label}
            </Button>
          ))}
        </Box>

        {section === "reports" && (
          <>
            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Tabs value={reportTab} onChange={(_, v) => setReportTab(v)}
                sx={{ "& .MuiTab-root": { fontWeight: 700, textTransform: "none", minHeight: 36, fontSize: 13 }, "& .Mui-selected": { color: "#A84D48" }, "& .MuiTabs-indicator": { backgroundColor: "#A84D48" } }}>
                <Tab value="pending" label={`Pending (${counts.pending})`} />
                <Tab value="reviewed" label={`Reviewed (${counts.reviewed})`} />
                <Tab value="dismissed" label={`Dismissed (${counts.dismissed})`} />
              </Tabs>
              <Button size="small" startIcon={<RefreshIcon sx={{ fontSize: 16 }} />} onClick={fetchReports} disabled={loading} sx={{ color: "#A84D48", fontWeight: 700, fontSize: 12 }}>Refresh</Button>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}><CircularProgress sx={{ color: "#A84D48" }} /></Box>
            ) : filteredReports.length === 0 ? (
              <EmptySection icon={<FlagIcon sx={{ color: "#A84D48", fontSize: 28 }} />} title={`No ${reportTab} reports`} description="All clear! Check back later or switch tabs." />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {filteredReports.map((report) => (
                  <ReportCard
                    key={report.id} report={report}
                    fullListing={fullListings[report.reported_listing_id] || null}
                    onUpdateStatus={updateStatus} onDelete={setDeleteTarget}
                    onDecision={handleDecision} processing={processing}
                  />
                ))}
              </Box>
            )}
          </>
        )}

        {section === "feedback" && (
          <EmptySection icon={<FeedbackIcon sx={{ color: "#A84D48", fontSize: 28 }} />} title="Feedback — Coming Soon" description="This section will display user feedback and feature requests." />
        )}
        {section === "bugs" && (
          <EmptySection icon={<BugReportIcon sx={{ color: "#A84D48", fontSize: 28 }} />} title="Bug Reports — Coming Soon" description="This section will display bug reports with status tracking." />
        )}
      </Box>

      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this report?</DialogTitle>
        <DialogContent><DialogContentText>This will permanently remove the report. This cannot be undone.</DialogContentText></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={deleteReport} sx={{ fontWeight: 600 }}>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}