import { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Image, LayoutAnimation,
} from "react-native";
import Slider from "@react-native-community/slider";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useItems } from "../../contexts/ItemsContext";
import { useTimezone } from "../../contexts/TimezoneContext";
import apiFetch from "../../utils/apiFetch";
import { useTheme } from "../../contexts/ThemeContext";
import ScreenHeader from "../../components/ScreenHeader";
import ItemDetailModal from "../../components/ItemDetailModal";
import PickerModal from "../../components/PickerModal";
import ReportModal from "../../components/ReportModal";
import { CAMPUSES } from "../../constants/campuses";
import { formatRelativeDate } from "../../utils/timezone";

const IMPORTANCE_LABELS: Record<number, string> = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS: Record<number, string> = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };
const LISTING_TYPE_LABELS: Record<string, string> = { found: "Found", lost: "Lost" };
const LISTING_TYPE_COLORS: Record<string, string> = { found: "#0891b2", lost: "#4f46e5" };
const RADIUS_MIN = 0;
const RADIUS_MAX = 500;

function parseCoordinates(coords: string | null): { lat: number; lng: number } | null {
  if (!coords) return null;
  const pointMatch = coords.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (pointMatch) return { lat: parseFloat(pointMatch[2]), lng: parseFloat(pointMatch[1]) };
  const degMatch = coords.match(/([\d.]+)°?\s*([NS])\s+([\d.]+)°?\s*([EW])/i);
  if (degMatch) {
    let lat = parseFloat(degMatch[1]);
    let lng = parseFloat(degMatch[3]);
    if (degMatch[2].toUpperCase() === "S") lat = -lat;
    if (degMatch[4].toUpperCase() === "W") lng = -lng;
    return { lat, lng };
  }
  const parts = coords.split(",").map((s: string) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
  return null;
}

function feetToMeters(feet: number) { return feet * 0.3048; }

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function MapScreen() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { t } = useTheme();
  const mapRef = useRef<MapView>(null);
  const initialCampus = profile?.default_campus || "boston";
  const { items: rawItems, updateItem } = useItems();
  const { timezone } = useTimezone();
  const [selectedCampus, setSelectedCampus] = useState(initialCampus);
  const [searchPin, setSearchPin] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(150);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [reportItem, setReportItem] = useState<any | null>(null);
  const [listingTypeFilter, setListingTypeFilter] = useState("all");
  const [showResolved, setShowResolved] = useState(false);
  const [campusPickerOpen, setCampusPickerOpen] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(false);
  const [currentRegion, setCurrentRegion] = useState({
    latitude: CAMPUSES.find((c) => c.id === initialCampus)?.center.lat || 42.3398,
    longitude: CAMPUSES.find((c) => c.id === initialCampus)?.center.lng || -71.0892,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const activeCampus = CAMPUSES.find((c) => c.id === selectedCampus) || CAMPUSES[0];

  // Items come from ItemsContext — fetched once at login, shared app-wide.
  // Enrich with parsed lat/lng for items that only have a locations.coordinates string.
  const allWithCoords = useMemo(() => rawItems
    .map((item: any) => {
      let lat = item.lat, lng = item.lng;
      if (lat == null && item.locations?.coordinates) {
        const parsed = parseCoordinates(item.locations.coordinates);
        if (parsed) { lat = parsed.lat; lng = parsed.lng; }
      }
      return { ...item, _lat: lat, _lng: lng };
    })
    .filter((i: any) => i._lat != null && i._lng != null)
    .filter((i: any) => showResolved || !i.resolved)
    .filter((i: any) => listingTypeFilter === "all" || i.listing_type === listingTypeFilter)
  , [rawItems, showResolved, listingTypeFilter]);

  const nearbyItems = useMemo(() => {
    if (!searchPin) return [];
    return allWithCoords.filter((i) => haversineDistance(searchPin.lat, searchPin.lng, i._lat, i._lng) <= feetToMeters(radius));
  }, [allWithCoords, searchPin, radius]);


  const handleMapPress = (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setSearchPin({ lat: latitude, lng: longitude });
    setResultsExpanded(false);
  };

  const toggleResults = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setResultsExpanded((v) => !v);
  };

  // iOS GoogleMaps + react-native-maps bug workaround: when Marker children
  // are added to <MapView> after initial render, the native marker layer
  // doesn't redraw until the map receives a camera/region change event.
  // Forcing a camera animation on searchPin changes both fixes the bug AND
  // provides natural UX (pan to where you tapped).
  useEffect(() => {
    if (searchPin) {
      mapRef.current?.animateToRegion(
        {
          latitude: searchPin.lat,
          longitude: searchPin.lng,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        400
      );
    }
  }, [searchPin]);

  // Same bug, different trigger: when new items enter the nearbyItems list,
  // the new Marker children don't paint until a camera event fires. Nudge
  // the camera with a small randomized offset so iOS doesn't dedupe
  // sequential identical calls. Triggered ONLY on nearbyItems.length change
  // (not on every radius tick) so a continuous slider stays smooth — the
  // nudge fires ~once per item crossing the radius boundary, not 60×/sec.
  useEffect(() => {
    if (searchPin) {
      mapRef.current?.animateCamera(
        {
          center: {
            latitude: searchPin.lat + (Math.random() * 0.00002 - 0.00001),
            longitude: searchPin.lng + (Math.random() * 0.00002 - 0.00001),
          },
        },
        { duration: 1 }
      );
    }
  }, [nearbyItems.length, searchPin]);

  const handleCampusChange = (campusId: string) => {
    setSelectedCampus(campusId);
    setSearchPin(null);
    const campus = CAMPUSES.find((c) => c.id === campusId) || CAMPUSES[0];
    mapRef.current?.animateToRegion({ latitude: campus.center.lat, longitude: campus.center.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
  };

  const handleRecenter = () => {
    const campus = CAMPUSES.find((c) => c.id === selectedCampus) || CAMPUSES[0];
    mapRef.current?.animateToRegion({ latitude: campus.center.lat, longitude: campus.center.lng, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 500);
  };

  const handleClaim = async (item_id: string) => {
    try {
      await apiFetch(`/api/listings/${item_id}/resolve`, { method: "PATCH" });
      updateItem(item_id, { resolved: true });
      setSelectedItem((prev: any) => prev?.item_id === item_id ? { ...prev, resolved: true } : prev);
    } catch (err) { console.error("Claim error:", err); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <ScreenHeader title="Map" showLogo rightIcon="settings-outline" onRightPress={() => router.push("/settings")} />

      {/* Filters row */}
      <View style={{ flexDirection: "row", paddingHorizontal: 12, paddingVertical: 6, gap: 6, alignItems: "center" }}>
        {/* Campus dropdown */}
        <TouchableOpacity
          style={[styles.campusChip, { backgroundColor: t.cardSolid, borderColor: t.cardBorder, flexDirection: "row", gap: 4 }]}
          onPress={() => setCampusPickerOpen(true)}
        >
          <Text style={[styles.campusChipText, { color: t.text }]}>{CAMPUSES.find((c: any) => c.id === selectedCampus)?.name || "Campus"}</Text>
          <Ionicons name="chevron-down" size={12} color={t.muted} />
        </TouchableOpacity>

        {/* Type toggle */}
        <TouchableOpacity onPress={() => { const c = ["all", "lost", "found"]; setListingTypeFilter(c[(c.indexOf(listingTypeFilter) + 1) % c.length]); }} style={[styles.campusChip, { backgroundColor: listingTypeFilter === "all" ? t.accent : LISTING_TYPE_COLORS[listingTypeFilter], borderColor: listingTypeFilter === "all" ? t.accent : LISTING_TYPE_COLORS[listingTypeFilter] }]}>
          <Text style={[styles.campusChipText, { color: "#fff" }]}>{listingTypeFilter === "all" ? "All" : LISTING_TYPE_LABELS[listingTypeFilter]}</Text>
        </TouchableOpacity>

        {/* Resolved toggle */}
        <TouchableOpacity onPress={() => setShowResolved((v) => !v)} style={[styles.campusChip, { backgroundColor: showResolved ? "#1f3527" : t.cardSolid, borderColor: showResolved ? "rgba(110,231,183,0.42)" : t.cardBorder }]}>
          <Text style={[styles.campusChipText, { color: showResolved ? "#6ee7b7" : t.muted }]}>Resolved</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={{ flex: 1, marginBottom: 80 }}>
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={{ flex: 1 }}
            initialRegion={currentRegion}
            onRegionChangeComplete={setCurrentRegion}
            onPress={handleMapPress}
          >
            {/* Campus center marker — red dot with label underneath, matches web */}
            <Marker
              key={`campus-${activeCampus.id}`}
              coordinate={{ latitude: activeCampus.center.lat, longitude: activeCampus.center.lng }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={false}
            >
              <View style={styles.campusMarker}>
                <View style={styles.campusMarkerDot} />
                <View style={styles.campusMarkerLabel}>
                  <Text style={styles.campusMarkerText}>{activeCampus.name}</Text>
                </View>
              </View>
            </Marker>

            {/* Item pins — only render when in radius */}
            {nearbyItems.map((item) => (
              <Marker
                key={item.item_id}
                coordinate={{ latitude: item._lat, longitude: item._lng }}
                pinColor={item.listing_type === "lost" ? "#4f46e5" : "#0891b2"}
                onPress={() => setSelectedItem(item)}
              />
            ))}
            {/* Search pin — distinct circle marker */}
            {searchPin && (
              <Marker
                key="search-pin"
                coordinate={{ latitude: searchPin.lat, longitude: searchPin.lng }}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: "#A84D48", borderWidth: 3, borderColor: "#fff" }} />
              </Marker>
            )}
            {searchPin && (
              <Circle
                center={{ latitude: searchPin.lat, longitude: searchPin.lng }}
                radius={feetToMeters(radius)}
                strokeColor="rgba(168,77,72,0.6)"
                fillColor="rgba(168,77,72,0.12)"
              />
            )}
          </MapView>

          {/* Recenter button */}
          <TouchableOpacity
            onPress={handleRecenter}
            style={[styles.recenterBtn, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}
            activeOpacity={0.7}
          >
            <Ionicons name="locate" size={20} color={t.accent} />
          </TouchableOpacity>

          {/* Tap hint */}
          {!searchPin && (
            <View style={styles.tapHint}>
              <Text style={styles.tapHintText}>Tap the map to search nearby items</Text>
            </View>
          )}

          {/* Bottom panel — radius slider + nearby items */}
          {searchPin && (
            <View style={[styles.panel, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
              {/* Radius control */}
              <View style={styles.radiusSection}>
                <View style={styles.radiusHeader}>
                  <Ionicons name="funnel" size={14} color={t.accent} />
                  <Text style={[styles.radiusTitle, { color: t.text }]}>Search Radius</Text>
                  <Text style={[styles.radiusValue, { color: t.accent }]}>{radius}ft</Text>
                  <TouchableOpacity onPress={() => setSearchPin(null)} style={{ marginLeft: "auto" }}>
                    <Ionicons name="close" size={18} color={t.muted} />
                  </TouchableOpacity>
                </View>
                <Slider
                  style={{ width: "100%", height: 30 }}
                  minimumValue={RADIUS_MIN}
                  maximumValue={RADIUS_MAX}
                  step={1}
                  value={radius}
                  onValueChange={(v: number) => setRadius(Math.round(v))}
                  minimumTrackTintColor={t.accent}
                  maximumTrackTintColor={t.inputBorder}
                  thumbTintColor={t.accent}
                />
                <View style={styles.radiusLabels}>
                  <Text style={[styles.radiusLabel, { color: t.muted }]}>{RADIUS_MIN}ft</Text>
                  <Text style={[styles.radiusLabel, { color: t.muted }]}>{RADIUS_MAX}ft</Text>
                </View>
              </View>

              {/* Item count + Show/Hide results toggle */}
              <TouchableOpacity onPress={toggleResults} activeOpacity={0.7} style={styles.resultsToggle}>
                <Text style={[styles.itemCount, { color: t.subtext, marginBottom: 0 }]}>
                  {nearbyItems.length} item{nearbyItems.length !== 1 ? "s" : ""} within {radius}ft
                </Text>
                <View style={styles.resultsToggleRight}>
                  <Text style={[styles.resultsToggleText, { color: t.accent }]}>
                    {resultsExpanded ? "Hide" : "Show results"}
                  </Text>
                  <Ionicons name={resultsExpanded ? "chevron-down" : "chevron-up"} size={14} color={t.accent} />
                </View>
              </TouchableOpacity>

              {resultsExpanded && (
                <View style={{ height: 160, marginTop: 8 }}>
                  {nearbyItems.length === 0 ? (
                    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                      <Text style={{ color: t.muted, fontSize: 13 }}>No items in this area</Text>
                    </View>
                  ) : (
                    <ScrollView showsVerticalScrollIndicator={false}>
                      {nearbyItems.map((item) => (
                        <TouchableOpacity key={item.item_id} activeOpacity={0.7} onPress={() => setSelectedItem(item)}
                          style={[styles.nearbyItem, { borderBottomColor: t.separator }]}>
                          {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.nearbyImage} />
                          ) : (
                            <View style={[styles.nearbyImagePlaceholder, { backgroundColor: t.inputBg }]}>
                              <Text>📦</Text>
                            </View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.nearbyTitle, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
                            <Text style={[styles.nearbyMeta, { color: t.subtext }]} numberOfLines={1}>
                              {item.locations?.name || "Unknown"}
                            </Text>
                            <Text style={[styles.nearbyDate, { color: t.muted }]}>{formatRelativeDate(item.date, timezone)}</Text>
                          </View>
                          <View style={styles.nearbyBadges}>
                            <View style={[styles.badge, { backgroundColor: (IMPORTANCE_COLORS[item.importance] || "#888") + "22" }]}>
                              <Text style={[styles.badgeText, { color: IMPORTANCE_COLORS[item.importance] || "#888" }]}>{IMPORTANCE_LABELS[item.importance] || ""}</Text>
                            </View>
                            {item.listing_type && (
                              <View style={[styles.badge, { backgroundColor: (LISTING_TYPE_COLORS[item.listing_type] || "#888") + "22" }]}>
                                <Text style={[styles.badgeText, { color: LISTING_TYPE_COLORS[item.listing_type] || "#888" }]}>{LISTING_TYPE_LABELS[item.listing_type] || ""}</Text>
                              </View>
                            )}
                          </View>
                          <Ionicons name="chevron-forward" size={16} color={t.muted} />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>
              )}
            </View>
          )}
      </View>

      <ItemDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} onClaim={handleClaim} onReport={(item) => setReportItem(item)} />

      <ReportModal
        visible={!!reportItem}
        onClose={() => setReportItem(null)}
        type="post"
        targetId={reportItem?.item_id || ""}
        targetLabel={reportItem?.title || ""}
      />
      <PickerModal
        visible={campusPickerOpen}
        onClose={() => setCampusPickerOpen(false)}
        title="Campus"
        options={CAMPUSES.map((c: any) => ({ label: `${c.name}, ${c.state}`, value: c.id }))}
        selected={selectedCampus}
        onSelect={(v) => { handleCampusChange(v); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  campusScroll: { maxHeight: 42, flexGrow: 0 },
  campusContainer: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  campusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  campusChipText: { fontWeight: "700", fontSize: 12 },
  tapHint: { position: "absolute", bottom: 16, alignSelf: "center", backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  tapHintText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  recenterBtn: { position: "absolute", top: 12, right: 12, width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  // Panel
  panel: { position: "absolute", bottom: 0, left: 0, right: 0, borderWidth: 1, borderBottomWidth: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, overflow: "hidden" },
  radiusSection: { marginBottom: 8 },
  radiusHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  radiusTitle: { fontWeight: "800", fontSize: 14 },
  radiusValue: { fontWeight: "800", fontSize: 14, marginLeft: 6 },
  radiusLabels: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
  radiusLabel: { fontSize: 11 },
  itemCount: { fontWeight: "700", fontSize: 12, marginBottom: 6 },
  resultsToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  resultsToggleRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  resultsToggleText: { fontWeight: "800", fontSize: 12 },
  // Campus center marker — mirrors my-app/src/pages/MapPage.jsx:buildCampusMarkerEl
  campusMarker: { alignItems: "center" },
  campusMarkerDot: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#CC0000", borderWidth: 2, borderColor: "#fff" },
  campusMarkerLabel: { marginTop: 3, backgroundColor: "rgba(204,0,0,0.85)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  campusMarkerText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  // Nearby items
  nearbyItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 10 },
  nearbyImage: { width: 40, height: 40, borderRadius: 8 },
  nearbyImagePlaceholder: { width: 40, height: 40, borderRadius: 8, justifyContent: "center", alignItems: "center" },
  nearbyTitle: { fontWeight: "800", fontSize: 13 },
  nearbyMeta: { fontSize: 11, fontWeight: "600", marginTop: 1 },
  nearbyDate: { fontSize: 10, marginTop: 1 },
  nearbyBadges: { alignItems: "flex-end", gap: 3 },
  badge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  badgeText: { fontSize: 9, fontWeight: "800" },
});
