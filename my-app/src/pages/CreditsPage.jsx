import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box, Container, Typography, Avatar, Chip, Paper,
  Dialog, DialogContent, IconButton, Divider, Fade,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import GitHubIcon from "@mui/icons-material/GitHub";
import LanguageIcon from "@mui/icons-material/Language";

const TEAM = [
  {
    name: "Ryan Sinha",
    role: "Co-Founder",
    photo: "/team/ryan.png",
    bio: "Computer Science, Northeastern University '29. Full-stack developer focused on interactive web design and user-focused tools.",
    linkedin: "https://www.linkedin.com/in/ryan-sinha-306986387/",
    github: "https://github.com/RyanS2025",
    website: "https://ryansinha.dev",
  },
  {
    name: "Nahom Hailemelekot",
    role: "Co-Founder",
    photo: "/team/nahom.png",
    bio: "Computer Science, Northeastern University '29. Software engineer passionate about building impactful applications.",
    linkedin: "https://www.linkedin.com/in/nahom-hailemelekot-993bab342/",
    github: "https://github.com/NahomHaile",
  },
  {
    name: "Benjamin Hailu",
    role: "Co-Founder",
    photo: "/team/benjamin.png",
    bio: "Computer Science, Northeastern University '29. Developer with a focus on clean design and scalable systems.",
    linkedin: "https://www.linkedin.com/in/benjaminhailu/",
    github: "https://github.com/hailube",
    website: "https://benhailu.com",
  },
  {
    name: "Liam Pulsifer",
    role: "Co-Founder",
    photo: "/team/liam.png",
    bio: "Computer Science, Northeastern University '29. Engineer driven by problem-solving and collaborative development.",
    linkedin: "https://www.linkedin.com/in/liam-pulsifer-1b91773b9/",
    github: "https://github.com/LiamPulsifer",
  },
  {
    name: "Shamar Aitcheson",
    role: "Co-Founder",
    photo: "/team/shamar.jpg",
    bio: "Cybersecurity, Northeastern University '29. Developer with a focus on interactive web design and user-interactive models. Also a music producer.",
    linkedin: "https://www.linkedin.com/in/shamar-aitcheson-5309bb29a/",
    github: "https://github.com/AitchesonS06",
    website: "https://youtube.com/@martoonnabeat",
  },
];

