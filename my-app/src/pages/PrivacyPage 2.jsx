import { Box, Container, Typography, Divider, Link, Chip } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SecurityIcon from "@mui/icons-material/Security";
import StorageIcon from "@mui/icons-material/Storage";
import NotificationsIcon from "@mui/icons-material/NotificationsNone";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import IntegrationInstructionsIcon from "@mui/icons-material/IntegrationInstructions";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

export default function PrivacyPage({ effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const navigate = useNavigate();

  const BRAND = {
    accent:           isDark ? "#FF4500" : "#A84D48",
    bg:               isDark ? "#030303" : "#f5f0f0",
    dot:              isDark ? "rgba(255,255,255,0.07)" : "rgba(168,77,72,0.12)",
    paper:            isDark ? "#1A1A1B" : "#fff",
    border:           isDark ? "rgba(255,255,255,0.10)" : "#ecdcdc",
    title:            isDark ? "#D7DADC" : "#3d2020",
    secondaryText:    isDark ? "#818384" : "#6b4a4a",
    gradientStart:    isDark ? "#1f252b" : "#A84D48",
    gradientEnd:      isDark ? "#141619" : "#7a2929",
    sectionBg:        isDark ? "#232427" : "#fdf7f7",
    chipBg:           isDark ? "rgba(255,69,0,0.12)" : "rgba(168,77,72,0.08)",
    chipColor:        isDark ? "#FF4500" : "#A84D48",
  };

  return (
    <Box sx={{
      minHeight: "100vh",
      bgcolor: BRAND.bg,
      backgroundImage: `radial-gradient(circle, ${BRAND.dot} 1px, transparent 1px)`,
      backgroundSize: "24px 24px",
    }}>
      {/* Gradient hero header */}
      <Box sx={{
        background: `linear-gradient(160deg, ${BRAND.gradientStart} 0%, ${BRAND.gradientEnd} 100%)`,
        position: "relative",
        overflow: "hidden",
        pb: 5,
        pt: 2,
      }}>
        {/* Decorative circles */}
        <Box sx={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)", bottom: -100, right: -80, pointerEvents: "none" }} />
        <Box sx={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)", top: -60, left: -60, pointerEvents: "none" }} />

        <Container maxWidth="md" sx={{ position: "relative", zIndex: 1 }}>
          {/* Back button */}
          <Box
            onClick={() => navigate(-1)}
            sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, cursor: "pointer", color: "rgba(255,255,255,0.8)", mb: 4, mt: { xs: 5, sm: 2 }, "&:hover": { color: "#fff" }, transition: "color 0.15s" }}
          >
            <ArrowBackIcon sx={{ fontSize: 18 }} />
            <Typography variant="body2" fontWeight={600}>Back</Typography>
          </Box>

          {/* Logo */}
          <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
            <Box
              component="img"
              src="/MainLogoTextAlt.png"
              alt="Lost & Hound"
              sx={{ width: { xs: 160, md: 200 }, filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}
            />
          </Box>

          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h4" fontWeight={900} sx={{ color: "#fff", letterSpacing: "-0.5px", mb: 0.75 }}>
              Privacy Policy
            </Typography>
            <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.65)", fontWeight: 500 }}>
              Last updated April 2026
            </Typography>
          </Box>
        </Container>
      </Box>

      {/* Content */}
      <Container maxWidth="md" sx={{ py: 5 }}>
        {/* Intro card */}
        <Box sx={{ bgcolor: BRAND.paper, borderRadius: 3, p: { xs: 3, md: 4 }, mb: 3, border: `1px solid ${BRAND.border}` }}>
          <Typography variant="body1" sx={{ color: BRAND.title, lineHeight: 1.75 }}>
            Lost &amp; Hound is Northeastern's community lost-and-found platform. We take your privacy seriously.
            This policy explains what data we collect, how we use it, and your rights.
          </Typography>
        </Box>

        {/* Sections */}
        <Section icon={<StorageIcon />} title="What We Collect" brand={BRAND}>
          <Item brand={BRAND}>Name, email address, and campus location — required to create an account</Item>
          <Item brand={BRAND}>Lost/found item listings you create, including text descriptions and photos</Item>
          <Item brand={BRAND}>Messages you send to other users through the app</Item>
          <Item brand={BRAND}>Device push notification token to deliver push notifications</Item>
          <Item brand={BRAND}>Face ID enrollment status — stored locally on your device only, never sent to our servers</Item>
        </Section>

        <Section icon={<SecurityIcon />} title="How We Use It" brand={BRAND}>
          <Item brand={BRAND}>To operate the lost-and-found matching service</Item>
          <Item brand={BRAND}>To send push notifications about new messages and community updates (opt out any time in Settings → Notifications)</Item>
          <Item brand={BRAND}>To moderate content and enforce community guidelines</Item>
        </Section>

        <Section icon={<IntegrationInstructionsIcon />} title="Third-Party Services" brand={BRAND}>
          <ThirdParty brand={BRAND} name="Supabase" desc="Database and authentication. Your account data and listings are stored on Supabase servers." href="https://supabase.com/privacy" />
          <ThirdParty brand={BRAND} name="Google Cloud Vision API" desc="Images you upload are sent to Google's Vision API for content safety screening. Google does not store or use these images beyond the screening request." href="https://cloud.google.com/terms/data-processing-terms" />
          <ThirdParty brand={BRAND} name="OneSignal" desc="Push notification delivery. Your device token and notification content are processed by OneSignal." href="https://onesignal.com/privacy_policy" />
          <ThirdParty brand={BRAND} name="Resend" desc="Transactional email delivery (password resets, email verification). Your email address is processed by Resend for delivery only." />
          <ThirdParty brand={BRAND} name="Google Maps" desc="Map display and campus location picker." href="https://policies.google.com/privacy" />
        </Section>

        <Section icon={<AccessTimeIcon />} title="Data Retention" brand={BRAND}>
          <Item brand={BRAND}>Your account and all associated data is deleted immediately when you use Delete Account in Settings</Item>
          <Item brand={BRAND}>Messages and listings may be retained for up to 30 days after deletion for moderation purposes</Item>
          <Item brand={BRAND}>Push notification delivery logs are retained for usage monitoring</Item>
        </Section>

        <Section icon={<DeleteOutlineIcon />} title="Your Rights" brand={BRAND}>
          <Item brand={BRAND}>Delete your account and all data: Settings → Delete Account</Item>
          <Item brand={BRAND}>Opt out of push notifications: Settings → Notifications</Item>
          <Item brand={BRAND}>Contact us with data requests: <Link href="mailto:thelostandhoundservices@gmail.com" sx={{ color: BRAND.accent, fontWeight: 600 }}>thelostandhoundservices@gmail.com</Link></Item>
        </Section>

        <Divider sx={{ borderColor: BRAND.border, my: 4 }} />
        <Typography variant="caption" sx={{ color: BRAND.secondaryText, display: "block", textAlign: "center" }}>
          © 2026 Lost &amp; Hound · Oasis @ Northeastern
        </Typography>
      </Container>
    </Box>
  );
}

