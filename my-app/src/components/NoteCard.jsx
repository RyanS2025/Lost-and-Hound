import { useState, useEffect } from "react";
import { Box, Typography, Paper, IconButton } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";

const ACCENT = "#A84D48";

export default function NoteCard({ storageKey, title, description }) {
  const [visible, setVisible] = useState(false);
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  useEffect(() => {
    const dismissed = localStorage.getItem(`demo_note_${storageKey}`);
    if (!dismissed) setVisible(true);
    else setVisible(false);
  }, [storageKey]);

  const dismiss = () => {
    localStorage.setItem(`demo_note_${storageKey}`, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Paper
      elevation={4}
      sx={{
        position: "fixed",
        // Sit above the footer (46px) with 8px gap, plus safe area inset
        bottom: { xs: "calc(54px + env(safe-area-inset-bottom))", sm: "calc(60px + env(safe-area-inset-bottom))" },
        right: { xs: 12, sm: 20 },
        zIndex: 1300,
        maxWidth: { xs: "calc(100vw - 24px)", sm: 300 },
        borderRadius: 3,
        p: 2,
        border: `1.5px solid ${ACCENT}`,
        background: isDark ? "#1A1A1B" : "#fff",
        boxShadow: isDark ? "0 8px 32px rgba(0,0,0,0.45)" : "0 8px 32px rgba(168,77,72,0.18)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 0.5 }}>
        <LightbulbOutlinedIcon sx={{ color: ACCENT, fontSize: 20, mt: 0.2, flexShrink: 0 }} />
        <Typography fontWeight={700} fontSize={14} sx={{ color: isDark ? "#D7DADC" : "#2d2d2d", flex: 1 }}>
          {title}
        </Typography>
        <IconButton size="small" onClick={dismiss} sx={{ color: isDark ? "#818384" : "#999", p: 0, ml: 0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Typography variant="body2" sx={{ color: isDark ? "#B8BABD" : "#555", lineHeight: 1.5, pl: "28px" }}>
        {description}
      </Typography>
    </Paper>
  );
}
