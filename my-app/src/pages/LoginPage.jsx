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
  useTheme
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Avatar from "@mui/material/Avatar";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const theme = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email.endsWith("@northeastern.edu")) {
      setError("You must use a @northeastern.edu email address.");
      return;
    }

    if (isSignUp && (!firstName.trim() || !lastName.trim())) {
      setError("Please enter your first and last name.");
      return;
    }

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
            },
          },
        });

        if (signUpError) {
          setError(cleanErrorMessage(signUpError.message || signUpError.code || "Unknown error"));
          return;
        }

        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError("An account with this email already exists.");
          return;
        }

        setMessage("Account created! Check your Northeastern email for a verification link.");
        setFirstName("");
        setLastName("");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(cleanErrorMessage(err.message || err.code));
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
              <LockOutlinedIcon />
            </Avatar>
            <Typography component="h1" variant="h4" gutterBottom>
              Lost & Hound
            </Typography>
            <Typography component="h2" variant="h5">
              {isSignUp ? "Sign Up" : "Log In"}
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            {isSignUp && (
              <>
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <TextField
                  margin="normal"
                  required
                  fullWidth
                  label="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </>
            )}

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
            />

            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              inputProps={{ minLength: 6 }}
            />

            <Button type="submit" fullWidth variant="contained" sx={{ mt: 3, mb: 2 }}>
              {isSignUp ? "Sign Up" : "Log In"}
            </Button>
          </Box>

          {!isSignUp && (
            <Box sx={{ textAlign: "center" }}>
              <MuiLink
                component="button"
                variant="body2"
                onClick={() => navigate("/forgot-password")}
                sx={{ cursor: "pointer" }}
              >
                Forgot password?
              </MuiLink>
            </Box>
          )}

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
            <Typography variant="body2" component="span">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            </Typography>
            <MuiLink
              component="button"
              variant="body2"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError("");
                setMessage("");
                setFirstName("");
                setLastName("");
              }}
              sx={{ cursor: "pointer" }}
            >
              {isSignUp ? "Log In" : "Sign Up"}
            </MuiLink>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}

function cleanErrorMessage(errorMsg) {
  if (!errorMsg) return "Something went wrong. Please try again.";
  if (errorMsg.toLowerCase().includes("user already registered")) return "An account with this email already exists.";
  if (errorMsg.toLowerCase().includes("email already registered")) return "An account with this email already exists.";
  if (errorMsg.includes("Invalid login credentials")) return "Incorrect email or password.";
  if (errorMsg.includes("user not found")) return "No account found with this email.";
  if (errorMsg.includes("6 characters")) return "Password must be at least 6 characters.";
  if (errorMsg.includes("rate limit")) return "Too many attempts. Please try again later.";
  if (errorMsg.includes("valid email")) return "Please enter a valid email address.";
  return errorMsg;
}