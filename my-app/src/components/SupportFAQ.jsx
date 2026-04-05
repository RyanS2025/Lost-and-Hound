import {
  Accordion, AccordionSummary, AccordionDetails, Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

const FAQ_ITEMS = [
  {
    q: "How do I post a lost or found item?",
    a: 'Tap the "+" button on the Feed page. Fill in the title, location, description, and importance level. You can optionally add a photo and pin the location on the map.',
  },
  {
    q: "Who can use Lost & Hound?",
    a: "Only Northeastern University students with a valid @northeastern.edu email address can create an account.",
  },
  {
    q: "How does messaging work?",
    a: 'When you find a listing that matches your item, click on it and tap "Message" to start a conversation with the poster. Messages are tied to specific listings.',
  },
  {
    q: "How do I set up two-factor authentication (2FA)?",
    a: "After your first login, you'll be prompted to set up 2FA. Scan the QR code with an authenticator app (like Google Authenticator) and enter the verification code.",
  },
  {
    q: "What should I do if I see a false or inappropriate listing?",
    a: "Tap the flag icon on any listing or user profile to submit a report. Moderators review all reports and may remove content or suspend accounts.",
  },
  {
    q: "Is Lost & Hound affiliated with Northeastern University?",
    a: "No. Lost & Hound is a student-made project and is not officially affiliated with or endorsed by Northeastern University.",
  },
  {
    q: "I lost access to my authenticator app. What do I do?",
    a: "For security reasons, 2FA cannot be reset by users directly. Switch to the Submit Ticket tab, select \"Login / Access Issue\" as the category, and a moderator will verify your identity and help you regain access.",
  },
  {
    q: "How do I reset my password?",
    a: 'On the login page, click "Forgot Password?" and enter your @northeastern.edu email. You\'ll receive a reset link in your inbox.',
  },
  {
    q: "How long do listings stay active?",
    a: "Listings are automatically cleaned up after a period of time. If your item has been returned, you can remove the listing yourself.",
  },
];

export default function SupportFAQ({ accent, secondary, divider }) {
  return (
    <>
      {FAQ_ITEMS.map(({ q, a }, i) => (
        <Accordion
          key={i}
          disableGutters
          elevation={0}
          sx={{
            bgcolor: "transparent",
            "&::before": { display: "none" },
            borderBottom: i < FAQ_ITEMS.length - 1 ? `1px solid ${divider}` : "none",
          }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon sx={{ color: accent, fontSize: 20 }} />}
            sx={{
              px: 0,
              minHeight: 44,
              "& .MuiAccordionSummary-content": { my: 1 },
            }}
          >
            <Typography fontWeight={700} fontSize={13.5}>
              {q}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ px: 0, pt: 0, pb: 1.5 }}>
            <Typography
              variant="body2"
              sx={{ color: secondary, lineHeight: 1.6, fontSize: 13 }}
            >
              {a}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ))}
    </>
  );
}
