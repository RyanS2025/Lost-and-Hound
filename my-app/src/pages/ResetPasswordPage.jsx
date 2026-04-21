import { useState } from "react";
import { supabase } from "../../backend/supabaseClient";
import { API_BASE } from "../utils/apiFetch";
import { dismissKeyboardOnEnter } from "../utils/keyboard";
import {
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link as MuiLink,
  IconButton,
  InputAdornment,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { useNavigate } from "react-router-dom";

const PASSWORD_MAX_LENGTH = 32;
const PASSWORD_MIN_LENGTH = 6;

export default function ResetPasswordPage({ effectiveTheme = "light", onComplete }) {
  const isDark = effectiveTheme === "dark";
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

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

    if (!password) {
      setError("Please enter a new password.");
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (password.length > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Session expired. Please request a new reset link.");
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Request failed");
      setSuccess(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
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
            Set New Password
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", textAlign: "center", lineHeight: 1.6 }}
          >
            {success
              ? "Your password has been updated successfully."
              : "Enter your new password below."}
          </Typography>
        </Box>

        {!success ? (
          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              required
              fullWidth
              size="small"
              label="New Password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
              inputProps={{ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH }}
              onKeyDown={dismissKeyboardOnEnter}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((v) => !v)}
                        edge="end"
                        size="small"
                        sx={{ color: isDark ? "#A9AAAB" : "inherit" }}
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ ...textFieldSx, mb: 2 }}
            />

            <TextField
              required
              fullWidth
              size="small"
              label="Confirm Password"
              type={showConfirm ? "text" : "password"}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
              inputProps={{ minLength: PASSWORD_MIN_LENGTH, maxLength: PASSWORD_MAX_LENGTH }}
              onKeyDown={dismissKeyboardOnEnter}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirm((v) => !v)}
                        edge="end"
                        size="small"
                        sx={{ color: isDark ? "#A9AAAB" : "inherit" }}
                      >
                        {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              sx={{ ...textFieldSx, mb: 3 }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={loading}
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
              {loading ? "Updating..." : "Update Password"}
            </Button>
          </Box>
        ) : (
          <Button
            fullWidth
            variant="contained"
            onClick={() => onComplete ? onComplete() : navigate("/")}
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
            Back to Sign In
          </Button>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mt: 2, textAlign: "left" }}>
            You can now sign in with your new password.
          </Alert>
        )}

        {!success && (
          <Box sx={{ mt: 2.5, textAlign: "center" }}>
            <MuiLink
              component="button"
              variant="body2"
              onClick={() => onComplete ? onComplete() : navigate("/")}
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
        )}
      </Paper>
    </Box>
  );
}
