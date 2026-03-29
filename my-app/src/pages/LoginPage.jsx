import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../backend/supabaseClient";
import {
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  Link as MuiLink,
  Checkbox,
  FormControlLabel,
  CircularProgress,
  LinearProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import TermsModal from "../components/TermsModal";
import apiFetch from "../utils/apiFetch";

const NAME_MAX_LENGTH = 25;
const PASSWORD_MAX_LENGTH = 32;

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
  onLoginCancel,
  effectiveTheme = "light",
}) {
  const isDark = effectiveTheme === "dark";
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // 2FA state
  const [authStep, setAuthStep] = useState("credentials"); // "credentials" | "mfa"
  const [otpCode, setOtpCode] = useState("");
  const [rememberDevice, setRememberDevice] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState("");
  const [mfaChallengeId, setMfaChallengeId] = useState("");
  const [mfaQrCodeSvg, setMfaQrCodeSvg] = useState("");
  const [mfaUri, setMfaUri] = useState("");
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaVerifying, setMfaVerifying] = useState(false);

  // Terms modal state
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Refs to read Chrome's autofilled DOM values (Chrome bypasses onChange)
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  // Sync Chrome autofill into React state on mount.
  useEffect(() => {
    const sync = () => {
      const eInput = emailRef.current?.querySelector("input");
      const pInput = passwordRef.current?.querySelector("input");
      if (eInput?.value && !email) setEmail(eInput.value);
      if (pInput?.value && !password) setPassword(pInput.value);
    };
    const t1 = setTimeout(sync, 100);
    const t2 = setTimeout(sync, 500);
    const t3 = setTimeout(sync, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    if (loginTransition) {
      const timer = setTimeout(() => setFadeOut(true), 400);
      return () => clearTimeout(timer);
    }
  }, [loginTransition]);

  // Reset terms accepted when switching between sign-up and sign-in
  useEffect(() => {
    setTermsAccepted(false);
  }, [isSignUp]);

  const doSignUp = async () => {
    try {
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

      setMessage("SIGNUP_SUCCESS");
      setFirstName("");
      setLastName("");
    } catch (err) {
      setError(cleanErrorMessage(err.message || err.code));
    }
  };

  const startMfaFlow = async (existingFactorsData = null) => {
    let factorsData = existingFactorsData;
    if (!factorsData) {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      factorsData = data;
    }

    const totpFactors =
      factorsData?.all?.filter((f) => f.factor_type === "totp") ||
      factorsData?.totp ||
      [];
    const verifiedFactor = totpFactors.find((f) => f.status === "verified") || null;

    if (verifiedFactor?.id) {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: verifiedFactor.id,
      });
      if (challengeError) throw challengeError;

      setMfaFactorId(verifiedFactor.id);
      setMfaChallengeId(challengeData.id);
      setMfaQrCodeSvg("");
      setMfaUri("");
      setOtpCode("");
      setAuthStep("mfa");
      setMessage("Open your authenticator app and enter the current 6-digit code.");
      return;
    }

    // If only unverified factors exist, remove them and create a fresh enrollment
    // so the user always gets a valid QR setup screen.
    for (const factor of totpFactors) {
      if (factor?.id) {
        await supabase.auth.mfa.unenroll({ factorId: factor.id }).catch(() => null);
      }
    }

    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      // Use a unique friendly name to avoid duplicate-name conflicts.
      friendlyName: `Lost & Hound ${new Date().toISOString().slice(0, 10)}`,
    });
    if (enrollError) throw enrollError;

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: enrollData.id,
    });
    if (challengeError) throw challengeError;

    setMfaFactorId(enrollData.id);
    setMfaChallengeId(challengeData.id);
    setMfaQrCodeSvg(enrollData.totp?.qr_code || "");
    setMfaUri(enrollData.totp?.uri || "");
    setOtpCode("");
    setAuthStep("mfa");
    setMessage("Set up your authenticator app, then enter the 6-digit code to complete login.");
  };

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

    if (isSignUp && (firstName.trim().length > NAME_MAX_LENGTH || lastName.trim().length > NAME_MAX_LENGTH)) {
      setError(`First and last name must be ${NAME_MAX_LENGTH} characters or fewer.`);
      return;
    }

    if (password.length > PASSWORD_MAX_LENGTH) {
      setError(`Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);
      return;
    }

    try {
      if (isSignUp) {
        // Show terms modal first — sign-up happens after acceptance
        if (!termsAccepted) {
          setTermsOpen(true);
          return;
        }
        await doSignUp();
      } else {
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (signInError) {
            throw signInError;
          }

          // Force MFA setup when no verified factor exists, regardless of old trusted devices.
          const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors();
          if (factorsError) throw factorsError;

          const hasVerifiedTotp =
            (factorsData?.all || []).some((f) => f.factor_type === "totp" && f.status === "verified") ||
            (factorsData?.totp || []).some((f) => f.status === "verified");

          if (!hasVerifiedTotp) {
            setMfaLoading(true);
            try {
              await startMfaFlow(factorsData);
            } catch (mfaErr) {
              setError(mfaErr.message || "Failed to start MFA. Please try again.");
              await supabase.auth.signOut();
            } finally {
              setMfaLoading(false);
            }
            return;
          }

          // 2FA gate: check whether this device is already trusted
          let deviceTrusted = false;
          if (signInData?.session?.access_token) {
            try {
              const checkData = await apiFetch("/api/auth/check-device", {
                method: "POST",
              });
              deviceTrusted = checkData?.trusted === true;
            } catch {
              deviceTrusted = false;
            }
          }

          if (deviceTrusted) {
            // Already trusted — proceed straight into the app
            onLoginSuccess?.();
          } else {
            // Device not trusted — start Supabase MFA challenge/enrollment flow.
            setMfaLoading(true);
            try {
              await startMfaFlow();
            } catch (mfaErr) {
              setError(mfaErr.message || "Failed to start MFA. Please try again.");
              // Sign the user out so they aren't partially authenticated
              await supabase.auth.signOut();
            } finally {
              setMfaLoading(false);
            }
          }
        }
    } catch (err) {
      setError(cleanErrorMessage(err.message || err.code));
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Please enter a valid 6-digit authenticator code.");
      return;
    }
    if (!mfaFactorId || !mfaChallengeId) {
      setError("MFA challenge is missing. Please go back and sign in again.");
      return;
    }

    setMfaVerifying(true);
    try {
      onLoginSuccess?.();

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: otpCode,
      });
      if (verifyError) throw verifyError;

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) throw new Error("Session expired. Please sign in again.");

      const trustResult = await apiFetch("/api/auth/trust-device", {
        method: "POST",
        body: JSON.stringify({ rememberDevice }),
      });
      if (trustResult?.deviceToken) {
        localStorage.setItem("device_token", trustResult.deviceToken);
      }
    } catch (err) {
      onLoginCancel?.();
      setError(err.message || "Verification failed. Please try again.");
    } finally {
      setMfaVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setError("");
    setMessage("");
    if (!mfaFactorId) {
      setError("No MFA factor found. Please go back and sign in again.");
      return;
    }
    setMfaLoading(true);
    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: mfaFactorId,
      });
      if (challengeError) throw challengeError;
      setMfaChallengeId(challengeData.id);
      setMessage("Challenge refreshed. Enter the current code from your authenticator app.");
      setOtpCode("");
    } catch (err) {
      setError(err.message || "Failed to refresh MFA challenge");
    } finally {
      setMfaLoading(false);
    }
  };

  const isSvgMarkup = typeof mfaQrCodeSvg === "string" && mfaQrCodeSvg.trim().startsWith("<svg");
  const isDataUri = typeof mfaQrCodeSvg === "string" && mfaQrCodeSvg.trim().startsWith("data:image");
  const qrImgSrc = !mfaQrCodeSvg
    ? ""
    : isDataUri
      ? mfaQrCodeSvg
      : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(mfaQrCodeSvg)}`;

  return (
    <>
      <ConfettiCanvas active={loginTransition} />

      <Box
        sx={{
          minHeight: "100dvh",
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
              position: "relative",
            }}
          >
            {/* Loading bar — shown while MFA is being set up */}
            <LinearProgress
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                borderRadius: "0 0 12px 12px",
                height: 3,
                opacity: mfaLoading ? 1 : 0,
                transition: "opacity 0.3s ease",
                "& .MuiLinearProgress-bar": {
                  background: `linear-gradient(90deg, ${BRAND.accent}, ${BRAND.accentHover})`,
                },
                backgroundColor: "transparent",
              }}
            />
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
            ) : authStep === "mfa" ? (
              /* ── Supabase authenticator MFA step ── */
              <Box component="form" onSubmit={handleOtpSubmit} noValidate>
                <Typography variant="h5" fontWeight={800} sx={{ color: BRAND.title, mb: 0.5 }}>
                  {mfaQrCodeSvg ? "Set up your authenticator app" : "Enter authenticator code"}
                </Typography>
                <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                  {mfaQrCodeSvg
                    ? "Scan the QR code in your authenticator app (Duo is highly recommended) then enter the 6-digit code below."
                    : "Use the 6-digit code from your authenticator app to finish signing in."}
                </Typography>

                {mfaQrCodeSvg && (
                  <Box sx={{ mb: 2, display: "flex", justifyContent: "center" }}>
                    {isSvgMarkup ? (
                      <Box
                        aria-label="Authenticator QR code"
                        sx={{
                          width: 200,
                          height: 200,
                          borderRadius: 2,
                          border: `1px solid ${BRAND.border}`,
                          p: 1,
                          background: "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          "& svg": { width: "100%", height: "100%" },
                        }}
                        dangerouslySetInnerHTML={{ __html: mfaQrCodeSvg }}
                      />
                    ) : (
                      <Box
                        component="img"
                        alt="Authenticator QR code"
                        src={qrImgSrc}
                        sx={{ width: 200, height: 200, borderRadius: 2, border: `1px solid ${BRAND.border}`, p: 1, background: "#fff" }}
                      />
                    )}
                  </Box>
                )}

                {mfaUri && (() => {
                  const secret = new URL(mfaUri).searchParams.get("secret") ?? mfaUri;
                  return (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" sx={{ display: "block", mb: 0.5, color: "text.secondary" }}>
                        Trouble scanning? Enter this code manually in your authenticator app:
                      </Typography>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, background: "rgba(0,0,0,0.06)", borderRadius: 1, px: 1.5, py: 0.75 }}>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", letterSpacing: 1, flexGrow: 1, userSelect: "all" }}>
                          {secret}
                        </Typography>
                        <Tooltip title="Copy">
                          <IconButton size="small" onClick={() => navigator.clipboard.writeText(secret)}>
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })()}

                <TextField
                  required
                  fullWidth
                  size="small"
                  label="Verification code"
                  placeholder="000000"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputProps={{ maxLength: 6, inputMode: "numeric", pattern: "\\d{6}" }}
                  autoFocus
                  sx={{ ...autofillTextFieldSx, mb: 2 }}
                />

                <FormControlLabel
                  control={
                    <Checkbox
                      checked={rememberDevice}
                      onChange={(e) => setRememberDevice(e.target.checked)}
                      sx={{ color: BRAND.accent, "&.Mui-checked": { color: BRAND.accent } }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: "text.secondary" }}>
                      Remember this device for 30 days
                    </Typography>
                  }
                  sx={{ mb: 2 }}
                />

                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  disabled={mfaVerifying || otpCode.length !== 6}
                  sx={{
                    py: 1.25,
                    background: BRAND.accent,
                    "&:hover": { background: BRAND.accentHover },
                    fontWeight: 700,
                    borderRadius: 2,
                    fontSize: 15,
                    textTransform: "none",
                    mb: 1.5,
                  }}
                >
                  {mfaVerifying ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Verify"}
                </Button>

                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <MuiLink
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={handleResendOtp}
                    disabled={mfaLoading}
                    sx={{ cursor: "pointer", color: BRAND.accent, fontWeight: 600 }}
                  >
                    {mfaLoading ? "Refreshing…" : "Refresh challenge"}
                  </MuiLink>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>·</Typography>
                  <MuiLink
                    component="button"
                    type="button"
                    variant="body2"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      setAuthStep("credentials");
                      setOtpCode("");
                      setMfaFactorId("");
                      setMfaChallengeId("");
                      setMfaQrCodeSvg("");
                      setMfaUri("");
                      setError("");
                      setMessage("");
                    }}
                    sx={{ cursor: "pointer", color: BRAND.accent, fontWeight: 600 }}
                  >
                    Back to sign in
                  </MuiLink>
                </Box>

                {error   && <Alert severity="error"   sx={{ mt: 2 }}>{error}</Alert>}
                {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
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
                    <>
                      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, mb: 0.75 }}>
                        <TextField
                          required
                          fullWidth
                          size="small"
                          label="First Name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value.slice(0, NAME_MAX_LENGTH))}
                          inputProps={{ maxLength: NAME_MAX_LENGTH }}
                          helperText={`${firstName.length}/${NAME_MAX_LENGTH}`}
                          sx={autofillTextFieldSx}
                        />
                        <TextField
                          required
                          fullWidth
                          size="small"
                          label="Last Name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value.slice(0, NAME_MAX_LENGTH))}
                          inputProps={{ maxLength: NAME_MAX_LENGTH }}
                          helperText={`${lastName.length}/${NAME_MAX_LENGTH}`}
                          sx={autofillTextFieldSx}
                        />
                      </Box>
                      <Typography variant="caption" sx={{ display: "block", mb: 1.5, color: isDark ? "#A9AAAB" : "text.secondary" }}>
                        Max {NAME_MAX_LENGTH} characters for first and last name.
                      </Typography>
                    </>
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
                    onChange={(e) => setPassword(e.target.value.slice(0, PASSWORD_MAX_LENGTH))}
                    autoComplete="current-password"
                    inputProps={{ minLength: 6, maxLength: PASSWORD_MAX_LENGTH }}
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
                    onClick={() => navigate("/forgot-password")}
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
                    {error === "EMAIL_NOT_CONFIRMED" ? (
                      <>
                        <strong>Email not confirmed.</strong> Please check your inbox for the verification link.
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
                          Can't find it? Northeastern's email system may quarantine messages from new senders.
                          Check your <strong>Junk/Spam</strong> folder, or visit{" "}
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
                      </>
                    ) : (
                      error
                    )}
                  </Alert>
                )}
                {message && (
                  <Alert severity="success" sx={{ mt: 2, textAlign: "left" }}>
                    {message === "SIGNUP_SUCCESS" ? (
                      <>
                        <strong>Account created!</strong> Check your Northeastern email for a verification link.
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
                          Can't find it? Northeastern's email system may quarantine messages from new senders.
                          Check your <strong>Junk/Spam</strong> folder, or visit{" "}
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
                      </>
                    ) : (
                      message
                    )}
                  </Alert>
                )}
              </>
            )}
          </Box>
        </Paper>
      </Box>

      {/* Terms & Conditions modal — shows before sign-up */}
      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        effectiveTheme={effectiveTheme}
        onAccept={() => {
          setTermsAccepted(true);
          // Run sign-up now that terms are accepted
          doSignUp();
        }}
      />
    </>
  );
}

function cleanErrorMessage(errorMsg) {
  if (!errorMsg) return "Something went wrong. Please try again.";
  if (errorMsg.toLowerCase().includes("email not confirmed"))
    return "EMAIL_NOT_CONFIRMED";
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