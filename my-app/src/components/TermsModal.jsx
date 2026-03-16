import { useState, useRef, useEffect } from "react";
import {
  Modal, Box, Typography, Button, IconButton, Checkbox,
  FormControlLabel, Divider,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import GavelIcon from "@mui/icons-material/Gavel";

const SECTIONS = [
  {
    title: "1. Eligibility",
    content:
      "Lost & Hound is exclusively available to current students, faculty, and staff of Northeastern University. You must register using a valid @northeastern.edu email address. By creating an account, you confirm that you are affiliated with Northeastern University and that the information you provide is accurate. Accounts created with non-Northeastern email addresses will be rejected.",
  },
  {
    title: "2. Platform Purpose & Limitations",
    content:
      "Lost & Hound is a community-powered platform that connects people who have found lost items with people who may have lost them. The platform serves solely as a communication tool and bulletin board. Lost & Hound does not verify ownership of any items, does not facilitate the physical exchange of items, and does not guarantee that any lost item will be recovered. All arrangements for item retrieval are made at the sole discretion and risk of the users involved.",
  },
  {
    title: "3. No False Claims & Code of Conduct",
    content:
      "You agree not to falsely claim ownership of items that do not belong to you. Falsely claiming an item is a violation of these Terms, the Northeastern University Code of Student Conduct, and may constitute theft under applicable law. You agree not to post fraudulent, misleading, or deceptive listings. You agree not to use the platform for any purpose other than reporting or recovering genuinely lost items. Violations may result in immediate account suspension, permanent bans, and referral to Northeastern University or law enforcement authorities.",
  },
  {
    title: "4. Messaging & Harassment Policy",
    content:
      "The in-app messaging system is provided solely for communication related to lost and found items. You agree not to use messaging for harassment, threats, intimidation, stalking, solicitation, spam, or any form of abusive behavior. You agree not to share personal information such as home addresses, financial information, or identification numbers through the messaging system. All messages are subject to review by moderators in the event of a report. Users who violate this policy will be banned from the platform.",
  },
  {
    title: "5. Safety & Liability Disclaimer",
    content:
      "LOST & HOUND, ITS CREATORS, DEVELOPERS, OPERATORS, AND NORTHEASTERN UNIVERSITY ARE NOT RESPONSIBLE FOR ANY LOSS, THEFT, DAMAGE, INJURY, OR HARM OF ANY KIND ARISING FROM THE USE OF THIS PLATFORM. This includes but is not limited to: theft or misappropriation of items, physical harm or injury during item exchanges, fraud or deception by other users, disputes between users, loss of or damage to personal property, and any criminal activity facilitated through or related to the platform. You acknowledge that all interactions with other users, including in-person meetings for item exchanges, are conducted entirely at your own risk. We strongly recommend meeting in well-lit, public locations on Northeastern University campus, bringing a friend or notifying someone of your plans, never sharing your home address or financial information, and verifying item ownership before handing over any property.",
  },
  {
    title: "6. Assumption of Risk",
    content:
      "By using Lost & Hound, you expressly acknowledge and agree that you assume all risks associated with using this platform, communicating with other users, and any in-person interactions that result from using this platform. You agree to exercise your own judgment and caution in all interactions.",
  },
  {
    title: "7. Moderation & Ban Policy",
    content:
      "Lost & Hound employs moderators who have the authority to review reported content, remove listings or messages that violate these Terms, issue temporary bans (3 days, 30 days) or permanent bans, and reverse bans if a decision is found to be in error. Moderation decisions are made at the sole discretion of the moderation team. While we strive for fair enforcement, Lost & Hound does not guarantee a formal appeals process. Banned users will be notified of the reason for their ban and the duration.",
  },
  {
    title: "8. Data Handling & Privacy",
    content:
      "When you create an account, we store your first name, last name, Northeastern email address, and campus preference. Your data is stored securely using Supabase infrastructure. We do not sell, share, or distribute your personal information to third parties. You may delete your account at any time through the Settings page, which will remove your profile data from our system. Listing and message data associated with your account may be retained for moderation purposes even after account deletion. By using the messaging feature, you acknowledge that messages may be reviewed by moderators if a report is filed.",
  },
  {
    title: "9. Indemnification",
    content:
      "You agree to indemnify, defend, and hold harmless Lost & Hound, its creators, developers, operators, contributors, and Northeastern University from any claims, damages, losses, liabilities, costs, or expenses (including legal fees) arising from your use of the platform, your violation of these Terms, your interactions with other users, any content you post or share on the platform, and any false claims of item ownership.",
  },
  {
    title: "10. Limitation of Liability",
    content:
      'TO THE MAXIMUM EXTENT PERMITTED BY LAW, LOST & HOUND AND ITS CREATORS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROPERTY, PERSONAL INJURY, OR EMOTIONAL DISTRESS, ARISING FROM YOUR USE OF THE PLATFORM. THE PLATFORM IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.',
  },
  {
    title: "11. Changes to Terms",
    content:
      "We reserve the right to modify these Terms at any time. Continued use of Lost & Hound after changes are posted constitutes your acceptance of the updated Terms. We will make reasonable efforts to notify users of significant changes.",
  },
  {
    title: "12. Governing Law",
    content:
      "These Terms shall be governed by and construed in accordance with the laws of the Commonwealth of Massachusetts, without regard to conflict of law principles. Any disputes arising from these Terms or your use of the platform shall be subject to the exclusive jurisdiction of the courts located in Suffolk County, Massachusetts.",
  },
];

export default function TermsModal({ open, onClose, onAccept }) {
  const [accepted, setAccepted] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setAccepted(false);
      setScrolledToBottom(false);
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
    <Modal open={open} onClose={onClose}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#fff",
          borderRadius: 4,
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          outline: "none",
          overflow: "hidden",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          mx: 1.5,
          boxSizing: "border-box",
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
            borderBottom: "1.5px solid #ecdcdc",
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: "#A84D4815",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <GavelIcon sx={{ color: "#A84D48", fontSize: 22 }} />
            </Box>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2 }}>
                Terms & Conditions
              </Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                Please read before creating your account
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Scrollable content */}
        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{
            flex: 1,
            overflowY: "auto",
            px: 3,
            py: 2.5,
            minHeight: 0,
          }}
        >
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mb: 2.5, lineHeight: 1.6 }}
          >
            Welcome to Lost & Hound — Northeastern University's community-powered
            lost and found platform. By creating an account, you agree to the
            following terms. Please read them carefully.
          </Typography>

          {SECTIONS.map((section, i) => (
            <Box key={i} sx={{ mb: 2.5 }}>
              <Typography
                fontWeight={800}
                fontSize={14}
                sx={{ mb: 0.75, color: "#3d2020" }}
              >
                {section.title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ lineHeight: 1.7, fontSize: 13 }}
              >
                {section.content}
              </Typography>
              {i < SECTIONS.length - 1 && (
                <Divider sx={{ mt: 2.5, borderColor: "#f0e8e8" }} />
              )}
            </Box>
          ))}

          <Box
            sx={{
              mt: 1,
              mb: 1,
              p: 2,
              borderRadius: 2,
              background: "#fdf7f7",
              border: "1.5px solid #ecdcdc",
            }}
          >
            <Typography
              variant="caption"
              fontWeight={700}
              color="text.secondary"
              sx={{ display: "block", mb: 0.5 }}
            >
              Last updated: March 2026
            </Typography>
            <Typography variant="caption" color="text.secondary">
              If you have questions about these Terms, contact the Lost & Hound
              team or Northeastern University's Office of Student Conduct.
            </Typography>
          </Box>
        </Box>

        {/* Footer — checkbox + accept button */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: "1.5px solid #ecdcdc",
            background: "#faf8f8",
            flexShrink: 0,
          }}
        >
          {!scrolledToBottom && (
            <Typography
              variant="caption"
              sx={{
                display: "block",
                textAlign: "center",
                color: "#a07070",
                fontWeight: 600,
                mb: 1,
                fontSize: 11,
              }}
            >
              ↓ Scroll to the bottom to continue
            </Typography>
          )}

          <FormControlLabel
            control={
              <Checkbox
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                disabled={!scrolledToBottom}
                sx={{
                  color: "#A84D48",
                  "&.Mui-checked": { color: "#A84D48" },
                  "&.Mui-disabled": { color: "#ddd" },
                }}
              />
            }
            label={
              <Typography
                variant="body2"
                fontWeight={600}
                sx={{
                  color: scrolledToBottom ? "#3d2020" : "#bbb",
                  fontSize: 13,
                }}
              >
                I have read and agree to the Terms & Conditions
              </Typography>
            }
          />

          <Button
            variant="contained"
            fullWidth
            disabled={!accepted}
            onClick={() => {
              onAccept();
              onClose();
            }}
            sx={{
              mt: 1,
              background: "#A84D48",
              "&:hover": { background: "#8f3e3a" },
              "&.Mui-disabled": { background: "#e0d6d6", color: "#aaa" },
              fontWeight: 800,
              borderRadius: 2,
              py: 1.25,
              fontSize: 15,
              textTransform: "none",
            }}
          >
            Accept & Create Account
          </Button>
        </Box>
      </Box>
    </Modal>
  );
}