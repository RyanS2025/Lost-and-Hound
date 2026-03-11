import './App.css';
import { Routes, Route, Link } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import FeedPage from './pages/FeedPage';
import MapPage from "./pages/MapPage";
import MessagePage from "./pages/MessagePage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import { AppBar, Toolbar, Button, Typography, Container, Box, Paper } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import HomeIcon from '@mui/icons-material/Home';
import FeedIcon from "@mui/icons-material/DynamicFeed";
import MapIcon from '@mui/icons-material/Map';
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutIcon from '@mui/icons-material/Logout';
import MessageIcon from '@mui/icons-material/Message';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

// --- App: Main application component with routing and navigation ---
export default function App() {
  const { user, profile, logout } = useAuth();

  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem("themeMode");
    return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => setSystemPrefersDark(e.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  const effectiveTheme = themeMode === "auto" ? (systemPrefersDark ? "dark" : "light") : themeMode;
  const darkAccent = "#FF4500";
  const darkAccentHover = "#E03D00";

  useEffect(() => {
    document.documentElement.style.colorScheme = effectiveTheme;
    document.body.style.backgroundColor = effectiveTheme === "dark" ? "#030303" : "#f5f0f0";
  }, [effectiveTheme]);

  const navBg = effectiveTheme === "dark" ? "#1A1A1B" : "#A84D48";
  const navBorder = effectiveTheme === "dark" ? "1px solid rgba(255,255,255,0.12)" : "none";
  const footerBg = effectiveTheme === "dark" ? "#121213" : "#fff";
  const footerBorder = effectiveTheme === "dark" ? "1px solid rgba(255,255,255,0.12)" : "1px solid #ecdcdc";

  const appTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: effectiveTheme,
          primary: { main: effectiveTheme === "dark" ? darkAccent : "#A84D48" },
          background: {
            default: effectiveTheme === "dark" ? "#030303" : "#f5f0f0",
            paper: effectiveTheme === "dark" ? "#1A1A1B" : "#ffffff",
          },
          text: {
            primary: effectiveTheme === "dark" ? "#D7DADC" : "#2d2d2d",
            secondary: effectiveTheme === "dark" ? "#818384" : "#6b6b6b",
          },
        },
        typography: {
          fontFamily: '"Nunito", "Roboto", "Helvetica", "Arial", sans-serif',
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
              },
            },
          },
          MuiTextField: {
            defaultProps: {
              autoComplete: "off",
            },
          },
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: "none",
              },
            },
          },
        },
      }),
    [effectiveTheme]
  );

  const toggleThemeFromNav = () => {
    if (effectiveTheme === "dark") {
      setThemeMode("light");
    } else {
      setThemeMode("dark");
    }
  };

  // LoginPage calls onLoginSuccess right before signing in.
  // This holds the LoginPage on screen for 1.8s so the animation can play.
  const [loginTransition, setLoginTransition] = useState(false);
  const didLoginTransition = useRef(false);

  const onLoginSuccess = useCallback(() => {
    setLoginTransition(true);
    didLoginTransition.current = true;
    setTimeout(() => setLoginTransition(false), 1200);
  }, []);

  // Show LoginPage if not logged in OR if the login animation is still playing
  if (!user || loginTransition) {
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        <LoginPage loginTransition={loginTransition} onLoginSuccess={onLoginSuccess} />
      </ThemeProvider>
    );
  }

  // Show nothing while profile is loading
  if (!profile) {
    return null;
  }

  // Ban check
  if (profile?.banned_until) {
    const bannedUntil = new Date(profile.banned_until);
    if (bannedUntil > new Date()) {
      const isPermanent = bannedUntil.getFullYear() === 9999;
      return (
        <ThemeProvider theme={appTheme}>
          <CssBaseline />
        <>
          <AppBar position="fixed" sx={{ background: navBg, borderBottom: navBorder }}>
            <Toolbar>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box component="img" src="/LostandHoundLogo.PNG" alt="Lost & Hound logo"
                  sx={{ height: 32, width: 32, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 0.5 }}>
                  Lost &amp; Hound
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                color="inherit"
                onClick={toggleThemeFromNav}
                startIcon={effectiveTheme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
                sx={{ mr: 1 }}
              >
                {effectiveTheme === "dark" ? "Light" : "Dark"}
              </Button>
              <Button color="inherit" onClick={logout} endIcon={<LogoutIcon />}>Log Out</Button>
            </Toolbar>
          </AppBar>
          <Toolbar />
          <Box sx={{
            display: "flex", justifyContent: "center", alignItems: "center",
            minHeight: "calc(100vh - 140px)", p: 3,
            background:
              effectiveTheme === "dark"
                ? "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)"
                : "radial-gradient(circle, #d4b5b5 1px, transparent 1px)",
            backgroundColor: effectiveTheme === "dark" ? "#030303" : "#f5f0f0",
            backgroundSize: "24px 24px",
          }}>
              <Paper elevation={0} sx={{
                p: 4, pt: 0, borderRadius: 3, textAlign: "center", maxWidth: 380,
                border: effectiveTheme === "dark" ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc",
                overflow: "visible",
                boxShadow:
                  effectiveTheme === "dark"
                    ? "0 10px 36px rgba(0,0,0,0.45), 0 2px 10px rgba(0,0,0,0.3)"
                    : "0 8px 32px rgba(168, 77, 72, 0.13), 0 2px 8px rgba(0,0,0,0.07)",
                background: effectiveTheme === "dark" ? "#1A1A1B" : "#fff",
              }}>
              <Box component="img" src="/HuskyBan.png" alt="Banned husky"
                sx={{ width: "100%", maxWidth: 260, mx: "auto", display: "block", mt: -6, mb: -2 }} />
              <Typography variant="h3" fontWeight={900} sx={{ mb: 0.5, color: effectiveTheme === "dark" ? "#D7DADC" : "#3d2020" }}>
                Account Suspended
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {isPermanent
                  ? "Your account has been permanently suspended."
                  : `Your account is suspended until ${bannedUntil.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}.`}
              </Typography>
              {profile.ban_reason && (
                <Typography variant="body2" sx={{ mb: 2, color: effectiveTheme === "dark" ? "#FF6A33" : "#A84D48", fontWeight: 600 }}>
                  {profile.ban_reason}
                </Typography>
              )}
              <Button variant="contained" onClick={logout}
                sx={{ background: effectiveTheme === "dark" ? darkAccent : "#A84D48", "&:hover": { background: effectiveTheme === "dark" ? darkAccentHover : "#8f3e3a" }, fontWeight: 700, borderRadius: 2, px: 4 }}>
                LOG OUT
              </Button>
            </Paper>
          </Box>
          <Box
            component="footer"
            sx={{
              position: "fixed",
              bottom: 0,
              left: 0,
              right: 0,
              height: 36,
              px: 3,
              borderTop: footerBorder,
              background: footerBg,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              zIndex: 1200,
            }}
          >
            <Typography variant="caption" color="text.disabled" fontWeight={600}>
              🐾 Lost &amp; Hound · Built by Nahom Hailemelekot, Benjamin Haillu, Liam Pulsifer, and Ryan Sinha · Oasis @ Northeastern
            </Typography>
          </Box>
        </>
        </ThemeProvider>
      );
    }
  }

  // Check if we should fade in (came from login animation)
  const shouldFadeIn = didLoginTransition.current;
  // Reset the ref so refreshes / normal navigation don't fade
  didLoginTransition.current = false;

  return (
    <ThemeProvider theme={appTheme}>
      <CssBaseline />
    <>
    <AppBar position="fixed" sx={{ background: navBg, borderBottom: navBorder }}>
        <Toolbar>
          <Box
            component={Link}
            to="/"
            sx={{ display: "flex", alignItems: "center", gap: 1, mr: 3, textDecoration: "none", color: "inherit" }}
          >
            <Box
              component="img"
              src="/LostandHoundLogo.PNG"
              alt="Lost & Hound logo"
              sx={{ height: 32, width: 32, objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
            <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 0.5 }}>
              Lost &amp; Hound
            </Typography>
          </Box>
          <Button
            color="inherit"
            component={Link}
            to="/"
            startIcon={<FeedIcon />}
            sx={{ mr: 2 }}
          >
            Feed
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/map"
            startIcon={<MapIcon />}
            sx={{ mr: 2 }}
          >
            Map
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/messages"
            startIcon={<MessageIcon />}
          >
            Messages
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {profile?.is_moderator && (
            <Button
              color="inherit"
              component={Link}
              to="/moderation"
              sx={{ minWidth: 0, mr: 0.5 }}
            >
              <SupervisorAccountIcon />
            </Button>
          )}
          <Typography variant="body1" sx={{ mr: 2 }}>
            {profile?.first_name && profile?.last_name
              ? profile.first_name + " " + profile.last_name
              : user.email}
          </Typography>
          <Button
            color="inherit"
            onClick={toggleThemeFromNav}
            startIcon={effectiveTheme === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
            sx={{ mr: 2 }}
          >
            {effectiveTheme === "dark" ? "Light" : "Dark"}
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/settings"
            endIcon={<SettingsIcon />}
            sx={{ mr: 2 }}
          >
            Settings
          </Button>
          <Button
            color="inherit"
            onClick={logout}
            endIcon={<LogoutIcon />}
          >
            Log Out
          </Button>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Box
        sx={{
          ...(shouldFadeIn
            ? {
                opacity: 0,
                animation: "appFadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.15s forwards",
                "@keyframes appFadeIn": {
                  "0%": { opacity: 0, transform: "translateY(6px)" },
                  "100%": { opacity: 1, transform: "translateY(0)" },
                },
              }
            : {}),
        }}
      >
        <Box sx={{ mt: 0, pb: "48px" }}>
          <Routes>
            <Route path="/" element={<FeedPage effectiveTheme={effectiveTheme} />} />
            <Route path="/map" element={<MapPage effectiveTheme={effectiveTheme} />} />
            <Route path="/messages" element={<MessagePage effectiveTheme={effectiveTheme} />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  effectiveTheme={effectiveTheme}
                />
              }
            />
            <Route path="/moderation" element={<DashboardPage effectiveTheme={effectiveTheme} />} />
            <Route path="*" element={<NotFoundPage effectiveTheme={effectiveTheme} />} />
          </Routes>
        </Box>
      </Box>

      <Box
        component="footer"
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 36,
          px: 3,
          borderTop: footerBorder,
          background: footerBg,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1200,
        }}
      >
        <Typography variant="caption" color="text.disabled" fontWeight={600}>
          🐾 Lost &amp; Hound · Built by Nahom Hailemelekot, Benjamin Haillu, Liam Pulsifer, and Ryan Sinha · Oasis @ Northeastern
        </Typography>
      </Box>
    </>
    </ThemeProvider>
  );
}