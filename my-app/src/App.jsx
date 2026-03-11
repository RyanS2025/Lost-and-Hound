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
import HomeIcon from '@mui/icons-material/Home';
import FeedIcon from "@mui/icons-material/DynamicFeed";
import MapIcon from '@mui/icons-material/Map';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import MessageIcon from '@mui/icons-material/Message';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import { useState, useCallback, useRef } from 'react';

// --- App: Main application component with routing and navigation ---
export default function App() {
  const { user, profile, logout } = useAuth();

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
    return <LoginPage loginTransition={loginTransition} onLoginSuccess={onLoginSuccess} />;
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
        <>
          <AppBar position="fixed">
            <Toolbar>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Box component="img" src="/LostandHoundLogo.PNG" alt="Lost & Hound logo"
                  sx={{ height: 32, width: 32, objectFit: "contain", filter: "brightness(0) invert(1)" }} />
                <Typography variant="h6" fontWeight={900} sx={{ letterSpacing: 0.5 }}>
                  Lost &amp; Hound
                </Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Button color="inherit" onClick={logout} endIcon={<LogoutIcon />}>Log Out</Button>
            </Toolbar>
          </AppBar>
          <Toolbar />
          <Box sx={{
            display: "flex", justifyContent: "center", alignItems: "center",
            minHeight: "calc(100vh - 140px)", p: 3,
          }}>
            <Paper elevation={0} sx={{
              p: 4, pt: 0, borderRadius: 3, textAlign: "center", maxWidth: 380,
              border: "1.5px solid #ecdcdc", overflow: "visible",
            }}>
              <Box component="img" src="/HuskyBan.png" alt="Banned husky"
                sx={{ width: "100%", maxWidth: 260, mx: "auto", display: "block", mt: -6, mb: -2 }} />
              <Typography variant="h3" fontWeight={900} sx={{ mb: 0.5, color: "#3d2020" }}>
                Account Suspended
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {isPermanent
                  ? "Your account has been permanently suspended."
                  : `Your account is suspended until ${bannedUntil.toLocaleDateString([], { month: "long", day: "numeric", year: "numeric" })}.`}
              </Typography>
              {profile.ban_reason && (
                <Typography variant="body2" sx={{ mb: 2, color: "#A84D48", fontWeight: 600 }}>
                  {profile.ban_reason}
                </Typography>
              )}
              <Button variant="contained" onClick={logout}
                sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 700, borderRadius: 2, px: 4 }}>
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
              borderTop: "1px solid #ecdcdc",
              background: "#fff",
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
      );
    }
  }

  // Check if we should fade in (came from login animation)
  const shouldFadeIn = didLoginTransition.current;
  // Reset the ref so refreshes / normal navigation don't fade
  didLoginTransition.current = false;

  return (
    <>
    <AppBar position="fixed">
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
            <Route path="/" element={<FeedPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/messages" element={<MessagePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/moderation" element={<DashboardPage />} />
            <Route path="*" element={<NotFoundPage />} />
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
          borderTop: "1px solid #ecdcdc",
          background: "#fff",
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
  );
}