import { useMemo, useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
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
      "Lost & Hound was built by Nahom Hailemelekot, Benjamin Hailu, Liam Pulsifer, and Ryan Sinha.",
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
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const isDark = effectiveTheme === "dark";

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      const show = Keyboard.addListener("keyboardWillShow", () => setKeyboardOpen(true));
      const hide = Keyboard.addListener("keyboardWillHide", () => setKeyboardOpen(false));
      return () => { show.then((h) => h.remove()); hide.then((h) => h.remove()); };
    }
    // Web browser fallback
    const vv = window.visualViewport;
    if (!vv) return;
    const handle = () => setKeyboardOpen(window.innerHeight - vv.height > 100);
    vv.addEventListener("resize", handle);
    return () => vv.removeEventListener("resize", handle);
  }, []);

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
      {!keyboardOpen && <Box
        component="footer"
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: styles.border,
          background: styles.bg,
          zIndex: 1200,
          pb: "env(safe-area-inset-bottom)",
        }}
      >
        <Box
          sx={{
            height: 56,
            px: { xs: 2, sm: 2 },
            display: { xs: "flex", md: "grid" },
            gridTemplateColumns: { md: "1fr auto 1fr" },
            alignItems: "center",
            justifyContent: { xs: "center" },
          }}
        >
          {/* Left — hidden on mobile */}
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

          {/* Center — truly centered on desktop via grid, flex-center on mobile */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 0, justifyContent: "center" }}>
            {[
              { label: "Credits", action: () => setOpenModal("credits") },
              { label: "Disclaimer", action: () => setOpenModal("disclaimer") },
              { label: "Terms", action: () => setTermsOpen(true) },
              { label: "Privacy", action: () => setOpenModal("privacy") },
              { label: "Support", action: () => setSupportOpen(true) },
            ].map((item, i, arr) => (
              <Box key={item.label} sx={{ display: "flex", alignItems: "center" }}>
                <Button
                  size="small"
                  sx={{
                    color: styles.accent,
                    fontWeight: 700,
                    fontSize: 15,
                    px: { xs: 1, sm: 1.25 },
                    py: 0.75,
                    minWidth: 0,
                    lineHeight: 1,
                  }}
                  onClick={item.action}
                >
                  {item.label}
                </Button>
                {i < arr.length - 1 && (
                  <Typography sx={{ color: styles.text, fontSize: 15, userSelect: "none", opacity: 0.6, lineHeight: 1 }}>·</Typography>
                )}
              </Box>
            ))}
          </Box>

          {/* Right — hidden on mobile */}
          <Box sx={{ display: { xs: "none", md: "flex" }, justifyContent: "flex-end" }}>
            <Button
              component="a"
              href="https://www.northeastern.edu/"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: styles.accent, fontWeight: 700, px: 1.5, py: 0.75, minWidth: 0, textTransform: "none", fontSize: 14 }}
            >
              Northeastern
            </Button>
          </Box>
        </Box>
      </Box>}

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
        open={supportOpen}
        onClose={() => setSupportOpen(false)}
        effectiveTheme={effectiveTheme}
      />
    </>
  );
}