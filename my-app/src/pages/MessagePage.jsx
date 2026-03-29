import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { useAuth } from "../AuthContext";
import { DEFAULT_TIME_ZONE, formatTime } from "../utils/timezone";

const MESSAGE_MAX_LENGTH = 500;

export default function MessagesPage({ effectiveTheme = "light", timeZone = DEFAULT_TIME_ZONE }) {
  const isDark = effectiveTheme === "dark";
  const isMobile = useMediaQuery("(max-width:900px)");
  const pageBg = isDark ? "#101214" : "#f9f5f4";
  const pageDot = isDark ? "rgba(255,255,255,0.07)" : "rgba(122,41,41,0.18)";
  const secondaryTextColor = isDark ? "#B8BABD" : "text.secondary";
  const mutedTextColor = isDark ? "#818384" : "text.disabled";
  const { user, profile } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isClosed, setIsClosed] = useState(false);
  const [msgHasMore, setMsgHasMore] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [profiles, setProfiles] = useState({});
  const [listings, setListings] = useState({});
  const [newMessage, setNewMessage] = useState("");
  const [reportTarget, setReportTarget] = useState(null);
  const [searchParams] = useSearchParams();
  const bottomRef = useRef(null);
  const handledConvoIdRef = useRef(null);

  const hideConversation = async (convo, e) => {
    e.stopPropagation();
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
    if (!trimmedMessage || !selectedConversation || isClosed || trimmedMessage.length > MESSAGE_MAX_LENGTH) return;
    try {
      await apiFetch(`/api/conversations/${selectedConversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: trimmedMessage }),
      });
      setNewMessage("");
    } catch (err) {
      console.error("Send message error:", err);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      try {
        const result = await apiFetch("/api/conversations");
        setConversations(result?.conversations || []);
        setProfiles(result?.profiles || {});
        setListings(result?.listings || {});
      } catch (err) {
        console.error("Fetch conversations error:", err);
      }
    };
    fetchConversations();
  }, [user]);

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

    const setup = async () => {
      try {
        const result = await apiFetch(
          `/api/conversations/${selectedConversation.id}/messages`
        );
        if (active) {
          setMessages(result?.messages || []);
          setIsClosed(result?.isClosed || false);
          setMsgHasMore(result?.hasMore ?? false);
          setMsgPage(1);
        }
      } catch (err) {
        console.error("Fetch messages error:", err);
      }

      channel = supabase
        .channel(`messages-${selectedConversation.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedConversation.id}` }, (payload) => {
          setMessages((prev) => [...prev, payload.new]);
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
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
    const otherId = selectedConversation.participant_1 === user.id
      ? selectedConversation.participant_2
      : selectedConversation.participant_1;
    const other = profiles[otherId];
    return {
      id: otherId,
      name: other ? `${other.first_name} ${other.last_name}` : "this user",
      firstName: other?.first_name || "user",
    };
  };

  return (
    <>
      <Box
        sx={{
          position: "fixed",
          inset: 0,
          zIndex: -1,
          backgroundColor: pageBg,
          backgroundImage: `radial-gradient(circle, ${pageDot} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          width: "100%",
          px: { xs: 1.25, sm: 2, md: 3 },
          py: { xs: 1.25, sm: 2, md: 3 },
          boxSizing: "border-box",
          height: "calc(100dvh - 64px - 36px)",
          overflow: "hidden",
          color: isDark ? "#D7DADC" : "inherit",
        }}
      >
      <Box sx={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography variant="h4" fontWeight={900} sx={{ mb: 2.5, flexShrink: 0 }}>
          Messages
        </Typography>

        <Paper
          elevation={2}
          sx={{
            flex: 1, borderRadius: 3,
            border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc",
            overflow: "hidden",
            background: isDark ? "#1A1A1B" : "#fff",
            minHeight: 0,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "row", height: "100%" }}>

            {/* Left sidebar */}
            <Box
              sx={{
                width: { xs: "100%", md: "30%" },
                borderRight: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc",
                overflowY: "auto",
                display: isMobile && selectedConversation ? "none" : "block",
              }}
            >
              {conversations.length === 0 ? (
                <Typography variant="caption" color={mutedTextColor} fontWeight={700} sx={{ p: 2, display: "block" }}>
                  No conversations yet
                </Typography>
              ) : (
                conversations.map((convo) => (
                  <Box
                    key={convo.id}
                    onClick={() => setSelectedConversation(convo)}
                    sx={{
                      p: 2, cursor: "pointer",
                      background: selectedConversation?.id === convo.id ? (isDark ? "#2D2D2E" : "#fdf0f0") : "transparent",
                      borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #f5eded",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      "&:hover": { background: isDark ? "#343536" : "#fdf7f7", "& .delete-btn": { opacity: 1 } },
                    }}
                  >
                    {(() => {
                      const otherId = convo.participant_1 === user.id ? convo.participant_2 : convo.participant_1;
                      const other = profiles[otherId];
                      const listing = listings[convo.listing_id];
                      return (
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography fontWeight={700} fontSize={13} noWrap>
                            {listing ? listing.title : "Unknown Listing"}
                          </Typography>
                          <Typography variant="caption" color={secondaryTextColor} noWrap>
                            {other ? `${other.first_name} ${other.last_name}` : "Loading..."}
                          </Typography>
                        </Box>
                      );
                    })()}
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={(e) => hideConversation(convo, e)}
                      sx={{ opacity: { xs: 1, md: 0 }, transition: "opacity 0.15s", color: isDark ? "#818384" : "#bbb", "&:hover": { color: "#A84D48" }, ml: 1, flexShrink: 0 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))
              )}
            </Box>

            {/* Right panel */}
            <Box
              sx={{
                flex: 1,
                display: isMobile && !selectedConversation ? "none" : "flex",
                flexDirection: "column",
                overflow: "hidden",
                minHeight: 0,
              }}
            >
              {!selectedConversation ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography fontWeight={700} color={mutedTextColor}>Select a conversation</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  {isMobile && (
                    <Box sx={{ px: 1.25, py: 0.75, borderBottom: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #ecdcdc", flexShrink: 0 }}>
                      <Button
                        size="small"
                        startIcon={<ArrowBackIcon fontSize="small" />}
                        onClick={() => setSelectedConversation(null)}
                        sx={{ color: "#A84D48", fontWeight: 700, textTransform: "none" }}
                      >
                        Back to conversations
                      </Button>
                    </Box>
                  )}
                  {/* Safety warning + report button */}
                  <Box
                    sx={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 1, px: 2, py: 1, flexShrink: 0,
                      background: isDark ? "#3a2f22" : "#fff8e1", borderBottom: isDark ? "1px solid rgba(255,193,7,0.35)" : "1px solid #ffe082",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
                      <WarningAmberIcon sx={{ color: "#f59e0b", fontSize: 18, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ color: isDark ? "#f6c66a" : "#92400e", fontWeight: 600, lineHeight: 1.4 }}>
                        Safety reminder: Never share personal information and always meet in a public place.
                      </Typography>
                    </Box>
                    {(() => {
                      const other = getOtherParticipant();
                      return (
                        <Button
                          size="small"
                          startIcon={<FlagIcon sx={{ fontSize: 14 }} />}
                          onClick={() => setReportTarget({ id: other.id, name: other.name })}
                          sx={{
                            color: isDark ? "#f2c27a" : "#92400e", fontSize: 11, fontWeight: 700,
                            textTransform: "none", whiteSpace: "nowrap", flexShrink: 0,
                            "&:hover": { color: "#A84D48", background: isDark ? "rgba(255,255,255,0.1)" : "rgba(168,77,72,0.08)" },
                          }}
                        >
                          Report
                        </Button>
                      );
                    })()}
                  </Box>

                  {/* Messages — scrollable area */}
                  <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1, minHeight: 0 }}>
                    {msgHasMore && (
                      <Box sx={{ display: "flex", justifyContent: "center", mb: 1 }}>
                        <Button
                          size="small"
                          onClick={async () => {
                            setLoadingOlder(true);
                            try {
                              const nextPage = msgPage + 1;
                              const result = await apiFetch(
                                `/api/conversations/${selectedConversation.id}/messages?page=${nextPage}&limit=10`
                              );
                              const olderMsgs = result?.messages || [];
                              setMessages(prev => [...olderMsgs, ...prev]);
                              setMsgHasMore(result?.hasMore ?? false);
                              setMsgPage(nextPage);
                            } catch (err) {
                              console.error("Load older messages error:", err);
                            }
                            setLoadingOlder(false);
                          }}
                          disabled={loadingOlder}
                          sx={{
                            color: isDark ? "#FF4500" : "#A84D48",
                            fontWeight: 600,
                            textTransform: "none",
                            fontSize: 12,
                          }}
                        >
                          {loadingOlder ? <CircularProgress size={16} sx={{ color: isDark ? "#FF4500" : "#A84D48" }} /> : "Load older messages"}
                        </Button>
                      </Box>
                    )}
                    {messages.map((msg) => {
                      if (msg.is_system) {
                        return (
                          <Box key={msg.id} sx={{ alignSelf: "center", my: 0.5 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                px: 2, py: 0.5, borderRadius: 99,
                                background: isDark ? "#2D2D2E" : "#f0e8e8", color: isDark ? "#818384" : "#999",
                                display: "block", textAlign: "center",
                              }}
                            >
                              {msg.content}
                            </Typography>
                          </Box>
                        );
                      }

                      const isOwn = msg.sender_id === user.id;
                      return (
                        <Box key={msg.id} sx={{ alignSelf: isOwn ? "flex-end" : "flex-start", maxWidth: { xs: "85%", md: "70%" }, minWidth: 0 }}>
                          <Box sx={{
                            p: "10px 14px", borderRadius: 3,
                            background: isOwn ? "#A84D48" : isDark ? "#2D2D2E" : "#f5eded",
                            color: isOwn ? "#fff" : isDark ? "#D7DADC" : "#333",
                            maxWidth: "100%",
                          }}>
                            <Typography fontSize={14} sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", wordBreak: "break-word" }}>
                              {msg.content}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption" color={mutedTextColor}
                            sx={{ display: "block", mt: 0.5, textAlign: isOwn ? "right" : "left" }}
                          >
                            {formatTime(msg.created_at, timeZone)}
                          </Typography>
                        </Box>
                      );
                    })}
                    <div ref={bottomRef} />
                  </Box>

                  {/* Input — pinned to bottom */}
                  {isClosed ? (
                    <Box sx={{ p: 2, borderTop: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc", textAlign: "center", flexShrink: 0 }}>
                      <Typography variant="caption" fontWeight={700} color={mutedTextColor}>
                        This conversation has been closed.
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", p: 1.5, borderTop: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #ecdcdc", gap: 1, flexShrink: 0 }}>
                      <TextField
                        fullWidth size="small" placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value.slice(0, MESSAGE_MAX_LENGTH))}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        helperText={`${newMessage.length}/${MESSAGE_MAX_LENGTH}`}
                        inputProps={{ maxLength: MESSAGE_MAX_LENGTH }}
                        sx={{
                          "& .MuiOutlinedInput-root": {
                            background: isDark ? "#2D2D2E" : "#fff",
                            color: isDark ? "#D7DADC" : "inherit",
                          },
                          "& .MuiFormHelperText-root": {
                            textAlign: "right",
                            color: isDark ? "#818384" : "text.secondary",
                            mr: 0.5,
                          },
                        }}
                      />
                      <IconButton onClick={sendMessage} disabled={!newMessage.trim() || newMessage.trim().length > MESSAGE_MAX_LENGTH} sx={{ color: "#A84D48" }}>
                        <SendIcon />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              )}
            </Box>

          </Box>
        </Paper>
      </Box>

      {/* Report modal */}
      <ReportModal
        open={!!reportTarget}
        onClose={() => setReportTarget(null)}
        type="user"
        targetId={reportTarget?.id}
        targetLabel={reportTarget?.name}
      />
      </Box>
    </>
  );
}