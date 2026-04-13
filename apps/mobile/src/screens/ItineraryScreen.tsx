import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useItinerary } from "../context/ItineraryContext";
import { optimizeRouteOrder } from "../lib/routeOptimizer";
import { colors } from "../theme/colors";

type TabKey = "plan" | "optimized";

function formatSlot(index: number): string {
  const clock = (totalMins: number) => {
    const h24 = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    const am = h24 < 12;
    const h = ((h24 + 11) % 12) + 1;
    return `${h}:${m.toString().padStart(2, "0")} ${am ? "AM" : "PM"}`;
  };
  const start = 8 * 60 + index * 150;
  const end = start + 120;
  return `${clock(start)} – ${clock(end)}`;
}

function tripDateRange(): string {
  const a = new Date();
  const b = new Date(a);
  b.setDate(b.getDate() + 1);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  return `${a.toLocaleDateString("en-PH", opts)} – ${b.toLocaleDateString("en-PH", opts)}`;
}

export function ItineraryScreen() {
  const insets = useSafeAreaInsets();
  const { stops, removeStop, clear } = useItinerary();
  const [tab, setTab] = useState<TabKey>("plan");
  const [optimized, setOptimized] = useState<typeof stops | null>(null);
  const [stats, setStats] = useState<{ km: number; minutes: number } | null>(null);

  const ordered = optimized ?? stops;
  const showMap = tab === "optimized" && optimized != null && ordered.length > 0;

  const mapPreview = useMemo(() => {
    if (!showMap) return null;
    return (
      <View style={styles.map}>
        <View style={styles.routeLine} />
        {ordered.map((s, idx) => (
          <View
            key={s.id}
            style={[
              styles.pin,
              { left: `${10 + idx * 18}%`, top: `${20 + (idx % 3) * 18}%` },
            ]}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>{idx + 1}</Text>
          </View>
        ))}
      </View>
    );
  }, [ordered, showMap]);

  const runOptimize = () => {
    if (!stops.length) return;
    const points = stops.map((s, idx) => ({
      id: s.id,
      label: `${idx + 1}. ${s.name}`,
      latitude: s.latitude,
      longitude: s.longitude,
    }));
    const result = optimizeRouteOrder(points);
    setOptimized(
      result.ordered.map((p) => {
        const match = stops.find((s) => s.id === p.id)!;
        return match;
      }),
    );
    setStats({ km: result.totalDistanceKm, minutes: result.estimatedMinutes });
    setTab("optimized");
  };

  const fmtDur = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h <= 0) return `${m} min`;
    return `${h} hrs ${m} mins`;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      contentContainerStyle={{ paddingBottom: 28, paddingHorizontal: 20 }}
    >
      <Text style={[styles.kicker, { marginTop: Math.max(insets.top, 10) }]}>ITINERARY</Text>
      <Text style={styles.title}>Itinerary</Text>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("plan")} style={styles.tabHit}>
          <Text style={[styles.tabLabel, tab === "plan" && styles.tabLabelOn]}>My Plan</Text>
          {tab === "plan" && <View style={styles.tabLine} />}
        </Pressable>
        <Pressable onPress={() => setTab("optimized")} style={styles.tabHit}>
          <Text style={[styles.tabLabel, tab === "optimized" && styles.tabLabelOn]}>Optimized Route</Text>
          {tab === "optimized" && <View style={styles.tabLine} />}
        </Pressable>
      </View>

      {stops.length > 0 && (
        <View style={styles.tripCard}>
          <View style={styles.tripTop}>
            <View>
              <Text style={styles.tripTitle}>Trip itinerary</Text>
              <Text style={styles.tripDates}>{tripDateRange()}</Text>
            </View>
            <Pressable hitSlop={8}>
              <Ionicons name="create-outline" size={22} color={colors.muted2} />
            </Pressable>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{stops.length} Destinations</Text>
          </View>
        </View>
      )}

      <View style={styles.timelineWrap}>
        {ordered.map((s, idx) => (
          <View key={s.id} style={styles.timelineRow}>
            <View style={styles.timeCol}>
              {idx < ordered.length - 1 && <View style={styles.vline} />}
              <View style={styles.numBadge}>
                <Text style={styles.numText}>{idx + 1}</Text>
              </View>
            </View>
            <View style={styles.itemCard}>
              {s.photoUrl ? (
                <Image source={{ uri: s.photoUrl }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]}>
                  <Ionicons name="image-outline" size={22} color={colors.muted} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={styles.itemTop}>
                  <Text style={styles.placeName} numberOfLines={2}>
                    {s.name}
                  </Text>
                  <Pressable onPress={() => removeStop(s.id)} hitSlop={10}>
                    <Ionicons name="trash-outline" size={20} color={colors.muted2} />
                  </Pressable>
                </View>
                <Text style={styles.placeCat}>{s.categoryName ?? "Destination"}</Text>
                <Text style={styles.placeTime}>{formatSlot(idx)}</Text>
              </View>
              <Ionicons name="reorder-three" size={28} color={colors.muted} />
            </View>
          </View>
        ))}
      </View>

      {stats && (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Estimated Time</Text>
            <Text style={styles.statValue}>{fmtDur(stats.minutes)}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Distance</Text>
            <Text style={styles.statValue}>{stats.km.toFixed(1)} km</Text>
          </View>
        </View>
      )}

      <Pressable style={styles.optimize} onPress={runOptimize} disabled={!stops.length}>
        <Text style={styles.optimizeText}>Optimize Route</Text>
      </Pressable>

      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={16} color={colors.muted} />
        <Text style={styles.hint}>Using Modified A* Algorithm</Text>
      </View>

      <Pressable style={styles.clearBtn} onPress={() => { setOptimized(null); setStats(null); clear(); }}>
        <Text style={styles.clearTxt}>Clear itinerary</Text>
      </Pressable>

      {mapPreview}

      {!stops.length && (
        <Text style={styles.empty}>
          Add destinations from a destination detail screen to build your day plan.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    color: colors.primaryTeal,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.navy,
    marginTop: 4,
  },
  tabs: {
    flexDirection: "row",
    gap: 24,
    marginTop: 16,
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabHit: {
    paddingBottom: 10,
  },
  tabLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.muted2,
  },
  tabLabelOn: {
    color: colors.primaryTeal,
  },
  tabLine: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primaryTeal,
  },
  tripCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 20,
  },
  tripTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tripTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy,
  },
  tripDates: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
  },
  badge: {
    alignSelf: "flex-start",
    marginTop: 12,
    backgroundColor: "rgba(4, 120, 126, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryTealDeep,
  },
  timelineWrap: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "stretch",
    marginBottom: 4,
  },
  timeCol: {
    width: 36,
    alignItems: "center",
    marginRight: 10,
  },
  vline: {
    position: "absolute",
    top: 36,
    bottom: -8,
    width: 2,
    backgroundColor: colors.border,
    left: "50%",
    marginLeft: -1,
  },
  numBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  numText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  itemCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.chipIdle,
  },
  thumbPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  placeName: {
    fontWeight: "800",
    color: colors.navy,
    fontSize: 15,
    flex: 1,
  },
  placeCat: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  placeTime: {
    fontSize: 12,
    color: colors.muted2,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.chipIdle,
    borderRadius: 16,
    padding: 14,
  },
  statLabel: {
    color: colors.muted2,
    fontSize: 13,
    fontWeight: "600",
  },
  statValue: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy,
  },
  optimize: {
    marginTop: 18,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  optimizeText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    justifyContent: "center",
    marginTop: 10,
  },
  hint: {
    fontSize: 12,
    color: colors.muted,
  },
  clearBtn: {
    marginTop: 14,
    alignItems: "center",
    paddingVertical: 8,
  },
  clearTxt: {
    color: colors.primaryTeal,
    fontWeight: "700",
    fontSize: 14,
  },
  map: {
    marginTop: 18,
    height: 180,
    borderRadius: 18,
    backgroundColor: "#E9F6F4",
    borderWidth: 1,
    borderColor: "#CFEEE9",
    position: "relative",
    overflow: "hidden",
  },
  routeLine: {
    position: "absolute",
    left: "12%",
    right: "12%",
    top: "48%",
    height: 3,
    backgroundColor: colors.primaryTeal,
    borderRadius: 999,
  },
  pin: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  empty: {
    color: colors.muted,
    marginTop: 16,
    fontSize: 14,
    lineHeight: 20,
  },
});