function Section({ icon, title, children, brand }) {
  return (
    <Box sx={{ bgcolor: brand.paper, borderRadius: 3, p: { xs: 3, md: 4 }, mb: 3, border: `1px solid ${brand.border}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}>
        <Box sx={{ color: brand.accent, display: "flex" }}>{icon}</Box>
        <Typography variant="h6" fontWeight={800} sx={{ color: brand.title, letterSpacing: "-0.3px" }}>{title}</Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>{children}</Box>
    </Box>
  );
}

function Item({ children, brand }) {
  return (
    <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
      <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: brand.accent, mt: "8px", flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: brand.title, lineHeight: 1.7 }}>{children}</Typography>
    </Box>
  );
}

function ThirdParty({ name, desc, href, brand }) {
  return (
    <Box sx={{ bgcolor: brand.sectionBg, borderRadius: 2, p: 2, border: `1px solid ${brand.border}` }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
        <Typography variant="body2" fontWeight={800} sx={{ color: brand.title }}>{name}</Typography>
        {href && (
          <Link href={href} target="_blank" rel="noreferrer" underline="none">
            <Chip label="Privacy Policy" size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: brand.chipBg, color: brand.chipColor, cursor: "pointer", "&:hover": { opacity: 0.8 } }} />
          </Link>
        )}
      </Box>
      <Typography variant="body2" sx={{ color: brand.secondaryText, lineHeight: 1.65 }}>{desc}</Typography>
    </Box>
  );
}
