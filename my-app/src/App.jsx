import './App.css';
import { Routes, Route, Link } from "react-router-dom";
import { supabase } from "../backend/supabaseClient";
import { useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import FeedPage from './pages/FeedPage';
import MapPage from "./pages/MapPage";
import MessagePage from "./pages/MessagePage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import NotFoundPage from "./pages/NotFoundPage";
import AppFooter from "./components/AppFooter";
import { AppBar, Toolbar, Button, Typography, Container, Box, Paper, CircularProgress } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import HomeIcon from '@mui/icons-material/Home';
import FeedIcon from "@mui/icons-material/DynamicFeed";
import MapIcon from '@mui/icons-material/Map';
import SettingsIcon from '@mui/icons-material/Settings';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LogoutIcon from '@mui/icons-material/Logout';
import MessageIcon from '@mui/icons-material/Message';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { DEFAULT_TIME_ZONE, formatCalendarDate, resolveTimeZone } from './utils/timezone';

// --- App: Main application component with routing and navigation ---
export default function App() {
  const { user, profile, logout } = useAuth();
  const darkBg = "#101214";
  const isCompactNav = useMediaQuery("(max-width:1100px)");

  const [themeMode, setThemeMode] = useState(() => {
    const saved = localStorage.getItem("themeMode");
    return saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
  });
  const [timeZone, setTimeZone] = useState(() =>
    resolveTimeZone(localStorage.getItem("timeZone") || DEFAULT_TIME_ZONE)
  );
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

  useEffect(() => {
    localStorage.setItem("timeZone", timeZone);
  }, [timeZone]);

  const effectiveTheme = themeMode === "auto" ? (systemPrefersDark ? "dark" : "light") : themeMode;
  const darkAccent = "#FF4500";
  const darkAccentHover = "#E03D00";
  const pageDot = effectiveTheme === "dark" ? "rgba(255,255,255,0.07)" : "rgba(122,41,41,0.18)";
  const pageBg = effectiveTheme === "dark" ? darkBg : "#f9f5f4";

  useEffect(() => {
    document.documentElement.style.colorScheme = effectiveTheme;
    document.body.style.backgroundColor = effectiveTheme === "dark" ? darkBg : "#f5f0f0";
  }, [effectiveTheme]);

  const navBg = effectiveTheme === "dark" ? "#1A1A1B" : "#A84D48";
  const navBorder = effectiveTheme === "dark" ? "1px solid rgba(255,255,255,0.12)" : "none";

  const appTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: effectiveTheme,
          primary: { main: effectiveTheme === "dark" ? darkAccent : "#A84D48" },
          background: {
            default: effectiveTheme === "dark" ? darkBg : "#f5f0f0",
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
          MuiOutlinedInput: {
            styleOverrides: {
              root: {
                backgroundColor: effectiveTheme === "dark" ? "#2D2D2E" : "#fff",
              },
            },
          },
          MuiTextField: {
            defaultProps: {
              autoComplete: "off",
            },
          },
          MuiChip: {
            styleOverrides: {
              root: {
                backgroundColor: effectiveTheme === "dark" ? "#1A1A1B" : "#fff",
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: ({ ownerState }) => ({
                textTransform: "none",
                ...(ownerState.variant === "outlined"
                  ? {
                      backgroundColor: effectiveTheme === "dark" ? "#1A1A1B" : "#fff",
                    }
                  : {}),
              }),
            },
          },
        },
      }),
    [effectiveTheme]
  );

  const toggleThemeFromNav = () => {
    if (themeMode === "auto") {
      return;
    }
    if (themeMode === "light") {
      setThemeMode("dark");
    } else {
      setThemeMode("light");
    }
  };

  const navThemeToggle =
    themeMode === "auto"
      ? {
          label: `Default (${effectiveTheme === "dark" ? "Dark" : "Light"})`,
          icon: <BrightnessAutoIcon />,
          disabled: true,
        }
      : themeMode === "light"
        ? { label: "Light", icon: <LightModeIcon />, disabled: false }
        : { label: "Dark", icon: <DarkModeIcon />, disabled: false };

  // LoginPage calls onLoginSuccess right before signing in.
  // This holds the LoginPage on screen for 1.8s so the animation can play.
  const [loginTransition, setLoginTransition] = useState(false);
  const [awaitingProfile, setAwaitingProfile] = useState(false);
  const didLoginTransition = useRef(false);
  // Tracks whether we're still waiting for the initial profile fetch on page refresh.
  // Starts true and flips to false once we get a result (success or failure).
  const [profileInitLoading, setProfileInitLoading] = useState(true);

  useEffect(() => {
    // Once we have a profile, or we know there's no user, initial load is done.
    // Also if user exists but profile is null (2FA_REQUIRED), we give it a short
    // window then stop showing the spinner so the MFA screen can appear.
    if (profile || !user) {
      setProfileInitLoading(false);
    } else if (user && !profile) {
      // User exists but no profile yet — could be loading or 2FA blocked.
      // Set a timeout so we don't spin forever if 2FA is required.
      const timer = setTimeout(() => setProfileInitLoading(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [profile, user]);

  const onLoginSuccess = useCallback(() => {
    setLoginTransition(true);
    setAwaitingProfile(true);
    didLoginTransition.current = true;
    setTimeout(() => setLoginTransition(false), 1200);
  }, []);

  const onLoginCancel = useCallback(() => {
    setLoginTransition(false);
    setAwaitingProfile(false);
  }, []);

  useEffect(() => {
    if (profile || !user) {
      setAwaitingProfile(false);
    }
  }, [profile, user]);

  // Keep showing LoginPage while auth/MFA is in progress.
  // This avoids a blank screen if /api/profile is blocked by require2FA.
  if (!user || loginTransition || !profile) {
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        {(awaitingProfile || profileInitLoading) && !loginTransition ? (
          <Box
            sx={{
              minHeight: '100vh',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: effectiveTheme === "dark" ? darkBg : "#f5f0f0",
              backgroundImage: `radial-gradient(circle, ${pageDot} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          >
            <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CircularProgress
                size={340}
                thickness={1}
                sx={{
                  color: effectiveTheme === "dark" ? darkAccent : "#A84D48",
                  position: "absolute",
                }}
              />
              <Box
                component="img"
                src="/TabLogo.png"
                alt="Lost & Hound"
                sx={{
                  width: 230,
                  height: 230,
                  objectFit: "contain",
                }}
              />
            </Box>
          </Box>
        ) : (
          <LoginPage
            loginTransition={loginTransition}
            onLoginSuccess={onLoginSuccess}
            onLoginCancel={onLoginCancel}
            effectiveTheme={effectiveTheme}
          />
        )}
      </ThemeProvider>
    );
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
            <Toolbar
              sx={{
                gap: { xs: 0.5, sm: 1 },
                px: { xs: 1, sm: 2 },
                overflowX: "auto",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box component="img" src="/TabLogo.PNG" alt="Lost & Hound logo"
                  sx={{ height: 32, width: 32, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 0.5, display: { xs: "none", sm: "block" } }}>
                  Lost &amp; Hound
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                color="inherit"
                onClick={toggleThemeFromNav}
                startIcon={navThemeToggle.icon}
                disabled={navThemeToggle.disabled}
                sx={{ mr: 0.5, minWidth: 0 }}
              >
                {!isCompactNav ? navThemeToggle.label : null}
              </Button>
              <Button color="inherit" onClick={logout} endIcon={<LogoutIcon />} sx={{ minWidth: 0 }}>
                {!isCompactNav ? "Log Out" : null}
              </Button>
            </Toolbar>
          </AppBar>
          <Toolbar />
          <Box
            sx={{
              position: "fixed",
              inset: 0,
              zIndex: -1,
              backgroundColor: pageBg,
              backgroundImage: `radial-gradient(circle, ${pageDot} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          />
          <Box sx={{
            display: "flex", justifyContent: "center", alignItems: "center",
            minHeight: "calc(100vh - 120px)", p: 3,
            boxSizing: "border-box",
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
                  : `Your account is suspended until ${formatCalendarDate(bannedUntil, timeZone)}.`}
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
          <AppFooter effectiveTheme={effectiveTheme} />
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
        <Toolbar
          sx={{
            gap: { xs: 0.5, sm: 1 },
            px: { xs: 1, sm: 2 },
            overflowX: "auto",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          <Box
            component={Link}
            to="/"
            sx={{ display: "flex", alignItems: "center", gap: 1, mr: { xs: 1, sm: 2 }, textDecoration: "none", color: "inherit", flexShrink: 0 }}
          >
            <Box
              component="img"
              src="/LostandHoundLogo.PNG"
              alt="Lost & Hound logo"
              sx={{ height: 32, width: 32, objectFit: "contain", filter: "brightness(0) invert(1)" }}
            />
            <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 0.5, display: { xs: "none", sm: "block" } }}>
              Lost &amp; Hound
            </Typography>
          </Box>
          <Button
            color="inherit"
            component={Link}
            to="/"
            startIcon={<FeedIcon />}
            sx={{ mr: { xs: 0.5, sm: 1 }, minWidth: 0 }}
          >
            {!isCompactNav ? "Feed" : null}
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/map"
            startIcon={<MapIcon />}
            sx={{ mr: { xs: 0.5, sm: 1 }, minWidth: 0 }}
          >
            {!isCompactNav ? "Map" : null}
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/messages"
            startIcon={<MessageIcon />}
            sx={{ minWidth: 0 }}
          >
            {!isCompactNav ? "Messages" : null}
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
          <Typography variant="body1" sx={{ mr: 1, display: { xs: "none", md: "block" } }}>
            {profile?.first_name && profile?.last_name
              ? profile.first_name + " " + profile.last_name
              : user.email}
          </Typography>
          <Button
            color="inherit"
            onClick={toggleThemeFromNav}
            startIcon={navThemeToggle.icon}
            disabled={navThemeToggle.disabled}
            sx={{ mr: { xs: 0.5, sm: 1 }, minWidth: 0 }}
          >
            {!isCompactNav ? navThemeToggle.label : null}
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/settings"
            endIcon={<SettingsIcon />}
            sx={{ mr: { xs: 0.5, sm: 1 }, minWidth: 0 }}
          >
            {!isCompactNav ? "Settings" : null}
          </Button>
          <Button
            color="inherit"
            onClick={logout}
            endIcon={<LogoutIcon />}
            sx={{ minWidth: 0 }}
          >
            {!isCompactNav ? "Log Out" : null}
          </Button>
        </Toolbar>
      </AppBar>
      <Toolbar />
      <Box
        sx={{
          ...(shouldFadeIn
            ? {
                animation: "appFadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.15s both",
                "@keyframes appFadeIn": {
                  "0%": { opacity: 0, transform: "translateY(6px)" },
                  "100%": { opacity: 1, transform: "translateY(0)" },
                },
              }
            : {}),
        }}
      >
        <Box sx={{ mt: 0, pb: { xs: "78px", sm: "64px" } }}>
          <Routes>
            <Route path="/" element={<FeedPage effectiveTheme={effectiveTheme} timeZone={timeZone} />} />
            <Route path="/map" element={<MapPage effectiveTheme={effectiveTheme} timeZone={timeZone} />} />
            <Route path="/messages" element={<MessagePage effectiveTheme={effectiveTheme} timeZone={timeZone} />} />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  themeMode={themeMode}
                  setThemeMode={setThemeMode}
                  timeZone={timeZone}
                  setTimeZone={setTimeZone}
                  effectiveTheme={effectiveTheme}
                />
              }
            />
            <Route path="/moderation" element={<DashboardPage effectiveTheme={effectiveTheme} timeZone={timeZone} />} />
            <Route path="*" element={<NotFoundPage effectiveTheme={effectiveTheme} />} />
          </Routes>
        </Box>
      </Box>

      <AppFooter effectiveTheme={effectiveTheme} />
    </>
    </ThemeProvider>
  );
}