import './App.css';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../backend/supabaseClient";
import { useAuth } from "./AuthContext";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import FeedPage from './pages/FeedPage';
import MapPage from "./pages/MapPage";
import MessagePage from "./pages/MessagePage";
import SettingsPage from "./pages/SettingsPage";
import DashboardPage from "./pages/DashboardPage";
import DashboardOverviewPage from "./pages/dashboard/DashboardOverviewPage";
import ReportsPage from "./pages/dashboard/ReportsPage";
import FeedbackPage from "./pages/dashboard/FeedbackPage";
import BugsPage from "./pages/dashboard/BugsPage";
import SupportPage from "./pages/dashboard/SupportPage";
import MyWorkPage from "./pages/dashboard/MyWorkPage";
import StatsPage from "./pages/dashboard/StatsPage";
import FinancesPage from "./pages/dashboard/FinancesPage";
import NotFoundPage from "./pages/NotFoundPage";
import NoteCard from "./components/NoteCard";
import DemoDisclaimerModal from "./components/DemoDisclaimerModal";
import { useDemo } from "./contexts/DemoContext";
import {
  DEMO_PROFILE, DEMO_LISTINGS, DEMO_CONVERSATIONS,
  DEMO_PROFILES, DEMO_LISTINGS_MAP, DEMO_UNREAD_COUNTS,
} from "./demo/mockData";
import AppFooter from "./components/AppFooter";
import ReferralPollModal from "./components/ReferralPollModal";
import { Capacitor } from "@capacitor/core";
import { AppBar, Toolbar, Button, Typography, Container, Box, Paper, CircularProgress, Badge, Chip } from '@mui/material';
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
import apiFetch from './utils/apiFetch';
import { prefetchDashboard, clearDashboardCache } from './utils/dashboardPrefetch';

