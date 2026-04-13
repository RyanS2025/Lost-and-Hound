import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, RefreshControl, Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import ScreenHeader from "../../components/ScreenHeader";
import CreatePostModal from "../../components/CreatePostModal";
import ItemDetailModal from "../../components/ItemDetailModal";
import ReportModal from "../../components/ReportModal";
import PickerModal from "../../components/PickerModal";
import apiFetch from "../../utils/apiFetch";
import { useTheme } from "../../contexts/ThemeContext";
import { useTimezone } from "../../contexts/TimezoneContext";
import { CAMPUSES } from "../../constants/campuses";
import { formatRelativeDate } from "../../utils/timezone";

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
  if (item?.lat != null && item?.lng != null) return { lat: item.lat, lng: item.lng };
  if (item?.locations?.coordinates) return parseCoordinates(item.locations.coordinates);
  return null;
}

const CATEGORIES = ["All", "Husky Card", "Jacket", "Wallet/Purse", "Bag", "Keys", "Electronics", "Other"];
const IMPORTANCE_LABELS: Record<number, string> = { 3: "High", 2: "Medium", 1: "Low" };
const IMPORTANCE_COLORS: Record<number, string> = { 3: "#b91c1c", 2: "#a16207", 1: "#1d4ed8" };
const LISTING_TYPE_LABELS: Record<string, string> = { found: "Found", lost: "Lost" };
const LISTING_TYPE_COLORS: Record<string, string> = { found: "#0891b2", lost: "#4f46e5" };
const SORT_OPTIONS = ["Newest", "Oldest", "Most Important"];

