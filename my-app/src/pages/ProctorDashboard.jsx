import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Box, Typography, Paper, Button, Chip, TextField, InputAdornment, Tooltip,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell,
} from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import SearchIcon from "@mui/icons-material/Search";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import AddIcon from "@mui/icons-material/Add";
import { useAuth } from "../AuthContext";
import apiFetch from "../utils/apiFetch";
import { formatCalendarDate, DEFAULT_TIME_ZONE } from "../utils/timezone";
import { proctorCache } from "../utils/dashboardPrefetch";
import ProctorItemModal from "../components/ProctorItemModal";
import ReceiveItemModal from "../components/ReceiveItemModal";
import NotFoundPage from "./NotFoundPage";

const TABS = [
  { key: "unclaimed", label: "Unclaimed", help: "Received at the desk, but no owner has been designated in the app yet." },
  { key: "pending",   label: "Pending",   help: "Received at the desk and the owner is designated in the app — waiting to be picked up." },
  { key: "delivered", label: "Delivered", help: "Owner verified their pickup PIN at the desk and collected the item." },
];

const LISTING_TYPE_LABELS = { found: "Found", lost: "Lost" };
const LISTING_TYPE_COLORS = { found: "#0891b2", lost: "#4f46e5" };

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name",   label: "Name (A–Z)" },
];

