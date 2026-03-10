import { useState } from "react";
import {
  Modal, Box, Typography, Button, IconButton, TextField,
  RadioGroup, FormControlLabel, Radio, Alert, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";

const POST_REASONS = [
  "False or misleading listing",
  "Inappropriate content",
  "Spam",
  "Already resolved / duplicate",
  "Other",
];

const USER_REASONS = [
  "Harassment or threatening behavior",
  "Scam or fraud attempt",
  "Impersonation",
  "Inappropriate messages",
  "Other",
];

export default function ReportModal({ open, onClose, type, targetId, targetLabel }) {
  const { user } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const reasons = type === "post" ? POST_REASONS : USER_REASONS;

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    setError("");

    const row = {
      reporter_id: user.id,
      reason,
      details: details.trim() || null,
      status: "pending",
    };

    if (type === "post") {
      row.reported_listing_id = targetId;
    } else {
      row.reported_user_id = targetId;
    }

    const { error: insertErr } = await supabase.from("reports").insert(row);

    setSubmitting(false);
    if (insertErr) {
      setError("Something went wrong. Please try again.");
    } else {
      setSubmitted(true);
    }
  };

  const handleClose = () => {
    onClose();
    // Reset state after animation
    setTimeout(() => {
      setReason("");
      setDetails("");
      setSubmitted(false);
      setError("");
    }, 200);
  };

  return (
    <Modal open={open} onClose={handleClose}>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: "#fff", borderRadius: 3, p: 3, width: "100%", maxWidth: 420,
        outline: "none",
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
              sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 700, borderRadius: 2 }}
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
                  control={<Radio size="small" sx={{ color: "#A84D48", "&.Mui-checked": { color: "#A84D48" } }} />}
                  label={<Typography variant="body2">{r}</Typography>}
                  sx={{ mb: -0.5 }}
                />
              ))}
            </RadioGroup>

            <TextField
              placeholder="Additional details (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              multiline
              rows={2}
              fullWidth
              size="small"
              sx={{ mt: 2, mb: 2 }}
            />

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
            )}

            <Button
              variant="contained"
              fullWidth
              disabled={!reason || submitting}
              onClick={handleSubmit}
              sx={{
                background: "#A84D48",
                "&:hover": { background: "#8f3e3a" },
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