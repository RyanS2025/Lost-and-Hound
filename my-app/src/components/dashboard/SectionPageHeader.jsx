import { Link } from "react-router-dom";
import { Box, Typography, Button, Divider } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

/**
 * Shared back-nav + section title header for every dashboard section page.
 * Usage: <SectionPageHeader icon={<BugReportIcon />} title="Bug Reports" subtitle="..." isDark={isDark} />
 */
export default function SectionPageHeader({ icon, title, subtitle, isDark }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
      <Button
        component={Link}
        to="/moderation"
        startIcon={<ArrowBackIcon sx={{ fontSize: 15 }} />}
        sx={{
          color: "text.secondary",
          fontWeight: 600,
          fontSize: 13,
          textTransform: "none",
          px: 1.25,
          minWidth: 0,
          flexShrink: 0,
          "&:hover": { background: isDark ? "#343536" : "#f5f5f5" },
        }}
      >
        Dashboard
      </Button>

      <Divider
        orientation="vertical"
        flexItem
        sx={{ borderColor: isDark ? "rgba(255,255,255,0.14)" : "#e0e0e0" }}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 2, flexShrink: 0,
          background: isDark ? "rgba(255,255,255,0.07)" : "#f5eded",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h5"
            fontWeight={900}
            sx={{ lineHeight: 1.2, color: isDark ? "#D7DADC" : "inherit", fontSize: { xs: 18, sm: 22 } }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
