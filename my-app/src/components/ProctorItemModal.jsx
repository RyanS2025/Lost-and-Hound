import { useState, useRef } from "react";
import {
  Box, Typography, Paper, Button, Chip, Modal, IconButton, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { formatRelativeDate, DEFAULT_TIME_ZONE } from "../utils/timezone";
import apiFetch from "../utils/apiFetch";

const STATUS_LABELS = { unclaimed: "Unclaimed", pending: "Pending", delivered: "Delivered" };
const STATUS_COLORS = { unclaimed: "#a16207", pending: "#4f46e5", delivered: "#16a34a" };
const LISTING_TYPE_LABELS = { found: "Found", lost: "Lost" };

/**
 * Proctor-side item detail (wireframe B). Read-only for Unclaimed/Delivered;
 * for Pending items it shows a 4-digit pickup-PIN entry so the proctor can verify
 * the owner and mark the item Delivered.
 */
export default function ProctorItemModal({ item, status, onClose, onDelivered, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const inputs = useRef([]);

  if (!item) return null;

  const pin = digits.join("");
  const canVerify = pin.length === 4 && !verifying;

  const setDigit = (idx, val) => {
    const clean = val.replace(/\D/g, "");
    setError("");
    if (clean.length > 1) {
      // Handle paste of multiple digits
      const next = [...digits];
      for (let i = 0; i < clean.length && idx + i < 4; i++) next[idx + i] = clean[i];
      setDigits(next);
      const last = Math.min(idx + clean.length, 3);
      inputs.current[last]?.focus();
      return;
    }
    const next = [...digits];
    next[idx] = clean;
    setDigits(next);
    if (clean && idx < 3) inputs.current[idx + 1]?.focus();
  };

  const onKeyDown = (idx, e) => {
    if (e.key === "Backspace" && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    } else if (e.key === "Enter" && canVerify) {
      handleVerify();
    }
  };

  const handleVerify = async () => {
    if (!canVerify) return;
    setVerifying(true);
    setError("");
    try {
      await apiFetch(`/api/proctor/items/${item.item_id}/deliver`, {
        method: "POST",
        body: JSON.stringify({ pin }),
      });
      onDelivered?.(item.item_id);
    } catch (err) {
      setError(err?.message || "Could not verify the code.");
      setDigits(["", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  const dateLine = status === "delivered"
    ? `Delivered ${formatRelativeDate(item.delivered_at, timeZone)}`
    : item.received_at
      ? `Received ${formatRelativeDate(item.received_at, timeZone)}`
      : null;

  return (
    <Modal open={!!item} onClose={onClose} sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Box sx={{
        background: isDark ? "#1A1A1B" : "#fff", borderRadius: 4, p: "26px", maxWidth: 560,
        maxHeight: "90dvh", overflowY: "auto", outline: "none",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
        boxSizing: "border-box",
        width: { xs: "calc(100% - 32px)", sm: "100%" },
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0, pr: 1 }}>
            <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.25, overflowWrap: "anywhere", wordBreak: "break-word" }}>
              {item.title}
            </Typography>
            <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600} sx={{ display: "block" }}>
              Found by {item.poster_name}
            </Typography>
            {item.owner_name && (
              <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600} sx={{ display: "block" }}>
                Owner: {item.owner_name}
              </Typography>
            )}
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}><CloseIcon /></IconButton>
        </Box>

        {item.image_url
          ? <Box component="img" src={item.image_url} alt={item.title}
              sx={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 2, mb: 2, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc" }} />
          : <Box sx={{ width: "100%", height: 120, background: isDark ? "#2D2D2E" : "#f5f0f0", borderRadius: 2, mb: 2, display: "flex", alignItems: "center", justifyContent: "center", border: isDark ? "1px dashed rgba(255,255,255,0.2)" : "1.5px dashed #dac8c8" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No photo provided</Typography>
            </Box>
        }

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <Chip
            label={STATUS_LABELS[status] ?? status}
            size="small"
            sx={{ background: (STATUS_COLORS[status] ?? "#888") + "22", color: STATUS_COLORS[status] ?? "#888", border: `1px solid ${(STATUS_COLORS[status] ?? "#888")}44`, fontWeight: 800 }}
          />
          {item.category && <Chip label={item.category} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: "#A84D48", fontWeight: 700 }} />}
          {item.listing_type && <Chip label={LISTING_TYPE_LABELS[item.listing_type] ?? item.listing_type} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: isDark ? "#B8BABD" : "#6b6b6b", fontWeight: 700 }} />}
        </Box>

        {dateLine && (
          <Typography variant="caption" color={isDark ? "#818384" : "text.secondary"} fontWeight={600} sx={{ display: "block", mb: 2 }}>
            {dateLine}
            {item.locations?.name ? ` · ${item.locations.name}` : ""}
          </Typography>
        )}

        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>DESCRIPTION</Typography>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} lineHeight={1.65} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
            {item.description || "No description provided."}
          </Typography>
        </Box>

        {status === "pending" && (
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, background: isDark ? "#232324" : "#fdf7f7", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc" }}>
            <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", textAlign: "center", mb: 1.5 }}>
              4-DIGIT PICKUP PIN
            </Typography>
            <Box sx={{ display: "flex", justifyContent: "center", gap: 1.25, mb: 1 }}>
              {digits.map((d, i) => (
                <Box
                  key={i}
                  component="input"
                  ref={(el) => (inputs.current[i] = el)}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  inputMode="numeric"
                  autoComplete="off"
                  aria-label={`PIN digit ${i + 1}`}
                  sx={{
                    width: 54, height: 64, textAlign: "center", fontSize: 30, fontWeight: 800,
                    borderRadius: 2, outline: "none",
                    color: isDark ? "#FF4500" : "#A84D48",
                    background: isDark ? "#2D2D2E" : "#fff",
                    border: `2px solid ${error ? "#dc2626" : isDark ? "rgba(255,255,255,0.2)" : "#e0d8d8"}`,
                    "&:focus": { borderColor: isDark ? "#FF4500" : "#A84D48" },
                  }}
                />
              ))}
            </Box>
            {error
              ? <Typography variant="caption" sx={{ color: "#dc2626", fontWeight: 700, display: "block", textAlign: "center", mb: 1 }}>{error}</Typography>
              : <Typography variant="caption" color={isDark ? "#818384" : "text.secondary"} sx={{ display: "block", textAlign: "center", mb: 1 }}>
                  The owner must show this code to verify their ownership.
                </Typography>
            }
            <Box sx={{ display: "flex", gap: 1.5, mt: 1 }}>
              <Button fullWidth variant="outlined" onClick={onClose}
                sx={{ borderColor: isDark ? "rgba(255,255,255,0.2)" : "#ecdcdc", color: isDark ? "#B8BABD" : "#6b6b6b", fontWeight: 800, borderRadius: 2 }}>
                Cancel
              </Button>
              <Button fullWidth variant="contained" disabled={!canVerify} onClick={handleVerify}
                startIcon={verifying ? <CircularProgress size={16} color="inherit" /> : null}
                sx={{ background: isDark ? "#FF4500" : "#A84D48", "&:hover": { background: isDark ? "#E03D00" : "#8f3e3a" }, fontWeight: 800, borderRadius: 2 }}>
                {verifying ? "Verifying…" : "Verify code"}
              </Button>
            </Box>
          </Paper>
        )}

        {status === "unclaimed" && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 1, borderRadius: 1.5, background: isDark ? "#3a2f22" : "#fff3cd", border: isDark ? "1px solid rgba(245,158,11,0.5)" : "1px solid #ffc107" }}>
            <Typography variant="caption" sx={{ color: isDark ? "#f6c66a" : "#7d4e00", fontWeight: 600, lineHeight: 1.4 }}>
              No owner has claimed this item yet. Once the owner designates it in the app, it moves to Pending and a pickup PIN appears.
            </Typography>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
