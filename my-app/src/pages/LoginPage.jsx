import { useState, useRef, useEffect, useCallback } from "react";
import { supabase } from "../supabaseClient";
import {
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link as MuiLink,
} from "@mui/material";

/* ───────────────────────────────────────────
   Confetti canvas — lightweight, no deps
   ─────────────────────────────────────────── */
function ConfettiCanvas({ active }) {
  const canvasRef = useRef(null);
  const particles = useRef([]);
  const animFrame = useRef(null);

  const COLORS = [
    "#A84D48", "#e07a6e", "#f5c6c2", "#ffd700",
    "#ff6b6b", "#fff", "#7a2929", "#ffb347",
  ];

  const spawn = useCallback(() => {
    const arr = [];
    for (let i = 0; i < 150; i++) {
      arr.push({
        x: Math.random() * window.innerWidth,
        y: -20 - Math.random() * 200,
        w: 4 + Math.random() * 6,
        h: 8 + Math.random() * 10,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        vx: (Math.random() - 0.5) * 6,
        vy: 2 + Math.random() * 5,
        rotation: Math.random() * 360,
        rotSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        decay: 0.003 + Math.random() * 0.004,
      });
    }
    particles.current = arr;
  }, []);

  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    spawn();

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles.current) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.vy += 0.12;
        p.y += p.vy;
        p.rotation += p.rotSpeed;
        p.opacity -= p.decay;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) animFrame.current = requestAnimationFrame(loop);
    };
    animFrame.current = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animFrame.current);
  }, [active, spawn]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />
  );
}

/* ───────────────────────────────────────────
   Login page
   ─────────────────────────────────────────── */
