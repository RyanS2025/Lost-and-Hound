import { Box, Container, Typography, Divider, Link } from "@mui/material";
import { useNavigate } from "react-router-dom";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

const BRAND = { maroon: "#A84D48" };

export default function PrivacyPage({ effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const navigate = useNavigate();
  const bg = isDark ? "#1a1a1a" : "#f9f5f4";
  const cardBg = isDark ? "#232427" : "#fff";
  const text = isDark ? "#e8e4e4" : "#1a1a1a";

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: bg, py: 4 }}>
      <Container maxWidth="md">
        <Box
          sx={{ display: "flex", alignItems: "center", mb: 3, cursor: "pointer", color: BRAND.maroon }}
          onClick={() => navigate(-1)}
        >
          <ArrowBackIcon sx={{ mr: 1 }} />
          <Typography fontWeight={600}>Back</Typography>
        </Box>
        <Box sx={{ bgcolor: cardBg, borderRadius: 3, p: { xs: 3, md: 5 }, color: text }}>
          <Typography variant="h4" fontWeight={800} sx={{ color: BRAND.maroon, mb: 1 }}>
            Privacy Policy
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
            Lost &amp; Hound · Last updated April 2026
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Section title="What We Collect">
            <Li>Name, email address, and campus location (required to create an account)</Li>
            <Li>Lost/found item listings you create, including text descriptions and photos</Li>
            <Li>Messages you send to other users through the app</Li>
            <Li>Device push notification token (to deliver push notifications)</Li>
            <Li>Face ID enrollment status — stored locally on your device only; never transmitted to our servers</Li>
          </Section>

          <Section title="How We Use It">
            <Li>To operate the lost-and-found matching service</Li>
            <Li>To send push notifications about new messages and community updates (opt out any time in Settings → Notifications)</Li>
            <Li>To moderate content and enforce community guidelines</Li>
          </Section>

          <Section title="Third-Party Services">
            <Li>
              <strong>Supabase</strong> — Database and authentication. Your account data and listings are stored on Supabase servers.{" "}
              <Link href="https://supabase.com/privacy" target="_blank" rel="noreferrer">supabase.com/privacy</Link>
            </Li>
            <Li>
              <strong>Google Cloud Vision API</strong> — Images you upload are sent to Google's Vision API for content safety screening. Google does not store or use these images beyond the screening request.{" "}
              <Link href="https://cloud.google.com/terms/data-processing-terms" target="_blank" rel="noreferrer">Google's data processing terms</Link>
            </Li>
            <Li>
              <strong>OneSignal</strong> — Push notification delivery. Your device token and notification content are processed by OneSignal.{" "}
              <Link href="https://onesignal.com/privacy_policy" target="_blank" rel="noreferrer">onesignal.com/privacy_policy</Link>
            </Li>
            <Li>
              <strong>Resend</strong> — Transactional email delivery (password resets, email verification). Your email address is processed by Resend for delivery only.
            </Li>
            <Li>
              <strong>Google Maps</strong> — Map display and campus location picker.{" "}
              <Link href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</Link>
            </Li>
          </Section>

          <Section title="Data Retention">
            <Li>Your account and all associated data is deleted immediately when you use Delete Account in Settings</Li>
            <Li>Messages and listings may be retained for up to 30 days after deletion for moderation purposes</Li>
            <Li>Push notification delivery logs are retained for usage monitoring</Li>
          </Section>

          <Section title="Your Rights">
            <Li>Delete your account and all data: Settings → Delete Account</Li>
            <Li>Opt out of push notifications: Settings → Notifications</Li>
            <Li>Contact us with data requests: <Link href="mailto:support@thelostandhound.com">support@thelostandhound.com</Link></Li>
          </Section>

          <Divider sx={{ my: 3 }} />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            © 2026 Lost &amp; Hound · Oasis @ Northeastern
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>{title}</Typography>
      <Box component="ul" sx={{ pl: 2, m: 0 }}>{children}</Box>
    </Box>
  );
}

function Li({ children }) {
  return (
    <Typography component="li" variant="body2" sx={{ mb: 0.75 }}>{children}</Typography>
  );
}
