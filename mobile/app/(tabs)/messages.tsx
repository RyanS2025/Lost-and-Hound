import { useState, useEffect, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../utils/supabaseClient";
import apiFetch from "../../utils/apiFetch";
import { tapHaptic } from "../../utils/haptics";
import { useTheme } from "../../contexts/ThemeContext";
import { useTimezone } from "../../contexts/TimezoneContext";
import { useConversations } from "../../contexts/ConversationsContext";
import ScreenHeader from "../../components/ScreenHeader";
import ReportModal from "../../components/ReportModal";
import { formatTime } from "../../utils/timezone";

const MESSAGE_MAX_LENGTH = 500;

export default function MessagesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTheme();
  const { timezone } = useTimezone();
  const params = useLocalSearchParams<{ conversationId?: string }>();

  // Conversations come from ConversationsContext — prefetched at login, shared app-wide.
  const {
    conversations,
    profiles,
    listings,
    unreadCounts,
    loaded: conversationsLoaded,
    hasMore: convoHasMore,
    loadMore: loadMoreConvos,
    removeConversation,
    markConversationRead,
    getCachedThread,
    setCachedThread,
  } = useConversations();
  const loadingConversations = !conversationsLoaded;

  const [selectedConvo, setSelectedConvo] = useState<any | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [msgPage, setMsgPage] = useState(1);
  const [msgHasMore, setMsgHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const hideConversation = (convo: any) => {
    Alert.alert("Close Conversation", "Are you sure you want to close this conversation?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Close", style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/api/conversations/${convo.id}`, { method: "DELETE" });
            removeConversation(convo.id);
            if (selectedConvo?.id === convo.id) setSelectedConvo(null);
          } catch (err) { console.error("Close conversation error:", err); }
        },
      },
    ]);
  };
  const [reportTarget, setReportTarget] = useState<{ id: string; name: string } | null>(null);

  // Auto-select conversation from params (e.g. from "Message Poster" button)
  useEffect(() => {
    if (!params.conversationId || !conversations.length) return;
    const match = conversations.find((c) => c.id === params.conversationId);
    if (match && selectedConvo?.id !== match.id) setSelectedConvo(match);
  }, [params.conversationId, conversations]);

  useEffect(() => {
    if (!selectedConvo) { setMessages([]); setIsClosed(false); setMsgPage(1); setMsgHasMore(false); return; }
    let active = true;

    // Cache-first: if the thread is prefetched, paint instantly and skip spinner.
    // Then do a background fetch to catch any messages since the cache was warmed.
    const cached = getCachedThread(selectedConvo.id);
    if (cached) {
      setMessages(cached.messages);
      setIsClosed(cached.isClosed);
      setMsgHasMore(cached.hasMore);
      setMsgPage(1);
      setLoadingMessages(false);
    } else {
      setLoadingMessages(true);
    }

    (async () => {
      try {
        const result = await apiFetch(`/api/conversations/${selectedConvo.id}/messages`);
        if (active) {
          setMessages(result?.messages || []);
          setIsClosed(result?.isClosed || false);
          setMsgHasMore(result?.hasMore ?? false);
          setMsgPage(1);
          setLoadingMessages(false);
          // Warm the cache so a later re-open of the same thread is instant.
          setCachedThread(selectedConvo.id, {
            messages: result?.messages || [],
            isClosed: result?.isClosed || false,
            hasMore: result?.hasMore ?? false,
          });
        }
        apiFetch(`/api/conversations/${selectedConvo.id}/read`, { method: "PATCH" }).catch(() => {});
      } catch (err) { console.error("Fetch messages error:", err); if (active) setLoadingMessages(false); }
    })();

    const channel = supabase
      .channel(`messages-${selectedConvo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${selectedConvo.id}` }, (payload) => {
        setMessages((prev) => {
          const cleaned = prev.filter((m) => !(typeof m.id === "string" && m.id.startsWith("temp-") && m.sender_id === payload.new.sender_id));
          if (cleaned.some((m) => m.id === payload.new.id)) return cleaned;
          return [...cleaned, payload.new];
        });
      })
      .subscribe();

    return () => { active = false; supabase.removeChannel(channel); };
  }, [selectedConvo]);

  useEffect(() => {
    if (messages.length > 0) setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }, [messages.length]);

  const sendMessage = async () => {
    const trimmed = newMessage.trim();
    if (!trimmed || !selectedConvo || isClosed || sending || trimmed.length > MESSAGE_MAX_LENGTH) return;

    const tempId = `temp-${Date.now()}`;
    tapHaptic();
    setMessages((prev) => [...prev, { id: tempId, conversation_id: selectedConvo.id, sender_id: user.id, content: trimmed, created_at: new Date().toISOString(), is_system: false }]);
    setNewMessage("");
    setSending(true);

    try {
      await apiFetch(`/api/conversations/${selectedConvo.id}/messages`, { method: "POST", body: JSON.stringify({ content: trimmed }) });
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setNewMessage(trimmed);
    }
    setSending(false);
  };

  const otherId = selectedConvo ? (selectedConvo.participant_1 === user.id ? selectedConvo.participant_2 : selectedConvo.participant_1) : "";
  const otherName = selectedConvo && profiles[otherId] ? `${profiles[otherId].first_name} ${profiles[otherId].last_name}` : "User";
  const selectedListing = selectedConvo ? listings[selectedConvo.listing_id] : null;

  // ── Thread view ──
  if (selectedConvo) {
    return (
      <>
      <SafeAreaView style={[styles.container, { backgroundColor: t.bg, paddingBottom: 80 }]} edges={["top"]}>
        <View style={[styles.threadHeader, { borderBottomColor: t.separator }]}>
          <TouchableOpacity onPress={() => setSelectedConvo(null)} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color={t.accent} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={[styles.threadTitle, { color: t.text }]} numberOfLines={1}>{selectedListing?.title || "Conversation"}</Text>
            <Text style={[styles.threadSubtitle, { color: t.subtext }]}>{otherName}</Text>
          </View>
          <TouchableOpacity onPress={() => setReportTarget({ id: otherId, name: otherName })} hitSlop={12}>
            <Ionicons name="flag-outline" size={20} color={t.muted} />
          </TouchableOpacity>
        </View>

        <View style={[styles.safetyBanner, { backgroundColor: t.isDark ? "#3a2f22" : "#fff8e1", borderBottomColor: t.isDark ? "rgba(255,193,7,0.35)" : "#ffe082" }]}>
          <Ionicons name="warning-outline" size={14} color="#f59e0b" />
          <Text style={[styles.safetyText, { color: t.isDark ? "#f6c66a" : "#92400e" }]}>Never share personal info. Always meet in a public place.</Text>
        </View>

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {loadingMessages ? (
            <View style={styles.centered}><ActivityIndicator size="large" color={t.accent} /></View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={msgHasMore ? (
                <TouchableOpacity
                  style={{ alignSelf: "center", paddingVertical: 8 }}
                  disabled={loadingOlder}
                  onPress={async () => {
                    setLoadingOlder(true);
                    try {
                      const nextPage = msgPage + 1;
                      const result = await apiFetch(`/api/conversations/${selectedConvo.id}/messages?page=${nextPage}&limit=10`);
                      const olderMsgs = result?.messages || [];
                      setMessages((prev) => [...olderMsgs, ...prev]);
                      setMsgHasMore(result?.hasMore ?? false);
                      setMsgPage(nextPage);
                    } catch (err) { console.error("Load older error:", err); }
                    setLoadingOlder(false);
                  }}
                >
                  {loadingOlder ? <ActivityIndicator size="small" color={t.accent} /> : <Text style={{ color: t.accent, fontWeight: "700", fontSize: 13 }}>Load older messages</Text>}
                </TouchableOpacity>
              ) : null}
              renderItem={({ item: msg }) => {
                if (msg.is_system) return (
                  <View style={[styles.systemMsg, { backgroundColor: t.inputBg }]}>
                    <Text style={[styles.systemMsgText, { color: t.muted }]}>{msg.content}</Text>
                  </View>
                );
                const isOwn = msg.sender_id === user.id;
                return (
                  <View style={[styles.msgRow, isOwn ? styles.msgRowOwn : styles.msgRowOther]}>
                    <View style={[styles.msgBubble, isOwn ? { backgroundColor: t.accent } : { backgroundColor: t.cardSolid, borderWidth: 1, borderColor: t.cardBorder }]}>
                      <Text style={[styles.msgText, { color: isOwn ? "#fff" : t.text }]}>{msg.content}</Text>
                    </View>
                    <Text style={[styles.msgTime, { color: t.muted }, isOwn ? { textAlign: "right" } : { textAlign: "left" }]}>{formatTime(msg.created_at, timezone)}</Text>
                  </View>
                );
              }}
            />
          )}

          {isClosed ? (
            <View style={[styles.closedBanner, { borderTopColor: t.separator }]}>
              <Text style={[styles.closedText, { color: t.muted }]}>This conversation has been closed.</Text>
            </View>
          ) : (
            <View style={[styles.inputRow, { borderTopColor: t.separator, backgroundColor: t.bg }]}>
              <TextInput
                style={[styles.msgInput, { backgroundColor: t.inputBg, color: t.text, borderColor: t.inputBorder }]}
                placeholder="Type a message..."
                placeholderTextColor={t.muted}
                value={newMessage}
                onChangeText={(txt) => setNewMessage(txt.slice(0, MESSAGE_MAX_LENGTH))}
                onSubmitEditing={sendMessage}
                returnKeyType="send"
                multiline
                maxLength={MESSAGE_MAX_LENGTH}
              />
              <TouchableOpacity onPress={sendMessage} disabled={sending || !newMessage.trim()} style={[styles.sendBtn, (!newMessage.trim() || sending) && { opacity: 0.4 }]}>
                {sending ? <ActivityIndicator size="small" color={t.accent} /> : <Ionicons name="send" size={20} color={t.accent} />}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        type="user"
        targetId={reportTarget?.id || ""}
        targetLabel={reportTarget?.name || ""}
      />
      </>
    );
  }

  // ── Conversation list ──
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg, paddingBottom: 80 }]} edges={["top"]}>
      <ScreenHeader title="Messages" showLogo rightIcon="settings-outline" onRightPress={() => router.push("/settings")} />

      {loadingConversations ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={t.accent} /></View>
      ) : conversations.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={48} color={t.muted} />
          <Text style={[styles.emptyText, { color: t.muted }]}>No conversations yet</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 90 }}
          renderItem={({ item: convo }) => {
            const otherId = convo.participant_1 === user.id ? convo.participant_2 : convo.participant_1;
            const other = profiles[otherId];
            const listing = listings[convo.listing_id];
            return (
              <TouchableOpacity style={[styles.convoItem, { borderBottomColor: t.separator }]} onPress={() => { setSelectedConvo(convo); markConversationRead(convo.id); }} onLongPress={() => hideConversation(convo)} activeOpacity={0.7}>
                <View style={[styles.convoAvatar, { backgroundColor: t.inputBg }]}>
                  <Ionicons name="person" size={20} color={t.muted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.convoTitle, { color: t.text }]} numberOfLines={1}>{listing?.title || "Unknown Listing"}</Text>
                  <Text style={[styles.convoSubtitle, { color: t.subtext }]} numberOfLines={1}>{other ? `${other.first_name} ${other.last_name}` : "Loading..."}</Text>
                </View>
                {unreadCounts[convo.id] > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCounts[convo.id]}</Text>
                  </View>
                )}
                <Ionicons name="chevron-forward" size={18} color={t.muted} />
              </TouchableOpacity>
            );
          }}
        />
      )}

      <ReportModal
        visible={!!reportTarget}
        onClose={() => setReportTarget(null)}
        type="user"
        targetId={reportTarget?.id || ""}
        targetLabel={reportTarget?.name || ""}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 22, fontWeight: "900" },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  emptyText: { fontWeight: "700", fontSize: 15 },
  convoItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  convoAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  convoTitle: { fontSize: 14, fontWeight: "700" },
  convoSubtitle: { fontSize: 12, marginTop: 2 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: "#ef4444", justifyContent: "center", alignItems: "center", paddingHorizontal: 5, marginRight: 6 },
  unreadBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  // Thread
  threadHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  threadTitle: { fontSize: 15, fontWeight: "800" },
  threadSubtitle: { fontSize: 12 },
  safetyBanner: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1 },
  safetyText: { fontSize: 11, fontWeight: "600", flex: 1 },
  messageList: { padding: 12, gap: 4 },
  systemMsg: { alignSelf: "center", borderRadius: 99, paddingHorizontal: 14, paddingVertical: 4, marginVertical: 4 },
  systemMsgText: { fontSize: 12 },
  msgRow: { maxWidth: "80%", marginVertical: 2 },
  msgRowOwn: { alignSelf: "flex-end" },
  msgRowOther: { alignSelf: "flex-start" },
  msgBubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 3 },
  inputRow: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  msgInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  closedBanner: { padding: 14, borderTopWidth: StyleSheet.hairlineWidth, alignItems: "center" },
  closedText: { fontWeight: "700", fontSize: 13 },
});
