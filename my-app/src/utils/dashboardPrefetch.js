/**
 * Shared module-level caches for the moderation dashboard.
 * All dashboard pages import from here so App.jsx can prefetch
 * into the same cache objects that pages will read from on mount.
 */
import apiFetch from "./apiFetch";

export const summaryCache   = { data: null };   // DashboardOverviewPage
export const ticketCache    = {};               // useTicketList (keyed by ticketType)
export const reportsCache   = { reports: null, stolen: null }; // ReportsPage
export const myWorkCache    = { data: null };   // MyWorkPage
export const moderatorsCache = { data: null };  // DashboardPage

let prefetchStarted = false;

/**
 * Called by App.jsx as soon as profile.is_moderator is confirmed.
 * Fires all fetches in parallel; pages will find caches warm on first visit.
 */
export async function prefetchDashboard() {
  if (prefetchStarted) return; // only ever runs once per session
  prefetchStarted = true;

  await Promise.allSettled([
    // Overview counts
    apiFetch("/api/dashboard/summary").then((d) => { summaryCache.data = d; }),

    // Moderator list
    apiFetch("/api/moderators").then((d) => { moderatorsCache.data = d?.moderators || []; }),

    // Ticket lists — page 1 for each type
    apiFetch("/api/support-tickets?ticket_type=Support&page=1&limit=20").then((p) => {
      ticketCache["Support"] = { tickets: p?.tickets || [], hasMore: p?.hasMore ?? false };
    }),
    apiFetch("/api/support-tickets?ticket_type=Bug%20Report&page=1&limit=20").then((p) => {
      ticketCache["Bug Report"] = { tickets: p?.tickets || [], hasMore: p?.hasMore ?? false };
    }),
    apiFetch("/api/support-tickets?ticket_type=Feedback&page=1&limit=20").then((p) => {
      ticketCache["Feedback"] = { tickets: p?.tickets || [], hasMore: p?.hasMore ?? false };
    }),

    // My Work
    apiFetch("/api/support-tickets/my-work").then((d) => { myWorkCache.data = d?.tickets || []; }),

    // Reports (page 1 only — Load More handles the rest)
    apiFetch("/api/reports?page=1&limit=10").then((p) => {
      reportsCache.reports = { reports: p?.reports || [], listings: p?.listings || {}, hasMore: p?.hasMore ?? false };
    }),
  ]);
}

/** Call this on logout so the next moderator starts fresh */
export function clearDashboardCache() {
  summaryCache.data    = null;
  moderatorsCache.data = null;
  myWorkCache.data     = null;
  reportsCache.reports = null;
  reportsCache.stolen  = null;
  Object.keys(ticketCache).forEach((k) => delete ticketCache[k]);
  prefetchStarted = false;
}
