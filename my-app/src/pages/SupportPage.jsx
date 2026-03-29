import { useState, useEffect } from "react";
import {
  Box, Container, Typography, TextField, Button, Select, MenuItem,
  FormControl, InputLabel, Alert, CircularProgress, Paper, Chip,
  Divider, Collapse,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SendIcon from "@mui/icons-material/Send";
import { useAuth } from "../AuthContext";
import apiFetch from "../utils/apiFetch";
import { formatRelativeDate } from "../utils/timezone";

const CATEGORIES = [
  "Account Issue",
  "Listing Problem",
  "Bug Report",
  "Inappropriate Content",
  "Other",
];

const STATUS_CONFIG = {
  open:        { label: "Open",        bg: "#fff3cd", color: "#92400e", border: "#ffc107" },
  in_progress: { label: "In Progress", bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
  resolved:    { label: "Resolved",    bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  closed:      { label: "Closed",      bg: "#f1f5f9", color: "#64748b", border: "#cbd5e1" },
};

const STATUS_CONFIG_DARK = {
  open:        { label: "Open",        bg: "#3a2f22", color: "#f6c66a", border: "rgba(245,158,11,0.5)" },
  in_progress: { label: "In Progress", bg: "#1e2d40", color: "#93c5fd", border: "rgba(147,197,253,0.45)" },
  resolved:    { label: "Resolved",    bg: "#1f3527", color: "#6ee7b7", border: "rgba(110,231,183,0.42)" },
  closed:      { label: "Closed",      bg: "#2c3138", color: "#cbd5e1", border: "rgba(148,163,184,0.45)" },
};

function StatusChip({ status, isDark }) {
  const cfg = (isDark ? STATUS_CONFIG_DARK : STATUS_CONFIG)[status] || STATUS_CONFIG.open;
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
        fontWeight: 700,
        fontSize: "0.7rem",
      }}
    />
  );
}

