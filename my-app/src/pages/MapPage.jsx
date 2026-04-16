import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "../AuthContext";
import { useDemo } from "../contexts/DemoContext";
import {
  Box, Typography, Paper, Slider, Chip, IconButton, CircularProgress,
  Collapse, Button, Modal, Autocomplete, TextField,
  Select, MenuItem, FormControl, InputLabel,
} from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import CloseIcon from "@mui/icons-material/Close";
import ListIcon from "@mui/icons-material/ViewList";
import SearchIcon from "@mui/icons-material/Search";
import FlagIcon from "@mui/icons-material/Flag";
import ReportModal from "../components/ReportModal";
import { CAMPUSES } from "../constants/campuses";
import apiFetch from "../utils/apiFetch";
import { DEFAULT_TIME_ZONE, formatRelativeDate } from "../utils/timezone";

setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  v: "weekly",
});

// --- Constants ---
const IMPORTANCE_LABELS = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };
const LISTING_TYPE_LABELS = { found: "Found", lost: "Lost" };
const LISTING_TYPE_COLORS = { found: "#0891b2", lost: "#4f46e5" };
const RADIUS_MARKS = [
  { value: 50, label: "50ft" },
  { value: 150, label: "150ft" },
  { value: 300, label: "300ft" },
  { value: 500, label: "500ft" },
];

// --- Hide outside noise ---
const CLEAN_STYLES = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "off" }] },
];

function parseCoordinates(coordStr) {
  if (!coordStr || typeof coordStr !== "string") return null;
  const match = coordStr.match(/([\d.]+)°?\s*([NS])\s+([\d.]+)°?\s*([EW])/i);
  if (!match) {
    try {
      const obj = typeof coordStr === "string" ? JSON.parse(coordStr) : coordStr;
      if (obj.lat != null && obj.lng != null) return { lat: Number(obj.lat), lng: Number(obj.lng) };
    } catch { /* ignore */ }
    return null;
  }
  let lat = parseFloat(match[1]);
  let lng = parseFloat(match[3]);
  if (match[2].toUpperCase() === "S") lat = -lat;
  if (match[4].toUpperCase() === "W") lng = -lng;
  return { lat, lng };
}

