import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { useAuth } from "../AuthContext";
import {
  Box, Typography, Paper, Slider, Chip, IconButton, CircularProgress,
  Collapse, Button, Modal, Autocomplete, TextField,
} from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import CloseIcon from "@mui/icons-material/Close";
import ListIcon from "@mui/icons-material/ViewList";
import SearchIcon from "@mui/icons-material/Search";
import FlagIcon from "@mui/icons-material/Flag";
import ReportModal from "../components/ReportModal";
import { supabase } from "../supabaseClient";
import { CAMPUSES } from "../constants/campuses";
import { removeExpiredUnresolvedListings } from "../utils/listingExpiry";

setOptions({
  key: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  v: "weekly",
});

// --- Constants ---
const IMPORTANCE_LABELS = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };
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

function formatDate(d) {
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

// --- DetailModal ---
function DetailModal({ item, onClose, onClaim, isDark = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claimed, setClaimed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  if (!item) return null;
  return (
    <Modal open={!!item} onClose={onClose}>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: isDark ? "#1A1A1B" : "#fff", borderRadius: 4, p: "26px", width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto", outline: "none",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
          <Box>
            <Typography variant="h6" fontWeight={900}>{item.title}</Typography>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Posted by {item.poster_name} · {formatDate(item.date)}
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
          ? <Box component="img" src={item.image_url} alt={item.title} sx={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 2, mb: 2, border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc" }} />
          : <Box sx={{ width: "100%", height: 120, background: isDark ? "#2D2D2E" : "#f5f0f0", borderRadius: 2, mb: 2, display: "flex", alignItems: "center", justifyContent: "center", border: isDark ? "1px dashed rgba(255,255,255,0.2)" : "1.5px dashed #dac8c8" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No photo provided</Typography>
            </Box>
        }

        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <Chip label={IMPORTANCE_LABELS[item.importance]} size="small" sx={{ background: IMPORTANCE_COLORS[item.importance] + "22", color: IMPORTANCE_COLORS[item.importance], fontWeight: 800 }} />
          <Chip label={item.category} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: "#A84D48", fontWeight: 700 }} />
          {item.resolved && <Chip label="Resolved" size="small" sx={{ background: isDark ? "#1f3527" : "#dcfce7", color: isDark ? "#6ee7b7" : "#16a34a", border: isDark ? "1px solid rgba(110,231,183,0.42)" : "none", fontWeight: 800 }} />}
        </Box>

        <Paper variant="outlined" sx={{ p: 2, mb: 2, background: isDark ? "#232324" : "#fdf7f7", borderColor: isDark ? "rgba(255,255,255,0.14)" : "#ecdcdc", borderRadius: 2 }}>
          <Typography variant="caption" fontWeight={800} color="#a07070" sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>LOCATION</Typography>
          <Typography fontWeight={700} fontSize={14}>{item.locations?.name ?? "Unknown location"}</Typography>
          <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>Found at: {item.found_at}</Typography>
        </Paper>

        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" fontWeight={800} color="#a07070" sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>DESCRIPTION</Typography>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} lineHeight={1.65}>{item.description}</Typography>
        </Box>

        {!item.resolved && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1.25, py: 0.75, mb: 1.5, borderRadius: 1.5, background: isDark ? "#3a2f22" : "#fff3cd", border: isDark ? "1px solid rgba(245,158,11,0.5)" : "1px solid #ffc107" }}>
            <Typography variant="caption" sx={{ color: isDark ? "#f6c66a" : "#7d4e00", fontWeight: 600, lineHeight: 1.4 }}>
              ⚠️ Falsely claiming an item violates the Northeastern Code of Student Conduct and may result in disciplinary action.
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained" fullWidth disabled={item.resolved}
            onClick={async () => { setClaimed(true); await onClaim(item.item_id); }}
            sx={{ background: claimed ? "#16a34a" : "#A84D48", "&:hover": { background: claimed ? "#15803d" : "#8f3e3a" }, fontWeight: 800, borderRadius: 2 }}
          >
            {item.resolved ? "Already Resolved" : claimed ? "Marked as Found!" : "This is Mine!"}
          </Button>
          <Button
            variant="outlined"
            sx={{ borderColor: isDark ? "rgba(255,255,255,0.2)" : "#ecdcdc", color: "#A84D48", fontWeight: 800, borderRadius: 2, flexShrink: 0 }}
            onClick={async () => {
              const { data } = await supabase.from("conversations").select("id").eq("listing_id", item.item_id).eq("participant_1", user.id).maybeSingle();
              if (data != null) { navigate(`/messages?conversation=${data.id}`); return; }
              const { data: created } = await supabase.from("conversations").insert({ listing_id: item.item_id, participant_1: user.id, participant_2: item.poster_id }).select("id").single();
              if (created) navigate(`/messages?conversation=${created.id}`);
            }}
          >
            Message
          </Button>
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

// --- MapPage ---
export default function MapPage({ effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const { profile } = useAuth();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const searchPinRef = useRef(null);
  const circleRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const campusCenterMarkerRef = useRef(null);

  // Read default campus from profile, fall back to "boston"
  const initialCampus = profile?.default_campus || "boston";

  const [selectedCampus, setSelectedCampus] = useState(initialCampus);
  const [campusBuildings, setCampusBuildings] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchPin, setSearchPin] = useState(null);
  const [radius, setRadius] = useState(150);
  const [nearbyItems, setNearbyItems] = useState([]);
  const [showPanel, setShowPanel] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  const activeCampus = CAMPUSES.find((c) => c.id === selectedCampus) ?? CAMPUSES[0];

  // ---- Fetch buildings for active campus ----
  useEffect(() => {
    supabase
      .from("locations")
      .select("name, coordinates")
      .eq("campus", selectedCampus)
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (!data) return;
        const parsed = data
          .map((loc) => {
            const coords = parseCoordinates(loc.coordinates);
            if (!coords) return null;
            return { name: loc.name, lat: coords.lat, lng: coords.lng };
          })
          .filter(Boolean);
        setCampusBuildings(parsed);
      });
  }, [selectedCampus]);

  // ---- Fetch all listings ----
  const fetchItems = useCallback(async () => {
    setLoading(true);
    await removeExpiredUnresolvedListings();

    const { data, error } = await supabase
      .from("listings")
      .select("*, locations(name, coordinates)")
      .order("date", { ascending: false });

    if (!error && data) {
      const normalized = data.map((item) => {
        let lat = item.lat;
        let lng = item.lng;
        if (lat == null && item.locations?.coordinates) {
          const parsed = parseCoordinates(item.locations.coordinates);
          if (parsed) { lat = parsed.lat; lng = parsed.lng; }
        }
        return { ...item, _lat: lat, _lng: lng };
      });
      setItems(normalized);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchItems();
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
    clearSearch();
    const campus = CAMPUSES.find((c) => c.id === campusId) ?? CAMPUSES[0];
    if (mapInstanceRef.current) {
      mapInstanceRef.current.panTo(campus.center);
      mapInstanceRef.current.setZoom(campus.zoom);
    }
  };

  const handleClaim = async (item_id) => {
    await supabase.from("listings").update({ resolved: true }).eq("item_id", item_id);
    setItems(prev => prev.map(i => i.item_id === item_id ? { ...i, resolved: true } : i));
    if (selectedItem?.item_id === item_id) setSelectedItem(prev => ({ ...prev, resolved: true }));
  };

  // ---- Initialize Google Map + place initial campus marker ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { Map } = await importLibrary("maps");
      const { AdvancedMarkerElement } = await importLibrary("marker");
      if (cancelled || !mapRef.current) return;

      // Use the user's default campus for initial center
      const campus = CAMPUSES.find((c) => c.id === initialCampus) ?? CAMPUSES[0];

      const map = new Map(mapRef.current, {
        center: campus.center,
        zoom: campus.zoom,
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: "greedy",
        mapId: "LOST_HOUND_MAP",
        clickableIcons: false,
      });

      mapInstanceRef.current = map;

      // Place the initial campus center marker right away (no race condition)
      campusCenterMarkerRef.current = new AdvancedMarkerElement({
        map,
        position: campus.center,
        content: buildCampusMarkerEl(campus.name),
        title: campus.name,
        zIndex: 1000,
      });

      map.addListener("click", (e) => {
        const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        setSearchPin(pos);
        setShowPanel(true);
      });
    })();

    return () => { cancelled = true; };
  }, [initialCampus]);

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
  // (Initial marker is placed in map init effect — this only handles subsequent changes)
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
      return haversine(searchPin, { lat: i._lat, lng: i._lng }) <= radius;
    });
    setNearbyItems(nearby);
  }, [searchPin, radius, items]);

  const clearSearch = () => {
    setSearchPin(null);
    setShowPanel(false);
    setNearbyItems([]);
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", p: 3, color: isDark ? "#D7DADC" : "inherit" }}>
      <Box sx={{ width: "100%", maxWidth: 1200 }}>
        {/* Campus selector */}
        <Box
          sx={{
            display: "flex", gap: 0.6, flexWrap: "nowrap", mb: 1.5,
            pb: 1.5, borderBottom: isDark ? "1px solid rgba(255,255,255,0.12)" : "1.5px solid #f0e8e8",
            justifyContent: "center",
          }}
        >
          {CAMPUSES.map((campus) => (
            <Chip
              key={campus.id}
              label={`${campus.name}, ${campus.state}`}
              onClick={() => handleCampusChange(campus.id)}
              variant={selectedCampus === campus.id ? "filled" : "outlined"}
              sx={{
                fontWeight: 700, fontSize: 11, height: 26, cursor: "pointer", flexShrink: 1,
                "& .MuiChip-label": { px: 1 },
                borderColor: selectedCampus === campus.id ? "#A84D48" : isDark ? "rgba(255,255,255,0.2)" : "#e0d0d0",
                background: selectedCampus === campus.id ? "#A84D48" : "transparent",
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

        {/* Header */}
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h4" fontWeight={900}>Campus Map</Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            {searchPin && (
              <Button size="small" onClick={clearSearch} startIcon={<CloseIcon />} sx={{ color: "#A84D48", fontWeight: 700 }}>
                Clear Pin
              </Button>
            )}
            <Button
              variant="outlined" onClick={handleRefresh} disabled={refreshing}
              sx={{
                borderColor: isDark ? "rgba(255,255,255,0.24)" : "#ecdcdc", color: "#A84D48", fontWeight: 800,
                borderRadius: 2, minWidth: 0, px: 1.5, fontSize: 18,
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

        <Box sx={{ display: "flex", gap: 2.5, flexDirection: { xs: "column", md: "row" } }}>
          {/* Map */}
          <Paper
            elevation={3}
            sx={{
              flex: 1, height: { xs: "50vh", md: "calc(100vh - 270px)" },
              minHeight: 400, overflow: "hidden", borderRadius: 3, position: "relative",
              border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
              background: isDark ? "#1A1A1B" : "#fff",
            }}
          >
            {loading && (
              <Box sx={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 10 }}>
                <CircularProgress sx={{ color: "#A84D48" }} />
              </Box>
            )}
            <Box ref={mapRef} sx={{ width: "100%", height: "100%" }} />

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
                      background: isDark ? "rgba(36,29,29,0.95)" : "rgba(255,255,255,0.95)", backdropFilter: "blur(8px)",
                      color: isDark ? "#D7DADC" : "inherit",
                      borderRadius: 2, fontWeight: 700, fontSize: 13,
                      "& fieldset": { borderColor: isDark ? "rgba(255,255,255,0.16)" : "#ecdcdc" },
                      "&:hover fieldset": { borderColor: "#A84D48" },
                      "&.Mui-focused fieldset": { borderColor: "#A84D48" },
                    },
                  }}
                />
              )}
              sx={{ position: "absolute", top: 12, left: 12, width: 270, zIndex: 10 }}
            />

            {!searchPin && !loading && (
              <Paper
                elevation={0}
                sx={{
                  position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                  display: "flex", alignItems: "center", gap: 1,
                  px: 2.5, py: 1.25, borderRadius: 99,
                  background: isDark ? "rgba(36,29,29,0.92)" : "rgba(255,255,255,0.92)", backdropFilter: "blur(8px)",
                  border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc",
                }}
              >
                <MyLocationIcon sx={{ color: "#A84D48", fontSize: 18 }} />
                <Typography variant="body2" fontWeight={700} color="text.secondary">
                  Tap the map to search for nearby lost items
                </Typography>
              </Paper>
            )}
          </Paper>

          {/* Side panel */}
          <Collapse in={showPanel && !!searchPin} orientation="horizontal" sx={{ minWidth: showPanel ? 320 : 0 }}>
            <Paper
              elevation={2}
              sx={{
                width: 320, p: 2.5, borderRadius: 3,
                height: { xs: "auto", md: "calc(100vh - 270px)" },
                overflowY: "auto", border: isDark ? "1px solid rgba(255,255,255,0.16)" : "1.5px solid #ecdcdc",
                background: isDark ? "#1A1A1B" : "#fff",
              }}
            >
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
                          <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600} noWrap>
                            {item.locations?.name ?? "Unknown"} · {formatDate(item.date)}
                          </Typography>
                        </Box>
                        <Chip
                          label={IMPORTANCE_LABELS[item.importance]} size="small"
                          sx={{
                            background: IMPORTANCE_COLORS[item.importance] + "22",
                            color: IMPORTANCE_COLORS[item.importance],
                            fontWeight: 800, fontSize: 10, flexShrink: 0,
                          }}
                        />
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Paper>
          </Collapse>
        </Box>
      </Box>

      <DetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onClaim={handleClaim} isDark={isDark} />
    </Box>
  );
}