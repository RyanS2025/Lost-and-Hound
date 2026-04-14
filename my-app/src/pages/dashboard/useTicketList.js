import { useState, useRef, useCallback } from "react";
import apiFetch from "../../utils/apiFetch";

/**
 * Shared state + fetch logic for a paginated ticket list.
 * Each ticket-type page (Feedback, Bugs, Support) uses this hook.
 */
export function useTicketList(ticketType) {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState("open");
  const [actionError, setActionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const cacheRef = useRef(null);

  const fetchTickets = useCallback(async (pg = 1, append = false) => {
    if (pg === 1 && cacheRef.current) {
      // Serve stale cache immediately, revalidate in background
      setTickets(cacheRef.current.tickets);
      setHasMore(cacheRef.current.hasMore);
      setPage(1);
      setLoading(false);
      apiFetch(`/api/support-tickets?ticket_type=${encodeURIComponent(ticketType)}&page=1&limit=20`)
        .then((payload) => {
          const t = payload?.tickets || [];
          const h = payload?.hasMore ?? false;
          cacheRef.current = { tickets: t, hasMore: h };
          setTickets(t);
          setHasMore(h);
        })
        .catch(() => {});
      return;
    }

    if (pg === 1 && !append) setLoading(true);
    else setLoadingMore(true);

    setActionError("");
    try {
      const payload = await apiFetch(
        `/api/support-tickets?ticket_type=${encodeURIComponent(ticketType)}&page=${pg}&limit=20`
      );
      const t = payload?.tickets || [];
      const h = payload?.hasMore ?? false;
      setTickets((prev) => (append ? [...prev, ...t] : t));
      setHasMore(h);
      setPage(pg);
      if (pg === 1) cacheRef.current = { tickets: t, hasMore: h };
    } catch {
      if (!cacheRef.current) setActionError("Failed to load tickets.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [ticketType]);

  const handleStatus = useCallback(async (ticketId, newStatus) => {
    try {
      const updated = await apiFetch(`/api/support-tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setTickets((prev) => {
        const next = prev.map((t) => (t.id === ticketId ? { ...t, ...updated } : t));
        if (cacheRef.current) cacheRef.current = { ...cacheRef.current, tickets: next };
        return next;
      });
    } catch {
      /* silently fail — list will reflect true state on next fetch */
    }
  }, []);

  const deleteTicket = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/support-tickets/${deleteTarget}`, { method: "DELETE" });
      setTickets((prev) => {
        const next = prev.filter((t) => t.id !== deleteTarget);
        if (cacheRef.current) cacheRef.current = { ...cacheRef.current, tickets: next };
        return next;
      });
    } catch {
      setActionError("Failed to delete ticket.");
    }
    setDeleteTarget(null);
  }, [deleteTarget]);

  return {
    tickets, loading, hasMore, loadingMore, page, setPage,
    statusTab, setStatusTab,
    actionError, deleteTarget, setDeleteTarget,
    fetchTickets, handleStatus, deleteTicket,
  };
}