export default function App() {
  const { user, profile, sessionToken, logout, updateProfile, isPasswordRecovery, setIsPasswordRecovery } = useAuth();
  const { isDemoMode, exitDemo } = useDemo();
  const navigate = useNavigate();
  const [demoDismissed, setDemoDismissed] = useState(false);
  const demoDisclaimerOpen = isDemoMode && !demoDismissed;

  useEffect(() => {
    if (!isDemoMode) setDemoDismissed(false);
  }, [isDemoMode]);
  const location = useLocation();
  const darkBg = "#101214";
  const isCompactNav = useMediaQuery("(max-width:1100px)");

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Background prefetch — fire as soon as we know user is a moderator
  useEffect(() => {
    if (profile?.is_moderator) {
      prefetchDashboard();
    }
  }, [profile?.is_moderator]);

  const handleLogout = useCallback(() => {
    clearDashboardCache();
    logout();
  }, [logout]);

  const handleExitDemo = useCallback(() => {
    exitDemo();
    navigate("/");
  }, [exitDemo, navigate]);

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

  // Conversations state — lifted here so data persists across page navigations
  const [msgConversations, setMsgConversations] = useState([]);
  const [msgProfiles, setMsgProfiles] = useState({});
  const [msgListings, setMsgListings] = useState({});
  const [msgUnreadCounts, setMsgUnreadCounts] = useState({});
  const [msgConversationsLoaded, setMsgConversationsLoaded] = useState(false);

  useEffect(() => {
    if (isDemoMode) {
      setMsgConversations(DEMO_CONVERSATIONS);
      setMsgProfiles(DEMO_PROFILES);
      setMsgListings(DEMO_LISTINGS_MAP);
      setMsgUnreadCounts(DEMO_UNREAD_COUNTS);
      setMsgConversationsLoaded(true);
      return;
    }
    if (!user || !sessionToken) {
      setMsgConversations([]);
      setMsgProfiles({});
      setMsgListings({});
      setMsgUnreadCounts({});
      setMsgConversationsLoaded(false);
      return;
    }
    const fetchConversations = async () => {
      try {
        const result = await apiFetch("/api/conversations");
        setMsgConversations(result?.conversations || []);
        setMsgProfiles(result?.profiles || {});
        setMsgListings(result?.listings || {});
        setMsgUnreadCounts(result?.unreadCounts || {});
      } catch (err) {
        console.error("Fetch conversations error:", err);
      }
      setMsgConversationsLoaded(true);
    };
    fetchConversations();

    // Live update: refresh conversation list when new messages or conversations change
    const convoChannel = supabase
      .channel("convo-list-web")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fetchConversations)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, fetchConversations)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversations" }, fetchConversations)
      .subscribe();

    return () => { supabase.removeChannel(convoChannel); };
  }, [user?.id, sessionToken, isDemoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared listings state — fetched once, used by Feed and Map pages
  const [sharedItems, setSharedItems] = useState([]);
  const [sharedItemsLoaded, setSharedItemsLoaded] = useState(false);

  const fetchAllItems = useCallback(async () => {
    if (isDemoMode) return;
    try {
      await apiFetch("/api/listings/cleanup", { method: "POST" }).catch(() => {});
      let allItems = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const result = await apiFetch(`/api/listings?page=${page}&limit=100`);
        allItems = [...allItems, ...(result?.data || [])];
        hasMore = result?.hasMore ?? false;
        page++;
      }
      setSharedItems(allItems);
    } catch (err) {
      console.error("Fetch listings error:", err);
    }
    setSharedItemsLoaded(true);
  }, [isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      setSharedItems(DEMO_LISTINGS);
      setSharedItemsLoaded(true);
      return;
    }
    if (!user || !sessionToken) {
      setSharedItems([]);
      setSharedItemsLoaded(false);
      return;
    }
    fetchAllItems();
  }, [user?.id, sessionToken, fetchAllItems, isDemoMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unread message count — shown as a badge on the Messages nav button
  const [unreadCount, setUnreadCount] = useState(0);
  useEffect(() => {
    if (isDemoMode) { setUnreadCount(0); return; }
    if (!user || !sessionToken) { setUnreadCount(0); return; }

    // Fetch the current unread count from the backend
    const fetchUnread = () =>
      apiFetch("/api/messages/unread-count")
        .then(d => setUnreadCount(d.count ?? 0))
        .catch(() => {});

    fetchUnread();

    // Subscribe to new message inserts so the badge updates in real time
    // without the user needing to refresh the page
    const channel = supabase
      .channel("unread-badge")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, fetchUnread)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, fetchUnread)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, fetchUnread)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversations" }, fetchUnread)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, sessionToken]);

  // Handle email link verification (password recovery, etc.)
  // The email links directly to our app with token_hash & type params,
  // bypassing Supabase's /auth/v1/verify endpoint so Microsoft SafeLinks
  // can't consume the token by pre-fetching it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type");
    const code = params.get("code");

    if (tokenHash && type) {
      supabase.auth.verifyOtp({ token_hash: tokenHash, type }).then(({ error }) => {
        if (error) console.error("Token verification failed:", error.message);
        window.history.replaceState({}, "", window.location.pathname);
      });
    } else if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) console.error("Code exchange failed:", error.message);
        window.history.replaceState({}, "", window.location.pathname);
      });
    }
  }, []);

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
  const effectiveProfile = isDemoMode ? DEMO_PROFILE : profile;
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

  // Password recovery: Supabase gives a valid session via the email link,
  // so intercept before the normal auth check to show the reset form.
  if (isPasswordRecovery) {
    // `user` is only set after verifyOtp resolves and PASSWORD_RECOVERY fires.
    // Showing the form before that means the session doesn't exist yet, so any
    // submit attempt gets 401 "Invalid token" from requireAuth.
    // Wait for the session to be ready; time out after 8 s if something went wrong.
    const sessionReady = !!user;
    return (
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        {!sessionReady ? (
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: effectiveTheme === "dark" ? darkBg : "#f5f0f0",
              backgroundImage: `radial-gradient(circle, ${pageDot} 1px, transparent 1px)`,
              backgroundSize: "24px 24px",
            }}
          >
            <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CircularProgress
                size={340}
                thickness={1}
                sx={{ color: effectiveTheme === "dark" ? darkAccent : "#A84D48", position: "absolute" }}
              />
              <Box
                component="img"
                src="/TabLogo.png"
                alt="Lost & Hound"
                sx={{ width: 230, height: 230, objectFit: "contain" }}
              />
            </Box>
          </Box>
        ) : (
          <ResetPasswordPage
            effectiveTheme={effectiveTheme}
            onComplete={async () => {
              setIsPasswordRecovery(false);
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
          />
        )}
      </ThemeProvider>
    );
  }

  // Keep showing LoginPage while auth/MFA is in progress.
  // This avoids a blank screen if /api/profile is blocked by require2FA.
  if (!isDemoMode && (!user || loginTransition || !profile)) {
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
          <Routes>
            <Route
              path="/forgot-password"
              element={<ForgotPasswordPage effectiveTheme={effectiveTheme} />}
            />
            <Route
              path="/reset-password"
              element={<ResetPasswordPage effectiveTheme={effectiveTheme} />}
            />
            <Route
              path="*"
              element={
                <LoginPage
                  loginTransition={loginTransition}
                  onLoginSuccess={onLoginSuccess}
                  onLoginCancel={onLoginCancel}
                  effectiveTheme={effectiveTheme}
                />
              }
            />
          </Routes>
        )}
      </ThemeProvider>
    );
  }

  // Ban check
  if (!isDemoMode && profile?.banned_until) {
    const bannedUntil = new Date(profile.banned_until);
    if (bannedUntil > new Date()) {
      const isPermanent = bannedUntil.getFullYear() === 9999;
      return (
        <ThemeProvider theme={appTheme}>
          <CssBaseline />
        <>
          <AppBar position="fixed" sx={{ background: navBg, borderBottom: navBorder, pt: "env(safe-area-inset-top)" }}>
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
              <Button color="inherit" onClick={handleLogout} endIcon={<LogoutIcon />} sx={{ minWidth: 0 }}>
                {!isCompactNav ? "Log Out" : null}
              </Button>
            </Toolbar>
          </AppBar>
          <Box sx={{ height: "calc(64px + env(safe-area-inset-top))" }} />
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
              <Button variant="contained" onClick={handleLogout}
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
    <AppBar position="fixed" sx={{ background: navBg, borderBottom: navBorder, pt: "env(safe-area-inset-top)" }}>
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
              src="/TabLogo.png"
              alt="Lost & Hound logo"
              sx={{ height: 48, width: 48, objectFit: "contain"}}
            />
            <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 0.5, display: { xs: "none", sm: "block" } }}>
              Lost &amp; Hound
            </Typography>
            {isDemoMode && (
              <Chip
                label="DEMO"
                size="small"
                sx={{
                  background: "rgba(255,255,255,0.22)",
                  color: "#fff",
                  fontWeight: 800,
                  fontSize: 10,
                  letterSpacing: 1,
                  height: 20,
                  border: "1px solid rgba(255,255,255,0.4)",
                }}
              />
            )}
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
            startIcon={
              <Badge badgeContent={unreadCount} color="error" max={99}>
                <MessageIcon />
              </Badge>
            }
            sx={{ minWidth: 0 }}
          >
            {!isCompactNav ? "Messages" : null}
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {!isDemoMode && !Capacitor.isNativePlatform() && effectiveProfile?.is_moderator && (
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
            {effectiveProfile?.first_name && effectiveProfile?.last_name
              ? effectiveProfile.first_name + " " + effectiveProfile.last_name
              : user?.email ?? "Demo User"}
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
          {isDemoMode ? (
            <Button
              color="inherit"
              onClick={handleExitDemo}
              endIcon={<LogoutIcon />}
              sx={{ minWidth: 0 }}
            >
              {!isCompactNav ? "Exit Demo" : null}
            </Button>
          ) : (
            <Button
              color="inherit"
              onClick={handleLogout}
              endIcon={<LogoutIcon />}
              sx={{ minWidth: 0 }}
            >
              {!isCompactNav ? "Log Out" : null}
            </Button>
          )}
        </Toolbar>
      </AppBar>
      {/* Spacer matches AppBar height including safe-area-inset-top */}
      <Box sx={{ height: "calc(64px + env(safe-area-inset-top))" }} />
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
        <Box sx={{ mt: 0, pb: { xs: "calc(78px + env(safe-area-inset-bottom))", sm: "calc(64px + env(safe-area-inset-bottom))" } }}>
          <Routes>
            <Route path="/" element={<FeedPage effectiveTheme={effectiveTheme} timeZone={timeZone} sharedItems={sharedItems} setSharedItems={setSharedItems} sharedItemsLoaded={sharedItemsLoaded} refreshItems={fetchAllItems} />} />
            <Route path="/map" element={<MapPage effectiveTheme={effectiveTheme} timeZone={timeZone} sharedItems={sharedItems} setSharedItems={setSharedItems} sharedItemsLoaded={sharedItemsLoaded} refreshItems={fetchAllItems} />} />
            <Route path="/messages" element={<MessagePage effectiveTheme={effectiveTheme} timeZone={timeZone} conversations={msgConversations} setConversations={setMsgConversations} profiles={msgProfiles} setProfiles={setMsgProfiles} listings={msgListings} setListings={setMsgListings} unreadCounts={msgUnreadCounts} setUnreadCounts={setMsgUnreadCounts} conversationsLoaded={msgConversationsLoaded} />} />
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
            {!isDemoMode && !Capacitor.isNativePlatform() && (
              <Route path="/moderation" element={<DashboardPage effectiveTheme={effectiveTheme} timeZone={timeZone} />}>
                <Route index element={<DashboardOverviewPage />} />
                <Route path="reports"  element={<ReportsPage />} />
                <Route path="stolen"   element={<ReportsPage isStolen />} />
                <Route path="feedback" element={<FeedbackPage />} />
                <Route path="bugs"     element={<BugsPage />} />
                <Route path="support"  element={<SupportPage />} />
                <Route path="my-work"  element={<MyWorkPage />} />
                <Route path="stats"    element={<StatsPage />} />
                {effectiveProfile?.is_owner && <Route path="finances" element={<FinancesPage />} />}
              </Route>
            )}
            <Route path="*" element={<NotFoundPage effectiveTheme={effectiveTheme} />} />
          </Routes>
        </Box>
      </Box>

      <AppFooter effectiveTheme={effectiveTheme} />

      <ReferralPollModal
        open={!isDemoMode && !!profile && !profile.referral_answered}
        isDark={effectiveTheme === "dark"}
        onDone={() => updateProfile({ referral_answered: true })}
      />

      <DemoDisclaimerModal
        open={demoDisclaimerOpen}
        onClose={() => setDemoDismissed(true)}
        isDark={effectiveTheme === "dark"}
      />

      {isDemoMode && location.pathname === "/" && (
        <NoteCard
          storageKey="demo-feed"
          title="Browse the Feed"
          description="Scroll through lost and found listings from the Northeastern community. Click any card to see details and contact the poster."
        />
      )}
      {isDemoMode && location.pathname === "/map" && (
        <NoteCard
          storageKey="demo-map"
          title="Campus Map"
          description="See lost and found items plotted on the Northeastern campus map. Click any map pin to view listing details."
        />
      )}
      {isDemoMode && location.pathname === "/messages" && (
        <NoteCard
          storageKey="demo-messages"
          title="Direct Messages"
          description="Message other students directly to coordinate item pickups. Built-in safety reminders keep everyone safe."
        />
      )}
    </>
    </ThemeProvider>
  );
}