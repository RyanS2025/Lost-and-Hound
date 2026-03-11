import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Box, Typography, Paper, TextField, Button, Select, MenuItem,
  FormControl, InputLabel, Chip, CircularProgress, Modal, Slider,
  IconButton, InputAdornment, Collapse,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import UploadIcon from "@mui/icons-material/UploadFile";
import MapIcon from "@mui/icons-material/PinDrop";
import FlagIcon from "@mui/icons-material/Flag";
import ReportModal from "../components/ReportModal";
import { supabase } from "../supabaseClient";
import { useAuth } from "../AuthContext";
import MapPinPicker from "../components/MapPinPicker";
import { CAMPUSES } from "../constants/campuses";
import { removeExpiredUnresolvedListings } from "../utils/listingExpiry";

// --- Constants ---
const CATEGORIES = ["All", "Husky Card", "Jacket", "Wallet/Purse", "Bag", "Keys", "Electronics", "Other"];
const SORT_OPTIONS = ["Newest", "Oldest", "Most Important"];
const IMPORTANCE_LABELS = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };
const IMPORTANCE_MARKS = [{ value: 1, label: "Low" }, { value: 2, label: "Medium" }, { value: 3, label: "High" }];

// --- Helpers ---
function formatDate(d) {
  const diff = Math.floor((new Date() - new Date(d)) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff} days ago`;
}

function parseCoordinates(coordStr) {
  if (!coordStr || typeof coordStr !== "string") return null;
  const match = coordStr.match(
    /([\d.]+)°?\s*([NS])\s+([\d.]+)°?\s*([EW])/i
  );
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

// --- ImageUpload ---
function ImageUpload({ image, onChange, isDark = false }) {
  const inputRef = useRef();
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange({ dataUrl: ev.target.result, file });
    reader.readAsDataURL(file);
  };
  return (
    <Box>
      <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.75 }}>
        Photo (optional)
      </Typography>
      <Box
        onClick={() => inputRef.current.click()}
        sx={{
          border: `2px dashed ${image ? "#A84D48" : "#ccc"}`,
          borderRadius: 2, p: 2, cursor: "pointer", textAlign: "center",
          background: image ? (isDark ? "#2D2D2E" : "#fdf7f7") : (isDark ? "#232324" : "#fafafa"),
          transition: "border-color 0.15s",
          "&:hover": { borderColor: "#A84D48" },
        }}
      >
        {image
          ? <img src={image.dataUrl} alt="preview" style={{ maxHeight: 120, maxWidth: "100%", borderRadius: 8, objectFit: "cover" }} />
          : <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, color: "text.disabled" }}>
              <UploadIcon />
              <Typography variant="caption" fontWeight={700}>Click to upload a photo</Typography>
              <Typography variant="caption">JPG, PNG, WEBP</Typography>
            </Box>
        }
      </Box>
      {image && (
        <Button size="small" onClick={() => onChange(null)} sx={{ mt: 0.5, color: "#A84D48", fontSize: 12 }}>
          Remove photo
        </Button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} style={{ display: "none" }} />
    </Box>
  );
}

// --- ItemCard ---
function ItemCard({ item, onClick, isDark = false }) {
  return (
    <Paper
      elevation={1}
      onClick={() => onClick(item)}
      sx={{
        display: "flex", gap: 2, p: 2, borderRadius: 3, cursor: "pointer",
        opacity: item.resolved ? 0.65 : 1,
        border: "1.5px solid",
        borderColor: isDark ? "rgba(255,255,255,0.14)" : item.resolved ? "#e8e0e0" : "#ecdcdc",
        background: isDark ? "#1A1A1B" : "#fff",
        transition: "box-shadow 0.15s, transform 0.15s",
        "&:hover": { boxShadow: isDark ? "0 6px 18px rgba(0,0,0,0.35)" : "0 4px 18px rgba(168,77,72,0.13)", transform: "translateY(-2px)" },
      }}
    >
      <Box sx={{
        width: 72, height: 72, borderRadius: 2, flexShrink: 0, overflow: "hidden",
        background: isDark ? "#2D2D2E" : "#f0eded", border: isDark ? "1px solid rgba(255,255,255,0.14)" : "1.5px solid #e0d6d6",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {item.image_url
          ? <img src={item.image_url} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <UploadIcon sx={{ color: "#c4a8a7", fontSize: 28 }} />
        }
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
              <Typography fontWeight={800} fontSize={16}>{item.title}</Typography>
              {item.resolved && <Chip label="Resolved" size="small" sx={{ background: isDark ? "#1f3527" : "#dcfce7", color: isDark ? "#6ee7b7" : "#16a34a", border: isDark ? "1px solid rgba(110,231,183,0.42)" : "none", fontWeight: 800, fontSize: 11 }} />}
            </Box>
            <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600} display="block">
              {item.locations?.name ?? "Unknown location"} · {item.found_at}
            </Typography>
            <Typography variant="caption" sx={{ color: isDark ? "#818384" : "#aaa", fontWeight: 600 }}>
              {item.poster_name} · {formatDate(item.date)}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.75, flexShrink: 0 }}>
            <Chip
              label={IMPORTANCE_LABELS[item.importance]}
              size="small"
              sx={{ background: IMPORTANCE_COLORS[item.importance] + "22", color: IMPORTANCE_COLORS[item.importance], fontWeight: 800, fontSize: 11, border: `1px solid ${IMPORTANCE_COLORS[item.importance]}44` }}
            />
            <Chip label={item.category} size="small" sx={{ background: isDark ? "#343536" : "#f5eded", color: isDark ? "#B8BABD" : "#a07070", fontWeight: 700, fontSize: 11 }} />
          </Box>
        </Box>
        <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={500} sx={{ mt: 1, lineHeight: 1.5 }}>
          {item.description?.length > 100 ? item.description.slice(0, 100) + "…" : item.description}
        </Typography>
      </Box>
    </Paper>
  );
}

// --- DetailModal ---
function DetailModal({ item, onClose, onClaim, isDark = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [claimed, setClaimed] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  if (!item) return null;
  const pinCoords = (item.lat && item.lng)
    ? { lat: item.lat, lng: item.lng }
    : parseCoordinates(item.locations?.coordinates);

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
            <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>
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
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>LOCATION</Typography>
          <Typography fontWeight={700} fontSize={14}>{item.locations?.name ?? "Unknown location"}</Typography>
          <Typography variant="caption" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={600}>Found at: {item.found_at}</Typography>

          {pinCoords ? (
            <Box sx={{ mt: 1.5 }}>
              <MapPinPicker
                value={pinCoords}
                height={120}
                interactive={false}
                showCoords={false}
                zoom={17}
                center={pinCoords}
              />
            </Box>
          ) : (
            <Box sx={{ mt: 1.5, background: isDark ? "#2D2D2E" : "#ede8e8", borderRadius: 1.5, height: 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Typography variant="caption" color={isDark ? "#818384" : "text.disabled"} fontWeight={700}>No exact location pinned</Typography>
            </Box>
          )}
        </Paper>

        <Box sx={{ mb: 3 }}>
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "#a07070"} sx={{ letterSpacing: 0.5, display: "block", mb: 0.75 }}>DESCRIPTION</Typography>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} lineHeight={1.65}>{item.description}</Typography>
        </Box>

        {!item.resolved && (
          <Box
            sx={{
              display: "flex", alignItems: "center", gap: 0.75,
              px: 1.25, py: 0.75, mb: 1.5, borderRadius: 1.5,
              background: isDark ? "#3a2f22" : "#fff3cd", border: isDark ? "1px solid rgba(245,158,11,0.5)" : "1px solid #ffc107",
            }}
          >
            <Typography variant="caption" sx={{ color: isDark ? "#f6c66a" : "#7d4e00", fontWeight: 600, lineHeight: 1.4 }}>
              ⚠️ Falsely claiming an item violates the Northeastern Code of Student Conduct and may result in disciplinary action.
            </Typography>
          </Box>
        )}
        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button
            variant="contained"
            fullWidth
            disabled={item.resolved}
            onClick={async () => {
              setClaimed(true);
              await onClaim(item.item_id);
            }}
            sx={{ background: claimed ? "#16a34a" : "#A84D48", "&:hover": { background: claimed ? "#15803d" : "#8f3e3a" }, fontWeight: 800, borderRadius: 2 }}
          >
            {item.resolved ? "Already Resolved" : claimed ? "Marked as Found!" : "This is Mine!"}
          </Button>
          <Button
            variant="outlined"
            sx={{ borderColor: isDark ? "rgba(255,255,255,0.2)" : "#ecdcdc", color: "#A84D48", fontWeight: 800, borderRadius: 2, flexShrink: 0 }}
            onClick={async () => {
              const { data } = await supabase
                .from("conversations")
                .select("id")
                .eq("listing_id", item.item_id)
                .eq("participant_1", user.id)
                .maybeSingle();

              if (data != null) {
                navigate(`/messages?conversation=${data.id}`);
                return;
              }

              else {
                const {data: created } = await supabase
                  .from("conversations")
                  .insert({ listing_id: item.item_id, participant_1: user.id, participant_2: item.poster_id })
                  .select("id")
                  .single();
                  
                if (created) navigate(`/messages?conversation=${created.id}`);
              }
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

// --- NewItemModal ---
function NewItemModal({ open, onClose, onAdd, isDark = false }) {
  const { user, profile } = useAuth();
  const [locations, setLocations] = useState([]);
  const [selectedCampus, setSelectedCampus] = useState(profile?.default_campus || "boston");
  const [form, setForm] = useState({
    title: "", category: "Other", location_id: "", found_at: "",
    importance: 2, description: "", image: null, pin: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [flyTo, setFlyTo] = useState(null);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.title.trim() && form.found_at.trim() && form.description.trim() && form.location_id;

  useEffect(() => {
    if (!open) return;
    supabase
      .from("locations")
      .select("location_id, name, coordinates")
      .eq("campus", selectedCampus)
      .order("name", { ascending: true })
      .then(({ data }) => {
        if (data) setLocations(data);
      });
  }, [open, selectedCampus]);

  const handleCampusChange = (campusId) => {
    setSelectedCampus(campusId);
    set("location_id", "");
    set("pin", null);
    setFlyTo(null);
    setShowMap(false);
  };

  const handleBuildingChange = (location_id) => {
    set("location_id", location_id);
    const loc = locations.find((l) => l.location_id === location_id);
    if (!loc) return;

    const coords = parseCoordinates(loc.coordinates);
    if (coords) {
      set("pin", coords);
      setFlyTo({ ...coords, zoom: 18 });
      if (!showMap) setShowMap(true);
    }
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);

    let image_url = null;

    if (form.image?.file) {
      const ext = form.image.file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("listing-images")
        .upload(path, form.image.file);
      if (!uploadError) {
        const { data } = supabase.storage.from("listing-images").getPublicUrl(path);
        image_url = data.publicUrl;
      }
    }

    const posterName = profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : user.email;

    const insertData = {
      title: form.title,
      category: form.category,
      location_id: form.location_id,
      found_at: form.found_at,
      importance: form.importance,
      description: form.description,
      image_url,
      resolved: false,
      poster_id: user.id,
      poster_name: posterName,
      date: new Date().toISOString(),
    };

    if (form.pin) {
      insertData.lat = form.pin.lat;
      insertData.lng = form.pin.lng;
    }

    const { data, error } = await supabase
      .from("listings")
      .insert([insertData])
      .select(`*, locations(name, coordinates, campus)`)
      .single();

    setSubmitting(false);
    if (!error && data) {
      onAdd(data);
      onClose();
      setForm({ title: "", category: "Other", location_id: "", found_at: "", importance: 2, description: "", image: null, pin: null });
      setShowMap(false);
      setFlyTo(null);
      setSelectedCampus(profile?.default_campus || "boston");
    }
  };

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={{
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
        background: isDark ? "#1A1A1B" : "#fff", borderRadius: 4, p: "26px", width: "100%", maxWidth: 520,
        maxHeight: "92vh", overflowY: "auto", outline: "none",
        border: isDark ? "1px solid rgba(255,255,255,0.14)" : "none",
      }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
          <Typography variant="h6" fontWeight={900}>Report Found Item</Typography>
          <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
        </Box>

        <TextField label="Item Name" value={form.title} onChange={e => set("title", e.target.value)} placeholder="e.g. Blue Husky Card" fullWidth sx={{ mb: 2 }} />

        {/* Campus chips */}
        <Box sx={{ mb: 0.5 }}>
          <Typography variant="caption" fontWeight={700} color={isDark ? "#B8BABD" : "text.secondary"} sx={{ display: "block", mb: 0.75 }}>
            Campus
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
            {CAMPUSES.map(c => (
              <Chip
                key={c.id}
                label={`${c.name}, ${c.state}`}
                onClick={() => handleCampusChange(c.id)}
                variant={selectedCampus === c.id ? "filled" : "outlined"}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: 11, cursor: "pointer",
                  borderColor: selectedCampus === c.id ? "#A84D48" : "#e0d0d0",
                  background: selectedCampus === c.id ? "#A84D48" : "transparent",
                  color: selectedCampus === c.id ? "#fff" : isDark ? "#B8BABD" : "#7a5050",
                  "&:hover": {
                    background: selectedCampus === c.id ? "#8f3e3a" : isDark ? "#2D2D2E" : "#fdf0f0",
                    borderColor: "#A84D48",
                  },
                  transition: "all 0.15s",
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Category + Building */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 2, mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Category</InputLabel>
            <Select value={form.category} label="Category" onChange={e => set("category", e.target.value)}>
              {CATEGORIES.filter(c => c !== "All").map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth>
            <InputLabel id="building-label">Building</InputLabel>
            <Select
              labelId="building-label"
              value={form.location_id}
              label="Building"
              onChange={e => handleBuildingChange(e.target.value)}
            >
              {locations.length === 0 ? (
                <MenuItem value="" disabled>
                  No buildings for {CAMPUSES.find(c => c.id === selectedCampus)?.name ?? selectedCampus} yet
                </MenuItem>
              ) : (
                locations.map(l => (
                  <MenuItem key={l.location_id} value={l.location_id}>{l.name}</MenuItem>
                ))
              )}
            </Select>
          </FormControl>
        </Box>

        <TextField label="Found At (specific spot)" value={form.found_at} onChange={e => set("found_at", e.target.value)} placeholder="e.g. Table near window, Room 204" fullWidth sx={{ mb: 2 }} />
        <TextField label="Description" value={form.description} onChange={e => set("description", e.target.value)} placeholder="Color, markings, contents..." multiline rows={3} fullWidth sx={{ mb: 2 }} />

        {/* Map pin */}
        <Box sx={{ mb: 2 }}>
          <Button
            size="small" startIcon={<MapIcon />}
            onClick={() => setShowMap(!showMap)}
            sx={{
              color: form.pin ? "#16a34a" : "#A84D48",
              fontWeight: 700, mb: 0.75,
              background: form.pin ? "#dcfce722" : "transparent",
            }}
          >
            {form.pin
              ? `📍 Pin placed — tap to ${showMap ? "hide" : "edit"}`
              : "Drop a pin on the map (optional)"}
          </Button>

          <Collapse in={showMap}>
            <MapPinPicker
              value={form.pin}
              onChange={(latLng) => set("pin", latLng)}
              height={200}
              flyTo={flyTo}
            />
            {form.pin && (
              <Button size="small" onClick={() => { set("pin", null); setFlyTo(null); }} sx={{ mt: 0.5, color: "#A84D48", fontSize: 12 }}>
                Remove pin
              </Button>
            )}
          </Collapse>
        </Box>

        {/* Importance */}
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="caption" fontWeight={800} color={isDark ? "#B8BABD" : "text.secondary"} sx={{ display: "block", mb: 1 }}>
            Importance: <span style={{ color: IMPORTANCE_COLORS[form.importance], fontWeight: 900 }}>{IMPORTANCE_LABELS[form.importance]}</span>
          </Typography>
          <Slider
            value={form.importance} min={1} max={3} step={1}
            onChange={(_, v) => set("importance", v)}
            sx={{ color: IMPORTANCE_COLORS[form.importance] }}
            marks={IMPORTANCE_MARKS}
          />
        </Box>

        <Box sx={{ mb: 3 }}>
          <ImageUpload image={form.image} onChange={v => set("image", v)} isDark={isDark} />
        </Box>

        <Button
          variant="contained" fullWidth disabled={!valid || submitting} onClick={handleSubmit}
          sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 900, borderRadius: 2, py: 1.5 }}
        >
          {submitting ? <CircularProgress size={20} color="inherit" /> : "Post Listing"}
        </Button>
      </Box>
    </Modal>
  );
}

// --- FeedPage ---
export default function FeedPage({ effectiveTheme = "light" }) {
  const isDark = effectiveTheme === "dark";
  const { profile } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [selectedCampus, setSelectedCampus] = useState(profile?.default_campus || "boston");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    await removeExpiredUnresolvedListings();

    const { data, error } = await supabase
      .from("listings")
      .select(`*, locations(name, coordinates, campus)`)
      .order("date", { ascending: false });

    if (!error) setItems(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleClaim = async (item_id) => {
    await supabase.from("listings").update({ resolved: true }).eq("item_id", item_id);
    setItems(prev => prev.map(i => i.item_id === item_id ? { ...i, resolved: true } : i));
    if (selected?.item_id === item_id) setSelected(prev => ({ ...prev, resolved: true }));
  };

  const filtered = items
    .filter(i => selectedCampus === "all" || i.locations?.campus === selectedCampus)
    .filter(i => showResolved || !i.resolved)
    .filter(i => category === "All" || i.category === category)
    .filter(i =>
      i.title?.toLowerCase().includes(search.toLowerCase()) ||
      i.locations?.name?.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sort === "Newest") return new Date(b.date) - new Date(a.date);
      if (sort === "Oldest") return new Date(a.date) - new Date(b.date);
      if (sort === "Most Important") return b.importance - a.importance;
      return 0;
    });

  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%", p: 3, color: isDark ? "#D7DADC" : "inherit" }}>
      <Box sx={{ width: "100%", maxWidth: 680 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2.5 }}>
          <Typography variant="h4" fontWeight={900}>Lost & Found Feed</Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              onClick={() => {
                const btn = document.getElementById("feed-refresh-icon");
                if (btn) btn.style.transform = "rotate(360deg)";
                fetchItems().finally(() => {
                  setTimeout(() => { if (btn) btn.style.transform = "rotate(0deg)"; }, 600);
                });
              }}
              sx={{
                borderColor: isDark ? "rgba(255,255,255,0.24)" : "#ecdcdc", color: "#A84D48", fontWeight: 800,
                borderRadius: 2, minWidth: 0, px: 1.5, fontSize: 18,
              }}
            >
              <span
                id="feed-refresh-icon"
                style={{ display: "inline-block", transition: "transform 0.6s cubic-bezier(0.4,0,0.2,1)" }}
              >
                ↻
              </span>
            </Button>
            <Button
              variant="contained" startIcon={<AddIcon />} onClick={() => setShowNew(true)}
              sx={{ background: "#A84D48", "&:hover": { background: "#8f3e3a" }, fontWeight: 900, borderRadius: 2 }}
            >
              Report Item
            </Button>
          </Box>
        </Box>

        {/* Search + Campus filter */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 2, alignItems: "center" }}>
          <TextField
            fullWidth placeholder="Search items, locations, descriptions..."
            value={search} onChange={e => setSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: isDark ? "#B8BABD" : "#a07070" }} /></InputAdornment>,
              sx: isDark ? { background: "#2D2D2E", color: "#D7DADC" } : undefined,
            }}
          />
          <FormControl size="small" sx={{ minWidth: 160, flexShrink: 0 }}>
            <Select
              value={selectedCampus}
              onChange={(e) => setSelectedCampus(e.target.value)}
              displayEmpty
            >
              <MenuItem value="all">All Campuses</MenuItem>
              {CAMPUSES.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}, {c.state}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Category filter chips */}
        <Box sx={{ display: "flex", gap: 1, overflowX: "auto", pb: 1, mb: 1.5 }}>
          {CATEGORIES.map(c => (
            <Chip key={c} label={c} clickable onClick={() => setCategory(c)} sx={{
              flexShrink: 0, fontWeight: 800,
              background: category === c ? "#A84D48" : isDark ? "#2D2D2E" : "#fff",
              color: category === c ? "#fff" : isDark ? "#B8BABD" : "#a07070",
              border: `1.5px solid ${category === c ? "#A84D48" : isDark ? "rgba(255,255,255,0.18)" : "#e0d8d8"}`,
              "&:hover": { background: category === c ? "#8f3e3a" : isDark ? "#343536" : "#fdf7f7" },
            }} />
          ))}
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="body2" color={isDark ? "#B8BABD" : "text.secondary"} fontWeight={700}>
            {filtered.length} item{filtered.length !== 1 ? "s" : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Chip
              label={showResolved ? "Hide Resolved" : "Show Resolved"}
              clickable
              onClick={() => setShowResolved(v => !v)}
              sx={{
                fontWeight: 800, fontSize: 12,
                background: showResolved ? (isDark ? "#1f3527" : "#dcfce7") : isDark ? "#2D2D2E" : "#f5f5f5",
                color: showResolved ? (isDark ? "#6ee7b7" : "#16a34a") : isDark ? "#818384" : "#999",
                border: `1.5px solid ${showResolved ? (isDark ? "rgba(110,231,183,0.42)" : "#86efac") : isDark ? "rgba(255,255,255,0.18)" : "#e0e0e0"}`,
                "&:hover": { background: showResolved ? (isDark ? "#27412f" : "#bbf7d0") : isDark ? "#343536" : "#ececec" },
              }}
            />
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sort by</InputLabel>
              <Select value={sort} label="Sort by" onChange={e => setSort(e.target.value)}>
                {SORT_OPTIONS.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {loading
          ? <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}><CircularProgress sx={{ color: "#A84D48" }} /></Box>
          : filtered.length === 0
            ? <Typography textAlign="center" color={isDark ? "#818384" : "text.disabled"} fontWeight={700} sx={{ mt: 8 }}>No items found.</Typography>
            : <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {filtered.map(item => <ItemCard key={item.item_id} item={item} onClick={setSelected} isDark={isDark} />)}
              </Box>
        }
      </Box>

      <DetailModal item={selected} onClose={() => setSelected(null)} onClaim={handleClaim} isDark={isDark} />
      <NewItemModal open={showNew} onClose={() => setShowNew(false)} onAdd={item => setItems(prev => [item, ...prev])} isDark={isDark} />
    </Box>
  );
}