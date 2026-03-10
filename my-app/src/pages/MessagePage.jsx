import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Box, Typography, Paper, TextField, IconButton, Button } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import ChatIcon from "@mui/icons-material/ChatBubbleOutline";
import DeleteIcon from "@mui/icons-material/Delete";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import FlagIcon from "@mui/icons-material/Flag";
import ReportModal from "../components/ReportModal";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";

export default function MessagesPage() {
  const { user, profile } = useAuth();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isClosed, setIsClosed] = useState(false);
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

    const name = profile?.first_name ? `${profile.first_name} ${profile.last_name}` : "Someone";
    await supabase.from("messages").insert({
      conversation_id: convo.id,
      sender_id: user.id,
      content: `${name} has closed this conversation.`,
      is_system: true,
    });

    await supabase.from("hidden_conversations").insert({
      user_id: user.id,
      conversation_id: convo.id,
    });

    await supabase.from("messages").delete().eq("conversation_id", convo.id);
    await supabase.from("conversations").delete().eq("id", convo.id);

    setConversations((prev) => prev.filter((c) => c.id !== convo.id));
    if (selectedConversation?.id === convo.id) setSelectedConversation(null);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || isClosed) return;
    await supabase.from("messages").insert({
      conversation_id: selectedConversation.id,
      sender_id: user.id,
      content: newMessage,
    });
    setNewMessage("");
  };

  useEffect(() => {
    if (!user) return;
    const fetchConversations = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
      if (data) {
        const { data: hiddenData } = await supabase
          .from("hidden_conversations")
          .select("conversation_id")
          .eq("user_id", user.id);
        const hiddenIds = new Set((hiddenData || []).map((h) => h.conversation_id));
        const visible = data.filter((c) => !hiddenIds.has(c.id));
        setConversations(visible);

        const otherIds = visible.map((c) =>
          c.participant_1 === user.id ? c.participant_2 : c.participant_1
        );

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", otherIds);

        if (profileData) {
          const map = {};
          profileData.forEach((p) => { map[p.id] = p; });
          setProfiles(map);
        }

        const listingIds = visible.map((c) => c.listing_id).filter(Boolean);
        if (listingIds.length > 0) {
          const { data: listingData } = await supabase
            .from("listings")
            .select("item_id, title")
            .in("item_id", listingIds);
          if (listingData) {
            const map = {};
            listingData.forEach((l) => { map[l.item_id] = l; });
            setListings(map);
          }
        }
      }
    };
    fetchConversations();
  }, [user]);

  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      setIsClosed(false);
      return;
    }
    setIsClosed(false);

    let channel;
    let closedChannel;
    let active = true;

    const setup = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at", { ascending: true });

      if (!active) return;
      if (data) setMessages(data);

      const { count } = await supabase
        .from("hidden_conversations")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", selectedConversation.id);
      if (!active) return;
      setIsClosed((count ?? 0) > 0);

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
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", convoId)
        .single();
      if (!data) return;

      handledConvoIdRef.current = convoId;

      const otherId = data.participant_1 === user?.id ? data.participant_2 : data.participant_1;
      const { data: p } = await supabase.from("profiles").select("id, first_name, last_name").eq("id", otherId).single();
      if (p) setProfiles((prev) => ({ ...prev, [p.id]: p }));

      if (data.listing_id) {
        const { data: l } = await supabase.from("listings").select("item_id, title").eq("item_id", data.listing_id).single();
        if (l) setListings((prev) => ({ ...prev, [l.item_id]: l }));
      }

      setConversations((prev) => prev.some((c) => c.id === convoId) ? prev : [data, ...prev]);
      setSelectedConversation(data);
    };

    fetchAndSelect();
  }, [conversations, searchParams]);

  // Helper to get the other participant's info for the selected conversation
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
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", p: 3, boxSizing: "border-box", height: "calc(100vh - 64px - 36px)", overflow: "hidden" }}>
      <Box sx={{ width: "100%", maxWidth: 900, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <Typography variant="h4" fontWeight={900} sx={{ mb: 2.5 }}>
          Messages
        </Typography>

        <Paper
          elevation={2}
          sx={{
            flex: 1, minHeight: 0, borderRadius: 3,
            border: "1.5px solid #ecdcdc", overflow: "hidden",
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "row", height: "100%" }}>

            {/* Left sidebar */}
            <Box sx={{ width: "30%", borderRight: "1.5px solid #ecdcdc", overflowY: "auto" }}>
              {conversations.length === 0 ? (
                <Typography variant="caption" color="text.disabled" fontWeight={700} sx={{ p: 2, display: "block" }}>
                  No conversations yet
                </Typography>
              ) : (
                conversations.map((convo) => (
                  <Box
                    key={convo.id}
                    onClick={() => setSelectedConversation(convo)}
                    sx={{
                      p: 2, cursor: "pointer",
                      background: selectedConversation?.id === convo.id ? "#fdf0f0" : "transparent",
                      borderBottom: "1px solid #f5eded",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      "&:hover": { background: "#fdf7f7", "& .delete-btn": { opacity: 1 } },
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
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {other ? `${other.first_name} ${other.last_name}` : "Loading..."}
                          </Typography>
                        </Box>
                      );
                    })()}
                    <IconButton
                      className="delete-btn"
                      size="small"
                      onClick={(e) => hideConversation(convo, e)}
                      sx={{ opacity: 0, transition: "opacity 0.15s", color: "#bbb", "&:hover": { color: "#A84D48" }, ml: 1, flexShrink: 0 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))
              )}
            </Box>

            {/* Right panel */}
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
              {!selectedConversation ? (
                <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography fontWeight={700} color="text.disabled">Select a conversation</Typography>
                </Box>
              ) : (
                <Box sx={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
                  {/* Safety warning + report button */}
                  <Box
                    sx={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 1, px: 2, py: 1,
                      background: "#fff8e1", borderBottom: "1px solid #ffe082",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
                      <WarningAmberIcon sx={{ color: "#f59e0b", fontSize: 18, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ color: "#92400e", fontWeight: 600, lineHeight: 1.4 }}>
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
                            color: "#92400e", fontSize: 11, fontWeight: 700,
                            textTransform: "none", whiteSpace: "nowrap", flexShrink: 0,
                            "&:hover": { color: "#A84D48", background: "rgba(168,77,72,0.08)" },
                          }}
                        >
                          Report
                        </Button>
                      );
                    })()}
                  </Box>

                  {/* Messages */}
                  <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 1 }}>
                    {messages.map((msg) => {
                      if (msg.is_system) {
                        return (
                          <Box key={msg.id} sx={{ alignSelf: "center", my: 0.5 }}>
                            <Typography
                              variant="caption"
                              sx={{
                                px: 2, py: 0.5, borderRadius: 99,
                                background: "#f0e8e8", color: "#999",
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
                        <Box key={msg.id} sx={{ alignSelf: isOwn ? "flex-end" : "flex-start", maxWidth: "70%" }}>
                          <Box sx={{
                            p: "10px 14px", borderRadius: 3,
                            background: isOwn ? "#A84D48" : "#f5eded",
                            color: isOwn ? "#fff" : "#333",
                          }}>
                            <Typography fontSize={14}>{msg.content}</Typography>
                          </Box>
                          <Typography
                            variant="caption" color="text.disabled"
                            sx={{ display: "block", mt: 0.5, textAlign: isOwn ? "right" : "left" }}
                          >
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Typography>
                        </Box>
                      );
                    })}
                    <div ref={bottomRef} />
                  </Box>

                  {/* Input */}
                  {isClosed ? (
                    <Box sx={{ p: 2, borderTop: "1.5px solid #ecdcdc", textAlign: "center" }}>
                      <Typography variant="caption" fontWeight={700} color="text.disabled">
                        This conversation has been closed.
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: "flex", alignItems: "center", p: 1.5, borderTop: "1.5px solid #ecdcdc", gap: 1 }}>
                      <TextField
                        fullWidth size="small" placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      />
                      <IconButton onClick={sendMessage} disabled={!newMessage.trim()} sx={{ color: "#A84D48" }}>
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
  );
}