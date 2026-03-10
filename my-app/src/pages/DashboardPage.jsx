import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, Button, Chip, Tabs, Tab,
  CircularProgress, Alert, Dialog, DialogTitle,
  DialogContent, DialogContentText, DialogActions,
  IconButton,
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
import LockIcon from "@mui/icons-material/Lock";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";

// --- Status styling ---
const STATUS_CONFIG = {
  pending: { bg: "#fff3cd", color: "#92400e", border: "#ffc107" },
  reviewed: { bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  dismissed: { bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

function formatDate(d) {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleDateString([], { month: "short", day: "numeric" }) +
    " at " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// --- Stat Card ---
function StatCard({ icon, label, value, color }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5, borderRadius: 2.5, borderColor: "#ecdcdc",
        display: "flex", alignItems: "center", gap: 2, flex: 1,
        minWidth: 0,
      }}
    >
      <Box sx={{
        width: 44, height: 44, borderRadius: 2, flexShrink: 0,
        background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" fontWeight={900} sx={{ lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

// --- Empty State ---
function EmptySection({ icon, title, description }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 5, borderRadius: 2.5, borderColor: "#ecdcdc", borderStyle: "dashed",
        display: "flex", flexDirection: "column", alignItems: "center",
        textAlign: "center",
      }}
    >
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

// --- Access Denied screen ---
function AccessDenied() {
  const navigate = useNavigate();
  return (
    <Box sx={{
      display: "flex", justifyContent: "center", alignItems: "center",
      minHeight: "calc(100vh - 140px)", p: 3,
    }}>
      <Paper
        elevation={0}
        sx={{
          p: 5, borderRadius: 3, textAlign: "center", maxWidth: 400,
          border: "1.5px solid #ecdcdc",
        }}
      >
        <Box sx={{
          width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2.5,
          background: "#fdf0f0", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <LockIcon sx={{ fontSize: 32, color: "#A84D48" }} />
        </Box>
        <Typography variant="h4" fontWeight={900} sx={{ mb: 1 }}>
          404
        </Typography>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          Page not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          The page you're looking for doesn't exist or has been moved.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/")}
          sx={{
            background: "#A84D48", "&:hover": { background: "#8f3e3a" },
            fontWeight: 700, borderRadius: 2,
          }}
        >
          Go Home
        </Button>
      </Paper>
    </Box>
  );
}

// --- Report Card ---
function ReportCard({ report, onUpdateStatus, onDelete }) {
  const isPost = !!report.reported_listing_id;
  const statusStyle = STATUS_CONFIG[report.status] || STATUS_CONFIG.pending;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2.5, borderRadius: 2.5, borderColor: "#ecdcdc",
        transition: "box-shadow 0.15s",
        "&:hover": { boxShadow: "0 2px 12px rgba(168,77,72,0.1)" },
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <Chip
            label={isPost ? "Post" : "User"}
            size="small"
            sx={{
              fontWeight: 800, fontSize: 11,
              background: isPost ? "#f5eded" : "#ede8f5",
              color: isPost ? "#A84D48" : "#6b21a8",
            }}
          />
          <Chip
            label={report.status}
            size="small"
            sx={{
              fontWeight: 700, fontSize: 11, textTransform: "capitalize",
              background: statusStyle.bg, color: statusStyle.color,
              border: `1px solid ${statusStyle.border}`,
            }}
          />
        </Box>
        <Typography variant="caption" color="text.disabled" fontWeight={600}>
          {formatDate(report.created_at)}
        </Typography>
      </Box>

      {/* Reason + details */}
      <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
        {report.reason}
      </Typography>
      {report.details && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.5 }}>
          {report.details}
        </Typography>
      )}

      {/* Reporter + target */}
      <Box sx={{ display: "flex", gap: 3, mb: 1.5, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            Reported by
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {report.reporter
              ? `${report.reporter.first_name} ${report.reporter.last_name}`
              : "Unknown"}
          </Typography>
        </Box>
        <Box>
          <Typography variant="caption" fontWeight={700} color="text.secondary">
            {isPost ? "Post" : "User"}
          </Typography>
          <Typography variant="body2" fontWeight={600}>
            {isPost
              ? (report.reportedListing?.title || "Deleted listing")
              : (report.reportedUser
                  ? `${report.reportedUser.first_name} ${report.reportedUser.last_name}`
                  : "Unknown user")}
          </Typography>
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1, pt: 1.5, borderTop: "1px solid #f0e8e8", alignItems: "center" }}>
        {report.status === "pending" && (
          <>
            <Button
              size="small" startIcon={<CheckCircleIcon sx={{ fontSize: 16 }} />}
              onClick={() => onUpdateStatus(report.id, "reviewed")}
              sx={{ color: "#16a34a", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(22,163,74,0.08)" } }}
            >
              Reviewed
            </Button>
            <Button
              size="small" startIcon={<CancelIcon sx={{ fontSize: 16 }} />}
              onClick={() => onUpdateStatus(report.id, "dismissed")}
              sx={{ color: "#64748b", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(100,116,139,0.08)" } }}
            >
              Dismiss
            </Button>
          </>
        )}
        {(report.status === "reviewed" || report.status === "dismissed") && (
          <Button
            size="small"
            onClick={() => onUpdateStatus(report.id, "pending")}
            sx={{ color: "#92400e", fontWeight: 700, fontSize: 12, "&:hover": { background: "rgba(146,64,14,0.08)" } }}
          >
            Reopen
          </Button>
        )}
        <Box sx={{ flex: 1 }} />
        <IconButton
          size="small"
          onClick={() => onDelete(report.id)}
          sx={{ color: "#ccc", "&:hover": { color: "#dc2626" } }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
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
  const [loading, setLoading] = useState(true);
  const [reportTab, setReportTab] = useState("pending");
  const [actionError, setActionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  // --- Fetch reports ---
  const fetchReports = async () => {
    setLoading(true);
    setActionError("");

    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setActionError("Failed to load reports.");
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setReports([]);
      setLoading(false);
      return;
    }

    // Fetch profiles for reporters and reported users
    const userIds = new Set();
    data.forEach((r) => {
      if (r.reporter_id) userIds.add(r.reporter_id);
      if (r.reported_user_id) userIds.add(r.reported_user_id);
    });

    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .in("id", [...userIds]);

    const profileMap = {};
    (profilesData || []).forEach((p) => { profileMap[p.id] = p; });

    // Fetch listing titles
    const listingIds = data.map((r) => r.reported_listing_id).filter(Boolean);
    let listingMap = {};
    if (listingIds.length > 0) {
      const { data: listingsData } = await supabase
        .from("listings")
        .select("item_id, title, poster_name")
        .in("item_id", listingIds);
      (listingsData || []).forEach((l) => { listingMap[l.item_id] = l; });
    }

    const enriched = data.map((r) => ({
      ...r,
      reporter: profileMap[r.reporter_id] || null,
      reportedUser: profileMap[r.reported_user_id] || null,
      reportedListing: listingMap[r.reported_listing_id] || null,
    }));

    setReports(enriched);
    setLoading(false);
  };

  useEffect(() => {
    if (profile?.is_moderator) fetchReports();
  }, [profile]);

  const updateStatus = async (reportId, newStatus) => {
    setActionError("");
    const { error } = await supabase
      .from("reports")
      .update({ status: newStatus })
      .eq("id", reportId);

    if (error) {
      setActionError("Failed to update report.");
      return;
    }
    setReports((prev) =>
      prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
    );
  };

  const deleteReport = async () => {
    if (!deleteTarget) return;
    setActionError("");
    const { error } = await supabase.from("reports").delete().eq("id", deleteTarget);
    if (error) {
      setActionError("Failed to delete report.");
    } else {
      setReports((prev) => prev.filter((r) => r.id !== deleteTarget));
    }
    setDeleteTarget(null);
  };

  // --- Derived data ---
  const counts = {
    pending: reports.filter((r) => r.status === "pending").length,
    reviewed: reports.filter((r) => r.status === "reviewed").length,
    dismissed: reports.filter((r) => r.status === "dismissed").length,
  };
  const filteredReports = reports.filter((r) => r.status === reportTab);
  const postReports = reports.filter((r) => !!r.reported_listing_id).length;
  const userReports = reports.filter((r) => !!r.reported_user_id).length;

  // --- Guard: block non-moderators (must be after all hooks) ---
  if (profile && !profile.is_moderator) {
    return <AccessDenied />;
  }

  // --- Section nav items ---
  const sections = [
    { id: "reports", label: "Reports", icon: <FlagIcon sx={{ fontSize: 18 }} /> },
    { id: "feedback", label: "Feedback", icon: <FeedbackIcon sx={{ fontSize: 18 }} /> },
    { id: "bugs", label: "Bug Reports", icon: <BugReportIcon sx={{ fontSize: 18 }} /> },
  ];

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", p: 3 }}>
      <Box sx={{ width: "100%", maxWidth: 960 }}>

        {/* --- Header --- */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 0.5 }}>
          <Box sx={{
            width: 44, height: 44, borderRadius: 2,
            background: "#A84D4815", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <ShieldIcon sx={{ color: "#A84D48", fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={900}>Moderation Dashboard</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage reports, feedback, and platform health.
            </Typography>
          </Box>
        </Box>

        {/* --- Stats row --- */}
        <Box sx={{ display: "flex", gap: 2, my: 3, flexWrap: "wrap" }}>
          <StatCard
            icon={<FlagIcon sx={{ color: "#f59e0b", fontSize: 22 }} />}
            label="Pending Reports"
            value={counts.pending}
            color="#f59e0b"
          />
          <StatCard
            icon={<ArticleIcon sx={{ color: "#A84D48", fontSize: 22 }} />}
            label="Post Reports"
            value={postReports}
            color="#A84D48"
          />
          <StatCard
            icon={<PeopleIcon sx={{ color: "#6b21a8", fontSize: 22 }} />}
            label="User Reports"
            value={userReports}
            color="#6b21a8"
          />
          <StatCard
            icon={<CheckCircleIcon sx={{ color: "#16a34a", fontSize: 22 }} />}
            label="Reviewed"
            value={counts.reviewed}
            color="#16a34a"
          />
        </Box>

        {/* --- Section nav --- */}
        <Box sx={{ display: "flex", gap: 1, mb: 3, borderBottom: "1.5px solid #f0e8e8", pb: 1.5 }}>
          {sections.map((s) => (
            <Button
              key={s.id}
              startIcon={s.icon}
              onClick={() => setSection(s.id)}
              sx={{
                fontWeight: 700, fontSize: 13, textTransform: "none",
                color: section === s.id ? "#A84D48" : "#999",
                background: section === s.id ? "#A84D4810" : "transparent",
                borderRadius: 2, px: 2,
                "&:hover": { background: section === s.id ? "#A84D4818" : "#f5f5f5" },
              }}
            >
              {s.label}
            </Button>
          ))}
        </Box>

        {/* ============================================ */}
        {/* REPORTS SECTION                              */}
        {/* ============================================ */}
        {section === "reports" && (
          <>
            {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}

            {/* Tabs + refresh */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Tabs
                value={reportTab}
                onChange={(_, v) => setReportTab(v)}
                sx={{
                  "& .MuiTab-root": { fontWeight: 700, textTransform: "none", minHeight: 36, fontSize: 13 },
                  "& .Mui-selected": { color: "#A84D48" },
                  "& .MuiTabs-indicator": { backgroundColor: "#A84D48" },
                }}
              >
                <Tab value="pending" label={`Pending (${counts.pending})`} />
                <Tab value="reviewed" label={`Reviewed (${counts.reviewed})`} />
                <Tab value="dismissed" label={`Dismissed (${counts.dismissed})`} />
              </Tabs>
              <Button
                size="small"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={fetchReports}
                disabled={loading}
                sx={{ color: "#A84D48", fontWeight: 700, fontSize: 12 }}
              >
                Refresh
              </Button>
            </Box>

            {/* Report cards */}
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
                <CircularProgress sx={{ color: "#A84D48" }} />
              </Box>
            ) : filteredReports.length === 0 ? (
              <EmptySection
                icon={<FlagIcon sx={{ color: "#A84D48", fontSize: 28 }} />}
                title={`No ${reportTab} reports`}
                description="All clear! Check back later or switch tabs."
              />
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {filteredReports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    onUpdateStatus={updateStatus}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </Box>
            )}
          </>
        )}

        {/* ============================================ */}
        {/* FEEDBACK SECTION (template)                  */}
        {/* ============================================ */}
        {section === "feedback" && (
          <EmptySection
            icon={<FeedbackIcon sx={{ color: "#A84D48", fontSize: 28 }} />}
            title="Feedback — Coming Soon"
            description="This section will display user feedback and feature requests submitted through the app."
          />
        )}

        {/* ============================================ */}
        {/* BUG REPORTS SECTION (template)               */}
        {/* ============================================ */}
        {section === "bugs" && (
          <EmptySection
            icon={<BugReportIcon sx={{ color: "#A84D48", fontSize: 28 }} />}
            title="Bug Reports — Coming Soon"
            description="This section will display bug reports submitted by users, with status tracking and priority levels."
          />
        )}
      </Box>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete this report?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently remove the report. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} sx={{ color: "text.secondary" }}>
            Cancel
          </Button>
          <Button
            variant="contained" color="error"
            onClick={deleteReport}
            sx={{ fontWeight: 600 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}