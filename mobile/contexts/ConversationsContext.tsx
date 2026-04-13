import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import apiFetch from "../utils/apiFetch";
import { supabase } from "../utils/supabaseClient";
import { useAuth } from "./AuthContext";

// Mirrors the web app pattern from my-app/src/App.jsx:
// fetch conversations + unread badge count ONCE after auth, cache at app
// level, subscribe to realtime. Tabs layout reads the badge from context,
// Messages screen reads the full list from context — both are instant.

interface CachedThread {
  messages: any[];
  isClosed: boolean;
  hasMore: boolean;
}

interface ConversationsContextType {
  conversations: any[];
  profiles: Record<string, any>;
  listings: Record<string, any>;
  unreadCounts: Record<string, number>;
  unreadTotal: number;
  loaded: boolean;
  hasMore: boolean;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  removeConversation: (id: string) => void;
  markConversationRead: (id: string) => void;
  // Client-side cache of recent message threads. Prefetched in the background
  // for the top 3 most-recent conversations after the list loads. Opening a
  // cached conversation renders instantly; cache entries are invalidated on
  // realtime INSERT so stale data never lingers.
  getCachedThread: (id: string) => CachedThread | null;
  setCachedThread: (id: string, thread: CachedThread) => void;
}

const ConversationsContext = createContext<ConversationsContextType>({
  conversations: [],
  profiles: {},
  listings: {},
  unreadCounts: {},
  unreadTotal: 0,
  loaded: false,
  hasMore: false,
  refresh: async () => {},
  loadMore: async () => {},
  removeConversation: () => {},
  markConversationRead: () => {},
  getCachedThread: () => null,
  setCachedThread: () => {},
});

export function useConversations() {
  return useContext(ConversationsContext);
}

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const { user, mfaVerified } = useAuth();
  const [conversations, setConversations] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const [listings, setListings] = useState<Record<string, any>>({});
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  // Message thread cache — keyed by conversation ID. Prefetched for top 3
  // conversations, invalidated on realtime INSERT, consumed by messages.tsx.
  const [threadCache, setThreadCache] = useState<Record<string, CachedThread>>({});

  const refresh = useCallback(async () => {
    try {
      const result = await apiFetch("/api/conversations?page=1&limit=10");
      setConversations(result?.conversations || []);
      setProfiles(result?.profiles || {});
      setListings(result?.listings || {});
      setUnreadCounts(result?.unreadCounts || {});
      setPage(1);
      setHasMore(result?.hasMore ?? false);
    } catch (err) {
      console.error("Conversations refresh error:", err);
    }
    setLoaded(true);
  }, []);

  const refreshUnreadTotal = useCallback(async () => {
    try {
      const result = await apiFetch("/api/messages/unread-count");
      setUnreadTotal(result?.count ?? 0);
    } catch {}
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasMore) return;
    const next = page + 1;
    try {
      const result = await apiFetch(`/api/conversations?page=${next}&limit=10`);
      setConversations((prev) => [...prev, ...(result?.conversations || [])]);
      setProfiles((prev) => ({ ...prev, ...(result?.profiles || {}) }));
      setListings((prev) => ({ ...prev, ...(result?.listings || {}) }));
      setUnreadCounts((prev) => ({ ...prev, ...(result?.unreadCounts || {}) }));
      setPage(next);
      setHasMore(result?.hasMore ?? false);
    } catch (err) {
      console.error("Load more conversations error:", err);
    }
  }, [hasMore, page]);

  const removeConversation = useCallback((id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setUnreadCounts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    // Server-authoritative recount for the tab badge
    refreshUnreadTotal();
  }, [refreshUnreadTotal]);

  const markConversationRead = useCallback((id: string) => {
    setUnreadCounts((prev) => ({ ...prev, [id]: 0 }));
    refreshUnreadTotal();
  }, [refreshUnreadTotal]);

  const getCachedThread = useCallback((id: string): CachedThread | null => {
    return threadCache[id] || null;
  }, [threadCache]);

  const setCachedThread = useCallback((id: string, thread: CachedThread) => {
    setThreadCache((prev) => ({ ...prev, [id]: thread }));
  }, []);

  const invalidateThreadCache = useCallback((id: string) => {
    setThreadCache((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  // Prefetch the top 3 most-recent conversations' messages in the background
  // after the conversation list loads. Renders are instant for these threads
  // because messages.tsx reads from the cache on click. The top 3 hit rate
  // for real messaging apps is ~70%, so this pays off most of the time.
  useEffect(() => {
    if (!loaded || conversations.length === 0) return;

    const top3 = conversations.slice(0, 3);
    // Only fetch threads we don't already have cached
    const toFetch = top3.filter((c) => !threadCache[c.id]);
    if (toFetch.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const results = await Promise.all(
          toFetch.map((c) =>
            apiFetch(`/api/conversations/${c.id}/messages`)
              .then((r: any) => ({ id: c.id, data: r }))
              .catch(() => null)
          )
        );
        if (cancelled) return;
        setThreadCache((prev) => {
          const next = { ...prev };
          for (const result of results) {
            if (!result) continue;
            next[result.id] = {
              messages: result.data?.messages || [],
              isClosed: result.data?.isClosed || false,
              hasMore: result.data?.hasMore || false,
            };
          }
          return next;
        });
      } catch (err) {
        console.error("Thread prefetch error:", err);
      }
    })();

    return () => { cancelled = true; };
    // threadCache intentionally omitted — we read it at effect-time via the
    // filter above. Adding it as a dep would cause the effect to re-run every
    // time prefetch completes, doing one extra no-op pass.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, conversations]);

  // Prefetch + realtime subscribe as soon as user is authenticated
  useEffect(() => {
    if (!user || !mfaVerified) {
      setConversations([]);
      setProfiles({});
      setListings({});
      setUnreadCounts({});
      setUnreadTotal(0);
      setLoaded(false);
      setPage(1);
      setHasMore(false);
      setThreadCache({});
      return;
    }

    // Fire both fetches in parallel
    refresh();
    refreshUnreadTotal();

    const channel = supabase
      .channel("convos-context-mobile")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload: any) => {
        // Invalidate cached thread for this conversation so next open re-fetches
        if (payload?.new?.conversation_id) invalidateThreadCache(payload.new.conversation_id);
        refresh();
        refreshUnreadTotal();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, () => {
        refreshUnreadTotal();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload: any) => {
        if (payload?.old?.conversation_id) invalidateThreadCache(payload.old.conversation_id);
        refreshUnreadTotal();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversations" }, () => {
        refresh();
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "conversations" }, () => {
        refresh();
        refreshUnreadTotal();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, mfaVerified, refresh, refreshUnreadTotal, invalidateThreadCache]);

  return (
    <ConversationsContext.Provider
      value={{
        conversations,
        profiles,
        listings,
        unreadCounts,
        unreadTotal,
        loaded,
        hasMore,
        refresh,
        loadMore,
        removeConversation,
        markConversationRead,
        getCachedThread,
        setCachedThread,
      }}
    >
      {children}
    </ConversationsContext.Provider>
  );
}