function haversine(a, b) {
  const R = 20902231;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// --- DetailModal ---
function DetailModal({ item, onClose, onClaim, isDark = false, timeZone = DEFAULT_TIME_ZONE }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [returning, setReturning] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const isOwner = user?.id && item?.poster_id === user.id;
  if (!item) return null;
  return (
    <Modal open={!!item} onClose={onClose}>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: isDark ? "#1A1A1B" : "#fff", borderRadius: 4, p: "26px", width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto", outline: "none",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
        mx: 1.5,
        boxSizing: "border-box",
        width: { xs: "calc(100% - 24px)", sm: "100%" },
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={900}>{item.title}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Posted by {item.poster_name} · {formatRelativeDate(item.date, timeZone, { compact: true })}
            </Typography>
          </Box>
            <Box sx={{ display: "flex", gap: 0.5 }}>
              <IconButton onClick={() => setReportOpen(true)} size="small" sx={{ color: isDark ? "#818384" : "#999", "&:hover": { color: "#A84D48" } }}>
                <FlagIcon fontSize="small" />
              </IconButton>
              <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </Box>
        </Box>

        {item.image_url
          ? <Box
              component="img"
              src={item.image_url}
              alt={item.title}
              onClick={() => setLightboxOpen(true)}
              sx={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 2, mb: 2, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc", cursor: "zoom-in" }}
            />
          : <Box sx={{ width: "100%", height: 120, background: isDark ? "#2D2D2E" : "#f5f0f0", borderRadius: 2, mb: 2, display: "flex", alignItems: "center", justifyContent: "center", border: isDark ? "1px dashed rgba(255,255,255,0.2)" : "1.5px dashed #dac8c8" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No photo provided</Typography>
            </Box>
        }

        {/* Lightbox */}
        <Modal open={lightboxOpen} onClose={() => setLightboxOpen(false)}>
          <Box
            onClick={() => setLightboxOpen(false)}
            sx={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", display: "flex", alignItems: "center", justifyContent: "center", p: 2, cursor: "zoom-out" }}
          >
            <Box component="img" src={item.image_url} alt={item.title} sx={{ maxWidth: "100%", maxHeight: "90dvh", objectFit: "contain", borderRadius: 2 }} />
          </Box>
        </Modal>

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <Chip label={IMPORTANCE_LABELS[item.importance]} size="small" sx={{ background: IMPORTANCE_COLORS[item.importance] + "22", color: IMPORTANCE_COLORS[item.importance], fontWeight: 800 }} />
          <Chip label={item.category} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: "#A84D48", fontWeight: 700 }} />
          {item.listing_type && (
            <Chip
              label={LISTING_TYPE_LABELS[item.listing_type] ?? item.listing_type}
              size="small"
              sx={{
                background: (LISTING_TYPE_COLORS[item.listing_type] ?? "#888") + "22",
                color: LISTING_TYPE_COLORS[item.listing_type] ?? "#888",
                border: `1px solid ${(LISTING_TYPE_COLORS[item.listing_type] ?? "#888")}44`,
                fontWeight: 800,
              }}
            />
          )}
          {item.resolved && <Chip label="Resolved" size="small" sx={{ background: isDark ? "#1f3527" : "#dcfce7", color: isDark ? "#6ee7b7" : "#16a34a", border: isDark ? "1px solid rgba(110,231,183,0.42)" : "none", fontWeight: 800 }} />}
        </Box>

        <Paper variant="outlined" sx={{ p: 2, mb: 2, background: isDark ? "#232324" : "#fdf7f7", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc", borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={800} color="#a07070" sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>LOCATION</Typography>
          <Typography fontWeight={700} fontSize={14}>{item.locations?.name ?? "Unknown location"}</Typography>
          <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>
            {item.listing_type === "lost" ? "Last seen at" : "Found at"}: {item.found_at}
          </Typography>
        </Paper>

        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" fontWeight={800} color="#a07070" sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>DESCRIPTION</Typography>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} lineHeight={1.65}>{item.description}</Typography>
        </Box>

        {!item.resolved && !isOwner && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.75, mb: 1.5, borderRadius: 1.5, background: isDark ? "#3a2f22" : "#fff3cd", border: isDark ? "1px solid rgba(245,158,11,0.5)" : "1px solid #ffc107" }}>
            <Typography variant="caption" sx={{ color: isDark ? "#f6c66a" : "#7d4e00", fontWeight: 600, lineHeight: 1.4 }}>
              {item.listing_type === "lost"
                ? "Only the original poster can mark this item as found."
                : "Only the original poster can mark this item as returned."}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          {isOwner && (
            <Button
              variant="contained"
              fullWidth
              disabled={item.resolved || returning}
              onClick={async () => {
                setReturning(true);
                await onClaim(item.item_id);
                setReturning(false);
              }}
              sx={{ background: item.resolved ? "#16a34a" : "#A84D48", "&:hover": { background: item.resolved ? "#15803d" : "#8f3e3a" }, fontWeight: 800, borderRadius: 2 }}
            >
              {item.resolved
                ? (item.listing_type === "lost" ? "Already Found" : "Already Returned")
                : returning ? "Marking..."
                : (item.listing_type === "lost" ? "I Found This!" : "Returned Item")}
            </Button>
          )}
          {!isOwner && (
            <Button
              variant="outlined"
              sx={{ borderColor: isDark ? "rgba(255,255,255,0.2)" : "#ecdcdc", color: "#A84D48", fontWeight: 800, borderRadius: 2, flexShrink: 0, width: "100%" }}
              onClick={async () => {
                try {
                  const result = await apiFetch("/api/conversations", {
                    method: "POST",
                    body: JSON.stringify({
                      listing_id: item.item_id,
                      other_user_id: item.poster_id,
                    }),
                  });
                  if (result?.id) navigate(`/messages?conversation=${result.id}`);
                } catch (err) {
                  console.error("Failed to open conversation:", err);
                }
              }}
            >
              Message
            </Button>
          )}
        </Box>
        <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} type="post" targetId={item.item_id} targetLabel={item.title}/>
      </Box>
    </Modal>
  );
}

// --- Helper: build campus center marker DOM element ---
function buildCampusMarkerEl(campusName) {
  const el = document.createElement("div");
  el.style.cssText = "display:flex;flex-direction:column;align-items:center;";
  el.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="8" fill="#CC0000" stroke="#fff" stroke-width="2"/>
    </svg>
    <span style="
      margin-top:3px;background:rgba(204,0,0,0.85);color:#fff;
      font-size:10px;font-weight:800;font-family:sans-serif;
      padding:1px 5px;border-radius:4px;white-space:nowrap;
      letter-spacing:0.3px;box-shadow:0 1px 3px rgba(0,0,0,0.35);
    ">${campusName}</span>
  `;
  return el;
}

// --- Side panel content (shared between desktop panel & mobile drawer) ---
function SidePanelContent({ isDark, radius, setRadius, nearbyItems, mapInstanceRef, setSelectedItem, timeZone = DEFAULT_TIME_ZONE }) {
  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <FilterAltIcon sx={{ color: "#A84D48", fontSize: 20 }} />
        <Typography fontWeight={800} fontSize={15}>Search Radius</Typography>
      </Box>
      <Slider
        value={radius} min={25} max={500} step={25}
        onChange={(_, v) => setRadius(v)}
        valueLabelDisplay="auto" valueLabelFormat={(v) => `${v} ft`}
        marks={RADIUS_MARKS} sx={{ color: "#A84D48", mb: 2 }}
      />

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <ListIcon sx={{ color: isDark ? "#B8BABD" : "#a07070", fontSize: 18 }} />
        <Typography variant="body2" fontWeight={800} color="text.secondary">
          {nearbyItems.length} item{nearbyItems.length !== 1 ? "s" : ""} within {radius} ft
        </Typography>
      </Box>

      {nearbyItems.length === 0 ? (
        <Typography variant="body2" color={isDark ? "#818384" : "text.disabled"} fontWeight={600} sx={{ textAlign: "center", mt: 4 }}>
          No lost items in this area. Try a larger radius.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {nearbyItems.map((item) => (
            <Paper
              key={item.item_id} variant="outlined"
              sx={{
                p: 1.5, borderRadius: 2, borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc",
                background: isDark ? "#232324" : "#fff",
                cursor: "pointer", transition: "box-shadow 0.15s",
                opacity: item.resolved ? 0.6 : 1,
                "&:hover": { boxShadow: isDark ? "0 4px 14px rgba(0,0,0,0.35)" : "0 2px 12px rgba(168,77,72,0.12)" },
              }}
              onClick={() => {
                if (mapInstanceRef.current && item._lat && item._lng) {
                  mapInstanceRef.current.panTo({ lat: item._lat, lng: item._lng });
                  mapInstanceRef.current.setZoom(20);
                }
                setSelectedItem(item);
              }}
            >
              <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                <Box sx={{
                  width: 44, height: 44, borderRadius: 1.5, flexShrink: 0,
                  overflow: "hidden", background: isDark ? "#2D2D2E" : "#f0eded",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1px solid #e0d6d6",
                }}>
                  {item.image_url
                    ? <img src={item.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <Typography variant="caption" sx={{ color: isDark ? "#818384" : "#ccc", fontSize: 18 }}>📦</Typography>
                  }
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={800} fontSize={13} noWrap>{item.title}</Typography>
                  <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600} noWrap sx={{ display: "block" }}>
                    {item.locations?.name ?? "Unknown"}
                  </Typography>
                  <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={600} sx={{ display: "block", fontSize: 11 }}>
                    {formatRelativeDate(item.date, timeZone, { compact: true })}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flexShrink: 0, alignItems: "flex-end" }}>
                  <Chip
                    label={IMPORTANCE_LABELS[item.importance]} size="small"
                    sx={{
                      background: IMPORTANCE_COLORS[item.importance] + "22",
                      color: IMPORTANCE_COLORS[item.importance],
                      fontWeight: 800, fontSize: 10,
                    }}
                  />
                  {/* Lost/Found badge on side panel cards */}
                  {item.listing_type && (
                    <Chip
                      label={LISTING_TYPE_LABELS[item.listing_type] ?? item.listing_type}
                      size="small"
                      sx={{
                        background: (LISTING_TYPE_COLORS[item.listing_type] ?? "#888") + "22",
                        color: LISTING_TYPE_COLORS[item.listing_type] ?? "#888",
                        border: `1px solid ${(LISTING_TYPE_COLORS[item.listing_type] ?? "#888")}44`,
                        fontWeight: 800, fontSize: 10,
                      }}
                    />
                  )}
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </>
  );
}

// --- MapPage ---
export default function MapPage({ effectiveTheme = "light", timeZone = DEFAULT_TIME_ZONE, sharedItems, setSharedItems, sharedItemsLoaded, refreshItems }) {
  const isDark = effectiveTheme === "dark";
  const isMobile = useMediaQuery("(max-width:900px)");
  const pageBg = isDark ? "#101214" : "#f9f5f4";
  const pageDot = isDark ? "rgba(255,255,255,0.07)" : "rgba(122,41,41,0.18)";
  const { profile } = useAuth();
  const { isDemoMode } = useDemo();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const searchPinRef = useRef(null);
  const circleRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const campusCenterMarkerRef = useRef(null);

  const initialCampus = isDemoMode
    ? (localStorage.getItem('demo_campus') || 'boston')
    : (profile?.default_campus || "boston");

  const [selectedCampus, setSelectedCampus] = useState(initialCampus);
  const [campusBuildings, setCampusBuildings] = useState([]);
  const loading = !sharedItemsLoaded;
  const [searchPin, setSearchPin] = useState(null);
  const [radius, setRadius] = useState(150);
  const [nearbyItems, setNearbyItems] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  // "all" shows both types. "found" / "lost" narrows markers and the side panel list.
  const [listingTypeFilter, setListingTypeFilter] = useState("all");
  const [mobileBuilding, setMobileBuilding] = useState("");

  const activeCampus = CAMPUSES.find((c) => c.id === selectedCampus) ?? CAMPUSES[0];

  // ---- Fetch buildings for active campus ----
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch(`/api/locations?campus=${encodeURIComponent(selectedCampus)}`);
        const parsed = (data || [])
          .map((loc) => {
            const coords = parseCoordinates(loc.coordinates);
            if (!coords) return null;
            return { name: loc.name, lat: coords.lat, lng: coords.lng };
          })
          .filter(Boolean);
        setCampusBuildings(parsed);
      } catch (err) {
        console.error("Failed to fetch campus locations:", err);
        setCampusBuildings([]);
      }
    })();
  }, [selectedCampus]);

  // Normalize shared items with lat/lng for map display
  const items = useMemo(() => sharedItems.map((item) => {
    let lat = item.lat;
    let lng = item.lng;
    if (lat == null && item.locations?.coordinates) {
      const parsed = parseCoordinates(item.locations.coordinates);
      if (parsed) { lat = parsed.lat; lng = parsed.lng; }
    }
    return { ...item, _lat: lat, _lng: lng };
  }), [sharedItems]);

  // Silently refresh in background on page visit (stale-while-revalidate)
  useEffect(() => {
    if (sharedItemsLoaded) refreshItems();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshItems();
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(activeCampus.center);
      mapInstanceRef.current.setZoom(activeCampus.zoom);
    }
    clearSearch();
    setTimeout(() => setRefreshing(false), 600);
  };

  const handleCampusChange = (campusId) => {
    setSelectedCampus(campusId);
    setCampusBuildings([]);
    setMobileBuilding("");
    clearSearch();
    const campus = CAMPUSES.find((c) => c.id === campusId) ?? CAMPUSES[0];
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(campus.center);
      mapInstanceRef.current.setZoom(campus.zoom);
    }
  };

  const handleClaim = async (item_id) => {
    try {
      await apiFetch(`/api/listings/${item_id}/resolve`, { method: "PATCH" });
      setSharedItems(prev => prev.map(i => i.item_id === item_id ? { ...i, resolved: true } : i));
      if (selectedItem?.item_id === item_id) setSelectedItem(prev => ({ ...prev, resolved: true }));
    } catch (err) {
      console.error("Failed to resolve listing:", err);
    }
  };

  // ---- Initialize Google Map + place initial campus marker ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Map } = await importLibrary("maps");
      const { AdvancedMarkerElement } = await importLibrary("marker");
      if (cancelled || !mapRef.current) return;

      const campus = CAMPUSES.find((c) => c.id === initialCampus) ?? CAMPUSES[0];

      const map = new Map(mapRef.current, {
        center: campus.center,
        zoom: campus.zoom,
        disableDefaultUI: true,
        zoomControl: !isMobile,
        gestureHandling: "greedy",
        mapId: "LOST_HOUND_MAP",
        clickableIcons: false,
      });

      mapInstanceRef.current = map;

      const kick = () => {
        try {
          map.moveCamera({ center: campus.center, zoom: campus.zoom });
        } catch {
          if (window.google?.maps?.event) {
            window.google.maps.event.trigger(map, "resize");
            map.setCenter(campus.center);
          }
        }
      };
      requestAnimationFrame(kick);
      setTimeout(kick, 150);
      setTimeout(kick, 600);
      setTimeout(kick, 1500);

      campusCenterMarkerRef.current = new AdvancedMarkerElement({
        map,
        position: campus.center,
        content: buildCampusMarkerEl(campus.name),
        title: campus.name,
        zIndex: 1000,
      });

      map.addListener("click", (e) => {
        setSearchPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
        setShowPanel(true);
      });
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCampus]);

  const isMobileRef = useRef(isMobile);
  useEffect(() => { isMobileRef.current = isMobile; }, [isMobile]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const listener = map.addListener("click", (e) => {
      setSearchPin({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      setShowPanel(true);
    });

    return () => {
      if (listener && typeof listener.remove === "function") listener.remove();
      else if (window.google?.maps?.event) window.google.maps.event.removeListener(listener);
    };
  }, []);

  // ---- Place / move the search pin + radius circle ----
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    (async () => {
      const { AdvancedMarkerElement } = await importLibrary("marker");

      if (!searchPin) {
        if (searchPinRef.current) { searchPinRef.current.map = null; searchPinRef.current = null; }
        if (circleRef.current) { circleRef.current.setMap(null); circleRef.current = null; }
        return;
      }

      if (searchPinRef.current) {
        searchPinRef.current.position = searchPin;
      } else {
        const pinEl = document.createElement("div");
        pinEl.innerHTML = `<svg width="32" height="42" viewBox="0 0 32 42" fill="none"><path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z" fill="#A84D48"/><circle cx="16" cy="16" r="7" fill="#fff"/></svg>`;
        const marker = new AdvancedMarkerElement({
          map, position: searchPin, gmpDraggable: true, content: pinEl, zIndex: 999,
        });
        marker.addListener("dragend", () => {
          const p = marker.position;
          setSearchPin({ lat: p.lat, lng: p.lng });
        });
        searchPinRef.current = marker;
      }

      const radiusMeters = radius * 0.3048;
      if (circleRef.current) {
        circleRef.current.setCenter(searchPin);
        circleRef.current.setRadius(radiusMeters);
      } else {
        await importLibrary("maps");
        const circle = new google.maps.Circle({
          map, center: searchPin, radius: radiusMeters,
          fillColor: "#A84D48", fillOpacity: 0.10,
          strokeColor: "#A84D48", strokeOpacity: 0.45, strokeWeight: 2,
        });
        circleRef.current = circle;
      }
    })();
  }, [searchPin, radius]);

  // ---- Render item markers ----
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    markersRef.current.forEach((m) => (m.map = null));
    markersRef.current = [];

    if (!searchPin) return;

    (async () => {
      const { AdvancedMarkerElement } = await importLibrary("marker");

      nearbyItems.forEach((item, index) => {
        if (item._lat == null || item._lng == null) return;
        const color = item.resolved ? "#94a3b8" : (IMPORTANCE_COLORS[item.importance] || "#666");

        const el = document.createElement("div");
        el.style.transition = "opacity 0.3s";
        el.style.cursor = "pointer";
        el.style.animation = `markerDrop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s both`;
        el.innerHTML = `<svg width="24" height="32" viewBox="0 0 24 32" fill="none"><path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20C24 5.37 18.63 0 12 0z" fill="${color}"/><circle cx="12" cy="12" r="5" fill="#fff" opacity="0.9"/></svg>`;

        if (!document.getElementById("marker-drop-style")) {
          const style = document.createElement("style");
          style.id = "marker-drop-style";
          style.textContent = `
            @keyframes markerDrop {
              0% { opacity: 0; transform: translateY(-20px) scale(0.6); }
              60% { opacity: 1; transform: translateY(2px) scale(1.05); }
              80% { transform: translateY(-1px) scale(0.98); }
              100% { opacity: 1; transform: translateY(0) scale(1); }
            }
          `;
          document.head.appendChild(style);
        }

        const marker = new AdvancedMarkerElement({
          map, position: { lat: item._lat, lng: item._lng }, content: el,
        });

        marker.addListener("click", () => {
          if (mapInstanceRef.current && item._lat && item._lng) {
            mapInstanceRef.current.panTo({ lat: item._lat, lng: item._lng });
            mapInstanceRef.current.setZoom(18);
          }
          setSelectedItem(item);
        });

        markersRef.current.push(marker);
      });
    })();
  }, [searchPin, nearbyItems]);

  // ---- Update campus center marker when user switches campus ----
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const campus = CAMPUSES.find((c) => c.id === selectedCampus) ?? CAMPUSES[0];

    (async () => {
      const { AdvancedMarkerElement } = await importLibrary("marker");

      if (campusCenterMarkerRef.current) {
        campusCenterMarkerRef.current.map = null;
        campusCenterMarkerRef.current = null;
      }

      campusCenterMarkerRef.current = new AdvancedMarkerElement({
        map: mapInstanceRef.current,
        position: campus.center,
        content: buildCampusMarkerEl(campus.name),
        title: campus.name,
        zIndex: 1000,
      });
    })();
  }, [selectedCampus]);

  // ---- Filter nearby items ----
  useEffect(() => {
    if (!searchPin) { setNearbyItems([]); return; }
    const nearby = items.filter((i) => {
      if (i._lat == null || i._lng == null) return false;
      if (!showResolved && i.resolved) return false;
      // Only apply the type filter when the user has selected found or lost specifically.
      if (listingTypeFilter !== "all" && i.listing_type !== listingTypeFilter) return false;
      return haversine(searchPin, { lat: i._lat, lng: i._lng }) <= radius;
    });
    setNearbyItems(nearby);
  }, [searchPin, radius, items, showResolved, listingTypeFilter]);

  // ---- Trigger map resize when layout changes ----
  useEffect(() => {
    const el = mapRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      try {
        const center = map.getCenter();
        if (center) map.moveCamera({ center: { lat: center.lat(), lng: center.lng() } });
      } catch {
        if (window.google?.maps?.event) {
          const center = map.getCenter();
          window.google.maps.event.trigger(map, "resize");
          if (center) map.setCenter(center);
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onViewportResize = () => {
      const map = mapInstanceRef.current;
      if (!map || !window.google?.maps?.event) return;
      const center = map.getCenter();
      window.google.maps.event.trigger(map, "resize");
      if (center) map.setCenter(center);
    };

    vv.addEventListener("resize", onViewportResize);
    return () => vv.removeEventListener("resize", onViewportResize);
  }, []);

  const clearSearch = () => {
    setSearchPin(null);
    setShowPanel(false);
    setNearbyItems([]);
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
      <Box sx={{
        display: "flex", justifyContent: "center", width: "100%",
        px: { xs: 1, sm: 2, md: 3 },
        py: { xs: 1, sm: 2, md: 3 },
        color: isDark ? "#D7DADC" : "inherit",
      }}>
      <Box sx={{ width: "100%", maxWidth: 1200 }}>
        {/* Campus selector */}
        <Box sx={{ mb: 1, pb: 1, borderBottom: isDark ? "1px solid rgba(255,255,255,0.12)" : "1.5px solid #f0e8e8" }}>
          {/* Desktop: scrollable chip row */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" }, gap: 0.6, flexWrap: "nowrap",
              justifyContent: "center", overflowX: "auto", flexShrink: 0,
              WebkitOverflowScrolling: "touch", "&::-webkit-scrollbar": { height: 4 },
            }}
          >
            {CAMPUSES.map((campus) => (
              <Chip
                key={campus.id}
                label={`${campus.name}, ${campus.state}`}
                onClick={() => handleCampusChange(campus.id)}
                variant={selectedCampus === campus.id ? "filled" : "outlined"}
                sx={{
                  fontWeight: 700, fontSize: 11, height: 26, cursor: "pointer", flexShrink: 0,
                  "& .MuiChip-label": { px: 1 },
                  borderColor: selectedCampus === campus.id ? "#A84D48" : isDark ? "rgba(255,255,255,0.2)" : "#e0d0d0",
                  background: selectedCampus === campus.id ? "#A84D48" : isDark ? "#1A1A1B" : "#fff",
                  color: selectedCampus === campus.id ? "#fff" : isDark ? "#B8BABD" : "#7a5050",
                  "&:hover": {
                    background: selectedCampus === campus.id ? "#8f3e3a" : isDark ? "#2D2D2E" : "#fdf0f0",
                    borderColor: "#A84D48",
                  },
                  transition: "all 0.15s",
                }}
              />
            ))}
          </Box>
          {/* Mobile: dropdown */}
          <FormControl
            size="small"
            fullWidth
            sx={{ display: { xs: "flex", md: "none" } }}
          >
            <InputLabel sx={{ fontWeight: 700, color: isDark ? "#B8BABD" : undefined }}>Campus</InputLabel>
            <Select
              value={selectedCampus}
              label="Campus"
              onChange={(e) => handleCampusChange(e.target.value)}
              MenuProps={{ PaperProps: { sx: { maxHeight: 300, maxWidth: 280 } } }}
              sx={{
                fontWeight: 700,
                background: isDark ? "#1A1A1B" : "#fff",
                color: isDark ? "#D7DADC" : "inherit",
                "& .MuiOutlinedInput-notchedOutline": { borderColor: isDark ? "rgba(255,255,255,0.2)" : "#e0d0d0" },
                "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#A84D48" },
                "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#A84D48" },
                "& .MuiSvgIcon-root": { color: isDark ? "#B8BABD" : undefined },
              }}
            >
              {CAMPUSES.map((campus) => (
                <MenuItem key={campus.id} value={campus.id} sx={{ fontWeight: 700 }}>
                  {campus.name}, {campus.state}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Header */}
        <Box sx={{
          display: "flex",
          justifyContent: { xs: "flex-start", sm: "space-between" },
          alignItems: { xs: "flex-start", sm: "center" },
          flexDirection: { xs: "column", sm: "row" },
          gap: { xs: 0.75, sm: 1 }, mb: 1.5, flexShrink: 0,
        }}>
          <Typography variant={isMobile ? "h5" : "h4"} fontWeight={900}>Campus Map</Typography>
          <Box sx={{ display: "flex", gap: { xs: 0.75, sm: 1 }, alignItems: "center", flexWrap: "nowrap" }}>
            {/* Listing type toggle — cycles All → Lost → Found → All */}
            {(() => {
              const cycle = ["all", "lost", "found"];
              const typeColor = listingTypeFilter === "all" ? "#A84D48" : LISTING_TYPE_COLORS[listingTypeFilter];
              const typeLabel = listingTypeFilter === "all" ? "All" : LISTING_TYPE_LABELS[listingTypeFilter];
              return (
                <Chip
                  label={`Type: ${typeLabel}`}
                  clickable
                  onClick={() => setListingTypeFilter(cycle[(cycle.indexOf(listingTypeFilter) + 1) % cycle.length])}
                  sx={{
                    fontWeight: 800, fontSize: { xs: 11, sm: 12 },
                    background: typeColor,
                    color: "#fff",
                    border: `1.5px solid ${typeColor}`,
                    "&:hover": { background: typeColor, opacity: 0.85 },
                  }}
                />
              );
            })()}
            <Chip
              label={showResolved ? "Hide Resolved" : "Show Resolved"}
              clickable
              onClick={() => setShowResolved(v => !v)}
              sx={{
                fontWeight: 800, fontSize: { xs: 11, sm: 12 },
                background: showResolved ? (isDark ? "#1f3527" : "#dcfce7") : isDark ? "#2D2D2E" : "#f5f5f5",
                color: showResolved ? (isDark ? "#6ee7b7" : "#16a34a") : isDark ? "#818384" : "#999",
                border: `1.5px solid ${showResolved ? (isDark ? "rgba(110,231,183,0.42)" : "#86efac") : isDark ? "rgba(255,255,255,0.18)" : "#e0e0e0"}`,
                "&:hover": { background: showResolved ? (isDark ? "#27412f" : "#bbf7d0") : isDark ? "#343536" : "#ececec" },
              }}
            />
            {searchPin && (
              isMobile ? (
                <IconButton size="small" onClick={clearSearch} sx={{ color: "#A84D48", background: isDark ? "#1A1A1B" : "#fff", border: isDark ? "1px solid rgba(255,255,255,0.18)" : "1px solid #ecdcdc", borderRadius: 2 }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              ) : (
                <Button size="small" onClick={clearSearch} startIcon={<CloseIcon />} sx={{ color: "#A84D48", fontWeight: 700, background: isDark ? "#1A1A1B" : "#fff", borderRadius: 2, px: 1.25 }}>
                  Clear
                </Button>
              )
            )}
            <Button
              variant="outlined" onClick={handleRefresh} disabled={refreshing}
              sx={{
                borderColor: isDark ? "rgba(255,255,255,0.24)" : "#ecdcdc", color: "#A84D48", fontWeight: 800,
                borderRadius: 2, minWidth: 0, px: 1.5, fontSize: 18,
                background: isDark ? "#1A1A1B" : "#fff",
                "& .refresh-icon": {
                  display: "inline-block",
                  transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)",
                  transform: refreshing ? "rotate(360deg)" : "rotate(0deg)",
                },
              }}
            >
              <span className="refresh-icon">↻</span>
            </Button>
          </Box>
        </Box>

        <Box sx={{
          display: "flex", gap: 2.5,
          flexDirection: { xs: "column", md: "row" },
        }}>
          {/* Map container */}
          <Paper
            elevation={3}
            sx={{
              flex: 1,
              minHeight: { xs: 240, md: 400 },
              height: { xs: "40vh", md: "calc(100vh - 240px)" },
              overflow: "hidden", borderRadius: 3, position: "relative",
              border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
              background: isDark ? "#1A1A1B" : "#fff",
              touchAction: "none",
            }}
          >
            {loading && (
              <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 10 }}>
                <CircularProgress sx={{ color: "#A84D48" }} />
              </Box>
            )}
            <Box
              ref={mapRef}
              sx={{
                position: "absolute",
                inset: 0,
                touchAction: "none",
                WebkitUserSelect: "none",
                userSelect: "none",
              }}
            />

            {/* Desktop: type-to-search Autocomplete */}
            <Autocomplete
              key={selectedCampus}
              options={campusBuildings}
              getOptionLabel={(o) => o.name}
              noOptionsText={campusBuildings.length === 0 ? "No buildings yet — add CSV to Supabase" : "No match"}
              onChange={(_, val) => {
                if (val && mapInstanceRef.current) {
                  mapInstanceRef.current.panTo({ lat: val.lat, lng: val.lng });
                  mapInstanceRef.current.setZoom(18);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder={campusBuildings.length ? "Search buildings…" : `No buildings for ${activeCampus.name} yet`}
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    startAdornment: <SearchIcon sx={{ color: "#A84D48", fontSize: 18, mr: 0.5 }} />,
                  }}
                  sx={{
                    "& .MuiOutlinedInput-root": {
                      background: isDark ? "rgba(35,35,36,0.95)" : "rgba(255,255,255,0.95)",
                      backdropFilter: "blur(8px)",
                      color: isDark ? "#D7DADC" : "inherit",
                      borderRadius: 2, fontWeight: 700, fontSize: 13,
                      "& fieldset": { borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc" },
                      "&:hover fieldset": { borderColor: "#A84D48" },
                      "&.Mui-focused fieldset": { borderColor: "#A84D48" },
                    },
                  }}
                />
              )}
              sx={{ position: "absolute", top: 12, left: 12, width: 270, zIndex: 10, display: { xs: "none", md: "block" } }}
            />

            {/* Mobile: tap-to-select dropdown (no keyboard) */}
            <FormControl
              size="small"
              sx={{ position: "absolute", top: 12, left: 12, width: "calc(100% - 24px)", zIndex: 10, display: { xs: "flex", md: "none" } }}
            >
              <InputLabel sx={{ fontWeight: 700, color: isDark ? "#B8BABD" : undefined, bgcolor: "transparent" }}>
                {campusBuildings.length ? "Select building…" : `No buildings for ${activeCampus.name} yet`}
              </InputLabel>
              <Select
                value={mobileBuilding}
                label={campusBuildings.length ? "Select building…" : `No buildings for ${activeCampus.name} yet`}
                onChange={(e) => {
                  const building = campusBuildings.find((b) => b.name === e.target.value);
                  if (building && mapInstanceRef.current) {
                    mapInstanceRef.current.panTo({ lat: building.lat, lng: building.lng });
                    mapInstanceRef.current.setZoom(18);
                  }
                  setMobileBuilding(e.target.value);
                }}
                disabled={campusBuildings.length === 0}
                MenuProps={{ PaperProps: { sx: { maxHeight: 300, maxWidth: "calc(100vw - 32px)" } } }}
                sx={{
                  fontWeight: 700, borderRadius: 2,
                  background: isDark ? "rgba(35,35,36,0.95)" : "rgba(255,255,255,0.95)",
                  backdropFilter: "blur(8px)",
                  color: isDark ? "#D7DADC" : "inherit",
                  "& .MuiOutlinedInput-notchedOutline": { borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc" },
                  "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#A84D48" },
                  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#A84D48" },
                  "& .MuiSvgIcon-root": { color: isDark ? "#B8BABD" : undefined },
                }}
              >
                {campusBuildings.map((b) => (
                  <MenuItem key={b.name} value={b.name} sx={{ fontWeight: 700 }}>
                    {b.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {!searchPin && !loading && (
              <Paper
                elevation={0}
                sx={{
                  position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                  display: "flex", alignItems: "center", gap: 1,
                  px: 2, py: 1, borderRadius: 99, width: { xs: "calc(100% - 24px)", sm: "auto" },
                  background: isDark ? "rgba(36,29,29,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
                  border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc",
                }}
              >
                <MyLocationIcon sx={{ color: "#A84D48", fontSize: 18 }} />
                <Typography variant="body2" fontWeight={700} color="text.secondary" sx={{ fontSize: { xs: 12, sm: 14 } }}>
                  Tap the map to search nearby lost items
                </Typography>
              </Paper>
            )}
          </Paper>

          {/* Desktop side panel — slides in horizontally beside the map (md+) */}
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Collapse
              in={showPanel && !!searchPin}
              orientation="horizontal"
              unmountOnExit
              sx={{
                minWidth: showPanel ? 320 : 0,
                pointerEvents: showPanel && !!searchPin ? "auto" : "none",
              }}
            >
              <Paper
                elevation={2}
                sx={{
                  width: 320, p: 2.5, borderRadius: 3,
                  height: "calc(100vh - 240px)",
                  overflowY: "auto",
                  border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc",
                  background: isDark ? "#1A1A1B" : "#fff",
                }}
              >
                <SidePanelContent
                  isDark={isDark}
                  radius={radius}
                  setRadius={setRadius}
                  nearbyItems={nearbyItems}
                  mapInstanceRef={mapInstanceRef}
                  setSelectedItem={setSelectedItem}
                  timeZone={timeZone}
                />
              </Paper>
            </Collapse>
          </Box>

          {/* Mobile inline panel — appears below the map on all small screens (xs) */}
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            {searchPin && (
              <Paper
                elevation={2}
                sx={{
                  p: 2.5, borderRadius: 3, mb: 2,
                  border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc",
                  background: isDark ? "#1A1A1B" : "#fff",
                }}
              >
                <SidePanelContent
                  isDark={isDark}
                  radius={radius}
                  setRadius={setRadius}
                  nearbyItems={nearbyItems}
                  mapInstanceRef={mapInstanceRef}
                  setSelectedItem={setSelectedItem}
                  timeZone={timeZone}
                />
              </Paper>
            )}
          </Box>
        </Box>
      </Box>

      <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onClaim={handleClaim} isDark={isDark} timeZone={timeZone} />
      </Box>
    </>
  );
}