export default function FeedScreen() {
  const router = useRouter();
  const { t } = useTheme();
  const { timezone } = useTimezone();
  const { user, profile } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("Newest");
  const [showResolved, setShowResolved] = useState(false);
  const [showMyPosts, setShowMyPosts] = useState(false);
  const [listingTypeFilter, setListingTypeFilter] = useState("all");
  const [selectedCampus, setSelectedCampus] = useState(profile?.default_campus || "boston");
  const [selected, setSelected] = useState<any | null>(null);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [reportItem, setReportItem] = useState<any | null>(null);
  const [pickerOpen, setPickerOpen] = useState<"category" | "campus" | "sort" | null>(null);

  const fetchItems = useCallback(async (page = 1, append = false) => {
    if (page === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      if (page === 1) await apiFetch("/api/listings/cleanup", { method: "POST" }).catch(() => {});
      const result = await apiFetch(`/api/listings?page=${page}&limit=10`);
      const newItems = result?.data || [];
      setItems((prev) => append ? [...prev, ...newItems] : newItems);
      setHasMore(result?.hasMore ?? false);
      setCurrentPage(page);
    } catch (err) {
      console.error("Fetch listings error:", err);
    }
    setLoading(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchItems(1, false);
    setRefreshing(false);
  }, [fetchItems]);

  const loadMore = useCallback(() => {
    if (hasMore && !loadingMore) fetchItems(currentPage + 1, true);
  }, [hasMore, loadingMore, currentPage, fetchItems]);

  const filtered = useMemo(() => {
    return items
      .filter((i) => selectedCampus === "all" || i.locations?.campus === selectedCampus)
      .filter((i) => showResolved || !i.resolved)
      .filter((i) => !showMyPosts || (user?.id && i.poster_id === user.id))
      .filter((i) => category === "All" || i.category === category)
      .filter((i) => listingTypeFilter === "all" || i.listing_type === listingTypeFilter)
      .filter((i) =>
        i.title?.toLowerCase().includes(search.toLowerCase()) ||
        i.locations?.name?.toLowerCase().includes(search.toLowerCase()) ||
        i.description?.toLowerCase().includes(search.toLowerCase())
      )
      .sort((a: any, b: any) => {
        if (sort === "Newest") return new Date(b.date).getTime() - new Date(a.date).getTime();
        if (sort === "Oldest") return new Date(a.date).getTime() - new Date(b.date).getTime();
        if (sort === "Most Important") return b.importance - a.importance;
        return 0;
      });
  }, [items, selectedCampus, showResolved, showMyPosts, category, listingTypeFilter, search, sort, user?.id]);

  const handleClaim = async (item_id: string) => {
    try {
      await apiFetch(`/api/listings/${item_id}/resolve`, { method: "PATCH" });
      setItems((prev) => prev.map((i) => (i.item_id === item_id ? { ...i, resolved: true } : i)));
      setSelected((prev: any) => prev?.item_id === item_id ? { ...prev, resolved: true } : prev);
    } catch (err) { console.error("Claim error:", err); }
  };

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity activeOpacity={0.7} onPress={() => setSelected(item)}>
      <View style={[styles.card, { backgroundColor: t.card, borderColor: t.cardBorder }]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            {item.image_url ? (
              <Image source={{ uri: item.image_url }} style={styles.cardImage} />
            ) : (
              <View style={[styles.cardImagePlaceholder, { backgroundColor: t.inputBg }]}>
                <Text style={{ fontSize: 20 }}>📦</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.titleRow}>
                <Text style={[styles.cardTitle, { color: t.text }]} numberOfLines={1}>{item.title}</Text>
                {item.listing_type && (
                  <View style={[styles.badge, { backgroundColor: (LISTING_TYPE_COLORS[item.listing_type] || "#888") + "22", borderColor: (LISTING_TYPE_COLORS[item.listing_type] || "#888") + "44" }]}>
                    <Text style={[styles.badgeText, { color: LISTING_TYPE_COLORS[item.listing_type] || "#888" }]}>{LISTING_TYPE_LABELS[item.listing_type] || item.listing_type}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.cardLocation, { color: t.subtext }]} numberOfLines={1}>{item.locations?.name || "Unknown"} · {item.found_at || ""}</Text>
              <Text style={[styles.cardMeta, { color: t.muted }]}>{item.poster_name || "Unknown"} · {formatRelativeDate(item.date, timezone)}</Text>
            </View>
          </View>
          <View style={styles.cardBadges}>
            <View style={[styles.badge, { backgroundColor: (IMPORTANCE_COLORS[item.importance] || "#888") + "22", borderColor: (IMPORTANCE_COLORS[item.importance] || "#888") + "44" }]}>
              <Text style={[styles.badgeText, { color: IMPORTANCE_COLORS[item.importance] || "#888" }]}>{IMPORTANCE_LABELS[item.importance] || ""}</Text>
            </View>
            <Text style={[styles.categoryLabel, { color: t.muted }]}>{item.category}</Text>
          </View>
        </View>
        {item.description ? <Text style={[styles.cardDesc, { color: t.subtext }]} numberOfLines={2}>{item.description}</Text> : null}
        {item.resolved && <View style={styles.resolvedBanner}><Text style={styles.resolvedText}>Resolved</Text></View>}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={["top"]}>
      <ScreenHeader title="Feed" showLogo rightIcon="settings-outline" onRightPress={() => router.push("/settings")} />

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
          <Ionicons name="search" size={18} color={t.muted} />
          <TextInput style={[styles.searchInput, { color: t.text }]} placeholder="Search items, locations..." placeholderTextColor={t.muted} value={search} onChangeText={(txt) => setSearch(txt.slice(0, 200))} maxLength={200} />
        </View>
      </View>

      {/* Dropdown pickers row */}
      <View style={[styles.pickerRow, { borderBottomColor: t.separator }]}>
        <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: t.card, borderColor: t.cardBorder }]} onPress={() => setPickerOpen("category")}>
          <Text style={[styles.pickerBtnText, { color: t.text }]} numberOfLines={1}>{category}</Text>
          <Ionicons name="chevron-down" size={14} color={t.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: t.card, borderColor: t.cardBorder }]} onPress={() => setPickerOpen("campus")}>
          <Text style={[styles.pickerBtnText, { color: t.text }]} numberOfLines={1}>{selectedCampus === "all" ? "All" : CAMPUSES.find((c: any) => c.id === selectedCampus)?.name || "Campus"}</Text>
          <Ionicons name="chevron-down" size={14} color={t.muted} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: t.card, borderColor: t.cardBorder }]} onPress={() => setPickerOpen("sort")}>
          <Text style={[styles.pickerBtnText, { color: t.text }]} numberOfLines={1}>{sort}</Text>
          <Ionicons name="chevron-down" size={14} color={t.muted} />
        </TouchableOpacity>
      </View>

      {/* Toggle filters row */}
      <View style={[styles.filterRow, { borderBottomColor: t.separator }]}>
        <Text style={[styles.itemCount, { color: t.subtext }]}>{filtered.length} item{filtered.length !== 1 ? "s" : ""}</Text>
        <View style={{ flexDirection: "row", gap: 6 }}>
          <TouchableOpacity onPress={() => { const c = ["all", "lost", "found"]; setListingTypeFilter(c[(c.indexOf(listingTypeFilter) + 1) % c.length]); }} style={[styles.filterChip, { backgroundColor: listingTypeFilter === "all" ? t.accent : LISTING_TYPE_COLORS[listingTypeFilter] }]}>
            <Text style={styles.filterChipText}>{listingTypeFilter === "all" ? "All" : LISTING_TYPE_LABELS[listingTypeFilter]}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowMyPosts((v) => !v)} style={[styles.filterChip, { backgroundColor: showMyPosts ? "#2a2520" : t.cardSolid, borderWidth: 1, borderColor: showMyPosts ? "rgba(245,158,11,0.5)" : t.cardBorder }]}>
            <Text style={[styles.filterChipText, { color: showMyPosts ? "#f6c66a" : t.muted }]}>Mine</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowResolved((v) => !v)} style={[styles.filterChip, { backgroundColor: showResolved ? "#1f3527" : t.cardSolid, borderWidth: 1, borderColor: showResolved ? "rgba(110,231,183,0.42)" : t.cardBorder }]}>
            <Text style={[styles.filterChipText, { color: showResolved ? "#6ee7b7" : t.muted }]}>Resolved</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={t.accent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.item_id}
          renderItem={renderItem}
          contentContainerStyle={[styles.listContent, { paddingBottom: 90 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.accent} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListFooterComponent={hasMore ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              {loadingMore ? <ActivityIndicator size="small" color={t.accent} /> : <Text style={{ color: t.muted, fontSize: 13 }}>Pull up for more</Text>}
            </View>
          ) : null}
          ListEmptyComponent={<View style={styles.centered}><Text style={[styles.emptyText, { color: t.muted }]}>No items found.</Text></View>}
        />
      )}

      {/* Floating create button */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: t.accent }]}
        onPress={() => setShowCreatePost(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      <ItemDetailModal item={selected} onClose={() => setSelected(null)} onClaim={handleClaim} onReport={(item) => setReportItem(item)} />

      <ReportModal
        visible={!!reportItem}
        onClose={() => setReportItem(null)}
        type="post"
        targetId={reportItem?.item_id || ""}
        targetLabel={reportItem?.title || ""}
      />

      <CreatePostModal
        visible={showCreatePost}
        onClose={() => setShowCreatePost(false)}
        onAdd={(item) => setItems((prev) => [item, ...prev])}
      />

      <PickerModal
        visible={pickerOpen === "category"}
        onClose={() => setPickerOpen(null)}
        title="Category"
        options={CATEGORIES.map((c) => ({ label: c, value: c }))}
        selected={category}
        onSelect={setCategory}
      />
      <PickerModal
        visible={pickerOpen === "campus"}
        onClose={() => setPickerOpen(null)}
        title="Campus"
        options={[{ label: "All Campuses", value: "all" }, ...CAMPUSES.map((c: any) => ({ label: `${c.name}, ${c.state}`, value: c.id }))]}
        selected={selectedCampus}
        onSelect={setSelectedCampus}
      />
      <PickerModal
        visible={pickerOpen === "sort"}
        onClose={() => setPickerOpen(null)}
        title="Sort By"
        options={SORT_OPTIONS.map((s) => ({ label: s, value: s }))}
        selected={sort}
        onSelect={setSort}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: 22, fontWeight: "900" },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  searchRow: { paddingHorizontal: 16, paddingTop: 12 },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  chipScroll: { maxHeight: 44, marginTop: 10, flexGrow: 0 },
  chipContainer: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  chipText: { fontWeight: "800", fontSize: 13 },
  pickerRow: { flexDirection: "row", paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  pickerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  pickerBtnText: { fontSize: 13, fontWeight: "700" },
  filterRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  itemCount: { fontWeight: "700", fontSize: 13 },
  filterButtons: { flexDirection: "row", gap: 6 },
  filterChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  filterChipText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  listContent: { paddingHorizontal: 16, gap: 10, paddingTop: 8 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between" },
  cardHeaderLeft: { flexDirection: "row", flex: 1, gap: 12 },
  cardImage: { width: 44, height: 44, borderRadius: 10 },
  cardImagePlaceholder: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  cardTitle: { fontSize: 14, fontWeight: "800", flexShrink: 1 },
  cardLocation: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  cardMeta: { fontSize: 11, marginTop: 2 },
  cardBadges: { alignItems: "flex-end", gap: 4, marginLeft: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "800" },
  categoryLabel: { fontSize: 10, fontWeight: "700" },
  cardDesc: { fontSize: 13, marginTop: 10, lineHeight: 18 },
  resolvedBanner: { marginTop: 8, backgroundColor: "#1f3527", borderRadius: 8, paddingVertical: 6, alignItems: "center" },
  resolvedText: { color: "#6ee7b7", fontWeight: "800", fontSize: 12 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
  emptyText: { fontWeight: "700", fontSize: 15 },
  fab: { position: "absolute", bottom: 100, right: 20, width: 56, height: 56, borderRadius: 28, justifyContent: "center", alignItems: "center", elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 6 },
});
