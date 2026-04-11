import { useState, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Modal, ActivityIndicator, Image, Alert, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import * as ImagePicker from "expo-image-picker";
import MapView, { Marker } from "react-native-maps";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import apiFetch from "../utils/apiFetch";
import { CAMPUSES } from "../constants/campuses";
import { successHaptic } from "../utils/haptics";

function parseCoordinates(coords: string | null): { lat: number; lng: number } | null {
  if (!coords) return null;
  // POINT(lng lat)
  const pointMatch = coords.match(/POINT\(([^ ]+) ([^ ]+)\)/);
  if (pointMatch) return { lat: parseFloat(pointMatch[2]), lng: parseFloat(pointMatch[1]) };
  // "42.3393° N 71.0893° W" format
  const degMatch = coords.match(/([\d.]+)°?\s*([NS])\s+([\d.]+)°?\s*([EW])/i);
  if (degMatch) {
    let lat = parseFloat(degMatch[1]);
    let lng = parseFloat(degMatch[3]);
    if (degMatch[2].toUpperCase() === "S") lat = -lat;
    if (degMatch[4].toUpperCase() === "W") lng = -lng;
    return { lat, lng };
  }
  // "lat, lng" format
  const parts = coords.split(",").map((s: string) => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { lat: parts[0], lng: parts[1] };
  return null;
}

const CATEGORIES = ["Husky Card", "Jacket", "Wallet/Purse", "Bag", "Keys", "Electronics", "Other"];
const IMPORTANCE_LABELS: Record<number, string> = { 1: "Low", 2: "Medium", 3: "High" };
const IMPORTANCE_COLORS: Record<number, string> = { 1: "#1d4ed8", 2: "#a16207", 3: "#b91c1c" };

interface Props {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: any) => void;
}

export default function CreatePostModal({ visible, onClose, onAdd }: Props) {
  const { profile } = useAuth();
  const { t } = useTheme();
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedCampus, setSelectedCampus] = useState(profile?.default_campus || "boston");
  const [listingType, setListingType] = useState<"found" | "lost">("found");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Other");
  const [locationId, setLocationId] = useState("");
  const [foundAt, setFoundAt] = useState("");
  const [importance, setImportance] = useState(2);
  const [description, setDescription] = useState("");
  const [image, setImage] = useState<{ uri: string; type: string; name: string } | null>(null);
  const [pin, setPin] = useState<{ lat: number; lng: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showBuildings, setShowBuildings] = useState(false);
  const [showPinMap, setShowPinMap] = useState(false);
  const [mapTouching, setMapTouching] = useState(false);

  const selectedBuilding = locations.find((l) => l.location_id === locationId);
  const valid = title.trim() && foundAt.trim() && description.trim() && locationId;

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const data = await apiFetch(`/api/locations?campus=${selectedCampus}`);
        setLocations(data || []);
      } catch (err) {
        console.error("Fetch locations error:", err);
      }
    })();
  }, [visible, selectedCampus]);

  const resetForm = () => {
    setTitle(""); setCategory("Other"); setLocationId(""); setFoundAt("");
    setImportance(2); setDescription(""); setImage(null); setPin(null);
    setListingType("found"); setSelectedCampus(profile?.default_campus || "boston");
    setShowBuildings(false); setShowPinMap(false);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        type: asset.mimeType || "image/jpeg",
        name: asset.fileName || `photo-${Date.now()}.jpg`,
      });
    }
  };

  const handleSubmit = async () => {
    if (!valid) return;
    setSubmitting(true);

    let image_url = null;

    if (image) {
      try {
        // Get signed upload URL
        const uploadData = await apiFetch("/api/upload-url", {
          method: "POST",
          body: JSON.stringify({
            filename: image.name,
            contentType: image.type,
            fileSize: 0, // Size check happens server-side
          }),
        });

        // Upload the image
        const response = await fetch(image.uri);
        const blob = await response.blob();
        const uploadRes = await fetch(uploadData.signedUrl, {
          method: "PUT",
          headers: { "Content-Type": image.type },
          body: blob,
        });

        if (uploadRes.ok) {
          const verify = await apiFetch("/api/verify-image", {
            method: "POST",
            body: JSON.stringify({ path: uploadData.path }),
          });
          if (verify?.valid) image_url = uploadData.publicUrl;
        }
      } catch (err) {
        console.error("Image upload error:", err);
      }
    }

    try {
      const data = await apiFetch("/api/listings", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          category,
          location_id: locationId,
          found_at: foundAt.trim(),
          importance,
          description: description.trim(),
          image_url,
          listing_type: listingType,
          lat: pin?.lat ?? null,
          lng: pin?.lng ?? null,
        }),
      });

      successHaptic();
      onAdd(data);
      onClose();
      resetForm();
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to create listing.");
    }
    setSubmitting(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 12 }}>
          <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: t.text }]}>
                Report {listingType === "found" ? "Found" : "Lost"} Item
              </Text>
              <TouchableOpacity onPress={() => { onClose(); resetForm(); }} hitSlop={12}>
                <Ionicons name="close-circle" size={28} color={t.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" scrollEnabled={!mapTouching}>
              {/* Found / Lost toggle */}
              <View style={styles.toggleRow}>
                <TouchableOpacity
                  style={[styles.toggleBtn, listingType === "found" && { backgroundColor: "#0891b2" }]}
                  onPress={() => setListingType("found")}
                >
                  <Text style={[styles.toggleText, listingType === "found" && { color: "#fff" }]}>I Found Something</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleBtn, listingType === "lost" && { backgroundColor: "#4f46e5" }]}
                  onPress={() => setListingType("lost")}
                >
                  <Text style={[styles.toggleText, listingType === "lost" && { color: "#fff" }]}>I Lost Something</Text>
                </TouchableOpacity>
              </View>

              {/* Title */}
              <Text style={[styles.label, { color: t.subtext }]}>Item Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, color: t.text, borderColor: t.inputBorder }]}
                value={title}
                onChangeText={(txt) => setTitle(txt.slice(0, 50))}
                placeholder="e.g. Black North Face Jacket"
                placeholderTextColor={t.muted}
                maxLength={50}
              />
              <Text style={[styles.charCount, { color: t.muted }]}>{title.length}/50</Text>

              {/* Campus */}
              <Text style={[styles.label, { color: t.subtext }]}>Campus</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 8 }}>
                {CAMPUSES.map((c: any) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => { setSelectedCampus(c.id); setLocationId(""); setPin(null); }}
                    style={[styles.chip, { backgroundColor: selectedCampus === c.id ? t.accent : t.inputBg, borderColor: selectedCampus === c.id ? t.accent : t.inputBorder }]}
                  >
                    <Text style={{ color: selectedCampus === c.id ? "#fff" : t.subtext, fontWeight: "700", fontSize: 12 }}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Category + Building */}
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: t.subtext }]}>Category</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.selectBtn, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
                    onPress={() => {
                      Alert.alert("Category", undefined, CATEGORIES.map((c) => ({
                        text: c, onPress: () => setCategory(c),
                      })));
                    }}
                  >
                    <Text style={{ color: t.text, fontSize: 14 }}>{category}</Text>
                    <Ionicons name="chevron-down" size={16} color={t.muted} />
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: t.subtext }]}>Building</Text>
                  <TouchableOpacity
                    style={[styles.input, styles.selectBtn, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}
                    onPress={() => setShowBuildings(true)}
                  >
                    <Text style={{ color: selectedBuilding ? t.text : t.muted, fontSize: 14 }} numberOfLines={1}>
                      {selectedBuilding?.name || "Select..."}
                    </Text>
                    <Ionicons name="chevron-down" size={16} color={t.muted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Pin map — shows after building is selected */}
              {/* Pin map toggle */}
              {!showPinMap ? (
                <TouchableOpacity
                  style={[styles.pinMapToggle, { borderColor: t.inputBorder }]}
                  onPress={() => setShowPinMap(true)}
                >
                  <Ionicons name="map-outline" size={18} color={t.muted} />
                  <Text style={{ color: t.muted, fontWeight: "600", fontSize: 13 }}>Drop a pin on the map (optional)</Text>
                </TouchableOpacity>
              ) : (() => {
                const campus = CAMPUSES.find((c: any) => c.id === selectedCampus) || CAMPUSES[0];
                const mapCenter = pin || { lat: campus.center.lat, lng: campus.center.lng };
                return (
                  <View
                    style={[styles.pinMapContainer, { borderColor: t.inputBorder }]}
                    onTouchStart={() => setMapTouching(true)}
                    onTouchEnd={() => setMapTouching(false)}
                    onTouchCancel={() => setMapTouching(false)}
                  >
                    <View style={styles.pinMapHeader}>
                      <Text style={[styles.pinMapLabel, { color: t.subtext }]}>
                        {pin ? "Hold and drag pin to adjust" : "Tap map to place pin"}
                      </Text>
                      <TouchableOpacity onPress={() => { setShowPinMap(false); setPin(null); }}>
                        <Ionicons name="close" size={18} color={t.muted} />
                      </TouchableOpacity>
                    </View>
                    <MapView
                      key={`${mapCenter.lat}-${mapCenter.lng}`}
                      style={styles.pinMap}
                      initialRegion={{
                        latitude: mapCenter.lat,
                        longitude: mapCenter.lng,
                        latitudeDelta: 0.003,
                        longitudeDelta: 0.003,
                      }}
                      scrollEnabled={true}
                      zoomEnabled={true}
                      rotateEnabled={false}
                      pitchEnabled={false}
                      onPress={(e) => {
                        const { latitude, longitude } = e.nativeEvent.coordinate;
                        setPin({ lat: latitude, lng: longitude });
                      }}
                    >
                      {pin && (
                        <Marker
                          coordinate={{ latitude: pin.lat, longitude: pin.lng }}
                          draggable
                          onDragEnd={(e) => setPin({ lat: e.nativeEvent.coordinate.latitude, lng: e.nativeEvent.coordinate.longitude })}
                          pinColor={t.accent}
                        />
                      )}
                    </MapView>
                  </View>
                );
              })()}

              {/* Found at */}
              <Text style={[styles.label, { color: t.subtext }]}>Specific Location</Text>
              <TextInput
                style={[styles.input, { backgroundColor: t.inputBg, color: t.text, borderColor: t.inputBorder }]}
                value={foundAt}
                onChangeText={(txt) => setFoundAt(txt.slice(0, 50))}
                placeholder="e.g. Second floor study area"
                placeholderTextColor={t.muted}
                maxLength={50}
              />
              <Text style={[styles.charCount, { color: t.muted }]}>{foundAt.length}/50</Text>

              {/* Description */}
              <Text style={[styles.label, { color: t.subtext }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: t.inputBg, color: t.text, borderColor: t.inputBorder }]}
                value={description}
                onChangeText={(txt) => setDescription(txt.slice(0, 250))}
                placeholder="Describe the item..."
                placeholderTextColor={t.muted}
                multiline
                maxLength={250}
              />
              <Text style={[styles.charCount, { color: t.muted }]}>{description.length}/250</Text>

              {/* Importance */}
              <Text style={[styles.label, { color: t.subtext }]}>
                Importance: <Text style={{ color: IMPORTANCE_COLORS[importance], fontWeight: "800" }}>{IMPORTANCE_LABELS[importance]}</Text>
              </Text>
              <Slider
                style={{ width: "100%", height: 30 }}
                minimumValue={1}
                maximumValue={3}
                step={1}
                value={importance}
                onValueChange={(v: number) => setImportance(v)}
                minimumTrackTintColor={IMPORTANCE_COLORS[importance]}
                maximumTrackTintColor={t.inputBorder}
                thumbTintColor={IMPORTANCE_COLORS[importance]}
              />

              {/* Image */}
              <Text style={[styles.label, { color: t.subtext }]}>Photo (optional)</Text>
              {image ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                  <TouchableOpacity onPress={() => setImage(null)} style={styles.imageRemoveBtn}>
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={[styles.imagePickerBtn, { borderColor: t.inputBorder }]} onPress={pickImage}>
                  <Ionicons name="camera-outline" size={24} color={t.muted} />
                  <Text style={{ color: t.muted, fontWeight: "600", fontSize: 13 }}>Add Photo</Text>
                </TouchableOpacity>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: t.accent, opacity: valid && !submitting ? 1 : 0.5 }]}
                onPress={handleSubmit}
                disabled={!valid || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>
                    {listingType === "found" ? "Report Found Item" : "Report Lost Item"}
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Building picker modal */}
          <Modal visible={showBuildings} animationType="fade" transparent>
            <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24 }}>
              <View style={[styles.buildingPicker, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <Text style={[{ fontSize: 16, fontWeight: "800", color: t.text }]}>Select Building</Text>
                  <TouchableOpacity onPress={() => setShowBuildings(false)}>
                    <Ionicons name="close" size={22} color={t.muted} />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 300 }}>
                  {locations.map((loc) => (
                    <TouchableOpacity
                      key={loc.location_id}
                      style={[styles.buildingItem, { borderBottomColor: t.separator }]}
                      onPress={() => {
                      setLocationId(loc.location_id);
                      setShowBuildings(false);
                      console.log("[CreatePost] Raw coordinates:", JSON.stringify(loc.coordinates), typeof loc.coordinates);
                      const coords = parseCoordinates(loc.coordinates);
                      console.log("[CreatePost] Parsed:", coords);
                      if (coords) {
                        setPin(coords);
                        setShowPinMap(true);
                      } else {
                        console.warn("[CreatePost] Failed to parse coordinates");
                      }
                    }}
                    >
                      <Text style={{ color: locationId === loc.location_id ? t.accent : t.text, fontWeight: locationId === loc.location_id ? "800" : "600", fontSize: 14 }}>
                        {loc.name}
                      </Text>
                      {locationId === loc.location_id && <Ionicons name="checkmark" size={18} color={t.accent} />}
                    </TouchableOpacity>
                  ))}
                  {locations.length === 0 && (
                    <Text style={{ color: t.muted, textAlign: "center", paddingVertical: 20 }}>No buildings for this campus</Text>
                  )}
                </ScrollView>
              </View>
            </View>
          </Modal>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, maxHeight: "95%", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingBottom: 8 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  content: { padding: 16, paddingTop: 4, gap: 4 },
  label: { fontWeight: "700", fontSize: 13, marginTop: 10, marginBottom: 4 },
  charCount: { fontSize: 11, textAlign: "right", marginTop: 2 },
  input: { borderRadius: 10, padding: 12, fontSize: 15, borderWidth: 1 },
  selectBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  textArea: { minHeight: 80, textAlignVertical: "top" },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  toggleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  toggleText: { fontWeight: "700", fontSize: 14, color: "#999" },
  imagePickerBtn: { borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", padding: 20, alignItems: "center", gap: 6 },
  imagePreviewContainer: { position: "relative" },
  imagePreview: { width: "100%", height: 180, borderRadius: 12 },
  imageRemoveBtn: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12 },
  pinMapToggle: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", padding: 14, marginTop: 8 },
  pinMapContainer: { borderRadius: 12, overflow: "hidden", borderWidth: 1, marginTop: 8 },
  pinMapHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 12, paddingTop: 8 },
  pinMapLabel: { fontSize: 11, fontWeight: "600" },
  pinMap: { width: "100%", height: 200 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  buildingPicker: { borderRadius: 16, borderWidth: 1, padding: 16 },
  buildingItem: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});
