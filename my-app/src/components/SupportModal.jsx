import { useState, useRef, useEffect } from "react";
import {
  Modal, Box, Typography, Button, IconButton, TextField,
  Select, MenuItem, FormControl, InputLabel, Alert, CircularProgress, Chip,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SendIcon from "@mui/icons-material/Send";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import apiFetch from "../utils/apiFetch";
import SupportFAQ from "./SupportFAQ";
import { useAuth } from "../AuthContext";
import { stripInvisible } from "../utils/profanityFilter";

const TICKET_TYPES = ["Support", "Bug Report", "Feedback"];

const STATUS_LABEL = { open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed" };
const STATUS_SX = {
  open:        { bgcolor: "#1976d2", color: "#fff" },
  in_progress: { bgcolor: "#e65100", color: "#fff" },
  resolved:    { bgcolor: "#2e7d32", color: "#fff" },
  closed:      { bgcolor: "#757575", color: "#fff" },
};

const CATEGORIES_BY_TYPE = {
  Support: ["Login / Access Issue", "Account or Profile Issue", "Listing Problem", "Messaging Issue", "Technical Problem", "Other"],
  "Bug Report": ["UI / Display Issue", "App Crash / Freeze", "Feature Not Working", "Performance Issue", "Other"],
  Feedback: ["Feature Request", "Usability Improvement", "Design Suggestion", "General Feedback"],
};

const SUBJECT_MAX = 100;
const DESC_MAX = 500;

export default function SupportModal({ open, onClose }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isSmall = useMediaQuery("(max-width:780px)");
  const { user, profile } = useAuth();
  const userEmail = user?.email || "";
  const userName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "";

  const BRAND = {
    accent: isDark ? "#FF4500" : "#A84D48",
    accentHover: isDark ? "#E03D00" : "#8f3e3a",
    surface: isDark ? "#1A1A1B" : "#fff",
    chatSurface: isDark ? "#141415" : "#f7f3f3",
    border: isDark ? "rgba(255,255,255,0.14)" : "rgba(122,41,41,0.12)",
    inputBg: isDark ? "#2D2D2E" : "#fff",
    divider: isDark ? "rgba(255,255,255,0.1)" : "#f0e8e8",
    footerBg: isDark ? "#161617" : "#faf8f8",
    iconBg: isDark ? "rgba(255,69,0,0.16)" : "#A84D4815",
    secondary: isDark ? "#A9AAAB" : "#6f6f6f",
    backdrop: isDark ? "rgba(0,0,0,0.68)" : "rgba(20,15,15,0.45)",
    buttonDisabledBg: isDark ? "#37383A" : "#e0d6d6",
    buttonDisabledText: isDark ? "#808285" : "#aaa",
    modBubble: isDark ? "rgba(255,69,0,0.12)" : "#fff4f3",
    userBubble: isDark ? "rgba(255,255,255,0.06)" : "#f0f0f0",
  };

  // ── Form state ───────────────────────────────────────────
  const fileInputRef = useRef();
  const [tab, setTab] = useState("form");
  const [ticketType, setTicketType] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [imageConverting, setImageConverting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTicketCode, setSubmittedTicketCode] = useState(null);
  const [error, setError] = useState("");

  // ── My Tickets tab ───────────────────────────────────────
  const [myTickets, setMyTickets] = useState([]);
  const [myTicketsLoading, setMyTicketsLoading] = useState(false);
  const [myTicketsError, setMyTicketsError] = useState("");
  const [myTicketsHasMore, setMyTicketsHasMore] = useState(false);
  const [myTicketsLoadingMore, setMyTicketsLoadingMore] = useState(false);
  const [myTicketsPage, setMyTicketsPage] = useState(1);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const myTicketsCacheRef = useRef(null); // { tickets, hasMore }

  // ── Chat panel ───────────────────────────────────────────
  const [chatOpen, setChatOpen] = useState(false);
  const [chatReplies, setChatReplies] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatBottomRef = useRef();
  const pollRef = useRef();

  useEffect(() => {
    if (tab === "my-tickets" && open) {
      const cache = myTicketsCacheRef.current;
      if (cache) {
        setMyTickets(cache.tickets);
        setMyTicketsHasMore(cache.hasMore);
        setMyTicketsPage(1);
      } else {
        setMyTicketsLoading(true);
      }
      setMyTicketsError("");
      apiFetch("/api/support-tickets/mine?page=1&limit=10")
        .then((data) => {
          const tickets = data?.tickets || [];
          const hasMore = data?.hasMore ?? false;
          myTicketsCacheRef.current = { tickets, hasMore };
          setMyTickets(tickets);
          setMyTicketsHasMore(hasMore);
          setMyTicketsPage(1);
        })
        .catch(() => { if (!myTicketsCacheRef.current) setMyTicketsError("Failed to load your tickets."); })
        .finally(() => setMyTicketsLoading(false));
    }
  }, [tab, open]);

  const loadMoreMyTickets = async () => {
    setMyTicketsLoadingMore(true);
    try {
      const nextPage = myTicketsPage + 1;
      const data = await apiFetch(`/api/support-tickets/mine?page=${nextPage}&limit=10`);
      const newTickets = data?.tickets || [];
      setMyTickets(prev => [...prev, ...newTickets]);
      setMyTicketsHasMore(data?.hasMore ?? false);
      setMyTicketsPage(nextPage);
    } catch {
      // silent — existing tickets still visible
    } finally {
      setMyTicketsLoadingMore(false);
    }
  };

  // ── Chat fetch + polling ──────────────────────────────────
  const fetchChatReplies = async (ticketId) => {
    try {
      const data = await apiFetch(`/api/support-tickets/${ticketId}/replies`);
      setChatReplies(data?.replies || []);
    } catch {
      // silent — don't disrupt existing chat
    }
  };

  useEffect(() => {
    if (chatOpen && selectedTicket) {
      fetchChatReplies(selectedTicket.id);
      chatBottomRef.current?.scrollIntoView();
      pollRef.current = setInterval(() => fetchChatReplies(selectedTicket.id), 6000);
    }
    return () => clearInterval(pollRef.current);
  }, [chatOpen, selectedTicket?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatReplies.length) {
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [chatReplies.length]);

  const sendChatMessage = async () => {
    const msg = chatInput.trim();
    if (!msg || chatSending || !selectedTicket) return;
    setChatSending(true);
    setChatError("");
    try {
      await apiFetch(`/api/support-tickets/${selectedTicket.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ message: msg }),
      });
      setChatInput("");
      await fetchChatReplies(selectedTicket.id);
    } catch (err) {
      setChatError(err?.message || "Failed to send.");
    } finally {
      setChatSending(false);
    }
  };

  const openChat = (ticket) => {
    setChatReplies([]);
    setChatError("");
    setChatInput("");
    setChatOpen(true);
  };

  const closeChat = () => {
    setChatOpen(false);
    clearInterval(pollRef.current);
  };

  // ── Image handling ────────────────────────────────────────
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
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) { setError("Only JPG, PNG, WebP, and GIF images are allowed."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("Image must be under 5 MB."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setImage({ file, dataUrl: ev.target.result });
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!ticketType || !category || !stripInvisible(subject) || !stripInvisible(description) || submitting || imageConverting) return;
    setSubmitting(true);
    setError("");
    let imageUrl = undefined;
    if (image?.file) {
      try {
        const uploadData = await apiFetch("/api/upload-url", { method: "POST", body: JSON.stringify({ filename: image.file.name, contentType: image.file.type, fileSize: image.file.size, folder: "support" }) });
        const putRes = await fetch(uploadData.signedUrl, { method: "PUT", headers: { "Content-Type": image.file.type }, body: image.file });
        if (putRes.ok) {
          const verify = await apiFetch("/api/verify-image", { method: "POST", body: JSON.stringify({ path: uploadData.path }) });
          if (verify?.valid) imageUrl = uploadData.publicUrl;
        }
      } catch {
        setError("Image upload failed. Please try again or remove the image.");
        setSubmitting(false);
        return;
      }
    }
    try {
      const data = await apiFetch("/api/support", { method: "POST", body: JSON.stringify({ ticketType, name: userName || undefined, category, subject: subject.trim(), description: description.trim(), image_url: imageUrl }) });
      setSubmittedTicketCode(data?.ticketCode || null);
      setSubmitted(true);
      myTicketsCacheRef.current = null; // invalidate cache so next visit re-fetches fresh
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setTab("form"); setTicketType(""); setCategory(""); setSubject(""); setDescription("");
      setImage(null); setSubmitted(false); setSubmittedTicketCode(null); setError("");
      setSelectedTicket(null); setChatOpen(false); setChatReplies([]); setChatInput(""); setChatError("");
      clearInterval(pollRef.current);
    }, 200);
  };

  const MODAL_H = { height: "90vh", maxHeight: 680 };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      slotProps={{ backdrop: { sx: { backgroundColor: BRAND.backdrop, backdropFilter: "blur(1px)" } } }}
      sx={{ display: "flex", alignItems: "center", justifyContent: "center", p: 2 }}
    >
      <Box sx={{
        display: "flex", flexDirection: "row",
        outline: "none",
      }}>
        {/* ── Main modal panel ── */}
        <Box sx={{
          width: isSmall ? "min(480px, calc(100vw - 32px))" : 480,
          height: isSmall ? "85vh" : MODAL_H.height,
          maxHeight: MODAL_H.maxHeight,
          display: "flex", flexDirection: "column",
          background: BRAND.surface,
          border: `1px solid ${BRAND.border}`,
          borderRadius: chatOpen && !isSmall ? "16px 0 0 16px" : 4,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          overflow: "hidden",
          boxSizing: "border-box",
          flexShrink: 0,
        }}>
          {/* Header */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 3, py: 2.5, borderBottom: `1.5px solid ${BRAND.divider}`, flexShrink: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: 2, background: BRAND.iconBg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <SupportAgentIcon sx={{ color: BRAND.accent, fontSize: 22 }} />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1.2, color: "text.primary" }}>Contact Support</Typography>
                <Typography variant="caption" sx={{ color: BRAND.secondary }} fontWeight={600}>We'll get back to you as soon as possible</Typography>
              </Box>
            </Box>
            <IconButton onClick={handleClose} size="small" sx={{ color: BRAND.secondary }}><CloseIcon /></IconButton>
          </Box>

          {/* Tabs */}
          {!submitted && (
            <Box sx={{ display: "flex", gap: 1, px: 3, py: 1.5, borderBottom: `1.5px solid ${BRAND.divider}`, flexShrink: 0 }}>
              {[["form", "Submit Ticket"], ["my-tickets", "My Tickets"], ["faq", "Q&A"]].map(([t, label]) => (
                <Box key={t} onClick={() => { setTab(t); setSelectedTicket(null); closeChat(); }}
                  sx={{ px: 2, py: 0.75, borderRadius: 2, cursor: "pointer", fontWeight: 700, fontSize: 13, userSelect: "none", transition: "all 0.15s", bgcolor: tab === t ? BRAND.accent : "transparent", color: tab === t ? "#fff" : BRAND.secondary, "&:hover": { bgcolor: tab === t ? BRAND.accentHover : BRAND.divider } }}>
                  {label}
                </Box>
              ))}
            </Box>
          )}

          {/* Body */}
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2.5, minHeight: 0 }}>
            {submitted ? (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <SupportAgentIcon sx={{ color: BRAND.accent, fontSize: 48, mb: 1.5 }} />
                <Typography fontWeight={800} fontSize={17} sx={{ mb: 1 }}>Ticket submitted!</Typography>
                {submittedTicketCode && (
                  <Box sx={{ display: "inline-block", px: 2.5, py: 1.25, borderRadius: 2, border: `2px solid ${BRAND.accent}`, background: BRAND.iconBg, mb: 1.5 }}>
                    <Typography variant="caption" sx={{ color: BRAND.secondary, display: "block", mb: 0.25, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 10 }}>Your Ticket Code — save this!</Typography>
                    <Typography fontWeight={900} fontSize={22} sx={{ color: BRAND.accent, letterSpacing: 1 }}>{submittedTicketCode}</Typography>
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  A moderator will review your request shortly.{submittedTicketCode ? " You can also check status without logging in using your Ticket Code and email." : ""}
                </Typography>
              </Box>
            ) : tab === "form" ? (
              <>
                <Box sx={{ display: "flex", gap: 1.5, mb: 2 }}>
                  {userName && <TextField label="Name" value={userName} fullWidth size="small" disabled sx={{ "& .MuiOutlinedInput-root": { bgcolor: BRAND.inputBg }, "& .Mui-disabled": { WebkitTextFillColor: BRAND.secondary } }} />}
                  {userEmail && <TextField label="Email" value={userEmail} fullWidth size="small" disabled sx={{ "& .MuiOutlinedInput-root": { bgcolor: BRAND.inputBg }, "& .Mui-disabled": { WebkitTextFillColor: BRAND.secondary } }} />}
                </Box>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Type</InputLabel>
                  <Select value={ticketType} label="Type" onChange={(e) => { setTicketType(e.target.value); setCategory(""); }} sx={{ bgcolor: BRAND.inputBg }}>
                    {TICKET_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
                <FormControl fullWidth size="small" sx={{ mb: 2 }} disabled={!ticketType}>
                  <InputLabel>Category</InputLabel>
                  <Select value={category} label="Category" onChange={(e) => setCategory(e.target.value)} sx={{ bgcolor: BRAND.inputBg }}>
                    {(CATEGORIES_BY_TYPE[ticketType] || []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                  </Select>
                </FormControl>
                <TextField label="Subject" placeholder="Brief summary of your issue" value={subject} onChange={(e) => setSubject(e.target.value.slice(0, SUBJECT_MAX))} fullWidth size="small" inputProps={{ maxLength: SUBJECT_MAX }} helperText={`${stripInvisible(subject).length}/${SUBJECT_MAX}`} sx={{ mb: 2, "& .MuiOutlinedInput-root": { bgcolor: BRAND.inputBg }, "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 } }} />
                <TextField label="Description" placeholder="Describe your issue in detail" value={description} onChange={(e) => setDescription(e.target.value.slice(0, DESC_MAX))} multiline rows={4} fullWidth size="small" inputProps={{ maxLength: DESC_MAX }} helperText={`${stripInvisible(description).length}/${DESC_MAX}`} sx={{ mb: 2, "& .MuiOutlinedInput-root": { bgcolor: BRAND.inputBg }, "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 } }} />
                {ticketType === "Bug Report" && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: BRAND.secondary, display: "block", mb: 0.75 }}>Screenshot / Attachment (optional)</Typography>
                    {image ? (
                      <Box>
                        <Box component="img" src={image.dataUrl} alt="preview" sx={{ maxWidth: "100%", maxHeight: 140, borderRadius: 1.5, objectFit: "contain", border: `1px solid ${BRAND.border}`, display: "block", mb: 0.5 }} />
                        <Button size="small" onClick={() => { setImage(null); setError(""); }} sx={{ color: BRAND.accent, fontSize: 12, p: 0, minWidth: 0 }}>Remove</Button>
                      </Box>
                    ) : (
                      <Box onClick={() => !imageConverting && fileInputRef.current.click()} sx={{ border: `2px dashed ${BRAND.border}`, borderRadius: 1.5, p: 1.5, cursor: "pointer", textAlign: "center", background: BRAND.inputBg, transition: "border-color 0.15s", "&:hover": { borderColor: BRAND.accent } }}>
                        {imageConverting
                          ? <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, color: "text.disabled" }}><CircularProgress size={16} sx={{ color: BRAND.accent }} /><Typography variant="caption" fontWeight={700}>Converting…</Typography></Box>
                          : <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, color: "text.disabled" }}><CloudUploadIcon sx={{ fontSize: 18 }} /><Typography variant="caption" fontWeight={700}>Click to upload — JPG, PNG, WebP, GIF (max 5 MB)</Typography></Box>}
                      </Box>
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*,.heic,.heif" onChange={handleImageFile} style={{ display: "none" }} />
                  </Box>
                )}
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
              </>
            ) : tab === "my-tickets" ? (
              selectedTicket ? (
                <Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => { setSelectedTicket(null); closeChat(); }} size="small" sx={{ color: BRAND.accent, textTransform: "none", fontWeight: 700, pl: 0 }}>
                      Back to tickets
                    </Button>
                    {selectedTicket.status !== "closed" && (
                      <Button
                        startIcon={<ChatBubbleOutlineIcon sx={{ fontSize: 16 }} />}
                        size="small"
                        onClick={() => chatOpen ? closeChat() : openChat(selectedTicket)}
                        sx={{ color: chatOpen ? BRAND.secondary : BRAND.accent, fontWeight: 700, fontSize: 12, textTransform: "none", border: `1px solid ${chatOpen ? BRAND.border : BRAND.accent}`, borderRadius: 2, px: 1.5 }}
                      >
                        {chatOpen ? "Close Chat" : "Open Chat"}
                      </Button>
                    )}
                  </Box>

                  {/* Header card */}
                  <Box sx={{ border: `1.5px solid ${BRAND.border}`, borderRadius: 2, p: 2, mb: 2 }}>
                    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.25 }}>
                      <Chip label={STATUS_LABEL[selectedTicket.status] || selectedTicket.status} size="small" sx={STATUS_SX[selectedTicket.status] || STATUS_SX.closed} />
                      <Chip label={selectedTicket.ticket_type} size="small" variant="outlined" />
                      {selectedTicket.category && <Chip label={selectedTicket.category} size="small" variant="outlined" />}
                    </Box>
                    <Typography fontWeight={800} fontSize={15} sx={{ mb: 1.5, lineHeight: 1.3 }}>{selectedTicket.ticket_title}</Typography>
                    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      <Box>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: BRAND.secondary }}>Submitted</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{new Date(selectedTicket.created_at).toLocaleDateString()}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: BRAND.secondary }}>Assigned To</Typography>
                        <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{selectedTicket.claimed_by || "Unassigned"}</Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Description */}
                  <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: BRAND.secondary, display: "block", mb: 0.75 }}>Your Message</Typography>
                  <Box sx={{ background: BRAND.inputBg, border: `1px solid ${BRAND.border}`, borderRadius: 1.5, p: 1.5, mb: 2 }}>
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{selectedTicket.ticket_desc}</Typography>
                  </Box>

                  {/* Image */}
                  {selectedTicket.image_url && (
                    <Box component="img" src={selectedTicket.image_url} alt="attachment" sx={{ maxWidth: "100%", maxHeight: 200, borderRadius: 1.5, objectFit: "contain", border: `1px solid ${BRAND.border}`, display: "block", mb: 2 }} />
                  )}

                  {/* On small screens, show inline replies instead of the panel */}
                  {isSmall && (
                    <>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: BRAND.secondary, display: "block", mb: 1 }}>Replies</Typography>
                      {chatReplies.length === 0 && !chatOpen ? (
                        <Box sx={{ textAlign: "center", py: 2.5, border: `1px dashed ${BRAND.border}`, borderRadius: 1.5 }}>
                          <Typography variant="body2" sx={{ color: BRAND.secondary, fontStyle: "italic" }}>No replies yet — a moderator will respond soon.</Typography>
                        </Box>
                      ) : (
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {(chatReplies.length ? chatReplies : (selectedTicket.support_replies || [])).map((r) => (
                            <Box key={r.id} sx={{ display: "flex", justifyContent: r.is_moderator ? "flex-start" : "flex-end" }}>
                              <Box sx={{ maxWidth: "80%", p: 1.25, borderRadius: 2, background: r.is_moderator ? BRAND.modBubble : BRAND.accent, border: r.is_moderator ? `1px solid ${BRAND.border}` : "none" }}>
                                <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.25, letterSpacing: 0.3, color: r.is_moderator ? BRAND.accent : "rgba(255,255,255,0.75)", textAlign: r.is_moderator ? "left" : "right" }}>
                                  {r.is_moderator ? "Support Team" : (userName || "You")}
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: r.is_moderator ? "text.primary" : "#fff", lineHeight: 1.5 }}>{r.message}</Typography>
                                <Typography sx={{ fontSize: 10, color: r.is_moderator ? BRAND.secondary : "rgba(255,255,255,0.7)", mt: 0.25 }}>{new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      )}
                      {selectedTicket.status !== "closed" && (
                        <Box sx={{ display: "flex", gap: 1, mt: 1.5 }}>
                          <TextField size="small" fullWidth placeholder="Reply…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChatMessage())} inputProps={{ maxLength: 1000 }} helperText={`${stripInvisible(chatInput).length}/1000`} sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 13, bgcolor: BRAND.inputBg }, "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 } }} />
                          <IconButton onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending} sx={{ bgcolor: BRAND.accent, color: "#fff", borderRadius: 2, width: 40, height: 40, flexShrink: 0, "&:hover": { bgcolor: BRAND.accentHover }, "&.Mui-disabled": { bgcolor: BRAND.buttonDisabledBg } }}>
                            {chatSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 18 }} />}
                          </IconButton>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              ) : myTicketsLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress size={28} sx={{ color: BRAND.accent }} /></Box>
              ) : myTicketsError ? (
                <Alert severity="error">{myTicketsError}</Alert>
              ) : myTickets.length === 0 ? (
                <Box sx={{ textAlign: "center", py: 4 }}>
                  <SupportAgentIcon sx={{ color: BRAND.secondary, fontSize: 40, mb: 1 }} />
                  <Typography variant="body2" sx={{ color: BRAND.secondary }}>You haven't submitted any tickets yet.</Typography>
                </Box>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {myTickets.map((t) => (
                    <Box key={t.id} onClick={() => { setSelectedTicket(t); setChatReplies([]); }}
                      sx={{ p: 1.5, borderRadius: 2, cursor: "pointer", border: `1.5px solid ${BRAND.border}`, transition: "border-color 0.15s, box-shadow 0.15s", "&:hover": { borderColor: BRAND.accent, boxShadow: `0 0 0 2px ${BRAND.accent}22` } }}>
                      <Box sx={{ display: "flex", gap: 1, mb: 0.75, flexWrap: "wrap" }}>
                        <Chip label={STATUS_LABEL[t.status] || t.status} size="small" sx={STATUS_SX[t.status] || STATUS_SX.closed} />
                        <Chip label={t.ticket_type} size="small" variant="outlined" sx={{ fontSize: 11 }} />
                      </Box>
                      <Typography fontWeight={700} fontSize={14} sx={{ mb: 0.25, lineHeight: 1.3 }}>{t.ticket_title}</Typography>
                      <Typography variant="caption" sx={{ color: BRAND.secondary }}>
                        {new Date(t.created_at).toLocaleDateString()} · {t.support_replies?.length || 0} {t.support_replies?.length === 1 ? "reply" : "replies"}
                      </Typography>
                    </Box>
                  ))}
                  {myTicketsHasMore && (
                    <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
                      <Button
                        size="small"
                        onClick={loadMoreMyTickets}
                        disabled={myTicketsLoadingMore}
                        sx={{ color: BRAND.accent, fontWeight: 700, fontSize: 12, textTransform: "none", border: `1px solid ${BRAND.border}`, borderRadius: 2, px: 2 }}
                      >
                        {myTicketsLoadingMore ? <CircularProgress size={13} sx={{ color: BRAND.accent, mr: 0.75 }} /> : null}
                        {myTicketsLoadingMore ? "Loading…" : "Load more"}
                      </Button>
                    </Box>
                  )}
                </Box>
              )
            ) : (
              <SupportFAQ accent={BRAND.accent} secondary={BRAND.secondary} divider={BRAND.divider} />
            )}
          </Box>

          {/* Footer */}
          <Box sx={{ px: 3, py: 2, borderTop: `1.5px solid ${BRAND.divider}`, background: BRAND.footerBg, flexShrink: 0 }}>
            {submitted ? (
              <Button variant="contained" fullWidth onClick={handleClose} sx={{ background: BRAND.accent, "&:hover": { background: BRAND.accentHover }, fontWeight: 800, borderRadius: 2, py: 1.25, fontSize: 15, textTransform: "none" }}>Done</Button>
            ) : tab === "form" ? (
              <Button variant="contained" fullWidth disabled={!ticketType || !category || !stripInvisible(subject) || !stripInvisible(description) || submitting || imageConverting} onClick={handleSubmit}
                sx={{ background: BRAND.accent, "&:hover": { background: BRAND.accentHover }, "&.Mui-disabled": { background: BRAND.buttonDisabledBg, color: BRAND.buttonDisabledText }, fontWeight: 800, borderRadius: 2, py: 1.25, fontSize: 15, textTransform: "none" }}>
                {submitting ? <CircularProgress size={20} color="inherit" /> : "Submit Ticket"}
              </Button>
            ) : null}
          </Box>
        </Box>

        {/* ── Chat slide panel (desktop only) ── */}
        {!isSmall && (
          <Box sx={{
            width: chatOpen ? 320 : 0,
            ...MODAL_H,
            overflow: "hidden",
            transition: "width 0.28s cubic-bezier(0.4,0,0.2,1)",
            flexShrink: 0,
          }}>
            <Box sx={{
              width: 320,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: BRAND.chatSurface,
              border: `1px solid ${BRAND.border}`,
              borderLeft: "none",
              borderRadius: "0 16px 16px 0",
              overflow: "hidden",
            }}>
              {/* Chat header */}
              <Box sx={{ px: 2, py: 1.75, borderBottom: `1px solid ${BRAND.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ChatBubbleOutlineIcon sx={{ fontSize: 18, color: BRAND.accent }} />
                  <Typography fontWeight={800} fontSize={14}>Live Chat</Typography>
                </Box>
                <IconButton size="small" onClick={closeChat} sx={{ color: BRAND.secondary }}><CloseIcon fontSize="small" /></IconButton>
              </Box>

              {/* Messages */}
              <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1.5, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
                {chatReplies.length === 0 ? (
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography variant="body2" sx={{ color: BRAND.secondary, fontStyle: "italic", textAlign: "center" }}>
                      No messages yet. Send one to get started!
                    </Typography>
                  </Box>
                ) : chatReplies.map((r) => (
                  <Box key={r.id} sx={{ display: "flex", justifyContent: r.is_moderator ? "flex-start" : "flex-end" }}>
                    <Box sx={{ maxWidth: "85%", px: 1.25, py: 1, borderRadius: r.is_moderator ? "4px 12px 12px 12px" : "12px 4px 12px 12px", background: r.is_moderator ? BRAND.modBubble : BRAND.accent, border: r.is_moderator ? `1px solid ${BRAND.border}` : "none", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
                      <Typography sx={{ fontSize: 10, fontWeight: 700, mb: 0.25, letterSpacing: 0.3, color: r.is_moderator ? BRAND.accent : "rgba(255,255,255,0.75)", textAlign: r.is_moderator ? "left" : "right" }}>
                        {r.is_moderator ? "Support Team" : (userName || "You")}
                      </Typography>
                      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", color: r.is_moderator ? "text.primary" : "#fff", lineHeight: 1.5, fontSize: 13 }}>{r.message}</Typography>
                      <Typography sx={{ fontSize: 10, color: r.is_moderator ? BRAND.secondary : "rgba(255,255,255,0.65)", mt: 0.25, textAlign: r.is_moderator ? "left" : "right" }}>
                        {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Typography>
                    </Box>
                  </Box>
                ))}
                <div ref={chatBottomRef} />
              </Box>

              {/* Input */}
              {selectedTicket?.status !== "closed" ? (
                <Box sx={{ px: 1.5, py: 1.25, borderTop: `1px solid ${BRAND.divider}`, flexShrink: 0 }}>
                  {chatError && <Alert severity="error" sx={{ mb: 0.75, py: 0, fontSize: 12 }}>{chatError}</Alert>}
                  <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}>
                    <TextField
                      size="small" fullWidth multiline maxRows={4}
                      placeholder="Type a message…"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                      inputProps={{ maxLength: 1000 }}
                      helperText={`${stripInvisible(chatInput).length}/1000`}
                      sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2, fontSize: 13, bgcolor: BRAND.inputBg }, "& .MuiFormHelperText-root": { textAlign: "right", mr: 0.5 } }}
                    />
                    <IconButton onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending}
                      sx={{ bgcolor: BRAND.accent, color: "#fff", borderRadius: 2, width: 38, height: 38, flexShrink: 0, "&:hover": { bgcolor: BRAND.accentHover }, "&.Mui-disabled": { bgcolor: BRAND.buttonDisabledBg } }}>
                      {chatSending ? <CircularProgress size={16} color="inherit" /> : <SendIcon sx={{ fontSize: 17 }} />}
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <Box sx={{ px: 2, py: 1.5, borderTop: `1px solid ${BRAND.divider}`, flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ color: BRAND.secondary, fontStyle: "italic" }}>This ticket is closed.</Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Box>
    </Modal>
  );
}
