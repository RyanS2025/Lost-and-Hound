import { useEffect, useState } from "react";
import { Box, Typography } from "@mui/material";
import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

const MESSAGES = [
  "Sniffing for lost items...",
  "Chasing squirrels...",
  "Fetching your data...",
  "Wagging tail...",
  "Digging up listings...",
  "Following the scent...",
  "Nose to the ground...",
  "Running in circles...",
  "Almost home!",
];

export default function LoadingScreen() {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const accent = prefersDark ? "#FF4500" : "#A84D48";
  const bg = prefersDark ? "#101214" : "#f5f0f0";
  const dot = prefersDark ? "rgba(255,255,255,0.07)" : "rgba(122,41,41,0.18)";
  const track = prefersDark ? "rgba(255,255,255,0.08)" : "rgba(168,77,72,0.12)";

  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      SplashScreen.hide({ fadeOutDuration: 200 });
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => setMsgIndex((i) => (i + 1) % MESSAGES.length), 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <Box sx={{
      position: "fixed", inset: 0, zIndex: 9999,
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      backgroundColor: bg,
      backgroundImage: `radial-gradient(circle, ${dot} 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
      gap: 3,
    }}>
      <Box sx={{ position: "relative", width: 340, height: 340, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Box component="svg" width="340" height="340" viewBox="0 0 340 340"
          sx={{
            position: "absolute", top: 0, left: 0,
            transformOrigin: "170px 170px",
            animation: "spinLogo 1.4s linear infinite",
            "@keyframes spinLogo": { to: { transform: "rotate(360deg)" } },
          }}>
          <circle cx="170" cy="170" r="168" fill="none" stroke={track} strokeWidth="2" />
          <circle cx="170" cy="170" r="168" fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeDasharray="791 264" />
        </Box>
        <Box component="img" src="/TabLogo.png" alt="Lost & Hound"
          sx={{ width: 230, height: 230, objectFit: "contain", position: "relative", zIndex: 1 }} />
      </Box>
      <Typography
        key={msgIndex}
        sx={{
          fontSize: 18, fontWeight: 800, color: accent, opacity: 0.9,
          animation: "fadeInMsg 0.3s ease",
          "@keyframes fadeInMsg": {
            from: { opacity: 0, transform: "translateY(4px)" },
            to: { opacity: 0.9, transform: "translateY(0)" },
          },
        }}
      >
        {MESSAGES[msgIndex]}
      </Typography>
    </Box>
  );
}
