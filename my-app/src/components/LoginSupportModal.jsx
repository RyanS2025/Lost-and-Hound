import { useState, useMemo } from "react";
import {
  Modal, Box, Typography, Button, IconButton, TextField,
  Select, MenuItem, FormControl, InputLabel, Alert, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import SupportFAQ from "./SupportFAQ";

const TICKET_TYPES = ["Support", "Bug Report", "Feedback"];

const CATEGORIES_BY_TYPE = {
  Support: [
    "Login / Access Issue",
    "Account or Profile Issue",
    "Listing Problem",
    "Messaging Issue",
    "Technical Problem",
    "Other",
  ],
  "Bug Report": [
    "UI / Display Issue",
    "App Crash / Freeze",
    "Feature Not Working",
    "Performance Issue",
    "Other",
  ],
  Feedback: [
    "Feature Request",
    "Usability Improvement",
    "Design Suggestion",
    "General Feedback",
  ],
};

const NAME_MAX = 50;
const SUBJECT_MAX = 100;
const DESC_MAX = 500;

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function LoginSupportModal({ open, onClose, effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";

  const styles = useMemo(
    () => ({
      panelBg: isDark ? "#1A1A1B" : "#fff",
      panelBorder: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid #ecdcdc",
      secondary: isDark ? "#A9AAAB" : "#6f6f6f",
      accent: isDark ? "#FF4500" : "#A84D48",
      accentHover: isDark ? "#E03D00" : "#8f3e3a",
      divider: isDark ? "rgba(255,255,255,0.1)" : "#f0e8e8",
      footerBg: isDark ? "#161617" : "#faf8f8",
      iconBg: isDark ? "rgba(255,69,0,0.16)" : "#A84D4815",
      inputBg: isDark ? "#2D2D2E" : "#fff",
      buttonDisabledBg: isDark ? "#37383A" : "#e0d6d6",
      buttonDisabledText: isDark ? "#808285" : "#aaa",
    }),
    [isDark]
  );

  const [tab, setTab] = useState("form");
  const [ticketType, setTicketType] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit =
    ticketType && name.trim() && email.trim() && category && subject.trim() && description.trim() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/support/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketType,
          name: name.trim(),
          email: email.trim(),
          category,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Request failed");
      }
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setTab("form");
      setTicketType("");
      setName("");
      setEmail("");
      setCategory("");
      setSubject("");
      setDescription("");
      setSubmitted(false);
      setError("");
    }, 200);
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: styles.panelBg,
          border: styles.panelBorder,
          borderRadius: 4,
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          mx: 1.5,
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 3,
            py: 2.5,
            borderBottom: `1.5px solid ${styles.divider}`,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: styles.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SupportAgentIcon sx={{ color: styles.accent, fontSize: 22 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={900}
                sx={{ lineHeight: 1.2, color: isDark ? "#F3F4F5" : "#2f1c1c" }}
              >
                Need Help?
              </Typography>
              <Typography variant="caption" sx={{ color: styles.secondary }} fontWeight={600}>
                Submit a ticket and a moderator will assist you
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: styles.secondary }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Tabs */}
        {!submitted && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              px: 3,
              py: 1.5,
              borderBottom: `1.5px solid ${styles.divider}`,
              flexShrink: 0,
            }}
          >
            {["form", "faq"].map((t) => (
              <Box
                key={t}
                onClick={() => setTab(t)}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 2,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  userSelect: "none",
                  transition: "all 0.15s",
                  bgcolor: tab === t ? styles.accent : "transparent",
                  color: tab === t ? "#fff" : styles.secondary,
                  "&:hover": {
                    bgcolor: tab === t ? styles.accentHover : styles.divider,
                  },
                }}
              >
                {t === "form" ? "Submit Ticket" : "Q&A"}
              </Box>
            ))}
          </Box>
        )}

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5, minHeight: 0 }}>
          {submitted ? (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <SupportAgentIcon sx={{ color: styles.accent, fontSize: 48, mb: 1.5 }} />
              <Typography
                fontWeight={800}
                fontSize={17}
                sx={{ mb: 1, color: isDark ? "#F3F4F5" : "#2f1c1c" }}
              >
                Ticket submitted!
              </Typography>
              <Typography
                variant="body2"
                sx={{ lineHeight: 1.6, color: styles.secondary }}
              >
                A moderator will review your request shortly. Thank you for reaching out.
              </Typography>
            </Box>
          ) : tab === "form" ? (
            <>
              <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
                <TextField
                  label="Your Name"
                  placeholder="First and last name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                  fullWidth
                  size="small"
                  inputProps={{ maxLength: NAME_MAX }}
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg } }}
                />
                <TextField
                  label="Email Address"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, NAME_MAX))}
                  fullWidth
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg } }}
                />
              </Box>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={ticketType}
                  label="Type"
                  onChange={(e) => {
                    setTicketType(e.target.value);
                    setCategory("");
                  }}
                  sx={{ bgcolor: styles.inputBg }}
                >
                  {TICKET_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={!ticketType}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  label="Category"
                  onChange={(e) => setCategory(e.target.value)}
                  sx={{ bgcolor: styles.inputBg }}
                >
                  {(CATEGORIES_BY_TYPE[ticketType] || []).map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Subject"
                placeholder="Brief summary of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                fullWidth
                size="small"
                inputProps={{ maxLength: SUBJECT_MAX }}
                helperText={`${subject.length}/${SUBJECT_MAX}`}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg },
                  "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 },
                }}
              />

              <TextField
                label="Description"
                placeholder="Describe your issue in detail"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                multiline
                rows={4}
                fullWidth
                size="small"
                inputProps={{ maxLength: DESC_MAX }}
                helperText={`${description.length}/${DESC_MAX}`}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg },
                  "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 },
                }}
              />

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            </>
          ) : (
            <SupportFAQ
              accent={styles.accent}
              secondary={styles.secondary}
              divider={styles.divider}
            />
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: `1.5px solid ${styles.divider}`,
            background: styles.footerBg,
            flexShrink: 0,
          }}
        >
          {submitted ? (
            <Button
              variant="contained"
              fullWidth
              onClick={handleClose}
              sx={{
                background: styles.accent,
                "&:hover": { background: styles.accentHover },
                fontWeight: 800,
                borderRadius: 2,
                py: 1.25,
                fontSize: 15,
                textTransform: "none",
              }}
            >
              Done
            </Button>
          ) : tab === "form" ? (
            <Button
              variant="contained"
              fullWidth
              disabled={!canSubmit}
              onClick={handleSubmit}
              sx={{
                background: styles.accent,
                "&:hover": { background: styles.accentHover },
                "&.Mui-disabled": {
                  background: styles.buttonDisabledBg,
                  color: styles.buttonDisabledText,
                },
                fontWeight: 800,
                borderRadius: 2,
                py: 1.25,
                fontSize: 15,
                textTransform: "none",
              }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : "Submit Ticket"}
            </Button>
          ) : null}
        </Box>
      </Box>
    </Modal>
  );
}