export default function ProctorDashboard({ effectiveTheme = "light", timeZone = DEFAULT_TIME_ZONE }) {
  const isDark = effectiveTheme === "dark";
  const { profile } = useAuth();
  const deskLocationId = profile?.proctor_location_id;

  const [status, setStatus] = useState("unclaimed");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [items, setItems] = useState(proctorCache.items?.items || []);
  const [hasMore, setHasMore] = useState(proctorCache.items?.hasMore ?? false);
  const [counts, setCounts] = useState(proctorCache.counts || { unclaimed: 0, pending: 0, delivered: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deskName, setDeskName] = useState("");

  const [selected, setSelected] = useState(null);
  const [receiveOpen, setReceiveOpen] = useState(false);

  const accent = isDark ? "#FF4500" : "#A84D48";
  const accentHover = isDark ? "#E03D00" : "#8f3e3a";
  const didSeed = useRef(false);

  // Resolve the proctor's desk building name from the locations list
  useEffect(() => {
    if (!deskLocationId) return;
    apiFetch("/api/locations")
      .then((locs) => {
        const match = (locs || []).find((l) => l.location_id === deskLocationId);
        if (match) setDeskName(match.name);
      })
      .catch(() => {});
  }, [deskLocationId]);

  const fetchItems = useCallback(async (nextPage, replace) => {
    if (!deskLocationId) return;
    setLoading(true);
    setError("");
    try {
      const q = search.trim() ? `&search=${encodeURIComponent(search.trim())}` : "";
      const d = await apiFetch(`/api/proctor/items?status=${status}&page=${nextPage}${q}`);
      setItems((prev) => (replace ? (d?.items || []) : [...prev, ...(d?.items || [])]));
      setHasMore(d?.hasMore ?? false);
      if (d?.counts) setCounts(d.counts);
      setPage(nextPage);
    } catch (err) {
      setError(err?.message || "Could not load items.");
    } finally {
      setLoading(false);
    }
  }, [deskLocationId, status, search]);

  // Refetch page 1 whenever the tab or (debounced) search changes
  useEffect(() => {
    // Use the warm cache for the very first paint of the default tab
    if (!didSeed.current && status === "unclaimed" && !search.trim() && proctorCache.items) {
      didSeed.current = true;
      return;
    }
    didSeed.current = true;
    const t = setTimeout(() => fetchItems(1, true), 250);
    return () => clearTimeout(t);
  }, [status, search, fetchItems]);

  const refresh = useCallback(() => fetchItems(1, true), [fetchItems]);

  const sortedItems = useMemo(() => {
    const arr = [...items];
    const dateKey = status === "delivered" ? "delivered_at" : "received_at";
    if (sort === "name") arr.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    else if (sort === "oldest") arr.sort((a, b) => new Date(a[dateKey]) - new Date(b[dateKey]));
    else arr.sort((a, b) => new Date(b[dateKey]) - new Date(a[dateKey]));
    return arr;
  }, [items, sort, status]);

  if (!profile) return null;
  if (!profile.is_proctor) return <NotFoundPage effectiveTheme={effectiveTheme} />;

  const showOwner = status === "pending" || status === "delivered";
  const dateCol = status === "unclaimed" ? "Date Dropped Off" : status === "delivered" ? "Date Returned" : null;

  const cellSx = { color: isDark ? "#D7DADC" : "inherit", borderColor: isDark ? "rgba(255,255,255,0.1)" : "#f0e8e8", fontSize: 14 };
  const headCellSx = { ...cellSx, color: isDark ? "#B8BABD" : "#a07070", fontWeight: 800, fontSize: 12, letterSpacing: 0.3, textTransform: "uppercase" };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", px: { xs: 1, sm: 2, md: 3 }, py: { xs: 1, sm: 2, md: 3 }, color: isDark ? "#D7DADC" : "inherit" }}>
      <Box sx={{ width: "100%", maxWidth: 1040 }}>

        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.25, sm: 2 }, mb: { xs: 2, sm: 3 } }}>
          <Box sx={{ width: { xs: 36, sm: 44 }, height: { xs: 36, sm: 44 }, borderRadius: 2, flexShrink: 0, background: isDark ? "rgba(255,255,255,0.08)" : "#A84D4815", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Inventory2Icon sx={{ color: accent, fontSize: { xs: 20, sm: 24 } }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <Typography variant="h4" fontWeight={900} sx={{ fontSize: { xs: 22, sm: 30 } }}>Proctor Dashboard</Typography>
              <Tooltip
                arrow
                title={
                  <Box sx={{ p: 0.5 }}>
                    {TABS.map((t) => (
                      <Typography key={t.key} variant="caption" sx={{ display: "block", mb: 0.5 }}>
                        <b>{t.label}:</b> {t.help}
                      </Typography>
                    ))}
                  </Box>
                }
              >
                <HelpOutlineIcon sx={{ fontSize: 18, color: isDark ? "#818384" : "#a07070", cursor: "help" }} />
              </Tooltip>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>
              {deskName ? `at ${deskName}` : "Manage and return items dropped off at your building desk."}
            </Typography>
          </Box>
        </Box>

        {!deskLocationId ? (
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, textAlign: "center", background: isDark ? "#232324" : "#fdf7f7", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc" }}>
            <Typography fontWeight={700} sx={{ mb: 0.5 }}>No desk assigned</Typography>
            <Typography variant="body2" color="text.secondary">
              Your proctor account isn't linked to a building desk yet. Ask an admin to set your desk location.
            </Typography>
          </Paper>
        ) : (
          <>
            {/* Status toggles */}
            <Box sx={{ display: "flex", gap: { xs: 1, sm: 1.5 }, mb: 2.5, flexWrap: "wrap" }}>
              {TABS.map((t) => {
                const active = status === t.key;
                return (
                  <Button
                    key={t.key}
                    onClick={() => setStatus(t.key)}
                    disableElevation
                    variant={active ? "contained" : "outlined"}
                    sx={{
                      flex: { xs: "1 1 30%", sm: "0 1 auto" },
                      px: { xs: 1.5, sm: 3 }, py: 1.25, borderRadius: 2.5, fontWeight: 800, fontSize: { xs: 13, sm: 15 },
                      background: active ? accent : isDark ? "#1A1A1B" : "#fff",
                      color: active ? "#fff" : isDark ? "#B8BABD" : "#a07070",
                      borderColor: active ? accent : isDark ? "rgba(255,255,255,0.18)" : "#e0d8d8",
                      "&:hover": { background: active ? accentHover : isDark ? "#343536" : "#fdf7f7", borderColor: active ? accentHover : accent },
                    }}
                  >
                    {t.label}
                    <Box component="span" sx={{
                      ml: 1, px: 1, py: 0.1, borderRadius: 5, fontSize: 12, fontWeight: 800,
                      background: active ? "rgba(255,255,255,0.25)" : isDark ? "#343536" : "#f5eded",
                      color: active ? "#fff" : accent,
                    }}>
                      {counts[t.key] ?? 0}
                    </Box>
                  </Button>
                );
              })}
            </Box>

            {/* Controls */}
            <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" } }}>
              <TextField
                size="small" placeholder="Search items…"
                value={search} onChange={(e) => setSearch(e.target.value)}
                sx={{ flex: 1 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: isDark ? "#B8BABD" : "#a07070" }} /></InputAdornment>,
                  sx: { background: isDark ? "#2D2D2E" : "#fff", color: isDark ? "#D7DADC" : "inherit" },
                }}
              />
              <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 160 } }}>
                <InputLabel>Sort by</InputLabel>
                <Select value={sort} label="Sort by" onChange={(e) => setSort(e.target.value)} sx={{ background: isDark ? "#2D2D2E" : "#fff" }}>
                  {SORT_OPTIONS.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                </Select>
              </FormControl>
              <Button
                variant="contained" startIcon={<AddIcon />} onClick={() => setReceiveOpen(true)}
                sx={{ background: accent, "&:hover": { background: accentHover }, fontWeight: 800, borderRadius: 2, flexShrink: 0, whiteSpace: "nowrap" }}
              >
                Receive item
              </Button>
            </Box>

            {error && <Typography variant="body2" sx={{ color: "#dc2626", fontWeight: 700, mb: 1.5 }}>{error}</Typography>}

            {/* Table */}
            <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc", background: isDark ? "#1A1A1B" : "#fff" }}>
              <Box sx={{ overflowX: "auto" }}>
                <Table size="small" sx={{ minWidth: 600 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={headCellSx}>Item Name</TableCell>
                      <TableCell sx={headCellSx}>Found by</TableCell>
                      {showOwner && <TableCell sx={headCellSx}>Owner</TableCell>}
                      <TableCell sx={headCellSx}>Status</TableCell>
                      {dateCol && <TableCell sx={headCellSx}>{dateCol}</TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedItems.map((item) => (
                      <TableRow
                        key={item.item_id}
                        hover
                        onClick={() => setSelected(item)}
                        sx={{ cursor: "pointer", "&:hover": { background: isDark ? "#232324" : "#fdf7f7" } }}
                      >
                        <TableCell sx={{ ...cellSx, fontWeight: 700 }}>{item.title}</TableCell>
                        <TableCell sx={cellSx}>{item.poster_name || "—"}</TableCell>
                        {showOwner && <TableCell sx={cellSx}>{item.owner_name || "—"}</TableCell>}
                        <TableCell sx={cellSx}>
                          <Chip
                            label={LISTING_TYPE_LABELS[item.listing_type] ?? item.listing_type}
                            size="small"
                            sx={{
                              background: (LISTING_TYPE_COLORS[item.listing_type] ?? "#888") + "22",
                              color: LISTING_TYPE_COLORS[item.listing_type] ?? "#888",
                              border: `1px solid ${(LISTING_TYPE_COLORS[item.listing_type] ?? "#888")}44`,
                              fontWeight: 800, height: 22,
                            }}
                          />
                        </TableCell>
                        {dateCol && (
                          <TableCell sx={cellSx}>
                            {formatCalendarDate(status === "delivered" ? item.delivered_at : item.received_at, timeZone)}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>

              {!loading && sortedItems.length === 0 && (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Typography variant="body2" color={isDark ? "#818384" : "text.secondary"}>
                    No {TABS.find((t) => t.key === status)?.label.toLowerCase()} items.
                  </Typography>
                </Box>
              )}
              {loading && (
                <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
                  <CircularProgress size={24} sx={{ color: accent }} />
                </Box>
              )}
            </Paper>

            {hasMore && !loading && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Button variant="outlined" onClick={() => fetchItems(page + 1, false)}
                  sx={{ color: accent, borderColor: isDark ? "rgba(255,69,0,0.4)" : "#A84D48", fontWeight: 700, borderRadius: 2, "&:hover": { borderColor: accent, background: isDark ? "rgba(255,69,0,0.08)" : "rgba(168,77,72,0.06)" } }}>
                  Load more
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>

      <ProctorItemModal
        item={selected}
        status={status}
        isDark={isDark}
        timeZone={timeZone}
        onClose={() => setSelected(null)}
        onDelivered={() => { setSelected(null); refresh(); }}
      />

      <ReceiveItemModal
        open={receiveOpen}
        isDark={isDark}
        onClose={() => setReceiveOpen(false)}
        onReceived={() => refresh()}
      />
    </Box>
  );
}
