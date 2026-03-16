import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography, Button } from "@mui/material";

export default function NotFoundPage({ effectiveTheme = "light" }) {
  const navigate = useNavigate();
  const isDark = effectiveTheme === "dark";
  const pageBg = isDark ? "#101214" : "#f9f5f4";
  const pageDot = isDark ? "rgba(255,255,255,0.07)" : "rgba(122,41,41,0.18)";
  return (
    <>
      <Box sx={{
        position: "fixed",
        inset: 0,
        zIndex: -1,
        backgroundColor: pageBg,
        backgroundImage: `radial-gradient(circle, ${pageDot} 1px, transparent 1px)`,
        backgroundSize: "24px 24px",
      }}>
      </Box>
      <Box sx={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "calc(100dvh - 100px)", p: { xs: 1.5, sm: 3 },
        boxSizing: "border-box",
      }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 }, pt: 0, borderRadius: 3, textAlign: "center", maxWidth: 380, width: "100%",
          border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc",
          overflow: "visible",
          boxShadow: isDark
            ? "0 10px 36px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.3)"
            : "0 8px 32px rgba(168, 77, 72, 0.13), 0 2px 8px rgba(0,0,0,0.07)",
          background: isDark ? "#1A1A1B" : "#fff",
        }}
      >
        <Box
          component="img"
          src="/404Image.png"
          alt="Lost husky"
          sx={{
            width: "100%", maxWidth: 260, mx: "auto", display: "block",
            mt: -6, mb: -2,
          }}
        />
        <Typography variant="h3" fontWeight={900} sx={{ mb: 0.5, color: isDark ? "#D7DADC" : "#3d2020" }}>
          404
        </Typography>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: isDark ? "#D7DADC" : "#3d2020" }}>
          Page not found
        </Typography>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} sx={{ mb: 3 }}>
          The page you're looking for doesn't exist or has been moved.
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate("/")}
          sx={{
            background: "#A84D48", "&:hover": { background: "#8f3e3a" },
            fontWeight: 700, borderRadius: 2, px: 4,
          }}
        >
          GO HOME
        </Button>
      </Paper>
      </Box>
    </>
  );
}