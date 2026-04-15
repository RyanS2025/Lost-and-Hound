import { useState } from "react";
import {
  Dialog, DialogContent, Box, Typography, Select, MenuItem,
  FormControl, InputLabel, Button, IconButton, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import apiFetch from "../utils/apiFetch";

const REFERRAL_OPTIONS = [
  { value: "word_of_mouth",        label: "Word of mouth" },
  { value: "social_media",         label: "Instagram / Social media" },
  { value: "reddit",               label: "Reddit" },
  { value: "northeastern_website", label: "Northeastern website" },
  { value: "professor_class",      label: "Professor or class" },
  { value: "flyer_poster",         label: "Flyer or poster" },
  { value: "oasis_event",          label: "Oasis event" },
  { value: "other",                label: "Other" },
];

export default function ReferralPollModal({ open, onDone, isDark }) {
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (selectedSource) => {
    setSaving(true);
    try {
      await apiFetch("/api/referral/user", {
        method: "POST",
        body: JSON.stringify({ source: selectedSource || undefined }),
      });
    } catch {
      // Fire-and-forget — don't block the user on failure
    } finally {
      setSaving(false);
      onDone();
    }
  };

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: isDark ? "#1A1A1B" : "#fff",
          border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ecdcdc",
          m: 2,
        },
      }}
    >
      <DialogContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Box
                component="img"
                src="/TabLogo.png"
                alt=""
                sx={{ height: 22, width: 22, objectFit: "contain" }}
              />
              <Typography sx={{ fontSize: 11, fontWeight: 700, color: "#A84D48", textTransform: "uppercase", letterSpacing: 0.8 }}>
                Quick question
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: isDark ? "#D7DADC" : "#1a1a1a", lineHeight: 1.3 }}>
              How did you hear about Lost &amp; Hound?
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, mt: 0.5 }}>
              Helps us understand how to reach more Huskies.
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={() => submit(null)}
            disabled={saving}
            sx={{ color: "text.disabled", mt: -0.5, mr: -0.5, flexShrink: 0 }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>

        {/* Dropdown */}
        <FormControl fullWidth size="small" sx={{ mb: 2.5 }}>
          <InputLabel sx={{ fontSize: 14 }}>Select an option</InputLabel>
          <Select
            value={source}
            label="Select an option"
            onChange={(e) => setSource(e.target.value)}
            sx={{ fontSize: 14, borderRadius: 1.5 }}
          >
            {REFERRAL_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Actions */}
        <Button
          fullWidth
          variant="contained"
          disabled={!source || saving}
          onClick={() => submit(source)}
          sx={{
            background: "#A84D48",
            "&:hover": { background: "#8a3d39" },
            "&:disabled": { background: isDark ? "rgba(255,255,255,0.08)" : "#f0e8e8", color: "text.disabled" },
            fontWeight: 700,
            borderRadius: 2,
            py: 1,
            mb: 1.25,
            textTransform: "none",
            fontSize: 14,
          }}
        >
          {saving ? <CircularProgress size={16} color="inherit" /> : "Submit"}
        </Button>

        <Box sx={{ textAlign: "center" }}>
          <Typography
            component="span"
            variant="caption"
            onClick={() => !saving && submit(null)}
            sx={{
              color: "text.disabled",
              cursor: saving ? "default" : "pointer",
              fontSize: 12,
              "&:hover": { color: "text.secondary" },
            }}
          >
            Skip
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  );
}
