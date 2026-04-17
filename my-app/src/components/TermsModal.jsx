import { useState, useRef, useEffect, useMemo } from "react";
import {
  Dialog, DialogContent, DialogActions, Box, Typography, Button, IconButton, Checkbox,
  FormControlLabel, Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import GavelIcon from "@mui/icons-material/Gavel";

const SECTIONS = [
  {
    title: "1. Disclaimer",
    content:
      "Lost & Hound is a student-made project created as part of Oasis @ Northeastern University. This platform is not officially affiliated with or endorsed by Northeastern University—it is an independent student initiative. Users acknowledge that Lost & Hound is maintained by students and may have limitations or changes without notice.",
  },
  {
    title: "2. Eligibility",
    content:
      "Lost & Hound is designed for Northeastern University students. You must register using a valid @northeastern.edu email address. By creating an account, you confirm that you are affiliated with Northeastern University and that the information you provide is accurate. This does not imply affiliation with or endorsement by the university.",
  },
  {
    title: "3. Platform Purpose & Limitations",
    content:
      "Lost & Hound is a community-powered platform that connects people who have found lost items with people who may have lost them. The platform serves solely as a communication tool and bulletin board. Lost & Hound does not verify ownership of any items, does not facilitate the physical exchange of items, and does not guarantee that any lost item will be recovered. All arrangements for item retrieval are made at the sole discretion and risk of the users involved.",
  },
  {
    title: "4. No False Claims & Code of Conduct",
    content:
      "You agree not to falsely claim ownership of items that do not belong to you. Falsely claiming an item is a violation of these Terms and may constitute theft under applicable law. You agree not to post fraudulent, misleading, or deceptive listings. You agree not to use the platform for any purpose other than reporting or recovering genuinely lost items. Violations may result in immediate account suspension and permanent bans.",
  },
  {
    title: "5. Messaging & Harassment Policy",
    content:
      "The in-app messaging system is provided solely for communication related to lost and found items. You agree not to use messaging for harassment, threats, intimidation, stalking, solicitation, spam, or any form of abusive behavior. You agree not to share personal information such as home addresses, financial information, or identification numbers through the messaging system. All messages are subject to review by moderators in the event of a report. Users who violate this policy will be banned from the platform.",
  },
  {
    title: "6. Safety & Liability Disclaimer",
    content:
      "LOST & HOUND, ITS CREATORS, DEVELOPERS, AND OPERATORS ARE NOT RESPONSIBLE FOR ANY LOSS, THEFT, DAMAGE, INJURY, OR HARM OF ANY KIND ARISING FROM THE USE OF THIS PLATFORM. This includes but is not limited to: theft or misappropriation of items, physical harm or injury during item exchanges, fraud or deception by other users, disputes between users, loss of or damage to personal property, and any criminal activity facilitated through or related to the platform. You acknowledge that all interactions with other users, including in-person meetings for item exchanges, are conducted entirely at your own risk. We strongly recommend meeting in well-lit, public locations, bringing a friend or notifying someone of your plans, never sharing your home address or financial information, and verifying item ownership before handing over any property.",
  },
  {
    title: "7. Assumption of Risk",
    content:
      "By using Lost & Hound, you expressly acknowledge and agree that you assume all risks associated with using this platform, communicating with other users, and any in-person interactions that result from using this platform. You agree to exercise your own judgment and caution in all interactions.",
  },
  {
    title: "8. Moderation & Ban Policy",
    content:
      "Lost & Hound employs moderators who have the authority to review reported content, remove listings or messages that violate these Terms, issue temporary bans (3 days, 30 days) or permanent bans, and reverse bans if a decision is found to be in error. Moderation decisions are made at the sole discretion of the moderation team. While we strive for fair enforcement, Lost & Hound does not guarantee a formal appeals process. Banned users will be notified of the reason for their ban and the duration.",
  },
  {
    title: "9. Data Handling & Privacy",
    content:
      "When you create an account, we store your first name, last name, email address, and campus preference. Your data is stored securely using Supabase infrastructure. We do not sell, share, or distribute your personal information to third parties. You may delete your account at any time through the Settings page, which will remove your profile data from our system. Listing and message data associated with your account may be retained for moderation purposes even after account deletion. By using the messaging feature, you acknowledge that messages may be reviewed by moderators if a report is filed.",
  },
  {
    title: "10. Indemnification",
    content:
      "You agree to indemnify, defend, and hold harmless Lost & Hound, its creators, developers, operators, and contributors from any claims, damages, losses, liabilities, costs, or expenses (including legal fees) arising from your use of the platform, your violation of these Terms, your interactions with other users, any content you post or share on the platform, and any false claims of item ownership.",
  },
  {
    title: "11. Limitation of Liability",
    content:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOST & HOUND AND ITS CREATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROPERTY, PERSONAL INJURY, OR EMOTIONAL DISTRESS, ARISING FROM YOUR USE OF THE PLATFORM. THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.',
  },
  {
    title: "12. Changes to Terms",
    content:
      "We reserve the right to modify these Terms at any time. Continued use of Lost & Hound after changes are posted constitutes your acceptance of the updated Terms. We will make reasonable efforts to notify users of significant changes.",
  },
  {
    title: "13. Governing Law",
    content:
      "These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of Massachusetts, without regard to conflict of law principles. Any disputes arising from these Terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts located in Suffolk County, Massachusetts.",
  },
];

export default function TermsModal({
  open,
  onClose,
  onAccept = () => {},
  readOnly = false,
  effectiveTheme = "light",
}) {
  const [accepted, setAccepted] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);
  const isDark = effectiveTheme === "dark";

  const styles = useMemo(
    () => ({
      panelBg: isDark ? "#1A1A1B" : "#fff",
      panelBorder: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid #ecdcdc",
      title: isDark ? "#F3F4F5" : "#2f1c1c",
      secondary: isDark ? "#A9AAAB" : "#6f6f6f",
      body: isDark ? "#C8CACC" : "#5e5e5e",
      sectionTitle: isDark ? "#FFBEA4" : "#3d2020",
      accent: isDark ? "#FF4500" : "#A84D48",
      accentHover: isDark ? "#E03D00" : "#8f3e3a",
      divider: isDark ? "rgba(255,255,255,0.1)" : "#f0e8e8",
      hint: isDark ? "#BE8C79" : "#a07070",
      noticeBg: isDark ? "#232324" : "#fdf7f7",
      noticeBorder: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc",
      footerBg: isDark ? "#161617" : "#faf8f8",
      iconBg: isDark ? "rgba(255,69,0,0.16)" : "#A84D4815",
      checkboxDisabled: isDark ? "#4A4A4B" : "#ddd",
      checkboxLabelDisabled: isDark ? "#787A7C" : "#bbb",
      buttonDisabledBg: isDark ? "#37383A" : "#e0d6d6",
      buttonDisabledText: isDark ? "#808285" : "#aaa",
    }),
    [isDark]
  );

  // Reset state when modal opens; auto-unlock if content doesn't need scrolling
  useEffect(() => {
    if (open) {
      setAccepted(false);
      setScrolledToBottom(false);
      // Defer so DialogContent has rendered and has its real dimensions
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (!el) return;
        if (el.scrollHeight <= el.clientHeight) {
          setScrolledToBottom(true);
        }
      });
    }
  }, [open]);

  // Detect when user has scrolled to the bottom
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) setScrolledToBottom(true);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      scroll="paper"
      fullWidth
      maxWidth="sm"
      PaperProps={{
        sx: {
          background: styles.panelBg,
          border: styles.panelBorder,
          borderRadius: 3,
          mx: 2,
          width: "calc(100% - 32px)",
          maxHeight: { xs: "calc(88dvh - env(safe-area-inset-top))", sm: "90dvh" },
          mt: "env(safe-area-inset-top)",
        },
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 2.5,
          borderBottom: `1.5px solid ${styles.divider}`,
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box sx={{ width: 40, height: 40, borderRadius: 2, background: styles.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <GavelIcon sx={{ color: styles.accent, fontSize: 22 }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2, color: styles.title }}>
              Terms & Conditions
            </Typography>
            <Typography variant="caption" sx={{ color: styles.secondary }} fontWeight={600}>
              {readOnly ? "Please review the full terms" : "Please read before creating your account"}
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={onClose} size="small" sx={{ color: styles.secondary }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Scrollable content — Dialog scroll="paper" makes DialogContent the scroll container */}
      <DialogContent
        ref={scrollRef}
        onScroll={handleScroll}
        sx={{
          px: 3, py: 2.5, background: styles.panelBg,
          overflowY: "scroll",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-y",
        }}
      >
        <Typography variant="body2" sx={{ mb: 2.5, lineHeight: 1.6, color: styles.body }}>
          {readOnly
            ? "Welcome to Lost & Hound — a student-made lost and found platform for Northeastern University. Please review the full terms and conditions below."
            : "Welcome to Lost & Hound — a student-made lost and found platform for Northeastern University. By creating an account, you agree to the following terms. Please read them carefully."}
        </Typography>

        {SECTIONS.map((section, i) => (
          <Box key={i} sx={{ mb: 2.5 }}>
            <Typography fontWeight={800} fontSize={14} sx={{ mb: 0.75, color: styles.sectionTitle }}>
              {section.title}
            </Typography>
            <Typography variant="body2" sx={{ lineHeight: 1.7, fontSize: 13, color: styles.body }}>
              {section.content}
            </Typography>
            {i < SECTIONS.length - 1 && <Divider sx={{ mt: 2.5, borderColor: styles.divider }} />}
          </Box>
        ))}

        <Box sx={{ mt: 1, mb: 1, p: 2, borderRadius: 2, background: styles.noticeBg, border: styles.noticeBorder }}>
          <Typography variant="caption" fontWeight={700} sx={{ display: "block", mb: 0.5, color: styles.secondary }}>
            Last updated: March 2026
          </Typography>
          <Typography variant="caption" sx={{ color: styles.secondary }}>
            If you have questions about these Terms, contact the Lost & Hound team.
          </Typography>
        </Box>
      </DialogContent>

      {/* Footer */}
      <DialogActions sx={{ px: 3, py: 2, borderTop: `1.5px solid ${styles.divider}`, background: styles.footerBg, flexDirection: "column", alignItems: "stretch" }}>
        {!readOnly && !scrolledToBottom && (
          <Typography variant="caption" sx={{ display: "block", textAlign: "center", color: styles.hint, fontWeight: 600, mb: 1, fontSize: 11 }}>
            ↓ Scroll to the bottom to continue
          </Typography>
        )}

        {readOnly ? (
          <Button variant="contained" fullWidth onClick={onClose}
            sx={{ background: styles.accent, "&:hover": { background: styles.accentHover }, fontWeight: 800, borderRadius: 2, py: 1.25, fontSize: 15, textTransform: "none" }}>
            Close
          </Button>
        ) : (
          <>
            <FormControlLabel
              control={
                <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={!scrolledToBottom}
                  sx={{ color: styles.accent, "&.Mui-checked": { color: styles.accent }, "&.Mui-disabled": { color: styles.checkboxDisabled } }} />
              }
              label={
                <Typography variant="body2" fontWeight={600}
                  sx={{ color: scrolledToBottom ? styles.sectionTitle : styles.checkboxLabelDisabled, fontSize: 13 }}>
                  I have read and agree to the Terms & Conditions
                </Typography>
              }
            />
            <Button variant="contained" fullWidth disabled={!accepted}
              onClick={() => { onAccept(); onClose(); }}
              sx={{
                mt: 1, background: styles.accent, "&:hover": { background: styles.accentHover },
                "&.Mui-disabled": { background: styles.buttonDisabledBg, color: styles.buttonDisabledText },
                fontWeight: 800, borderRadius: 2, py: 1.25, fontSize: 15, textTransform: "none",
              }}>
              Accept & Create Account
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}