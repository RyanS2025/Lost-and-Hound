import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import apiFetch from "../utils/apiFetch";
import { useAuth } from "./AuthContext";

// Mirrors the web app pattern from my-app/src/App.jsx:
// fetch listings ONCE after auth, cache at app level, let Map read from
// the cache so tab switches are instant. Feed keeps its own paginated
// fetch because it has different UX needs (10-per-page with Load More).

interface ItemsContextType {
  items: any[];
  itemsLoaded: boolean;
  refreshItems: () => Promise<void>;
  updateItem: (itemId: string, patch: Partial<any>) => void;
}

const ItemsContext = createContext<ItemsContextType>({
  items: [],
  itemsLoaded: false,
  refreshItems: async () => {},
  updateItem: () => {},
});

export function useItems() {
  return useContext(ItemsContext);
}

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { user, mfaVerified } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);

  const refreshItems = useCallback(async () => {
    // Fire-and-forget cleanup — don't block the fetch on it
    apiFetch("/api/listings/cleanup", { method: "POST" }).catch(() => {});
    try {
      // Page 1 — biggest wins come from rendering this ASAP
      const firstPage = await apiFetch(`/api/listings?page=1&limit=250`);
      setItems(firstPage?.data || []);
      setItemsLoaded(true);

      // Progressively append additional pages
      let page = 2;
      let hasMore = firstPage?.hasMore ?? false;
      while (hasMore) {
        const result = await apiFetch(`/api/listings?page=${page}&limit=250`);
        setItems((prev) => [...prev, ...(result?.data || [])]);
        hasMore = result?.hasMore ?? false;
        page++;
      }
    } catch (err) {
      console.error("ItemsContext fetch error:", err);
      setItemsLoaded(true);
    }
  }, []);

  // Prefetch as soon as user is authenticated — runs in background
  // while user is on feed, so map is instant when they switch tabs.
  useEffect(() => {
    if (user && mfaVerified) {
      refreshItems();
    } else {
      setItems([]);
      setItemsLoaded(false);
    }
  }, [user?.id, mfaVerified, refreshItems]);

  const updateItem = useCallback((itemId: string, patch: Partial<any>) => {
    setItems((prev) => prev.map((i) => (i.item_id === itemId ? { ...i, ...patch } : i)));
  }, []);

  return (
    <ItemsContext.Provider value={{ items, itemsLoaded, refreshItems, updateItem }}>
      {children}
    </ItemsContext.Provider>
  );
}
