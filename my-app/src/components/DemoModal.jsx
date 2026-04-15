import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  MobileStepper,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import GitHubIcon from "@mui/icons-material/GitHub";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";

const DEMO_SLIDES = [
  {
    title: "Secure Login",
    description:
      "Sign in with your Northeastern email. We support dark and light themes right from the start.",
    image: "/demo-screenshots/01-login-page.png",
  },
  {
    title: "Easy Sign Up",
    description:
      "Create an account with your @northeastern.edu email. We verify every user to keep the community safe.",
    image: "/demo-screenshots/02-signup-page.png",
  },
  {
    title: "Password Recovery",
    description:
      "Forgot your password? Reset it securely via email in just a few clicks.",
    image: "/demo-screenshots/03-forgot-password.png",
  },
  {
    title: "Terms & Conditions",
    description:
      "Transparent terms you can read before signing up — scroll through and accept at your own pace.",
    image: "/demo-screenshots/04-terms-modal.png",
  },
  {
    title: "Two-Factor Authentication",
    description:
      "Every account is protected with TOTP-based two-factor authentication. Scan the QR code with any authenticator app.",
    image: "/demo-screenshots/05-qr-code-setup.png",
  },
  {
    title: "Lost & Found Feed",
    description:
      "Browse lost and found listings from the Northeastern community. Filter by category, search by keyword, and sort by newest.",
    image: "/demo-screenshots/06-feed-page.png",
  },
  {
    title: "Report an Item",
    description:
      "Found or lost something? Report it in seconds — pick a category, building, and add a description.",
    image: "/demo-screenshots/07-create-post-modal.png",
  },
  {
    title: "Campus Map",
    description:
      "See lost and found items plotted on an interactive campus map. Tap anywhere to search nearby items within a custom radius.",
    image: "/demo-screenshots/08-map-page.png",
  },
  {
    title: "Direct Messages",
    description:
      "Message other students directly to coordinate item pickups. Built-in safety reminders keep everyone safe.",
    image: "/demo-screenshots/09-messages-page.png",
  },
  {
    title: "Account Settings",
    description:
      "Manage your profile, change your password, pick a theme, set your default campus and time zone.",
    image: "/demo-screenshots/10-settings-page.png",
  },
  {
    title: "Custom 404 Page",
    description:
      "Even our error page is on-brand — featuring our Lost & Hound mascot.",
    image: "/demo-screenshots/11-404-page.png",
  },
];

export default function DemoModal({ open, onClose, onViewDemo, effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const [activeStep, setActiveStep] = useState(0);
  const maxSteps = DEMO_SLIDES.length;

  useEffect(() => {
    if (open) setActiveStep(0);
  }, [open]);

  const styles = useMemo(
    () => ({
      bg: isDark ? "#1A1A1B" : "#fff",
      border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #ecdcdc",
      text: isDark ? "#D7DADC" : "#2d2d2d",
      subtext: isDark ? "#B8BABD" : "#6b6b6b",
      accent: isDark ? "#FF4500" : "#A84D48",
      accentHover: isDark ? "#E03D00" : "#8f3e3a",
      imgBorder: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #ecdcdc",
      imgBg: isDark ? "#121213" : "#f5f0f0",
      stepperBg: isDark ? "#121213" : "#faf6f6",
    }),
    [isDark]
  );

  const slide = DEMO_SLIDES[activeStep];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{
        sx: {
          background: styles.bg,
          border: styles.border,
          borderRadius: 3,
          maxHeight: "90vh",
        },
      }}
    >
      <DialogTitle sx={{ pr: 6, fontWeight: 800, color: styles.text }}>
        Demo Preview
        <Typography variant="body2" sx={{ color: styles.subtext, mt: 0.25 }}>
          See how Lost &amp; Hound works
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ position: "absolute", right: 12, top: 12, color: styles.subtext }}
          aria-label="Close"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, pb: 0 }}>
        {/* Screenshot */}
        <Box
          sx={{
            width: "100%",
            borderRadius: 2,
            overflow: "hidden",
            border: styles.imgBorder,
            background: styles.imgBg,
            mb: 2,
          }}
        >
          <Box
            component="img"
            src={slide.image}
            alt={slide.title}
            sx={{
              width: "100%",
              maxHeight: 320,
              objectFit: "contain",
              display: "block",
            }}
          />
        </Box>

        {/* Slide info */}
        <Typography variant="h6" sx={{ fontWeight: 800, color: styles.text }}>
          {slide.title}
        </Typography>
        <Typography variant="body2" sx={{ color: styles.subtext, mt: 0.5, mb: 2 }}>
          {slide.description}
        </Typography>
      </DialogContent>

      {/* Stepper + GitHub link */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
        <MobileStepper
          variant="dots"
          steps={maxSteps}
          position="static"
          activeStep={activeStep}
          sx={{
            background: styles.stepperBg,
            borderRadius: 2,
            "& .MuiMobileStepper-dot": {
              backgroundColor: isDark ? "rgba(255,255,255,0.2)" : "#d8c8c8",
            },
            "& .MuiMobileStepper-dotActive": {
              backgroundColor: styles.accent,
            },
          }}
          nextButton={
            <Button
              size="small"
              onClick={() => setActiveStep((s) => s + 1)}
              disabled={activeStep === maxSteps - 1}
              sx={{ color: styles.accent, fontWeight: 700 }}
            >
              Next
              <KeyboardArrowRight />
            </Button>
          }
          backButton={
            <Button
              size="small"
              onClick={() => setActiveStep((s) => s - 1)}
              disabled={activeStep === 0}
              sx={{ color: styles.accent, fontWeight: 700 }}
            >
              <KeyboardArrowLeft />
              Back
            </Button>
          }
        />

        {onViewDemo && (
          <Button
            onClick={onViewDemo}
            startIcon={<PlayArrowIcon />}
            fullWidth
            variant="contained"
            sx={{
              mt: 1.5,
              background: styles.accent,
              color: "#fff",
              fontWeight: 700,
              borderRadius: 2,
              textTransform: "none",
              "&:hover": { background: isDark ? "#E03D00" : "#8f3e3a" },
            }}
          >
            View Interactive Demo
          </Button>
        )}

        <Button
          component="a"
          href="https://github.com/RyanS2025/Lost-and-Hound"
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<GitHubIcon />}
          fullWidth
          sx={{
            mt: 1.5,
            color: styles.accent,
            fontWeight: 700,
            border: styles.border,
            borderRadius: 2,
            textTransform: "none",
            "&:hover": {
              backgroundColor: isDark ? "rgba(255,69,0,0.08)" : "rgba(168,77,72,0.06)",
            },
          }}
        >
          View on GitHub
        </Button>
      </Box>
    </Dialog>
  );
}
