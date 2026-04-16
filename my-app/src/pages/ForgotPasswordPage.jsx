import { useState } from "react";
import { supabase } from "../../backend/supabaseClient";
import {
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link as MuiLink,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useNavigate } from "react-router-dom";

export default function ForgotPasswordPage({ effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const BRAND = {
    accent: isDark ? "#FF4500" : "#A84D48",
    accentHover: isDark ? "#E03D00" : "#8f3e3a",
    bg: isDark ? "#030303" : "#f5f0f0",
    dot: isDark ? "rgba(255,255,255,0.12)" : "#c9a6a6",
    paper: isDark ? "#1A1A1B" : "#fff",
    border: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc",
    title: isDark ? "#D7DADC" : "#3d2020",
    inputBg: isDark ? "#2D2D2E" : "#fff",
    inputBorder: isDark ? "rgba(255,255,255,0.2)" : "#d8c8c8",
    inputBorderHover: isDark ? "rgba(255,255,255,0.35)" : "#caa8a8",
    inputText: isDark ? "#D7DADC" : "#2d2d2d",
    autofillBg: isDark ? "#3b312b" : "#fff8f7",
  };

  const textFieldSx = {
    "& .MuiOutlinedInput-root": {
      backgroundColor: BRAND.inputBg,
      color: BRAND.inputText,
      "& .MuiOutlinedInput-notchedOutline": {
        borderColor: BRAND.inputBorder,
      },
      "&:hover .MuiOutlinedInput-notchedOutline": {
        borderColor: BRAND.inputBorderHover,
      },
      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
        borderColor: BRAND.accent,
        borderWidth: "1px",
      },
      "& input:-webkit-autofill": {
        WebkitBoxShadow: `0 0 0 1000px ${BRAND.autofillBg} inset`,
        WebkitTextFillColor: BRAND.inputText,
        caretColor: BRAND.inputText,
        borderRadius: "inherit",
      },
    },
    "& .MuiInputLabel-root": {
      color: isDark ? "#A9AAAB" : "inherit",
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: BRAND.accent,
    },
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (!email.endsWith("@northeastern.edu")) {
      setError("You must use a @northeastern.edu email address.");
      return;
    }

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (resetError) throw resetError;
      setMessage("Password reset email sent! Check your Northeastern inbox.");
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(circle, ${BRAND.dot} 1px, transparent 1px)`,
        backgroundColor: BRAND.bg,
        backgroundSize: "24px 24px",
        pt: { xs: "calc(16px + env(safe-area-inset-top))", md: 4 },
        pb: { xs: "calc(16px + env(safe-area-inset-bottom))", md: 4 },
        px: { xs: 2, md: 4 },
        overflowX: "hidden",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 5 },
          maxWidth: 440,
          width: "100%",
          borderRadius: 4,
          background: BRAND.paper,
          border: `1.5px solid ${BRAND.border}`,
          boxShadow: isDark
            ? "0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)"
            : "0 12px 48px rgba(168, 77, 72, 0.28), 0 4px 16px rgba(0,0,0,0.1)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: isDark
                ? "rgba(255, 69, 0, 0.15)"
                : "rgba(168, 77, 72, 0.12)",
              mb: 2,
            }}
          >
            <LockResetIcon sx={{ fontSize: 28, color: BRAND.accent }} />
          </Box>
          <Typography
            variant="h5"
            fontWeight={800}
            sx={{ color: BRAND.title, mb: 0.5 }}
          >
            Reset Password
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", textAlign: "center", lineHeight: 1.6 }}
          >
            Enter your Northeastern email and we'll send you a link to reset
            your password.
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <TextField
            required
            fullWidth
            size="small"
            label="Email Address"
            placeholder="you@northeastern.edu"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitted}
            sx={{ ...textFieldSx, mb: 3 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            disabled={submitted}
            sx={{
              py: 1.25,
              background: BRAND.accent,
              "&:hover": { background: BRAND.accentHover },
              fontWeight: 700,
              borderRadius: 2,
              fontSize: 15,
              textTransform: "none",
            }}
          >
            {submitted ? "Email Sent!" : "Send Reset Link"}
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
            {error}
          </Alert>
        )}
        {message && (
          <Alert severity="success" sx={{ mt: 2, textAlign: "left" }}>
            {message}
            <Typography
              variant="caption"
              sx={{
                display: "block",
                mt: 1,
                color: "inherit",
                opacity: 0.85,
                lineHeight: 1.5,
              }}
            >
              Can't find it? Northeastern's email system may quarantine messages
              from new senders. Check your <strong>Junk/Spam</strong> folder, or
              visit{" "}
              <MuiLink
                href="https://security.microsoft.com/quarantine"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: "inherit", fontWeight: 700 }}
              >
                Microsoft 365 Quarantine
              </MuiLink>{" "}
              and release the email from there.
            </Typography>
          </Alert>
        )}

        <Box sx={{ mt: 2.5, textAlign: "center" }}>
          <MuiLink
            component="button"
            variant="body2"
            onClick={() => navigate("/")}
            sx={{
              cursor: "pointer",
              color: BRAND.accent,
              fontWeight: 600,
              textDecoration: "none",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            Back to Sign In
          </MuiLink>
        </Box>
      </Paper>
    </Box>
  );
}