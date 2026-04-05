import { useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  IconButton,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TermsModal from "./TermsModal";
import SupportModal from "./SupportModal";
const MODAL_CONTENT = {
  credits: {
    title: "Credits",
    body: [
      "Lost & Hound was built by Nahom Hailemelekot, Benjamin Haillu, Liam Pulsifer, and Ryan Sinha.",
      "Project context: Oasis @ Northeastern University.",
    ],
  },
  disclaimer: {
    title: "Disclaimer",
    body: [
      "Lost & Hound is a student-made project created as part of Oasis @ Northeastern University.",
      "This project is not affiliated with, endorsed by, or related to Northeastern University. It is an independent student initiative.",
    ],
  },
  privacy: {
    title: "Privacy & Data",
    body: [
      "We store account profile information and app content needed to operate Lost & Hound, including listings and messages.",
      "Data may be reviewed by moderators only when reports are submitted or policy enforcement is required.",
      "You can request account removal from Settings, subject to moderation and legal retention requirements.",
    ],
  },
};

export default function AppFooter({ effectiveTheme = "light" }) {
  const [openModal, setOpenModal] = useState(null);
  const [termsOpen, setTermsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const isDark = effectiveTheme === "dark";

  const styles = useMemo(
    () => ({
      bg: isDark ? "#121213" : "#fff",
      border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #ecdcdc",
      text: isDark ? "#B8BABD" : "#6b6b6b",
      accent: isDark ? "#FF8A5C" : "#A84D48",
      dialogBg: isDark ? "#1A1A1B" : "#fff",
      dialogBorder: isDark ? "1px solid rgba(255,255,255,0.16)" : "1px solid #ecdcdc",
    }),
    [isDark]
  );

  const modal = openModal ? MODAL_CONTENT[openModal] : null;

  return (
    <>
      <Box
        component="footer"
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          minHeight: 46,
          px: { xs: 1.25, sm: 2 },
          borderTop: styles.border,
          background: styles.bg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          zIndex: 1200,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: styles.text,
            fontWeight: 700,
            whiteSpace: "nowrap",
            display: { xs: "none", md: "block" },
          }}
        >
          Lost &amp; Hound · Oasis @ Northeastern
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            overflowX: "auto",
            "&::-webkit-scrollbar": { display: "none" },
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          <Button size="small" sx={{ color: styles.accent, fontWeight: 700 }} onClick={() => setOpenModal("credits")}>
            Credits
          </Button>
          <Button size="small" sx={{ color: styles.accent, fontWeight: 700 }} onClick={() => setOpenModal("disclaimer")}>
            Disclaimer
          </Button>
          <Button size="small" sx={{ color: styles.accent, fontWeight: 700 }} onClick={() => setTermsOpen(true)}>
            Terms
          </Button>
          <Button size="small" sx={{ color: styles.accent, fontWeight: 700 }} onClick={() => setOpenModal("privacy")}>
            Privacy
          </Button>
          {/* TODO: wire support channel once contact workflow is finalized. */}
          <Button size="small" sx={{ color: styles.accent, fontWeight: 700 }} onClick={() => setSupportOpen(true)}>
            Support
          </Button>
          <Button
            size="small"
            component="a"
            href="https://www.northeastern.edu/"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: styles.accent, fontWeight: 700 }}
          >
            Northeastern
          </Button>
        </Box>
      </Box>

      <Dialog
        open={!!modal}
        onClose={() => setOpenModal(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            background: styles.dialogBg,
            border: styles.dialogBorder,
            borderRadius: 2.5,
          },
        }}
      >
        <DialogTitle sx={{ pr: 6, fontWeight: 800 }}>
          {modal?.title}
          <IconButton
            onClick={() => setOpenModal(null)}
            size="small"
            sx={{ position: "absolute", right: 12, top: 12 }}
            aria-label="Close"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ borderColor: isDark ? "rgba(255,255,255,0.12)" : "#ecdcdc" }}>
          {modal?.body.map((line) => (
            <DialogContentText key={line} sx={{ mb: 1.25 }}>
              {line}
            </DialogContentText>
          ))}
        </DialogContent>
      </Dialog>

      <TermsModal
        open={termsOpen}
        onClose={() => setTermsOpen(false)}
        readOnly
        effectiveTheme={effectiveTheme}
      />

      <SupportModal
        open={supportOpen} // Render the modal when supportOpen is true
        onClose={() => setSupportOpen(false)} // Close the modal when requested
        effectiveTheme={effectiveTheme} // Pass the theme prop if needed
      />
    </>
  );
}