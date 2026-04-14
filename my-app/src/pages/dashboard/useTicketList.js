import { useState, useCallback, useEffect } from "react";
import apiFetch from "../../utils/apiFetch";
import { ticketCache } from "../../utils/dashboardPrefetch";

/**
 * Shared state + fetch logic for a paginated ticket list.
 * Each ticket-type page (Feedback, Bugs, Support) uses this hook.
 */
export function useTicketList(ticketType, { pollInterval = 30_000 } = {}) {
  const cache = ticketCache[ticketType] || null;

  const [tickets, setTickets] = useState(cache?.tickets || []);
  const [loading, setLoading] = useState(!cache);
  const [hasMore, setHasMore] = useState(cache?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [statusTab, setStatusTab] = useState("open");
  const [actionError, setActionError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchTickets = useCallback(async (pg = 1, append = false) => {
    const cached = ticketCache[ticketType];

    if (pg === 1 && cached) {
      // Serve stale cache immediately, revalidate in background
      setTickets(cached.tickets);
      setHasMore(cached.hasMore);
      setPage(1);
      setLoading(false);
      apiFetch(`/api/support-tickets?ticket_type=${encodeURIComponent(ticketType)}&page=1&limit=20`)
        .then((payload) => {
          const t = payload?.tickets || [];
          const h = payload?.hasMore ?? false;
          ticketCache[ticketType] = { tickets: t, hasMore: h };
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
      if (pg === 1) ticketCache[ticketType] = { tickets: t, hasMore: h };
    } catch {
      if (!ticketCache[ticketType]) setActionError("Failed to load tickets.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [ticketType]);

  // Background poll — silent revalidation, no loading state
  useEffect(() => {
    if (!pollInterval) return;
    const id = setInterval(() => {
      apiFetch(`/api/support-tickets?ticket_type=${encodeURIComponent(ticketType)}&page=1&limit=20`)
        .then((payload) => {
          const t = payload?.tickets || [];
          const h = payload?.hasMore ?? false;
          ticketCache[ticketType] = { tickets: t, hasMore: h };
          setTickets(t);
          setHasMore(h);
        })
        .catch(() => {});
    }, pollInterval);
    return () => clearInterval(id);
  }, [ticketType, pollInterval]);

  const handleStatus = useCallback(async (ticketId, newStatus) => {
    try {
      const updated = await apiFetch(`/api/support-tickets/${ticketId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      setTickets((prev) => {
        const next = prev.map((t) => (t.id === ticketId ? { ...t, ...updated } : t));
        if (ticketCache[ticketType]) ticketCache[ticketType] = { ...ticketCache[ticketType], tickets: next };
        return next;
      });
    } catch {
      /* silently fail — list will reflect true state on next poll */
    }
  }, [ticketType]);

  const deleteTicket = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await apiFetch(`/api/support-tickets/${deleteTarget}`, { method: "DELETE" });
      setTickets((prev) => {
        const next = prev.filter((t) => t.id !== deleteTarget);
        if (ticketCache[ticketType]) ticketCache[ticketType] = { ...ticketCache[ticketType], tickets: next };
        return next;
      });
    } catch {
      setActionError("Failed to delete ticket.");
    }
    setDeleteTarget(null);
  }, [deleteTarget, ticketType]);

  return {
    tickets, loading, hasMore, loadingMore, page, setPage,
    statusTab, setStatusTab,
    actionError, deleteTarget, setDeleteTarget,
    fetchTickets, handleStatus, deleteTicket,
  };
}
