import { useState } from "react";
import {
  Modal, Box, Typography, Button, IconButton, TextField,
  RadioGroup, FormControlLabel, Radio, Alert, CircularProgress,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import apiFetch from "../utils/apiFetch";
import { stripInvisible } from "../utils/profanityFilter";
import { useDemo } from "../contexts/DemoContext";

const REPORT_REASON_MAX_LENGTH = 50;
const REPORT_DETAILS_MAX_LENGTH = 250;

const POST_REASONS = [
  "Stolen item / theft concern",
  "False or misleading listing",
  "Inappropriate content",
  "Spam",
  "Already resolved / duplicate",
  "Other",
];

const USER_REASONS = [
  "Stolen item / theft concern",
  "Harassment or threatening behavior",
  "Scam or fraud attempt",
  "Impersonation",
  "Inappropriate messages",
  "Other",
];

export default function ReportModal({ open, onClose, type, targetId, targetLabel }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { isDemoMode } = useDemo();

  const BRAND = {
    accent: isDark ? "#C96E47" : "#A84D48",
    accentHover: isDark ? "#B35D38" : "#8f3e3a",
    surface: isDark ? "#1A1A1B" : "#fff",
    border: isDark ? "rgba(255,255,255,0.14)" : "rgba(122,41,41,0.12)",
    inputBg: isDark ? "#2D2D2E" : "#fff",
    backdrop: isDark ? "rgba(0,0,0,0.68)" : "rgba(20,15,15,0.45)",
  };

  const [reason, setReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const reasons = type === "post" ? POST_REASONS : USER_REASONS;
  const isOtherReason = reason === "Other";
  const isStolenReason = reason === "Stolen item / theft concern";

  const handleSubmit = async () => {
    if (!reason) return;
    if (isDemoMode) { setError("Cannot do this action in demo mode."); return; }
    const normalizedCustomReason = customReason.trim();
    if (isOtherReason && !normalizedCustomReason) {
      setError("Please enter a reason.");
      return;
    }
    setSubmitting(true);
    setError("");

    const row = {
      reason: isOtherReason ? normalizedCustomReason : reason,
      details: details.trim() || null,
    };

    if (type === "post") {
      row.reported_listing_id = targetId;
    } else {
      row.reported_user_id = targetId;
    }

    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify(row),
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
    // Reset state after animation
    setTimeout(() => {
      setReason("");
      setCustomReason("");
      setDetails("");
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
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: BRAND.surface,
        border: `1px solid ${BRAND.border}`,
        borderRadius: 3,
        p: 3,
        width: { xs: "calc(100% - 32px)", sm: "100%" },
        maxWidth: 420,
        maxHeight: "90vh",
        overflowY: "auto",
        outline: "none",
        color: "text.primary",
        boxSizing: "border-box",
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" fontWeight={800}>
            Report {type === "post" ? "Post" : "User"}
          </Typography>
          <IconButton onClick={handleClose} size="small"><CloseIcon /></IconButton>
        </Box>

        {submitted ? (
          <Box sx={{ textAlign: "center", py: 3 }}>
            <Typography fontWeight={700} sx={{ mb: 1 }}>
              Report submitted
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              Thanks for helping keep the community safe. We'll review this shortly.
            </Typography>
            <Button
              variant="contained"
              onClick={handleClose}
              sx={{ background: BRAND.accent, "&:hover": { background: BRAND.accentHover }, fontWeight: 700, borderRadius: 2 }}
            >
              Done
            </Button>
          </Box>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Reporting: <strong>{targetLabel}</strong>
            </Typography>

            <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Why are you reporting this {type === "post" ? "post" : "user"}?
            </Typography>

            <RadioGroup value={reason} onChange={(e) => setReason(e.target.value)}>
              {reasons.map((r) => (
                <FormControlLabel
                  key={r}
                  value={r}
                  control={<Radio size="small" sx={{ color: BRAND.accent, "&.Mui-checked": { color: BRAND.accent } }} />}
                  label={
                    <Typography
                      variant="body2"
                      fontWeight={r === "Stolen item / theft concern" ? 800 : 500}
                      sx={{ color: r === "Stolen item / theft concern" ? "#dc2626" : "inherit" }}
                    >
                      {r}
                    </Typography>
                  }
                  sx={{
                    mb: -0.5,
                    px: 1,
                    py: 0.25,
                    borderRadius: 1.5,
                    border: r === "Stolen item / theft concern"
                      ? (isDark ? "1px solid rgba(248,113,113,0.5)" : "1px solid #fecaca")
                      : "1px solid transparent",
                    background: r === "Stolen item / theft concern"
                      ? (isDark ? "rgba(127,29,29,0.22)" : "#fef2f2")
                      : "transparent",
                  }}
                />
              ))}
            </RadioGroup>

            {isStolenReason && (
              <Alert
                severity="warning"
                sx={{
                  mt: 1,
                  mb: 1,
                  border: isDark ? "1px solid rgba(245,158,11,0.45)" : "1px solid #fcd34d",
                  background: isDark ? "rgba(146,64,14,0.22)" : "#fffbeb",
                  "& .MuiAlert-message": { fontWeight: 600 },
                }}
              >
                High priority: select this only if theft is suspected. Include any identifying details below.
              </Alert>
            )}

            {isOtherReason && (
              <TextField
                placeholder="Enter report reason"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value.slice(0, REPORT_REASON_MAX_LENGTH))}
                fullWidth
                size="small"
                inputProps={{ maxLength: REPORT_REASON_MAX_LENGTH }}
                helperText={`${stripInvisible(customReason).length}/${REPORT_REASON_MAX_LENGTH}`}
                sx={{
                  mt: 1.25,
                  mb: 1,
                  "& .MuiOutlinedInput-root": {
                    bgcolor: BRAND.inputBg,
                  },
                  "& .MuiFormHelperText-root": {
                    textAlign: "right",
                    mr: 0.5,
                  },
                }}
              />
            )}

            <TextField
              placeholder="Additional details (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value.slice(0, REPORT_DETAILS_MAX_LENGTH))}
              multiline
              rows={3}
              fullWidth
              size="small"
              inputProps={{ maxLength: REPORT_DETAILS_MAX_LENGTH }}
              helperText={`${stripInvisible(details).length}/${REPORT_DETAILS_MAX_LENGTH}`}
              sx={{
                mt: 2,
                mb: 2,
                "& .MuiOutlinedInput-root": {
                  bgcolor: BRAND.inputBg,
                },
                "& .MuiFormHelperText-root": {
                  textAlign: "right",
                  mr: 0.5,
                },
              }}
            />

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}

            <Button
              variant="contained"
              fullWidth
              disabled={!reason || submitting || (isOtherReason && !customReason.trim())}
              onClick={handleSubmit}
              sx={{
                background: BRAND.accent,
                "&:hover": { background: BRAND.accentHover },
                fontWeight: 800,
                borderRadius: 2,
              }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : "Submit Report"}
            </Button>
          </>
        )}
      </Box>
    </Modal>
  );
}