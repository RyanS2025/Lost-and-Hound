import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { Keyboard } from "@capacitor/keyboard";
import { Box, Typography, Paper, TextField, IconButton, Button, CircularProgress } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import SendIcon from "@mui/icons-material/Send";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FlagIcon from "@mui/icons-material/Flag";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ReportModal from "../components/ReportModal";
import { supabase } from "../../backend/supabaseClient";
import apiFetch from "../utils/apiFetch";
import { useDemo } from "../contexts/DemoContext";
import { DEMO_MESSAGES } from "../demo/mockData";
import { containsProfanity, stripInvisible } from "../utils/profanityFilter";
import { useAuth } from "../AuthContext";
import { DEFAULT_TIME_ZONE, formatTime } from "../utils/timezone";

const MESSAGE_MAX_LENGTH = 500;

export default function MessagesPage({ effectiveTheme = "light", timeZone = DEFAULT_TIME_ZONE, conversations, setConversations, profiles, setProfiles, listings, setListings, unreadCounts = {}, setUnreadCounts = () => {}, conversationsLoaded }) {
  const isDark = effectiveTheme === "dark";
  const isMobile = useMediaQuery("(max-width:900px)");
  const pageBg = isDark ? "#101214" : "#f9f5f4";
  const pageDot = isDark ? "rgba(255,255,255,0.07)" : "rgba(122,41,41,0.18)";
  const secondaryTextColor = isDark ? "#B8BABD" : "text.secondary";
  const mutedTextColor = isDark ? "#818384" : "text.disabled";
  const { user, profile } = useAuth();
  const { isDemoMode } = useDemo();
  const currentUserId = isDemoMode ? 'demo-user-id' : user?.id;

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [msgHasMore, setMsgHasMore] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [msgProfane, setMsgProfane] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [searchParams] = useSearchParams();

  const overlayRef = useRef(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const showSub = Keyboard.addListener("keyboardWillShow", ({ keyboardHeight }) => {
      setKeyboardOpen(true);
      if (overlayRef.current) {
        overlayRef.current.style.height = `calc(100dvh - ${keyboardHeight}px)`;
      }
      // Scroll messages to bottom so the latest message stays visible above the keyboard
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      });
    });
    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardOpen(false);
      if (overlayRef.current) {
        overlayRef.current.style.height = "100dvh";
      }
    });
    return () => {
      showSub.then((h) => h.remove());
      hideSub.then((h) => h.remove());
    };
  }, []);

  const scrollContainerRef = useRef(null);
  const scrollIntentRef = useRef("none");
  const prevScrollHeightRef = useRef(0);
  const handledConvoIdRef = useRef(null);
  const messageCacheRef = useRef({});

  const hideConversation = async (convo, e) => {
    e.stopPropagation();
    if (isDemoMode) {
      setConversations((prev) => prev.filter((c) => c.id !== convo.id));
      if (selectedConversation?.id === convo.id) setSelectedConversation(null);
      return;
    }
    try {
      await apiFetch(`/api/conversations/${convo.id}`, { method: "DELETE" });
      setConversations((prev) => prev.filter((c) => c.id !== convo.id));
      if (selectedConversation?.id === convo.id) setSelectedConversation(null);
    } catch (err) {
      console.error("Close conversation error:", err);
    }
  };

  const sendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage || !selectedConversation || isClosed || sending || trimmedMessage.length > MESSAGE_MAX_LENGTH || msgProfane) return;

    if (isDemoMode) {
      const demoMsg = {
        id: `demo-sent-${Date.now()}`,
        conversation_id: selectedConversation.id,
        sender_id: 'demo-user-id',
        content: trimmedMessage,
        created_at: new Date().toISOString(),
        is_system: false,
      };
      scrollIntentRef.current = "bottom-instant";
      setMessages((prev) => [...prev, demoMsg]);
      setNewMessage("");
      setMsgProfane(false);
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      id: tempId,
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content: trimmedMessage,
      created_at: new Date().toISOString(),
      is_system: false,
    };

    scrollIntentRef.current = "bottom-instant";
    setMessages((prev) => [...prev, optimisticMsg]);
    setNewMessage("");
    setMsgProfane(false);
    setSending(true);

    try {
      await apiFetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: trimmedMessage }),
      });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(trimmedMessage);
      console.error("Send message error:", err);
    }
    setSending(false);
  };


  // Save messages to cache whenever they change
  useEffect(() => {
    if (selectedConversation && messages.length > 0) {
      messageCacheRef.current[selectedConversation.id] = messages.filter(
        (m) => !(typeof m.id === "string" && m.id.startsWith("temp-"))
      );
    }
  }, [messages, selectedConversation]);

  // Prefetch messages for the top 3 most-recent conversations in the background.
  // The existing cache-hit path at the `selectedConversation` effect will pick
  // these up, making first-click on a top-3 thread render instantly. This
  // turns the messages page into a "tap → instant" experience for ~70% of
  // typical clicks (power-law distribution of conversation popularity).
  useEffect(() => {
    if (isDemoMode) return;
    if (!conversationsLoaded || !conversations?.length) return;
    const top3 = conversations.slice(0, 3);
    const toFetch = top3.filter((c) => !messageCacheRef.current[c.id]);
    if (toFetch.length === 0) return;

    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        toFetch.map((c) =>
          apiFetch(`/api/conversations/${c.id}/messages`)
            .then((r) => ({ id: c.id, data: r }))
            .catch(() => null)
        )
      );
      if (cancelled) return;
      for (const result of results) {
        if (!result) continue;
        messageCacheRef.current[result.id] = result.data?.messages || [];
      }
    })();

    return () => { cancelled = true; };
  }, [conversations, conversationsLoaded]);

  // Cross-conversation invalidation: when a new message arrives for ANY
  // conversation (not just the selected one), drop its cache entry so the
  // next click re-fetches. Prevents stale threads in the prefetch cache.
  useEffect(() => {
    if (isDemoMode || !user) return;
    const channel = supabase
      .channel("msg-cache-invalidation-web")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const convoId = payload?.new?.conversation_id;
        if (!convoId) return;
        // Don't drop the currently-selected convo's cache — its own
        // subscription keeps it fresh via setMessages.
        if (selectedConversation?.id === convoId) return;
        delete messageCacheRef.current[convoId];
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedConversation]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      setIsClosed(false);
      setMsgHasMore(false);
      setMsgPage(1);
      return;
    }
    setIsClosed(false);

    let channel;
    let closedChannel;
    let active = true;

    // Show cached messages instantly if available
    const cached = messageCacheRef.current[selectedConversation.id];
    if (cached && cached.length > 0) {
      scrollIntentRef.current = "bottom-instant";
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setLoadingMessages(true);
    }

    const setup = async () => {
      if (isDemoMode) {
        const demoMsgs = DEMO_MESSAGES[selectedConversation.id] || [];
        if (active) {
          scrollIntentRef.current = "bottom-instant";
          setMessages(demoMsgs);
          setIsClosed(false);
          setMsgHasMore(false);
          setMsgPage(1);
          setLoadingMessages(false);
        }
        return;
      }
      try {
        const result = await apiFetch(
          `/api/conversations/${selectedConversation.id}/messages`
        );
        if (active) {
          scrollIntentRef.current = "bottom-instant";
          setMessages(result?.messages || []);
          setIsClosed(result?.isClosed || false);
          setMsgHasMore(result?.hasMore ?? false);
          setMsgPage(1);
          setLoadingMessages(false);
        }
        // Mark all messages from the other participant as read so the navbar badge decrements
        apiFetch(`/api/conversations/${selectedConversation.id}/read`, { method: "PATCH" }).catch(() => {});
      } catch (err) {
        console.error("Fetch messages error:", err);
        setLoadingMessages(false);
      }

      channel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedConversation.id}` }, (payload) => {
          scrollIntentRef.current = "bottom-instant";
          setMessages((prev) => {
            const cleaned = prev.filter((m) =>
              !(typeof m.id === "string" && m.id.startsWith("temp-") && m.sender_id === payload.new.sender_id)
            );
            if (cleaned.some((m) => m.id === payload.new.id)) return cleaned;
            return [...cleaned, payload.new];
          });
        })
        .subscribe();

      closedChannel = supabase
        .channel(`closed-${selectedConversation.id}`)
        .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversations", filter: `id=eq.${selectedConversation.id}` }, () => {
          setIsClosed(true);
          setConversations((prev) => prev.filter((c) => c.id !== selectedConversation.id));
        })
        .subscribe();
    };

    setup();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
      if (closedChannel) supabase.removeChannel(closedChannel);
    };
  }, [selectedConversation]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const intent = scrollIntentRef.current;
    scrollIntentRef.current = "none";
    if (intent === "bottom-instant") {
      container.scrollTop = container.scrollHeight;
    } else if (intent === "preserve") {
      container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
    }
  }, [messages]);

  useEffect(() => {
    const convoId = searchParams.get("conversation");
    if (!convoId) return;
    if (handledConvoIdRef.current === convoId) return;

    const match = conversations.find((c) => c.id === convoId);
    if (match) {
      handledConvoIdRef.current = convoId;
      setSelectedConversation(match);
      return;
    }

    if (isDemoMode) return;

    const fetchAndSelect = async () => {
      try {
        const { conversation, profile: otherProfile, listing } = await apiFetch(`/api/conversations/${convoId}`);

        handledConvoIdRef.current = convoId;

        if (otherProfile) setProfiles((prev) => ({ ...prev, [otherProfile.id]: otherProfile }));
        if (listing) setListings((prev) => ({ ...prev, [listing.item_id]: listing }));

        setConversations((prev) =>
          prev.some((c) => c.id === convoId) ? prev : [conversation, ...prev]
        );
        setSelectedConversation(conversation);
      } catch (err) {
        console.error("Fetch conversation error:", err);
      }
    };

    fetchAndSelect();
  }, [conversations, searchParams]);

  const getOtherParticipant = () => {
    if (!selectedConversation) return null;
    const otherId = selectedConversation.participant_1 === currentUserId
      ? selectedConversation.participant_2
      : selectedConversation.participant_1;
    const other = profiles[otherId];
    return {
      id: otherId,
      name: other ? `${other.first_name} ${other.last_name}` : "this user",
      firstName: other?.first_name || "user",
    };
  };

  const msgListContent = (maxW) => (
    <>
      {msgHasMore && (
        <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
          <Button size="small" disabled={loadingOlder}
            onClick={async () => {
              setLoadingOlder(true);
              try {
                const nextPage = msgPage + 1;
                const result = await apiFetch(`/api/conversations/${selectedConversation.id}/messages?page=${nextPage}&limit=10`);
                const older = result?.messages || [];
                prevScrollHeightRef.current = scrollContainerRef.current?.scrollHeight || 0;
                scrollIntentRef.current = "preserve";
                setMessages(prev => [...older, ...prev]);
                setMsgHasMore(result?.hasMore ?? false);
                setMsgPage(nextPage);
              } catch (err) { console.error("Load older messages error:", err); }
              setLoadingOlder(false);
            }}
            sx={{ color: isDark ? "#FF4500" : "#A84D48", fontWeight: 600, textTransform: "none", fontSize: 12 }}
          >
            {loadingOlder ? <CircularProgress size={16} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} /> : "Load older messages"}
          </Button>
        </Box>
      )}
      {messages.map((msg) => {
        if (msg.is_system) {
          return (
            <Box key={msg.id} sx={{ alignSelf: "center", my: 0.5 }}>
              <Typography variant="caption" sx={{ px: 2, py: 0.5, borderRadius: 99, background: isDark ? "#2D2D2E" : "#f0e8e8", color: isDark ? "#818384" : "#999", display: "block", textAlign: "center" }}>
                {msg.content}
              </Typography>
            </Box>
          );
        }
        const isOwn = msg.sender_id === currentUserId;
        return (
          <Box key={msg.id} sx={{ alignSelf: isOwn ? "flex-end" : "flex-start", maxWidth: maxW, minWidth: 0 }}>
            <Box sx={{ p: "10px 14px", borderRadius: 3, background: isOwn ? "#A84D48" : isDark ? "#2D2D2E" : "#f5eded", color: isOwn ? "#fff" : isDark ? "#D7DADC" : "#333", maxWidth: "100%" }}>
              <Typography fontSize={14} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>{msg.content}</Typography>
            </Box>
            <Typography variant="caption" color={mutedTextColor} sx={{ display: "block", mt: 0.5, textAlign: isOwn ? "right" : "left" }}>
              {formatTime(msg.created_at, timeZone)}
            </Typography>
          </Box>
        );
      })}
      <div />
    </>
  );

  const inputBar = (
    isClosed ? (
      <Box sx={{ p: 2, borderTop: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc", textAlign: "center", flexShrink: 0 }}>
        <Typography variant="caption" fontWeight={700} color={mutedTextColor}>This conversation has been closed.</Typography>
      </Box>
    ) : (
      <Box sx={{ display: "flex", alignItems: "center", p: 1.5, borderTop: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc", gap: 1, flexShrink: 0 }}>
        <TextField
          fullWidth size="small" placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => { const v = e.target.value.slice(0, MESSAGE_MAX_LENGTH); setNewMessage(v); setMsgProfane(containsProfanity(v)); }}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !sending) { e.preventDefault(); sendMessage(); } }}
          error={msgProfane}
          helperText={msgProfane ? "Cannot use that word" : `${stripInvisible(newMessage).length}/${MESSAGE_MAX_LENGTH}`}
          inputProps={{ maxLength: MESSAGE_MAX_LENGTH }}
          sx={{
            "& .MuiOutlinedInput-root": { background: isDark ? "#2D2D2E" : "#fff", color: isDark ? "#D7DADC" : "inherit" },
            "& .MuiFormHelperText-root": { textAlign: "right", color: isDark ? "#818384" : "text.secondary", mr: 0.5 },
          }}
        />
        <IconButton onClick={sendMessage} disabled={sending || !newMessage.trim() || newMessage.trim().length > MESSAGE_MAX_LENGTH || msgProfane} sx={{ color: "#A84D48" }}>
          {sending ? <CircularProgress size={20} sx={{ color: "#A84D48" }} /> : <SendIcon />}
        </IconButton>
      </Box>
    )
  );

  const safetyBanner = (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1, px: 2, py: 1, flexShrink: 0, background: isDark ? "#3a2f22" : "#fff8e1", borderBottom: isDark ? "1px solid rgba(255,193,7,0.35)" : "1px solid #ffe082" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
        <WarningAmberIcon sx={{ color: "#f59e0b", fontSize: 18, flexShrink: 0 }} />
        <Typography variant="caption" sx={{ color: isDark ? "#f6c66a" : "#92400e", fontWeight: 600, lineHeight: 1.4 }}>
          Safety reminder: Never share personal information and always meet in a public place.
        </Typography>
      </Box>
      {(() => {
        const other = getOtherParticipant();
        if (!other) return null;
        return (
          <Button size="small" startIcon={<FlagIcon sx={{ fontSize: 14 }} />} onClick={() => setReportTarget({ id: other.id, name: other.name })}
            sx={{ color: isDark ? "#f2c27a" : "#92400e", fontSize: 11, fontWeight: 700, textTransform: "none", whiteSpace: "nowrap", flexShrink: 0, "&:hover": { color: "#A84D48", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(168,77,72,0.08)" } }}>
            Report
          </Button>
        );
      })()}
    </Box>
  );

  const convoListItems = (
    <>
      {!conversationsLoaded ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={24} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} />
        </Box>
      ) : conversations.length === 0 ? (
        <Typography variant="caption" color={mutedTextColor} fontWeight={700} sx={{ p: 2, display: "block" }}>No conversations yet</Typography>
      ) : (
        conversations.map((convo) => (
          <Box key={convo.id}
            onClick={() => { setSelectedConversation(convo); setUnreadCounts((prev) => ({ ...prev, [convo.id]: 0 })); }}
            tabIndex={0} role="button"
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedConversation(convo); } }}
            sx={{
              p: 2, cursor: "pointer",
              background: selectedConversation?.id === convo.id ? (isDark ? "#2D2D2E" : "#fdf0f0") : "transparent",
              borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f5eded",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              "&:hover": { background: isDark ? "#343536" : "#fdf7f7", "& .delete-btn": { opacity: 1 } },
              "&:focus-visible": { outline: "2px solid #A84D48", outlineOffset: -2 },
            }}
          >
            {(() => {
              const otherId = convo.participant_1 === currentUserId ? convo.participant_2 : convo.participant_1;
              const other = profiles[otherId];
              const listing = listings[convo.listing_id];
              return (
                <>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} fontSize={13} noWrap>{listing ? listing.title : "Unknown Listing"}</Typography>
                    <Typography variant="caption" color={secondaryTextColor} noWrap>{other ? `${other.first_name} ${other.last_name}` : "Loading..."}</Typography>
                  </Box>
                  {unreadCounts[convo.id] > 0 && (
                    <Box sx={{ minWidth: 20, height: 20, borderRadius: 10, px: 0.5, backgroundColor: "#A84D48", display: "flex", alignItems: "center", justifyContent: "center", ml: 1, flexShrink: 0 }}>
                      <Typography sx={{ color: "#fff", fontSize: 11, fontWeight: 800, lineHeight: 1 }}>{unreadCounts[convo.id]}</Typography>
                    </Box>
                  )}
                </>
              );
            })()}
            <IconButton className="delete-btn" size="small" onClick={(e) => hideConversation(convo, e)}
              sx={{ opacity: { xs: 1, md: 0 }, transition: "opacity 0.15s", color: isDark ? "#818384" : "#bbb", "&:hover": { color: "#A84D48" }, ml: 1, flexShrink: 0 }}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ))
      )}
    </>
  );

  return (
    <>
      <Box sx={{ position: "fixed", inset: 0, zIndex: -1, backgroundColor: pageBg, backgroundImage: `radial-gradient(circle, ${pageDot} 1px, transparent 1px)`, backgroundSize: "24px 24px" }} />

      {/* ── DESKTOP: split-panel ── */}
      {!isMobile && (
        <Box sx={{ display: "flex", justifyContent: "center", px: 3, py: 3, height: "calc(100dvh - 64px - env(safe-area-inset-top) - 56px - env(safe-area-inset-bottom))", boxSizing: "border-box", overflow: "hidden", color: isDark ? "#D7DADC" : "inherit" }}>
          <Box sx={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <Typography variant="h4" fontWeight={900} sx={{ mb: 2.5, flexShrink: 0 }}>Messages</Typography>
            <Paper elevation={2} sx={{ flex: 1, borderRadius: 3, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc", overflow: "hidden", background: isDark ? "#1A1A1B" : "#fff", minHeight: 0 }}>
              <Box sx={{ display: "flex", flexDirection: "row", height: "100%" }}>
                <Box sx={{ width: "30%", borderRight: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc", overflowY: "auto" }}>
                  {convoListItems}
                </Box>
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  {!selectedConversation ? (
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Typography fontWeight={700} color={mutedTextColor}>Select a conversation</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                      {safetyBanner}
                      <Box ref={scrollContainerRef} sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
                        {loadingMessages ? (
                          <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <CircularProgress size={28} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} />
                          </Box>
                        ) : msgListContent("70%")}
                      </Box>
                      {inputBar}
                    </Box>
                  )}
                </Box>
              </Box>
            </Paper>
          </Box>
        </Box>
      )}

      {/* ── MOBILE: conversation list ── */}
      {isMobile && (
        <Box sx={{ px: 1.5, py: 1.5, color: isDark ? "#D7DADC" : "inherit" }}>
          <Typography variant="h4" fontWeight={900} sx={{ mb: 2 }}>Messages</Typography>
          <Paper elevation={2} sx={{ borderRadius: 3, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc", overflow: "hidden", background: isDark ? "#1A1A1B" : "#fff" }}>
            {convoListItems}
          </Paper>
        </Box>
      )}

      {/* ── MOBILE: thread slide-in overlay ──
          Outer: handles viewport sizing (never animates, never re-layouts).
          Inner: handles the slide animation (never resizes). */}
      {isMobile && (
        <Box ref={overlayRef} sx={{
          position: "fixed",
          inset: 0,
          height: "100dvh",
          zIndex: 1300,
          pointerEvents: selectedConversation ? "auto" : "none",
          overflow: "hidden",
        }}>
          <Box sx={{
            width: "100%",
            height: "100%",
            display: "flex", flexDirection: "column",
            background: isDark ? "#1A1A1B" : "#fff",
            transform: selectedConversation ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            willChange: "transform",
            backfaceVisibility: "hidden",
          }}>
            {/* Header */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5, pt: "calc(env(safe-area-inset-top) + 8px)", pb: 0.75, flexShrink: 0, borderBottom: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #ecdcdc", background: isDark ? "#1A1A1B" : "#fff" }}>
              <IconButton size="small" onClick={() => setSelectedConversation(null)} sx={{ color: isDark ? "#D7DADC" : "#1a1a1a" }}>
                <ArrowBackIcon />
              </IconButton>
              {selectedConversation && (() => {
                const otherId = selectedConversation.participant_1 === currentUserId ? selectedConversation.participant_2 : selectedConversation.participant_1;
                const other = profiles[otherId];
                const listing = listings[selectedConversation.listing_id];
                return (
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={800} fontSize={15} noWrap sx={{ color: isDark ? "#D7DADC" : "#1a1a1a" }}>
                      {other ? `${other.first_name} ${other.last_name}` : "Loading..."}
                    </Typography>
                    {listing && <Typography variant="caption" color={secondaryTextColor} noWrap sx={{ display: "block" }}>{listing.title}</Typography>}
                  </Box>
                );
              })()}
            </Box>

            {/* Safety banner */}
            {selectedConversation && safetyBanner}

            {/* Messages */}
            <Box ref={scrollContainerRef} sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
              {loadingMessages ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CircularProgress size={28} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} />
                </Box>
              ) : msgListContent("85%")}
            </Box>

            {/* Input */}
            <Box sx={{ flexShrink: 0, pb: keyboardOpen ? 0 : "env(safe-area-inset-bottom)" }}>
              {inputBar}
            </Box>
          </Box>
        </Box>
      )}

      <ReportModal open={!!reportTarget} onClose={() => setReportTarget(null)} type="user" targetId={reportTarget?.id} targetLabel={reportTarget?.name} />
    </>
  );
}