function TicketCard({ ticket, isDark, onReplyPosted }) {
  const [expanded, setExpanded] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyError, setReplyError] = useState("");

  const replies = ticket.support_replies || [];
  const canReply = ticket.status !== "closed" && ticket.status !== "resolved";

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    setReplyError("");
    try {
      await apiFetch(`/api/support-tickets/${ticket.id}/replies`, {
        method: "POST",
        body: JSON.stringify({ message: replyText.trim() }),
      });
      setReplyText("");
      onReplyPosted();
    } catch (err) {
      setReplyError(err.message || "Failed to send reply.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "#ecdcdc",
        background: isDark ? "#1A1A1B" : "#fff",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{ p: 2, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}
        onClick={() => setExpanded((v) => !v)}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
            <StatusChip status={ticket.status} isDark={isDark} />
            <Chip
              label={ticket.category}
              size="small"
              sx={{ background: isDark ? "rgba(255,255,255,0.07)" : "rgba(168,77,72,0.08)", color: isDark ? "#ccc" : "#A84D48", fontWeight: 600, fontSize: "0.7rem" }}
            />
            {replies.length > 0 && (
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {replies.length} {replies.length === 1 ? "reply" : "replies"}
              </Typography>
            )}
          </Box>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: expanded ? "normal" : "nowrap" }}>
            {ticket.description}
          </Typography>
          <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 0.5 }}>
            Submitted {formatRelativeDate(ticket.created_at)}
          </Typography>
        </Box>
        <Box sx={{ color: "text.secondary", mt: 0.25, flexShrink: 0 }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        <Divider sx={{ borderColor: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8" }} />
        <Box sx={{ px: 2, pt: 1.5, pb: 2 }}>
          <Typography variant="body2" sx={{ mb: replies.length > 0 ? 2 : 0, whiteSpace: "pre-wrap", color: "text.primary" }}>
            {ticket.description}
          </Typography>

          {replies.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
                Replies
              </Typography>
              {replies.map((reply) => (
                <Box
                  key={reply.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    background: reply.is_moderator
                      ? (isDark ? "rgba(168,77,72,0.15)" : "rgba(168,77,72,0.06)")
                      : (isDark ? "rgba(255,255,255,0.05)" : "#f9f5f4"),
                    border: `1px solid ${reply.is_moderator ? (isDark ? "rgba(168,77,72,0.4)" : "rgba(168,77,72,0.2)") : (isDark ? "rgba(255,255,255,0.08)" : "#ecdcdc")}`,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    {reply.is_moderator && (
                      <Chip label="Support Team" size="small" sx={{ background: isDark ? "rgba(168,77,72,0.3)" : "#A84D48", color: "#fff", fontWeight: 700, fontSize: "0.65rem", height: 18 }} />
                    )}
                    <Typography variant="caption" sx={{ color: "text.disabled" }}>
                      {formatRelativeDate(reply.created_at)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>{reply.message}</Typography>
                </Box>
              ))}
            </Box>
          )}

          {canReply && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {replyError && <Alert severity="error" sx={{ py: 0 }}>{replyError}</Alert>}
              <TextField
                multiline
                minRows={2}
                maxRows={5}
                placeholder="Add a message to your ticket..."
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ maxLength: 1000 }}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: 1.5 } }}
              />
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="contained"
                  size="small"
                  endIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <SendIcon fontSize="small" />}
                  disabled={!replyText.trim() || submitting}
                  onClick={handleReply}
                  sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, borderRadius: 1.5, fontWeight: 700 }}
                >
                  Send
                </Button>
              </Box>
            </Box>
          )}

          {!canReply && (
            <Typography variant="caption" sx={{ color: "text.disabled" }}>
              This ticket is {ticket.status} — no further replies can be added.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
}

export default function SupportPage({ effectiveTheme = "light" }) {
  const { user } = useAuth();
  const isDark = effectiveTheme === "dark";
  const isSmall = useMediaQuery("(max-width:600px)");

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  const fetchTickets = async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await apiFetch("/api/support-tickets/mine");
      setTickets(payload?.tickets || []);
    } catch {
      setError("Failed to load your support tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchTickets();
  }, [user]);

  const handleSubmit = async () => {
    if (!category || !description.trim()) {
      setFormError("Please select a category and enter a description.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    setFormSuccess("");
    try {
      await apiFetch("/api/support-tickets", {
        method: "POST",
        body: JSON.stringify({ category, description: description.trim() }),
      });
      setFormSuccess("Ticket submitted! Our support team will get back to you.");
      setCategory("");
      setDescription("");
      setShowForm(false);
      fetchTickets();
    } catch (err) {
      setFormError(err.message || "Failed to submit ticket.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ pb: 8, pt: { xs: 2, sm: 3 }, minHeight: "100vh" }}>
      <Container maxWidth="md" sx={{ px: isSmall ? 1.5 : 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <SupportAgentIcon sx={{ color: isDark ? "#FF8A5C" : "#A84D48", fontSize: 30 }} />
          <Box>
            <Typography variant="h5" fontWeight={800}>Support</Typography>
            <Typography variant="body2" color="text.secondary">Submit a ticket and our team will help you out.</Typography>
          </Box>
        </Box>

        {formSuccess && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setFormSuccess("")}>
            {formSuccess}
          </Alert>
        )}

        {!showForm ? (
          <Button
            variant="contained"
            onClick={() => setShowForm(true)}
            sx={{ mb: 3, background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 700, borderRadius: 2 }}
          >
            + New Ticket
          </Button>
        ) : (
          <Paper
            variant="outlined"
            sx={{ p: 2.5, mb: 3, borderRadius: 2, borderColor: isDark ? "rgba(255,255,255,0.12)" : "#ecdcdc", background: isDark ? "#1A1A1B" : "#fff" }}
          >
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>New Support Ticket</Typography>
            {formError && <Alert severity="error" sx={{ mb: 1.5 }}>{formError}</Alert>}
            <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
              <InputLabel>Category</InputLabel>
              <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              multiline
              minRows={3}
              maxRows={8}
              fullWidth
              size="small"
              label="Describe your issue"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              inputProps={{ maxLength: 500 }}
              helperText={`${description.length}/500`}
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
              <Button size="small" onClick={() => { setShowForm(false); setFormError(""); }} sx={{ color: "text.secondary" }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                size="small"
                disabled={submitting}
                onClick={handleSubmit}
                endIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
                sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 700, borderRadius: 1.5 }}
              >
                Submit Ticket
              </Button>
            </Box>
          </Paper>
        )}

        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, color: "text.secondary", textTransform: "uppercase", letterSpacing: 0.5 }}>
          Your Tickets
        </Typography>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
            <CircularProgress sx={{ color: "#A84D48" }} />
          </Box>
        ) : tickets.length === 0 ? (
          <Box sx={{ textAlign: "center", mt: 6, color: "text.secondary" }}>
            <SupportAgentIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
            <Typography variant="body2">No tickets yet. Submit one above if you need help.</Typography>
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {tickets.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} isDark={isDark} onReplyPosted={fetchTickets} />
            ))}
          </Box>
        )}
      </Container>
    </Box>
  );
}
