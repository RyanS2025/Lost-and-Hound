import { useState } from "react";
import {
  Modal, Box, Typography, Button, IconButton, TextField,
  Select, MenuItem, FormControl, InputLabel, Alert, CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import apiFetch from "../utils/apiFetch";
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

const SUBJECT_MAX = 100;
const DESC_MAX = 500;

export default function SupportModal({ open, onClose }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const BRAND = {
    accent: isDark ? "#FF4500" : "#A84D48",
    accentHover: isDark ? "#E03D00" : "#8f3e3a",
    surface: isDark ? "#1A1A1B" : "#fff",
    border: isDark ? "rgba(255,255,255,0.14)" : "rgba(122,41,41,0.12)",
    inputBg: isDark ? "#2D2D2E" : "#fff",
    divider: isDark ? "rgba(255,255,255,0.1)" : "#f0e8e8",
    footerBg: isDark ? "#161617" : "#faf8f8",
    iconBg: isDark ? "rgba(255,69,0,0.16)" : "#A84D4815",
    secondary: isDark ? "#A9AAAB" : "#6f6f6f",
    backdrop: isDark ? "rgba(0,0,0,0.68)" : "rgba(20,15,15,0.45)",
    buttonDisabledBg: isDark ? "#37383A" : "#e0d6d6",
    buttonDisabledText: isDark ? "#808285" : "#aaa",
  };

  const [tab, setTab] = useState("form");
  const [ticketType, setTicketType] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = ticketType && category && subject.trim() && description.trim() && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      await apiFetch("/api/support", {
        method: "POST",
        body: JSON.stringify({
          ticketType,
          category,
          subject: subject.trim(),
          description: description.trim(),
        }),
      });
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setTab("form");
      setTicketType("");
      setCategory("");
      setSubject("");
      setDescription("");
      setSubmitted(false);
      setError("");
    }, 200);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: BRAND.backdrop,
            backdropFilter: "blur(1px)",
          },
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: BRAND.surface,
          border: `1px solid ${BRAND.border}`,
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
            borderBottom: `1.5px solid ${BRAND.divider}`,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: BRAND.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SupportAgentIcon sx={{ color: BRAND.accent, fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2, color: "text.primary" }}>
                Contact Support
              </Typography>
              <Typography variant="caption" sx={{ color: BRAND.secondary }} fontWeight={600}>
                We'll get back to you as soon as possible
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: BRAND.secondary }}>
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
              borderBottom: `1.5px solid ${BRAND.divider}`,
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
                  bgcolor: tab === t ? BRAND.accent : "transparent",
                  color: tab === t ? "#fff" : BRAND.secondary,
                  "&:hover": {
                    bgcolor: tab === t ? BRAND.accentHover : BRAND.divider,
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
              <SupportAgentIcon sx={{ color: BRAND.accent, fontSize: 48, mb: 1.5 }} />
              <Typography fontWeight={800} fontSize={17} sx={{ mb: 1 }}>
                Ticket submitted!
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                A moderator will review your request shortly. Thank you for reaching out.
              </Typography>
            </Box>
          ) : tab === "form" ? (
            <>
              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={ticketType}
                  label="Type"
                  onChange={(e) => {
                    setTicketType(e.target.value);
                    setCategory("");
                  }}
                  sx={{ bgcolor: BRAND.inputBg }}
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
                  sx={{ bgcolor: BRAND.inputBg }}
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
                  "& .MuiOutlinedInput-root": { bgcolor: BRAND.inputBg },
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
                  "& .MuiOutlinedInput-root": { bgcolor: BRAND.inputBg },
                  "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 },
                }}
              />

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            </>
          ) : (
            <SupportFAQ
              accent={BRAND.accent}
              secondary={BRAND.secondary}
              divider={BRAND.divider}
            />
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: `1.5px solid ${BRAND.divider}`,
            background: BRAND.footerBg,
            flexShrink: 0,
          }}
        >
          {submitted ? (
            <Button
              variant="contained"
              fullWidth
              onClick={handleClose}
              sx={{
                background: BRAND.accent,
                "&:hover": { background: BRAND.accentHover },
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
                background: BRAND.accent,
                "&:hover": { background: BRAND.accentHover },
                "&.Mui-disabled": {
                  background: BRAND.buttonDisabledBg,
                  color: BRAND.buttonDisabledText,
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
