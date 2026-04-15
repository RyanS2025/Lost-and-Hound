import { useState, useMemo, useRef, useEffect } from "react";
import {
  Modal, Box, Typography, Button, IconButton, TextField,
  Select, MenuItem, FormControl, InputLabel, Alert, CircularProgress, Chip,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import SendIcon from "@mui/icons-material/Send";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import SupportFAQ from "./SupportFAQ";
import { stripInvisible } from "../utils/profanityFilter";

const STATUS_LABEL = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
const STATUS_SX = {
  open:        { bgcolor: "#1976d2", color: "#fff" },
  in_progress: { bgcolor: "#e65100", color: "#fff" },
  resolved:    { bgcolor: "#2e7d32", color: "#fff" },
  closed:      { bgcolor: "#757575", color: "#fff" },
};

const TICKET_TYPES = ["Support", "Bug Report", "Feedback"];

const CATEGORIES_BY_TYPE = {
  Support: [
    "Login / Access Issue",
    "Account or Profile Issue",
    "Listing Problem",
    "Messaging Issue",
    "Technical Problem",
    "Other",
  ],
  "Bug Report": [
    "UI / Display Issue",
    "App Crash / Freeze",
    "Feature Not Working",
    "Performance Issue",
    "Other",
  ],
  Feedback: [
    "Feature Request",
    "Usability Improvement",
    "Design Suggestion",
    "General Feedback",
  ],
};

const NAME_MAX = 50;
const SUBJECT_MAX = 100;
const DESC_MAX = 500;

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function LoginSupportModal({ open, onClose, effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";

  const styles = useMemo(
    () => ({
      panelBg: isDark ? "#1A1A1B" : "#fff",
      border: isDark ? "rgba(255,255,255,0.14)" : "rgba(122,41,41,0.12)",
      secondary: isDark ? "#A9AAAB" : "#6f6f6f",
      accent: isDark ? "#FF4500" : "#A84D48",
      accentHover: isDark ? "#E03D00" : "#8f3e3a",
      divider: isDark ? "rgba(255,255,255,0.1)" : "#f0e8e8",
      footerBg: isDark ? "#161617" : "#faf8f8",
      iconBg: isDark ? "rgba(255,69,0,0.16)" : "#A84D4815",
      inputBg: isDark ? "#2D2D2E" : "#fff",
      buttonDisabledBg: isDark ? "#37383A" : "#e0d6d6",
      buttonDisabledText: isDark ? "#808285" : "#aaa",
      backdrop: isDark ? "rgba(0,0,0,0.68)" : "rgba(20,15,15,0.45)",
      chatSurface: isDark ? "#141415" : "#f7f3f3",
      modBubble: isDark ? "rgba(255,69,0,0.12)" : "#fff4f3",
    }),
    [isDark]
  );

  const isSmall = useMediaQuery("(max-width:780px)");
  const [chatOpen, setChatOpen] = useState(false);

  const fileInputRef = useRef();
  const [tab, setTab] = useState("form");
  const [ticketType, setTicketType] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null); // { file, dataUrl }
  const [imageConverting, setImageConverting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTicketCode, setSubmittedTicketCode] = useState(null);
  const [error, setError] = useState("");

  // Check Status tab
  const [statusEmail, setStatusEmail] = useState("");
  const [statusTicketCode, setStatusTicketCode] = useState("");
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusResult, setStatusResult] = useState(null);
  const [statusError, setStatusError] = useState("");

  // Chat state
  const [chatReplies, setChatReplies] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatBottomRef = useRef();
  const pollRef = useRef();

  const fetchGuestReplies = async () => {
    if (!statusEmail.trim() || !statusTicketCode.trim()) return;
    try {
      const params = new URLSearchParams({ email: statusEmail.trim(), ticketCode: statusTicketCode.trim() });
      const res = await fetch(`${API_BASE}/api/support-tickets/guest-status?${params}`);
      if (res.ok) {
        const data = await res.json();
        setChatReplies(data.ticket?.support_replies || []);
      }
    } catch {
      // silent — don't disrupt chat
    }
  };

  const sendGuestMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatSending || !statusResult) return;
    setChatSending(true);
    setChatError("");
    try {
      const res = await fetch(`${API_BASE}/api/support-tickets/guest-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: statusEmail.trim(), ticketCode: statusTicketCode.trim(), message: msg }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send");
      }
      setChatInput("");
      await fetchGuestReplies();
    } catch (err) {
      setChatError(err.message || "Failed to send.");
    } finally {
      setChatSending(false);
    }
  };

  // Poll while chat is open
  useEffect(() => {
    if (chatOpen && statusResult) {
      fetchGuestReplies();
      pollRef.current = setInterval(fetchGuestReplies, 6000);
    }
    return () => clearInterval(pollRef.current);
  }, [chatOpen, statusResult?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to bottom when replies update
  useEffect(() => {
    if (chatReplies.length) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [chatReplies.length]);

  const canSubmit =
    ticketType && stripInvisible(name) && email.trim() && category && stripInvisible(subject) && stripInvisible(description) && !submitting && !imageConverting;

  const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

  const handleImageFile = async (e) => {
    let file = e.target.files[0];
    if (!file) return;

    const isHeic = file.type === "image/heic" || file.type === "image/heif"
      || /\.heic$/i.test(file.name) || /\.heif$/i.test(file.name);
    if (isHeic) {
      setImageConverting(true);
      try {
        const heic2any = (await import("heic2any")).default;
        const blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
        file = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
      } catch {
        setImageConverting(false);
        setError("Could not convert image. Please use JPG, PNG, or WebP.");
        return;
      }
      setImageConverting(false);
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError("Only JPG, PNG, WebP, and GIF images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be under 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => setImage({ file, dataUrl: ev.target.result });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");

    let imageUrl = undefined;

    // Upload image if one was attached (Bug Report only)
    if (image?.file) {
      try {
        const uploadRes = await fetch(`${API_BASE}/api/upload-url/guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: image.file.name,
            contentType: image.file.type,
            fileSize: image.file.size,
          }),
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.json().catch(() => ({}));
          setError(body.error || "Could not start upload. Please try again.");
          setSubmitting(false);
          return;
        }
        const uploadData = await uploadRes.json();

        const putRes = await fetch(uploadData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": image.file.type },
          body: image.file,
        });
        if (!putRes.ok) {
          setError("Failed to upload image to storage. Please try again.");
          setSubmitting(false);
          return;
        }

        const verifyRes = await fetch(`${API_BASE}/api/verify-image/guest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: uploadData.path }),
        });
        if (!verifyRes.ok) {
          const body = await verifyRes.json().catch(() => ({}));
          setError(body.error || "Image verification failed. Please use a valid JPG, PNG, or WebP.");
          setSubmitting(false);
          return;
        }
        const verifyData = await verifyRes.json();
        if (verifyData?.valid) imageUrl = uploadData.publicUrl;

        if (!imageUrl) {
          setError("Image could not be verified. Please try a different file.");
          setSubmitting(false);
          return;
        }
      } catch {
        setError("Image upload failed. Please try again or remove the image.");
        setSubmitting(false);
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/support/guest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketType,
          name: name.trim(),
          email: email.trim(),
          category,
          subject: subject.trim(),
          description: description.trim(),
          image_url: imageUrl,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Request failed");
      }
      const data = await res.json();
      setSubmittedTicketCode(data.ticketCode || null);
      setSubmitted(true);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const lookupTicket = async () => {
    if (!statusEmail.trim() || !statusTicketCode.trim()) return;
    setStatusLoading(true);
    setStatusError("");
    setStatusResult(null);
    try {
      const params = new URLSearchParams({ email: statusEmail.trim(), ticketCode: statusTicketCode.trim() });
      const res = await fetch(`${API_BASE}/api/support-tickets/guest-status?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setStatusError(body.error || "No ticket found with that email and code.");
        return;
      }
      const data = await res.json();
      setStatusResult(data.ticket);
      setChatReplies(data.ticket?.support_replies || []);
      setChatOpen(false);
    } catch {
      setStatusError("Could not reach the server. Please try again.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setTab("form");
      setTicketType("");
      setName("");
      setEmail("");
      setCategory("");
      setSubject("");
      setDescription("");
      setImage(null);
      setSubmitted(false);
      setSubmittedTicketCode(null);
      setError("");
      setStatusEmail("");
      setStatusTicketCode("");
      setStatusResult(null);
      setStatusError("");
      setChatOpen(false);
      setChatReplies([]);
      setChatInput("");
      setChatError("");
      clearInterval(pollRef.current);
    }, 200);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      slotProps={{
        backdrop: {
          sx: {
            backgroundColor: styles.backdrop,
            backdropFilter: "blur(1px)",
          },
        },
      }}
    >
      <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", display: "flex", flexDirection: "row", outline: "none", mx: isSmall ? 1 : 0 }}>
        <Box sx={{ width: isSmall ? "min(480px, calc(100vw - 16px))" : 480, height: "90vh", maxHeight: 680, display: "flex", flexDirection: "column", background: styles.panelBg, border: `1px solid ${styles.border}`, borderRadius: chatOpen && !isSmall ? "16px 0 0 16px" : 4, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", boxSizing: "border-box", flexShrink: 0 }}>
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
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                background: styles.iconBg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <SupportAgentIcon sx={{ color: styles.accent, fontSize: 22 }} />
            </Box>
            <Box>
              <Typography
                variant="h6"
                fontWeight={900}
                sx={{ lineHeight: 1.2, color: "text.primary" }}
              >
                Need Help?
              </Typography>
              <Typography variant="caption" sx={{ color: styles.secondary }} fontWeight={600}>
                Submit a ticket and a moderator will assist you
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ color: styles.secondary }}>
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Tabs */}
        {!submitted && (
          <Box
            sx={{
              display: "flex",
              gap: 1,
              px: 3,
              py: 1.5,
              borderBottom: `1.5px solid ${styles.divider}`,
              flexShrink: 0,
            }}
          >
            {[["form", "Submit Ticket"], ["check-status", "Check Status"], ["faq", "Q&A"]].map(([t, label]) => (
              <Box
                key={t}
                onClick={() => { setTab(t); setStatusResult(null); setStatusError(""); setChatOpen(false); }}
                sx={{
                  px: 2,
                  py: 0.75,
                  borderRadius: 2,
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                  userSelect: "none",
                  transition: "all 0.15s",
                  bgcolor: tab === t ? styles.accent : "transparent",
                  color: tab === t ? "#fff" : styles.secondary,
                  "&:hover": {
                    bgcolor: tab === t ? styles.accentHover : styles.divider,
                  },
                }}
              >
                {label}
              </Box>
            ))}
          </Box>
        )}

        {/* Body */}
        <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5, minHeight: 0 }}>
          {submitted ? (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <SupportAgentIcon sx={{ color: styles.accent, fontSize: 48, mb: 1.5 }} />
              <Typography fontWeight={800} fontSize={17} sx={{ mb: 1 }}>
                Ticket submitted!
              </Typography>
              {submittedTicketCode && (
                <Box
                  sx={{
                    display: "inline-block",
                    px: 2.5, py: 1.25,
                    borderRadius: 2,
                    border: `2px solid ${styles.accent}`,
                    background: styles.iconBg,
                    mb: 1.5,
                  }}
                >
                  <Typography variant="caption" sx={{ color: styles.secondary, display: "block", mb: 0.25, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>
                    Your Ticket Code — save this!
                  </Typography>
                  <Typography fontWeight={900} fontSize={22} sx={{ color: styles.accent, letterSpacing: 1 }}>
                    {submittedTicketCode}
                  </Typography>
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                A moderator will review your request shortly.{submittedTicketCode ? " Use your Ticket Code and email to check status later." : " Thank you for reaching out."}
              </Typography>
            </Box>
          ) : tab === "check-status" ? (
            statusResult ? (
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                  <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={() => { setStatusResult(null); setStatusError(""); setChatOpen(false); }}
                    size="small"
                    sx={{ color: styles.accent, textTransform: "none", fontWeight: 700, pl: 0 }}
                  >
                    Back to lookup
                  </Button>
                  {statusResult.status !== "closed" && (
                    <Button
                      startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />}
                      size="small"
                      onClick={() => setChatOpen(!chatOpen)}
                      sx={{ color: chatOpen ? styles.secondary : styles.accent, fontWeight: 700, fontSize: 12, textTransform: "none", border: `1px solid ${chatOpen ? styles.border : styles.accent}`, borderRadius: 2, px: 1.5 }}
                    >
                      {chatOpen ? "Close Chat" : "Open Chat"}
                    </Button>
                  )}
                </Box>

                {/* Header card */}
                <Box sx={{ border: `1.5px solid ${styles.border}`, borderRadius: 2, p: 2, mb: 2 }}>
                  <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.25 }}>
                    <Chip
                      label={STATUS_LABEL[statusResult.status] || statusResult.status}
                      size="small"
                      sx={STATUS_SX[statusResult.status] || STATUS_SX.closed}
                    />
                    <Chip label={statusResult.ticket_type} size="small" variant="outlined" />
                    {statusResult.category && (
                      <Chip label={statusResult.category} size="small" variant="outlined" />
                    )}
                  </Box>
                  <Typography fontWeight={800} fontSize={15} sx={{ mb: 1.5, lineHeight: 1.3 }}>
                    {statusResult.ticket_title}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: styles.secondary }}>Submitted</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{new Date(statusResult.created_at).toLocaleDateString()}</Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: styles.secondary }}>Assigned To</Typography>
                      <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{statusResult.claimed_by || "Unassigned"}</Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Description */}
                <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: styles.secondary, display: "block", mb: 0.75 }}>
                  Your Message
                </Typography>
                <Box sx={{ background: styles.inputBg, border: `1px solid ${styles.border}`, borderRadius: 1.5, p: 1.5, mb: 2 }}>
                  <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                    {statusResult.ticket_desc}
                  </Typography>
                </Box>

                {/* Image */}
                {statusResult.image_url && (
                  <Box
                    component="img"
                    src={statusResult.image_url}
                    alt="attachment"
                    sx={{ maxWidth: "100%", maxHeight: 200, borderRadius: 1.5, objectFit: "contain", border: `1px solid ${styles.border}`, display: "block", mb: 2 }}
                  />
                )}

                {/* Mobile only: inline chat (desktop uses the sliding panel) */}
                {isSmall && (
                  <>
                    <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: styles.secondary, display: "block", mb: 1 }}>
                      Messages
                    </Typography>
                    {(chatReplies.length ? chatReplies : (statusResult.support_replies || [])).length === 0 ? (
                      <Box sx={{ textAlign: "center", py: 2.5, border: `1px dashed ${styles.border}`, borderRadius: 1.5, mb: 1.5 }}>
                        <Typography variant="body2" sx={{ color: styles.secondary, fontStyle: "italic" }}>
                          No messages yet — a moderator will respond soon.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mb: 1.5 }}>
                        {(chatReplies.length ? chatReplies : (statusResult.support_replies || [])).map((r) => (
                          <Box key={r.id} sx={{ display: "flex", justifyContent: r.is_moderator ? "flex-start" : "flex-end" }}>
                            <Box sx={{ maxWidth: "80%", px: 1.25, py: 1, borderRadius: r.is_moderator ? "4px 12px 12px 12px" : "12px 4px 12px 12px", background: r.is_moderator ? styles.modBubble : styles.accent, border: r.is_moderator ? `1px solid ${styles.border}` : "none" }}>
                              <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.25, letterSpacing: 0.3, color: r.is_moderator ? styles.accent : "rgba(255,255,255,0.75)", textAlign: r.is_moderator ? "left" : "right" }}>
                                {r.is_moderator ? "Support Team" : (statusResult?.name || "You")}
                              </Typography>
                              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: r.is_moderator ? "text.primary" : "#fff", lineHeight: 1.5 }}>{r.message}</Typography>
                              <Typography sx={{ fontSize: 10, color: r.is_moderator ? styles.secondary : "rgba(255,255,255,0.7)", mt: 0.25, textAlign: r.is_moderator ? "left" : "right" }}>
                                {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </Typography>
                            </Box>
                          </Box>
                        ))}
                        <div ref={chatBottomRef} />
                      </Box>
                    )}
                    {statusResult.status !== "closed" && (
                      <Box sx={{ mt: 0.5 }}>
                        {chatError && <Alert severity="error" sx={{ mb: 0.75, py: 0, fontSize: 12 }}>{chatError}</Alert>}
                        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                          <TextField
                            size="small" fullWidth multiline maxRows={4}
                            placeholder="Type a message…"
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendGuestMessage())}
                            inputProps={{ maxLength: 1000 }}
                            helperText={`${stripInvisible(chatInput).length}/1000`}
                            sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 13, bgcolor: styles.inputBg }, "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 } }}
                          />
                          <IconButton onClick={sendGuestMessage} disabled={!chatInput.trim() || chatSending}
                            sx={{ bgcolor: styles.accent, color: "#fff", borderRadius: 2, width: 40, height: 40, flexShrink: 0, "&:hover": { bgcolor: styles.accentHover }, "&.Mui-disabled": { bgcolor: styles.buttonDisabledBg } }}>
                            {chatSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </Box>
                      </Box>
                    )}
                  </>
                )}
              </Box>
            ) : (
              <Box>
                <Typography variant="body2" sx={{ color: styles.secondary, mb: 2, lineHeight: 1.6 }}>
                  Enter the email address you used when submitting and your 5-digit Ticket Code to view your ticket status and moderator replies.
                </Typography>
                <TextField
                  label="Email Address"
                  placeholder="your@email.com"
                  type="email"
                  value={statusEmail}
                  onChange={(e) => setStatusEmail(e.target.value)}
                  fullWidth
                  size="small"
                  sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg } }}
                />
                <TextField
                  label="Ticket Code"
                  placeholder="5-digit code, e.g. 47832"
                  value={statusTicketCode}
                  onChange={(e) => setStatusTicketCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                  fullWidth
                  size="small"
                  sx={{ mb: 2, "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg } }}
                />
                {statusError && <Alert severity="error" sx={{ mb: 2 }}>{statusError}</Alert>}
                <Button
                  variant="contained"
                  fullWidth
                  disabled={!statusEmail.trim() || !statusTicketCode.trim() || statusLoading}
                  onClick={lookupTicket}
                  sx={{
                    background: styles.accent,
                    "&:hover": { background: styles.accentHover },
                    "&.Mui-disabled": { background: styles.buttonDisabledBg, color: styles.buttonDisabledText },
                    fontWeight: 800, borderRadius: 2, py: 1.25, fontSize: 15, textTransform: "none",
                  }}
                >
                  {statusLoading ? <CircularProgress size={20} color="inherit" /> : "Look Up Ticket"}
                </Button>
              </Box>
            )
          ) : tab === "form" ? (
            <>
              <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
                <TextField
                  label="Your Name"
                  placeholder="First and last name"
                  value={name}
                  onChange={(e) => setName(e.target.value.slice(0, NAME_MAX))}
                  fullWidth
                  size="small"
                  inputProps={{ maxLength: NAME_MAX }}
                  helperText={`${stripInvisible(name).length}/${NAME_MAX}`}
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg }, "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 } }}
                />
                <TextField
                  label="Email Address"
                  placeholder="your@email.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.slice(0, NAME_MAX))}
                  fullWidth
                  size="small"
                  sx={{ "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg } }}
                />
              </Box>

              <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                <InputLabel>Type</InputLabel>
                <Select
                  value={ticketType}
                  label="Type"
                  onChange={(e) => {
                    setTicketType(e.target.value);
                    setCategory("");
                  }}
                  sx={{ bgcolor: styles.inputBg }}
                >
                  {TICKET_TYPES.map((t) => (
                    <MenuItem key={t} value={t}>{t}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={!ticketType}>
                <InputLabel>Category</InputLabel>
                <Select
                  value={category}
                  label="Category"
                  onChange={(e) => setCategory(e.target.value)}
                  sx={{ bgcolor: styles.inputBg }}
                >
                  {(CATEGORIES_BY_TYPE[ticketType] || []).map((c) => (
                    <MenuItem key={c} value={c}>{c}</MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Subject"
                placeholder="Brief summary of your issue"
                value={subject}
                onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))}
                fullWidth
                size="small"
                inputProps={{ maxLength: SUBJECT_MAX }}
                helperText={`${stripInvisible(subject).length}/${SUBJECT_MAX}`}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg },
                  "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 },
                }}
              />

              <TextField
                label="Description"
                placeholder="Describe your issue in detail"
                value={description}
                onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))}
                multiline
                rows={4}
                fullWidth
                size="small"
                inputProps={{ maxLength: DESC_MAX }}
                helperText={`${stripInvisible(description).length}/${DESC_MAX}`}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": { bgcolor: styles.inputBg },
                  "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 },
                }}
              />

              {/* Image upload — Bug Reports only */}
              {ticketType === "Bug Report" && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: styles.secondary, display: "block", mb: 0.75 }}>
                    Screenshot / Attachment (optional)
                  </Typography>
                  {image ? (
                    <Box>
                      <Box
                        component="img"
                        src={image.dataUrl}
                        alt="preview"
                        sx={{ maxWidth: "100%", maxHeight: 140, borderRadius: 1.5, objectFit: "contain", border: `1px solid ${styles.border}`, display: "block", mb: 0.5 }}
                      />
                      <Button size="small" onClick={() => { setImage(null); setError(""); }} sx={{ color: styles.accent, fontSize: 12, p: 0, minWidth: 0 }}>
                        Remove
                      </Button>
                    </Box>
                  ) : (
                    <Box
                      onClick={() => !imageConverting && fileInputRef.current.click()}
                      sx={{
                        border: `2px dashed ${styles.border}`,
                        borderRadius: 1.5, p: 1.5, cursor: "pointer", textAlign: "center",
                        background: styles.inputBg, transition: "border-color 0.15s",
                        "&:hover": { borderColor: styles.accent },
                      }}
                    >
                      {imageConverting
                        ? <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, color: "text.disabled" }}>
                            <CircularProgress size={16} sx={{ color: styles.accent }} />
                            <Typography variant="caption" fontWeight={700}>Converting…</Typography>
                          </Box>
                        : <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, color: "text.disabled" }}>
                            <CloudUploadIcon sx={{ fontSize: 18 }} />
                            <Typography variant="caption" fontWeight={700}>Click to upload — JPG, PNG, WebP, GIF (max 5 MB)</Typography>
                          </Box>
                      }
                    </Box>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.heic,.heif"
                    onChange={handleImageFile}
                    style={{ display: "none" }}
                  />
                </Box>
              )}

              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            </>
          ) : (
            <SupportFAQ
              accent={styles.accent}
              secondary={styles.secondary}
              divider={styles.divider}
            />
          )}
        </Box>

        {/* Footer */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: `1.5px solid ${styles.divider}`,
            background: styles.footerBg,
            flexShrink: 0,
          }}
        >
          {submitted ? (
            <Button
              variant="contained"
              fullWidth
              onClick={handleClose}
              sx={{
                background: styles.accent,
                "&:hover": { background: styles.accentHover },
                fontWeight: 800,
                borderRadius: 2,
                py: 1.25,
                fontSize: 15,
                textTransform: "none",
              }}
            >
              Done
            </Button>
          ) : tab === "form" ? (
            <Button
              variant="contained"
              fullWidth
              disabled={!canSubmit}
              onClick={handleSubmit}
              sx={{
                background: styles.accent,
                "&:hover": { background: styles.accentHover },
                "&.Mui-disabled": {
                  background: styles.buttonDisabledBg,
                  color: styles.buttonDisabledText,
                },
                fontWeight: 800,
                borderRadius: 2,
                py: 1.25,
                fontSize: 15,
                textTransform: "none",
              }}
            >
              {submitting ? <CircularProgress size={20} color="inherit" /> : "Submit Ticket"}
            </Button>
          ) : null}
        </Box>
        </Box>

        {/* ── Live chat panel (desktop only, two-way) ── */}
        {!isSmall && statusResult && (
          <Box sx={{ width: chatOpen ? 320 : 0, height: "90vh", maxHeight: 680, overflow: "hidden", transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }}>
            <Box sx={{ width: 320, height: "100%", display: "flex", flexDirection: "column", background: styles.chatSurface, border: `1px solid ${styles.border}`, borderLeft: "none", borderRadius: "0 16px 16px 0", overflow: "hidden" }}>
              <Box sx={{ px: 2, py: 1.75, borderBottom: `1px solid ${styles.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: styles.accent }} />
                  <Typography fontWeight={800} fontSize={14}>Live Chat</Typography>
                </Box>
                <IconButton size="small" onClick={() => setChatOpen(false)} sx={{ color: styles.secondary }}><CloseIcon fontSize="small" /></IconButton>
              </Box>
              <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
                {chatReplies.length === 0 ? (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="body2" sx={{ color: styles.secondary, fontStyle: "italic", textAlign: "center" }}>
                      No messages yet. Send one to get started!
                    </Typography>
                  </Box>
                ) : chatReplies.map((r) => (
                  <Box key={r.id} sx={{ display: "flex", justifyContent: r.is_moderator ? "flex-start" : "flex-end" }}>
                    <Box sx={{ maxWidth: "85%", px: 1.25, py: 1, borderRadius: r.is_moderator ? "4px 12px 12px 12px" : "12px 4px 12px 12px", background: r.is_moderator ? styles.modBubble : styles.accent, border: r.is_moderator ? `1px solid ${styles.border}` : "none", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.25, letterSpacing: 0.3, color: r.is_moderator ? styles.accent : "rgba(255,255,255,0.75)", textAlign: r.is_moderator ? "left" : "right" }}>
                        {r.is_moderator ? "Support Team" : (statusResult?.name || "You")}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: r.is_moderator ? "text.primary" : "#fff", lineHeight: 1.5, fontSize: 13 }}>{r.message}</Typography>
                      <Typography sx={{ fontSize: 10, color: r.is_moderator ? styles.secondary : "rgba(255,255,255,0.65)", mt: 0.25, textAlign: r.is_moderator ? "left" : "right" }}>
                        {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                <div ref={chatBottomRef} />
              </Box>
              {statusResult.status !== "closed" ? (
                <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid ${styles.divider}`, flexShrink: 0 }}>
                  {chatError && <Alert severity="error" sx={{ mb: 0.75, py: 0, fontSize: 12 }}>{chatError}</Alert>}
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <TextField
                      size="small" fullWidth multiline maxRows={4}
                      placeholder="Type a message…"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendGuestMessage(); } }}
                      inputProps={{ maxLength: 1000 }}
                      helperText={`${stripInvisible(chatInput).length}/1000`}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 13, bgcolor: styles.inputBg }, "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 } }}
                    />
                    <IconButton onClick={sendGuestMessage} disabled={!chatInput.trim() || chatSending}
                      sx={{ bgcolor: styles.accent, color: "#fff", borderRadius: 2, width: 38, height: 38, flexShrink: 0, "&:hover": { bgcolor: styles.accentHover }, "&.Mui-disabled": { bgcolor: styles.buttonDisabledBg } }}>
                      {chatSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${styles.divider}`, flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ color: styles.secondary, fontStyle: "italic" }}>This ticket is closed.</Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
