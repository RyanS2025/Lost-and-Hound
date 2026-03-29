import { useState } from "react";
import { supabase } from "../supabaseClient";
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link as MuiLink,
} from "@mui/material";
import LockResetIcon from "@mui/icons-material/LockReset";
import Avatar from "@mui/material/Avatar";
import { useNavigate } from "react-router-dom";

// --- ForgotPasswordPage Component: Handles password reset requests ---
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

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
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
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
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #f44336 0%, #913c36 40%, #2a1f24 100%)",
        px: 2,
      }}
    >
      <Container component="main" maxWidth="xs">
        <Paper
          elevation={6}
          sx={{
            p: 4,
            width: "100%",
            borderRadius: 3,
            backgroundColor: "rgba(255,255,255,0.95)",
            boxShadow: "0px 10px 30px rgba(0,0,0,0.15)",
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", mb: 2 }}>
            <Avatar sx={{ m: 1, bgcolor: "primary.main" }}>
              <LockResetIcon />
            </Avatar>
            <Typography component="h1" variant="h4" gutterBottom>
              Lost &amp; Hound
            </Typography>
            <Typography component="h2" variant="h5">
              Reset Password
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: "center" }}>
              Enter your Northeastern email and we'll send you a link to reset your password.
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              placeholder="you@northeastern.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitted}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={submitted}
            >
              {submitted ? "Email Sent!" : "Send Reset Link"}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {message && (
            <Alert severity="success" sx={{ mt: 2 }}>
              {message}
            </Alert>
          )}

          <Box sx={{ mt: 2, textAlign: "center" }}>
            <MuiLink
              component="button"
              variant="body2"
              onClick={() => navigate("/login")}
              sx={{ cursor: "pointer" }}
            >
              Back to Log In
            </MuiLink>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}