export default function CreditsPage({ effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);

  const BRAND = {
    accent:        isDark ? "#FF4500" : "#A84D48",
    accentHover:   isDark ? "#E03D00" : "#8f3e3a",
    bg:            isDark ? "#030303" : "#f5f0f0",
    dot:           isDark ? "rgba(255,255,255,0.07)" : "rgba(168,77,72,0.12)",
    paper:         isDark ? "#1A1A1B" : "#fff",
    border:        isDark ? "rgba(255,255,255,0.10)" : "#ecdcdc",
    title:         isDark ? "#D7DADC" : "#3d2020",
    secondaryText: isDark ? "#818384" : "#6b4a4a",
    sectionBg:     isDark ? "#232427" : "#fdf7f7",
    chipBg:        isDark ? "rgba(255,69,0,0.12)" : "rgba(168,77,72,0.08)",
    chipColor:     isDark ? "#FF4500" : "#A84D48",
    heroOverlay:   isDark ? "rgba(3,3,3,0.55)" : "rgba(122,41,41,0.60)",
  };

  return (
    <Box sx={{
      minHeight: "100vh",
    }}>
      {/* Hero — team photo as full banner with red overlay */}
      <Box sx={{
        position: "relative",
        zIndex: 1,
        overflow: "hidden",
        pb: 6,
        pt: 2,
      }}>
        {/* Team photo background */}
        <Box sx={{
          position: "absolute",
          inset: 0,
          backgroundImage: "url(/team/teamhero.png)",
          backgroundSize: "cover",
          backgroundPosition: "center 60%",
        }} />
        {/* Red tint overlay */}
        <Box sx={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${BRAND.heroOverlay} 0%, ${isDark ? "rgba(3,3,3,0.85)" : "rgba(122,41,41,0.78)"} 100%)`,
        }} />

        <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
          <Box
            onClick={() => navigate(-1)}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, cursor: "pointer", color: "rgba(255,255,255,0.8)", mb: 4, mt: { xs: 5, sm: 2 }, "&:hover": { color: "#fff" }, transition: "color 0.15s" }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" fontWeight={600}>Back</Typography>
          </Box>

          <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
            <Box
              component="img"
              src="/MainLogoTextAlt.png"
              alt="Lost & Hound"
              sx={{ width: { xs: 160, md: 200 }, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}
            />
          </Box>

          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h4" fontWeight={900} sx={{ color: "#fff", letterSpacing: "-0.5px", mb: 0.75, textShadow: "0 2px 12px rgba(0,0,0,0.3)" }}>
              Meet the Team
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.75)", fontWeight: 500, textShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
              The people behind Lost &amp; Hound
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 5, position: "relative", zIndex: 1 }}>
        {/* Intro card */}
        <Box sx={{ bgcolor: BRAND.paper, borderRadius: 3, p: { xs: 3, md: 4 }, mb: 3, border: `1px solid ${BRAND.border}` }}>
          <Typography variant="body1" sx={{ color: BRAND.title, lineHeight: 1.75, textAlign: "center" }}>
            Lost &amp; Hound was created by four Computer Science students at Northeastern University,
            united by the goal of helping students reunite with their lost belongings.
          </Typography>
        </Box>

        {/* Team grid */}
        <Box sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
          gap: 3,
          mb: 3,
        }}>
          {TEAM.map((member, i) => (
            <Fade in timeout={400 + i * 150} key={member.name}>
              <Paper
                elevation={0}
                onClick={() => setSelected(member)}
                sx={{
                  p: { xs: 3, md: 3.5 },
                  borderRadius: 3,
                  border: `1px solid ${BRAND.border}`,
                  bgcolor: BRAND.paper,
                  cursor: "pointer",
                  textAlign: "center",
                  position: "relative",
                  overflow: "hidden",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    borderColor: isDark ? "rgba(255,69,0,0.3)" : "rgba(168,77,72,0.25)",
                    boxShadow: isDark
                      ? "0 8px 32px rgba(255,69,0,0.12)"
                      : "0 8px 32px rgba(168,77,72,0.10)",
                  },
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: 0, left: 0, right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${BRAND.accent}, ${BRAND.accentHover})`,
                    opacity: 0,
                    transition: "opacity 0.25s",
                  },
                  "&:hover::before": { opacity: 1 },
                }}
              >
                <Box sx={{
                  width: 88, height: 88,
                  borderRadius: "50%",
                  p: "3px",
                  background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentHover})`,
                  mx: "auto",
                  mb: 2,
                }}>
                  <Avatar
                    src={member.photo}
                    alt={member.name}
                    sx={{ width: "100%", height: "100%", border: `3px solid ${BRAND.paper}` }}
                  />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, color: BRAND.title, mb: 0.5, fontSize: 17, letterSpacing: "-0.3px" }}>
                  {member.name}
                </Typography>
                <Chip
                  label={member.role}
                  size="small"
                  sx={{ bgcolor: BRAND.chipBg, color: BRAND.chipColor, fontWeight: 700, fontSize: 11, height: 24 }}
                />
                <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5, mt: 1.5 }}>
                  <LinkedInIcon sx={{ fontSize: 18, color: BRAND.secondaryText, opacity: 0.6 }} />
                  <GitHubIcon sx={{ fontSize: 18, color: BRAND.secondaryText, opacity: 0.6 }} />
                  {member.website && <LanguageIcon sx={{ fontSize: 18, color: BRAND.secondaryText, opacity: 0.6 }} />}
                </Box>
              </Paper>
            </Fade>
          ))}
        </Box>

        <Divider sx={{ borderColor: BRAND.border, my: 4 }} />
        <Typography variant="caption" sx={{ color: BRAND.secondaryText, display: "block", textAlign: "center" }}>
          © 2026 Lost &amp; Hound · Oasis @ Northeastern
        </Typography>
      </Container>

      {/* Detail modal */}
      <Dialog
        open={!!selected}
        onClose={() => setSelected(null)}
        fullWidth
        maxWidth="sm"
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 250 }}
        slotProps={{
          backdrop: {
            sx: { bgcolor: isDark ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.6)" },
          },
        }}
        PaperProps={{
          sx: {
            bgcolor: BRAND.paper,
            border: `1px solid ${BRAND.border}`,
            borderRadius: 3,
            overflow: "hidden",
          },
        }}
      >
        {selected && (
          <>
            <IconButton
              onClick={() => setSelected(null)}
              size="small"
              sx={{ position: "absolute", right: 8, top: 8, zIndex: 1, color: BRAND.secondaryText, "&:hover": { color: BRAND.title, bgcolor: BRAND.sectionBg } }}
              aria-label="Close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>

            <DialogContent sx={{ textAlign: "center", pt: 5, pb: 5, px: 4 }}>
              <Box sx={{
                width: 140, height: 140,
                borderRadius: "50%",
                p: "4px",
                background: `linear-gradient(135deg, ${BRAND.accent}, ${BRAND.accentHover})`,
                mx: "auto",
                mb: 3,
              }}>
                <Avatar
                  src={selected.photo}
                  alt={selected.name}
                  sx={{ width: "100%", height: "100%", border: `4px solid ${BRAND.paper}` }}
                />
              </Box>

              <Typography variant="h4" sx={{ fontWeight: 900, color: BRAND.title, mb: 0.75, letterSpacing: "-0.3px" }}>
                {selected.name}
              </Typography>
              <Chip
                label={selected.role}
                sx={{ bgcolor: BRAND.chipBg, color: BRAND.chipColor, fontWeight: 700, fontSize: 14, height: 30, mb: 3 }}
              />
              <Typography variant="body1" sx={{ color: BRAND.secondaryText, lineHeight: 1.8, mb: 3.5, px: 2, fontSize: 16 }}>
                {selected.bio}
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "center", gap: 1.5 }}>
                {[
                  { icon: <LinkedInIcon sx={{ fontSize: 26 }} />, href: selected.linkedin, label: "LinkedIn" },
                  { icon: <GitHubIcon sx={{ fontSize: 26 }} />, href: selected.github, label: "GitHub" },
                  ...(selected.website ? [{ icon: <LanguageIcon sx={{ fontSize: 26 }} />, href: selected.website, label: "Website" }] : []),
                ].map((link) => (
                  <IconButton
                    key={link.label}
                    component="a"
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                    sx={{
                      color: BRAND.accent,
                      bgcolor: BRAND.sectionBg,
                      border: `1px solid ${BRAND.border}`,
                      width: 52, height: 52,
                      transition: "all 0.2s",
                      "&:hover": { bgcolor: BRAND.chipBg, borderColor: BRAND.accent, transform: "scale(1.08)" },
                    }}
                  >
                    {link.icon}
                  </IconButton>
                ))}
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
}
