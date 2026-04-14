import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Box, Typography } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import ShieldIcon from "@mui/icons-material/Shield";
import { useAuth } from "../AuthContext";
import apiFetch from "../utils/apiFetch";
import { DEFAULT_TIME_ZONE } from "../utils/timezone";
import NotFoundPage from "./NotFoundPage";

export default function DashboardPage({ effectiveTheme = "light", timeZone = DEFAULT_TIME_ZONE }) {
  const isDark = effectiveTheme === "dark";
  const isMobile = useMediaQuery("(max-width:600px)");
  const { profile } = useAuth();
  const [moderators, setModerators] = useState([]);

  useEffect(() => {
    if (profile?.is_moderator) {
      apiFetch("/api/moderators")
        .then((d) => setModerators(d?.moderators || []))
        .catch((err) => console.error("Failed to load moderators:", err));
    }
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profile) return null;
  if (!profile.is_moderator) return <NotFoundPage effectiveTheme={effectiveTheme} />;

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", px: { xs: 1, sm: 2, md: 3 }, py: { xs: 1, sm: 2, md: 3 }, color: isDark ? "#D7DADC" : "inherit" }}>
      <Box sx={{ width: "100%", maxWidth: 960 }}>

        {/* Header */}
        <Box sx={{ display: "flex", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, gap: { xs: 1.25, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
          <Box sx={{ width: { xs: 36, sm: 44 }, height: { xs: 36, sm: 44 }, borderRadius: 2, flexShrink: 0, background: isDark ? "rgba(255,255,255,0.08)" : "#A84D4815", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ShieldIcon sx={{ color: "#A84D48", fontSize: { xs: 20, sm: 24 } }} />
          </Box>
          <Box>
            <Typography variant={isMobile ? "h5" : "h4"} fontWeight={900}>Moderation Dashboard</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>
              Manage reports, feedback, and platform health.
            </Typography>
          </Box>
        </Box>

        {/* Page content */}
        <Outlet context={{ isDark, timeZone, moderators }} />
      </Box>
    </Box>
  );
}