export default function LoginPage({
  loginTransition = false,
  onLoginSuccess,
  effectiveTheme = "light",
}) {
  const isDark = effectiveTheme === "dark";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Refs to read Chrome's autofilled DOM values (Chrome bypasses onChange)
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Sync Chrome autofill into React state on mount.
  // Chrome fills the DOM directly without firing onChange, so React state
  // stays "". When user backspaces to empty, React re-renders with value=""
  // and Chrome re-fills — creating an un-clearable loop. Reading the DOM
  // value into state on mount breaks that cycle.
  useEffect(() => {
    const sync = () => {
      const eInput = emailRef.current?.querySelector("input");
      const pInput = passwordRef.current?.querySelector("input");
      if (eInput?.value && !email) setEmail(eInput.value);
      if (pInput?.value && !password) setPassword(pInput.value);
    };
    // Chrome autofills at unpredictable times, so poll a few times
    const t1 = setTimeout(sync, 100);
    const t2 = setTimeout(sync, 500);
    const t3 = setTimeout(sync, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Fade-out starts slightly after confetti
  const [fadeOut, setFadeOut] = useState(false);

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
    leftPanelGradient: isDark
      ? "linear-gradient(160deg, #1f252b 0%, #141619 100%)"
      : "linear-gradient(160deg, #A84D48 0%, #7a2929 100%)",
    leftPanelBody: isDark ? "rgba(215,218,220,0.74)" : "rgba(255,255,255,0.7)",
    leftPanelCaption: isDark ? "rgba(215,218,220,0.45)" : "rgba(255,255,255,0.4)",
  };

  const autofillTextFieldSx = {
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
      "& input:-webkit-autofill:hover": {
        WebkitBoxShadow: `0 0 0 1000px ${BRAND.autofillBg} inset`,
      },
      "& input:-webkit-autofill:focus": {
        WebkitBoxShadow: `0 0 0 1000px ${BRAND.autofillBg} inset`,
      },
      "& input:-webkit-autofill:active": {
        WebkitBoxShadow: `0 0 0 1000px ${BRAND.autofillBg} inset`,
      },
    },
    "& .MuiInputLabel-root": {
      color: isDark ? "#A9AAAB" : "inherit",
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: BRAND.accent,
    },
  };

  // When App tells us the transition is active (even on remount), start the fade
  useEffect(() => {
    if (loginTransition) {
      const timer = setTimeout(() => setFadeOut(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loginTransition]);

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
        onLoginSuccess?.();

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }
      }
    } catch (err) {
      setError(cleanErrorMessage(err.message || err.code));
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setMessage("");
    if (!email) {
      setError("Enter your email above first.");
      return;
    }
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
      if (resetError) throw resetError;
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError(cleanErrorMessage(err.message || err.code));
    }
  };

  return (
    <>
      <ConfettiCanvas active={loginTransition} />

      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `
            radial-gradient(circle, ${BRAND.dot} 1px, transparent 1px)
          `,
          backgroundColor: BRAND.bg,
          backgroundSize: "24px 24px",
          p: { xs: 2, md: 4 },
          transition: "opacity 0.8s ease, filter 0.8s ease",
          ...(fadeOut && {
            opacity: 0,
            filter: "blur(6px)",
          }),
        }}
      >
        <Paper
          elevation={0}
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            maxWidth: 880,
            width: "100%",
            borderRadius: 4,
            overflow: "hidden",
            background: BRAND.paper,
            border: `1.5px solid ${BRAND.border}`,
            boxShadow:
              isDark
                ? "0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.35)"
                : "0 12px 48px rgba(168, 77, 72, 0.28), 0 4px 16px rgba(0,0,0,0.1)",
            transition: "transform 0.7s cubic-bezier(.4,0,.2,1), box-shadow 0.7s ease",
            ...(loginTransition && {
              transform: "scale(1.02)",
              boxShadow:
                isDark
                  ? "0 16px 64px rgba(0,0,0,0.58), 0 4px 16px rgba(0,0,0,0.35)"
                  : "0 16px 64px rgba(168, 77, 72, 0.25), 0 4px 16px rgba(0,0,0,0.08)",
            }),
          }}
        >
          {/* --- Left panel: branding --- */}
          <Box
            sx={{
              flex: 1,
              p: { xs: 4, md: 5 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              background: BRAND.leftPanelGradient,
              position: "relative",
              overflow: "hidden",
              minHeight: { xs: 200, md: "auto" },
            }}
          >
            <Box
              sx={{
                position: "absolute",
                width: 300,
                height: 300,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
                bottom: -80,
                right: -80,
                pointerEvents: "none",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                width: 200,
                height: 200,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)",
                top: -60,
                left: -60,
                pointerEvents: "none",
              }}
            />

            <Box
              sx={{
                position: "relative",
                zIndex: 1,
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Box
                component="img"
                src="/MainLogoTextAlt.png"
                alt="Lost & Hound"
                sx={{
                  width: { xs: "76%", md: "82%" },
                  maxWidth: 300,
                  minWidth: 180,
                  height: "auto",
                  objectFit: "contain",
                  display: "block",
                  mb: 3,
                }}
              />
            </Box>

            <Box sx={{ position: "relative", zIndex: 1 }}>
              <Typography
                sx={{
                  fontSize: { xs: 22, md: 28 },
                  fontWeight: 800,
                  color: "#fff",
                  lineHeight: 1.3,
                  mb: 1.5,
                }}
              >
                Find What's Lost,
                <br />
                Help What's Found
              </Typography>
              <Typography
                variant="body2"
                sx={{ color: BRAND.leftPanelBody, lineHeight: 1.6 }}
              >
                Northeastern's community-powered lost & found platform.
              </Typography>
            </Box>

            <Typography
              variant="caption"
              sx={{
                color: BRAND.leftPanelCaption,
                mt: 4,
                position: "relative",
                zIndex: 1,
              }}
            >
              Made for Oasis @ Northeastern
            </Typography>
          </Box>

          {/* --- Right panel: form --- */}
          <Box
            sx={{
              flex: 1,
              p: { xs: 3, md: 5 },
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            {loginTransition ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  py: 8,
                  animation: "popIn 0.4s cubic-bezier(.175,.885,.32,1.275) forwards",
                  "@keyframes popIn": {
                    "0%": { opacity: 0, transform: "scale(0.8)" },
                    "100%": { opacity: 1, transform: "scale(1)" },
                  },
                }}
              >
                <Typography
                  sx={{ fontSize: 48, mb: 1, lineHeight: 1 }}
                  role="img"
                  aria-label="party"
                >
                  🎉
                </Typography>
                <Typography
                  variant="h5"
                  fontWeight={800}
                  sx={{ color: BRAND.title, mb: 0.5 }}
                >
                  Welcome back!
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Signing you in…
                </Typography>
              </Box>
            ) : (
              <>
                <Typography
                  variant="h5"
                  fontWeight={800}
                  sx={{ color: BRAND.title, mb: 0.5 }}
                >
                  {isSignUp ? "Create an account" : "Sign in"}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary", mb: 3 }}
                >
                  {isSignUp
                    ? "Already have an account?"
                    : "Don't have an account?"}{" "}
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
                    sx={{
                      cursor: "pointer",
                      color: BRAND.accent,
                      fontWeight: 700,
                      textDecoration: "none",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {isSignUp ? "Log In" : "Sign Up"}
                  </MuiLink>
                </Typography>

                <Box component="form" onSubmit={handleSubmit} noValidate>
                  {isSignUp && (
                    <Box sx={{ display: "flex", gap: 1.5, mb: 1.5 }}>
                      <TextField
                        required
                        fullWidth
                        size="small"
                        label="First Name"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        sx={autofillTextFieldSx}
                      />
                      <TextField
                        required
                        fullWidth
                        size="small"
                        label="Last Name"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        sx={autofillTextFieldSx}
                      />
                    </Box>
                  )}

                  <TextField
                    ref={emailRef}
                    required
                    fullWidth
                    size="small"
                    label="Email"
                    placeholder="you@northeastern.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    autoFocus
                    sx={{ ...autofillTextFieldSx, mb: 1.5 }}
                  />

                  <TextField
                    ref={passwordRef}
                    required
                    fullWidth
                    size="small"
                    label="Password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    inputProps={{ minLength: 6 }}
                    sx={{ ...autofillTextFieldSx, mb: 3 }}
                  />

                  <Button
                    type="submit"
                    fullWidth
                    variant="contained"
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
                    {isSignUp ? "Create account" : "Sign in"}
                  </Button>
                </Box>

                {!isSignUp && (
                  <MuiLink
                    component="button"
                    variant="body2"
                    onClick={handleForgotPassword}
                    sx={{
                      cursor: "pointer",
                      color: BRAND.accent,
                      fontWeight: 600,
                      display: "block",
                      mt: 2,
                      textAlign: "center",
                    }}
                  >
                    Forgot password?
                  </MuiLink>
                )}

                {error && (
                  <Alert severity="error" sx={{ mt: 2, textAlign: "left" }}>
                    {error}
                  </Alert>
                )}
                {message && (
                  <Alert severity="success" sx={{ mt: 2, textAlign: "left" }}>
                    {message}
                  </Alert>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Box>
    </>
  );
}

function cleanErrorMessage(errorMsg) {
  if (!errorMsg) return "Something went wrong. Please try again.";
  if (errorMsg.toLowerCase().includes("user already registered"))
    return "An account with this email already exists.";
  if (errorMsg.toLowerCase().includes("email already registered"))
    return "An account with this email already exists.";
  if (errorMsg.includes("Invalid login credentials"))
    return "Incorrect email or password.";
  if (errorMsg.includes("user not found"))
    return "No account found with this email.";
  if (errorMsg.includes("6 characters"))
    return "Password must be at least 6 characters.";
  if (errorMsg.includes("rate limit"))
    return "Too many attempts. Please try again later.";
  if (errorMsg.includes("valid email"))
    return "Please enter a valid email address.";
  return errorMsg;
}