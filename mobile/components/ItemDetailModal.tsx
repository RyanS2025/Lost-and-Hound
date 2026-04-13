import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Modal, Image, Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useTimezone } from "../contexts/TimezoneContext";
import apiFetch from "../utils/apiFetch";
import { formatRelativeDate } from "../utils/timezone";
import { tapHaptic, successHaptic } from "../utils/haptics";

const IMPORTANCE_LABELS: Record<number, string> = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS: Record<number, string> = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };
const LISTING_TYPE_LABELS: Record<string, string> = { found: "Found", lost: "Lost" };
const LISTING_TYPE_COLORS: Record<string, string> = { found: "#0891b2", lost: "#4f46e5" };

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

function getItemCoords(item: any): { lat: number; lng: number } | null {
  if (item?._lat != null && item?._lng != null) return { lat: item._lat, lng: item._lng };
  if (item?.lat != null && item?.lng != null) return { lat: item.lat, lng: item.lng };
  if (item?.locations?.coordinates) return parseCoordinates(item.locations.coordinates);
  return null;
}

interface Props {
  item: any | null;
  onClose: () => void;
  onClaim?: (item_id: string) => void;
  onReport?: (item: any) => void;
}

export default function ItemDetailModal({ item, onClose, onClaim, onReport }: Props) {
  const { user } = useAuth();
  const { t } = useTheme();
  const { timezone } = useTimezone();
  const router = useRouter();

  if (!item) return null;

  const coords = getItemCoords(item);
  const isOwner = user?.id && item.poster_id === user.id;

  const handleMessage = async () => {
    tapHaptic();
    try {
      const result = await apiFetch("/api/conversations", {
        method: "POST",
        body: JSON.stringify({ listing_id: item.item_id, other_user_id: item.poster_id }),
      });
      onClose();
      router.push({ pathname: "/(tabs)/messages", params: { conversationId: result.id } });
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to start conversation.");
    }
  };

  return (
    <Modal visible={!!item} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}>
        <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 16 }}>
          <View style={[styles.card, { backgroundColor: t.cardSolid, borderColor: t.cardBorder }]}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Ionicons name="close-circle" size={30} color={t.muted} />
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
              <Text style={[styles.title, { color: t.text }]}>{item.title}</Text>

              <View style={styles.badgeRow}>
                {item.listing_type && (
                  <View style={[styles.badge, { backgroundColor: (LISTING_TYPE_COLORS[item.listing_type] || "#888") + "22", borderColor: (LISTING_TYPE_COLORS[item.listing_type] || "#888") + "44" }]}>
                    <Text style={[styles.badgeText, { color: LISTING_TYPE_COLORS[item.listing_type] }]}>{LISTING_TYPE_LABELS[item.listing_type]}</Text>
                  </View>
                )}
                <View style={[styles.badge, { backgroundColor: (IMPORTANCE_COLORS[item.importance] || "#888") + "22", borderColor: (IMPORTANCE_COLORS[item.importance] || "#888") + "44" }]}>
                  <Text style={[styles.badgeText, { color: IMPORTANCE_COLORS[item.importance] }]}>{IMPORTANCE_LABELS[item.importance]}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
                  <Text style={[styles.badgeText, { color: t.subtext }]}>{item.category}</Text>
                </View>
              </View>

              {item.image_url && <Image source={{ uri: item.image_url }} style={styles.image} />}

              <View style={[styles.infoCard, { backgroundColor: t.bg, borderColor: t.cardBorder }]}>
                <View style={styles.infoRow}>
                  <Ionicons name="location" size={18} color={t.accent} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: t.text }}>{item.locations?.name || "Unknown"}</Text>
                    {item.found_at ? <Text style={{ fontSize: 12, color: t.subtext, marginTop: 2 }}>{item.found_at}</Text> : null}
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: t.separator }]} />
                <View style={styles.infoRow}>
                  <Ionicons name="person" size={18} color={t.accent} />
                  <Text style={{ fontSize: 14, fontWeight: "600", color: t.text, flex: 1 }}>{item.poster_name || "Unknown"}</Text>
                  <Text style={{ fontSize: 12, color: t.muted }}>{formatRelativeDate(item.date, timezone)}</Text>
                </View>
              </View>

              {item.description ? (
                <View style={[styles.infoCard, { backgroundColor: t.bg, borderColor: t.cardBorder, marginTop: 10 }]}>
                  <Text style={{ fontSize: 15, lineHeight: 22, color: t.text }}>{item.description}</Text>
                </View>
              ) : null}

              {coords && (
                <View style={[styles.miniMapContainer, { borderColor: t.cardBorder }]}>
                  <MapView
                    style={styles.miniMap}
                    initialRegion={{ latitude: coords.lat, longitude: coords.lng, latitudeDelta: 0.003, longitudeDelta: 0.003 }}
                    scrollEnabled={false} zoomEnabled={false} rotateEnabled={false} pitchEnabled={false}
                  >
                    <Marker coordinate={{ latitude: coords.lat, longitude: coords.lng }} pinColor={t.accent} />
                  </MapView>
                </View>
              )}

              {/* Actions */}
              {item.resolved ? (
                <View style={styles.resolvedBanner}><Text style={styles.resolvedText}>This item has been resolved</Text></View>
              ) : isOwner ? (
                <TouchableOpacity style={styles.claimBtn} onPress={() => onClaim?.(item.item_id)}>
                  <Text style={styles.claimBtnText}>Mark as Returned</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.messageBtn, { backgroundColor: t.accent }]} onPress={handleMessage}>
                  <Ionicons name="chatbubble-outline" size={18} color="#fff" />
                  <Text style={styles.messageBtnText}>Message Poster</Text>
                </TouchableOpacity>
              )}

              {!isOwner && (
                <TouchableOpacity
                  style={[styles.reportBtn, { borderColor: t.cardBorder }]}
                  onPress={() => {
                    onClose();
                    setTimeout(() => onReport?.(item), 300);
                  }}
                >
                  <Ionicons name="flag-outline" size={16} color={t.muted} />
                  <Text style={{ color: t.muted, fontWeight: "600", fontSize: 13 }}>Report Post</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, maxHeight: "90%", borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  closeBtn: { position: "absolute", top: 12, right: 12, zIndex: 10 },
  content: { padding: 20, paddingTop: 16, paddingBottom: 24 },
  title: { fontSize: 24, fontWeight: "900" },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  image: { width: "100%", height: 220, borderRadius: 14, marginTop: 16 },
  infoCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginTop: 14 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 6 },
  miniMapContainer: { borderRadius: 14, overflow: "hidden", borderWidth: 1, height: 160, marginTop: 12 },
  miniMap: { width: "100%", height: "100%" },
  resolvedBanner: { backgroundColor: "#1f3527", borderRadius: 10, paddingVertical: 10, alignItems: "center", marginTop: 16 },
  resolvedText: { color: "#6ee7b7", fontWeight: "800", fontSize: 13 },
  claimBtn: { backgroundColor: "#16a34a", borderRadius: 14, paddingVertical: 16, alignItems: "center", marginTop: 16 },
  claimBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  messageBtn: { flexDirection: "row", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", gap: 8, marginTop: 16 },
  messageBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  reportBtn: { flexDirection: "row", borderRadius: 10, paddingVertical: 10, alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, marginTop: 10 },
});
