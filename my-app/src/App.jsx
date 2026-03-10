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
import { useState } from 'react';

// --- App: Main application component with routing and navigation ---
export default function App() {
  const { user, profile, logout } = useAuth();

  if (!user) {
    return <LoginPage />;
  }

  // Supabase sends verification emails automatically. Optionally, you can add a check for user.confirmed_at if you want to block unverified users.

  return (
    <>
      {/* Main app content overlayed above background */}
      <AppBar position="fixed">
        <Toolbar>
          {/* Brand logo + name */}
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
            to = "/messages"
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
      <Toolbar /> {/* Spacer for fixed AppBar */}
      <Box sx={{ mt: 0, pb: "48px" }}>
        <Routes>
          <Route path="/" element={<FeedPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path = "/messages" element = {<MessagePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/moderation" element={<DashboardPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Box>

      {/* Footer */}
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
