import { useState, useEffect, useRef } from "react";
import {
  Box, Typography, Paper, Button, Modal, IconButton, TextField, InputAdornment, CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import apiFetch from "../utils/apiFetch";

/**
 * Lets a proctor confirm receipt of a found item a finder just handed in at the desk.
 * Lists found listings not yet received anywhere; "Receive" stamps it to this proctor's desk.
 */
export default function ReceiveItemModal({ open, onClose, onReceived, isDark = false }) {
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [receivingId, setReceivingId] = useState(null);
  const [error, setError] = useState("");

  // Debounced fetch of receivable items whenever the modal is open / search changes
  const debounce = useRef();
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
        const d = await apiFetch(`/api/proctor/receivable${q}`);
        setItems(d?.items || []);
      } catch (err) {
        setError(err?.message || "Could not load items.");
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [open, search]);

  // Reset transient state when the modal closes
  useEffect(() => {
    if (!open) { setSearch(""); setItems([]); setError(""); }
  }, [open]);

  const handleReceive = async (item) => {
    setReceivingId(item.item_id);
    setError("");
    try {
      await apiFetch(`/api/proctor/items/${item.item_id}/receive`, { method: "POST" });
      setItems((prev) => prev.filter((i) => i.item_id !== item.item_id));
      onReceived?.(item.item_id);
    } catch (err) {
      setError(err?.message || "Could not receive this item.");
    } finally {
      setReceivingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}>
      <Box sx={{
        background: isDark ? "#1A1A1B" : "#fff", borderRadius: 4, p: "26px", maxWidth: 560,
        maxHeight: "90dvh", overflowY: "auto", outline: "none",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
        boxSizing: "border-box",
        width: { xs: "calc(100% - 32px)", sm: "100%" },
        display: "flex", flexDirection: "column",
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={900}>Receive an item</Typography>
            <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>
              Confirm a found item a finder dropped off at your desk.
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}><CloseIcon /></IconButton>
        </Box>

        <TextField
          fullWidth size="small" placeholder="Search found items by name…"
          value={search} onChange={(e) => setSearch(e.target.value)} autoFocus
          sx={{ my: 1.5 }}
          InputProps={{
            startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: isDark ? "#B8BABD" : "#a07070" }} /></InputAdornment>,
            sx: { background: isDark ? "#2D2D2E" : "#fff", color: isDark ? "#D7DADC" : "inherit" },
          }}
        />

        {error && (
          <Typography variant="caption" sx={{ color: "#dc2626", fontWeight: 700, mb: 1 }}>{error}</Typography>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={26} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} /></Box>
        ) : items.length === 0 ? (
          <Typography variant="body2" color={isDark ? "#818384" : "text.secondary"} sx={{ textAlign: "center", py: 4 }}>
            No found items waiting to be received.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {items.map((item) => (
              <Paper key={item.item_id} variant="outlined" sx={{ p: 1.25, borderRadius: 2, display: "flex", alignItems: "center", gap: 1.5, background: isDark ? "#232324" : "#fdf7f7", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc" }}>
                {item.image_url
                  ? <Box component="img" src={item.image_url} alt={item.title} sx={{ width: 48, height: 48, objectFit: "cover", borderRadius: 1.5, flexShrink: 0 }} />
                  : <Box sx={{ width: 48, height: 48, borderRadius: 1.5, flexShrink: 0, background: isDark ? "#2D2D2E" : "#ede8e8" }} />
                }
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={800} fontSize={14} noWrap>{item.title}</Typography>
                  <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600} noWrap sx={{ display: "block" }}>
                    {item.poster_name}{item.locations?.name ? ` · ${item.locations.name}` : ""}
                  </Typography>
                </Box>
                <Button
                  variant="contained" size="small" disabled={receivingId === item.item_id}
                  onClick={() => handleReceive(item)}
                  startIcon={receivingId === item.item_id ? <CircularProgress size={14} color="inherit" /> : null}
                  sx={{ flexShrink: 0, background: isDark ? "#FF4500" : "#A84D48", "&:hover": { background: isDark ? "#E03D00" : "#8f3e3a" }, fontWeight: 800, borderRadius: 2 }}
                >
                  Receive
                </Button>
              </Paper>
            ))}
          </Box>
        )}
      </Box>
    </Modal>
  );
}
