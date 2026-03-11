import { useNavigate } from "react-router-dom";
import { Box, Paper, Typography, Button } from "@mui/material";

export default function NotFoundPage() {
  const navigate = useNavigate();
  return (
      <Box sx={{
        display: "flex", justifyContent: "center", alignItems: "center",
        minHeight: "calc(100vh - 140px)", p: 3,
        background: "radial-gradient(circle, #d4b5b5 1px, transparent 1px)",
        backgroundColor: "#f5f0f0",
        backgroundSize: "24px 24px",
      }}>
      <Paper
        elevation={0}
        sx={{
          p: 4, pt: 0, borderRadius: 3, textAlign: "center", maxWidth: 380,
          border: "1.5px solid #ecdcdc", overflow: "visible",
          boxShadow: "0 8px 32px rgba(168, 77, 72, 0.13), 0 2px 8px rgba(0,0,0,0.07)",
          background: "#fff",
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
        <Typography variant="h3" fontWeight={900} sx={{ mb: 0.5, color: "#3d2020" }}>
          404
        </Typography>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1, color: "#3d2020" }}>
          Page not found
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
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
  );
}