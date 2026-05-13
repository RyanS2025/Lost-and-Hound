import { useState, useEffect, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import {
  Box, Typography, Paper, Button, TextField, Select, MenuItem, FormControl,
  InputLabel, CircularProgress, Alert, Chip, Divider, IconButton, Collapse,
  Slider, InputAdornment,
} from "@mui/material";
import PollIcon from "@mui/icons-material/Poll";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SectionPageHeader from "../../components/dashboard/SectionPageHeader";
import PollBuilder from "../../components/PollBuilder";
import apiFetch from "../../utils/apiFetch";

const PROD_BASE = "https://thelostandhound.com";

const DELIVERY_OPTIONS = [
  { value: "link",         label: "Link only",        desc: "Accessible only via the generated URL" },
  { value: "first_login",  label: "First login",       desc: "Shown as a popup on first sign-in (one poll at a time)" },
  { value: "random_login", label: "Randomized login",  desc: "Shown randomly on some logins" },
];

const BATCH_OPTIONS = [
  { value: "everyone",     label: "Everyone" },
  { value: "random_group", label: "Random group of X users" },
];

function PollRow({ poll, onDelete, isDark }) {
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = `${PROD_BASE}/polls/${poll.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete poll "${poll.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/polls/${poll.id}`, { method: "DELETE" });
      onDelete(poll.id);
    } catch (err) {
      alert(err.message || "Failed to delete poll");
    } finally {
      setDeleting(false);
    }
  };

  const deliveryColor = poll.delivery_type === "first_login"
    ? "#f59e0b" : poll.delivery_type === "random_login"
    ? "#6366f1" : "#16a34a";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1.5,
        borderRadius: 2,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "#ecdcdc"}`,
        background: isDark ? "#1A1A1B" : "#fff",
        flexWrap: "wrap",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} noWrap sx={{ color: isDark ? "#D7DADC" : "#1a1a1a" }}>
          {poll.title}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.75, mt: 0.5, flexWrap: "wrap", alignItems: "center" }}>
          <Chip
            label={poll.delivery_type.replace("_", " ")}
            size="small"
            sx={{ fontSize: 11, fontWeight: 700, bgcolor: `${deliveryColor}18`, color: deliveryColor, height: 20 }}
          />
          <Chip
            label={poll.is_active ? "Active" : "Inactive"}
            size="small"
            sx={{
              fontSize: 11, fontWeight: 700, height: 20,
              bgcolor: poll.is_active ? "rgba(22,163,74,0.12)" : (isDark ? "rgba(255,255,255,0.07)" : "#f5f5f5"),
              color: poll.is_active ? "#16a34a" : "text.secondary",
            }}
          />
        </Box>
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, flexShrink: 0 }}>
        <Button
          size="small"
          startIcon={<ContentCopyIcon sx={{ fontSize: 13 }} />}
          onClick={handleCopy}
          sx={{ textTransform: "none", fontSize: 12, fontWeight: 600, color: isDark ? "#FF4500" : "#A84D48" }}
        >
          {copied ? "Copied!" : "Copy link"}
        </Button>
        <IconButton
          size="small"
          onClick={handleDelete}
          disabled={deleting}
          sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}
        >
          {deleting ? <CircularProgress size={14} /> : <DeleteOutlineIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>
    </Box>
  );
}

export default function PollsPage() {
  const { isDark } = useOutletContext();
  const accent = isDark ? "#FF4500" : "#A84D48";
  const cardBorder = isDark ? "rgba(255,255,255,0.1)" : "#ecdcdc";
  const cardBg = isDark ? "#1A1A1B" : "#fff";

  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deliveryType, setDeliveryType] = useState("link");
  const [loginProbability, setLoginProbability] = useState(25);
  const [batchType, setBatchType] = useState("everyone");
  const [batchSize, setBatchSize] = useState("");
  const [questions, setQuestions] = useState([]);

  const fetchPolls = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/polls");
      setPolls(data.polls ?? []);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPolls(); }, [fetchPolls]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDeliveryType("link");
    setLoginProbability(25);
    setBatchType("everyone");
    setBatchSize("");
    setQuestions([]);
    setError("");
  };

  const handleCreate = async () => {
    setError("");
    if (!title.trim()) return setError("Poll title is required.");
    if (questions.length === 0) return setError("Add at least one question.");
    const hasEmpty = questions.some((q) => !q.question_text.trim());
    if (hasEmpty) return setError("All questions must have text.");

    setCreating(true);
    try {
      await apiFetch("/api/polls", {
        method: "POST",
        body: JSON.stringify({
          title,
          description,
          delivery_type: deliveryType,
          random_login_probability: loginProbability / 100,
          batch_type: batchType,
          batch_size: batchType === "random_group" ? parseInt(batchSize, 10) || null : null,
          questions,
        }),
      });
      setSuccess("Poll created! Activate it from the polls list when ready.");
      resetForm();
      setShowForm(false);
      await fetchPolls();
    } catch (err) {
      setError(err.message || "Failed to create poll.");
    } finally {
      setCreating(false);
    }
  };

  const deliveryDesc = DELIVERY_OPTIONS.find((d) => d.value === deliveryType)?.desc;

  return (
    <Box>
      <SectionPageHeader
        icon={<PollIcon sx={{ color: accent, fontSize: 20 }} />}
        title="Polls"
        subtitle="Create and manage community polls"
        isDark={isDark}
      />

      {success && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      {/* Create poll button / toggle */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 2 }}>
        <Button
          variant="contained"
          startIcon={showForm ? <ExpandLessIcon /> : <AddIcon />}
          onClick={() => { setShowForm((v) => !v); setError(""); }}
          sx={{
            background: accent, "&:hover": { background: isDark ? "#E03D00" : "#8a3d39" },
            textTransform: "none", fontWeight: 700, borderRadius: 2,
          }}
        >
          {showForm ? "Cancel" : "New Poll"}
        </Button>
      </Box>

      {/* ── Poll Creator ── */}
      <Collapse in={showForm}>
        <Paper
          variant="outlined"
          sx={{ borderRadius: 3, border: `1px solid ${cardBorder}`, background: cardBg, p: { xs: 2, sm: 3 }, mb: 3 }}
        >
          <Typography variant="h6" fontWeight={800} sx={{ mb: 2.5, color: isDark ? "#D7DADC" : "#1a1a1a" }}>
            Create Poll
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          {/* Title & Description */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
            <TextField
              fullWidth
              size="small"
              label="Poll title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              inputProps={{ maxLength: 120 }}
            />
            <TextField
              fullWidth
              size="small"
              label="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              inputProps={{ maxLength: 400 }}
            />
          </Box>

          <Divider sx={{ mb: 2.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8" }} />

          {/* Delivery options */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1.5 }}>
            Delivery
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
            {DELIVERY_OPTIONS.map((opt) => (
              <Box
                key={opt.value}
                onClick={() => setDeliveryType(opt.value)}
                sx={{
                  display: "flex", alignItems: "center", gap: 1.5,
                  px: 2, py: 1.25, borderRadius: 2, cursor: "pointer",
                  border: `1.5px solid ${deliveryType === opt.value ? accent : (isDark ? "rgba(255,255,255,0.1)" : "#e0e0e0")}`,
                  background: deliveryType === opt.value
                    ? (isDark ? "rgba(255,69,0,0.08)" : "rgba(168,77,72,0.05)")
                    : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <Box sx={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${deliveryType === opt.value ? accent : (isDark ? "rgba(255,255,255,0.3)" : "#ccc")}`,
                  bgcolor: deliveryType === opt.value ? accent : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {deliveryType === opt.value && <Box sx={{ width: 6, height: 6, borderRadius: "50%", bgcolor: "#fff" }} />}
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={700} sx={{ color: isDark ? "#D7DADC" : "#1a1a1a" }}>{opt.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{opt.desc}</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {deliveryType === "random_login" && (
            <Box sx={{ px: 1, mb: 2 }}>
              <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Show probability: <strong style={{ color: accent }}>{loginProbability}%</strong> of logins
              </Typography>
              <Slider
                value={loginProbability}
                onChange={(_, v) => setLoginProbability(v)}
                min={5} max={100} step={5}
                sx={{ color: accent }}
              />
            </Box>
          )}

          <Divider sx={{ mb: 2.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8" }} />

          {/* Batching */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1.5 }}>
            Target Audience
          </Typography>
          <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
            {BATCH_OPTIONS.map((opt) => (
              <Box
                key={opt.value}
                onClick={() => setBatchType(opt.value)}
                sx={{
                  px: 2, py: 1, borderRadius: 2, cursor: "pointer", fontSize: 13, fontWeight: 700,
                  border: `1.5px solid ${batchType === opt.value ? accent : (isDark ? "rgba(255,255,255,0.1)" : "#e0e0e0")}`,
                  color: batchType === opt.value ? accent : "text.secondary",
                  background: batchType === opt.value
                    ? (isDark ? "rgba(255,69,0,0.08)" : "rgba(168,77,72,0.05)")
                    : "transparent",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
              </Box>
            ))}
          </Box>

          {batchType === "random_group" && (
            <TextField
              size="small"
              label="Number of users"
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              sx={{ mb: 2, width: 180 }}
              InputProps={{ inputProps: { min: 1 } }}
            />
          )}

          <Divider sx={{ mb: 2.5, borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8" }} />

          {/* Question builder */}
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1.5 }}>
            Questions
          </Typography>
          <PollBuilder value={questions} onChange={setQuestions} isDark={isDark} />

          <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={creating}
              sx={{
                background: accent, "&:hover": { background: isDark ? "#E03D00" : "#8a3d39" },
                textTransform: "none", fontWeight: 700, borderRadius: 2, px: 3,
              }}
            >
              {creating ? <CircularProgress size={16} color="inherit" /> : "Create Poll"}
            </Button>
          </Box>
        </Paper>
      </Collapse>

      {/* ── Poll list ── */}
      <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ textTransform: "uppercase", letterSpacing: 0.8, display: "block", mb: 1.5 }}>
        All Polls
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} sx={{ color: accent }} />
        </Box>
      ) : polls.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 5, border: `2px dashed ${cardBorder}`, borderRadius: 2 }}>
          <PollIcon sx={{ fontSize: 36, color: "text.disabled", mb: 1 }} />
          <Typography variant="body2" color="text.secondary">No polls yet. Create one above.</Typography>
        </Box>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {polls.map((poll) => (
            <PollRow
              key={poll.id}
              poll={poll}
              onDelete={(id) => setPolls((prev) => prev.filter((p) => p.id !== id))}
              isDark={isDark}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}
