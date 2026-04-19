import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import type { ExploreStackParamList, TabParamList } from "../navigation/tabTypes";
import { TabInlineBackButton } from "../components/ScreenBackBar";
import { firstPhotoPublicUrl, formatBusinessAddress } from "../lib/businessDisplay";
import { ratingParts } from "../lib/businessRatingDisplay";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { shadowCompat } from "../lib/rnWebStyleCompat";

type Props = CompositeScreenProps<
  NativeStackScreenProps<ExploreStackParamList, "ExploreMain">,
  CompositeScreenProps<BottomTabScreenProps<TabParamList, "Explore">, NativeStackScreenProps<RootStackParamList>>
>;

type Row = {
  id: string;
  name: string;
  description: string | null;
  subcategory?: string | null;
  tags?: string[] | null;
  status: string;
  address_line: string | null;
  rating_average?: number | null;
  rating_count?: number | null;
  estimated_cost_min_pesos?: number | null;
  estimated_cost_max_pesos?: number | null;
  best_visit_times?: string[] | null;
  categories: { slug: string; name: string } | null;
  municipalities: { id: string; name: string } | null;
  provinces: { name: string } | null;
  barangays: { name: string } | null;
  business_photos?: { storage_path: string; sort_order?: number | null }[] | null;
};

const categoryChips = [
  { id: "all", label: "All" },
  { id: "nature-adventure", label: "Nature & Adventure" },
  { id: "resorts-leisure", label: "Resort & Leisure" },
  { id: "food-dining", label: "Food & Dining" },
];

export function ExploreScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [rows, setRows] = useState<Row[]>([]);
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [natureSubcategory, setNatureSubcategory] = useState<"all" | "waterfalls-swimming" | "camping-sightseeing">("all");
  const [municipality, setMunicipality] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const searchInputRef = useRef<TextInput>(null);
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchWidthAnim = useRef(new Animated.Value(0)).current;
  const searchMaxWidth = useMemo(() => {
    // Header content has horizontal padding 20 (FlatList contentContainerStyle).
    // searchRow gap = 10, filterCircle width = 48.
    const pagePad = 20 * 2;
    const gap = 10;
    const filterBtn = 48;
    return Math.max(48, Math.floor(windowWidth - pagePad - gap - filterBtn));
  }, [windowWidth]);

  useFocusEffect(
    useCallback(() => {
      const slug = route.params?.categorySlug;
      if (slug) setCategory(slug);
    }, [route.params?.categorySlug]),
  );

  /** Distinct municipalities that actually have at least one approved listing (from same query as Explore list). */
  function municipalitiesFromRows(list: Row[]): { id: string; name: string }[] {
    const map = new Map<string, { id: string; name: string }>();
    for (const row of list) {
      const raw = row.municipalities as
        | { id: string; name: string }
        | { id: string; name: string }[]
        | null
        | undefined;
      const m = Array.isArray(raw) ? raw[0] : raw;
      if (m?.id && m.name) map.set(m.id, { id: m.id, name: m.name });
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setLoadError(
        "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in Expo → Environment variables for release builds, or apps/mobile/.env locally.",
      );
      setRows([]);
      setMunicipalities([]);
      setMunicipality("all");
      return;
    }
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id,name,description,subcategory,tags,status,address_line,rating_average,rating_count,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,categories(slug,name),municipalities(id,name),provinces(name),barangays(name),business_photos(storage_path,sort_order)",
      )
      .eq("status", "approved")
      .order("sort_order", { ascending: true, foreignTable: "business_photos" });
    if (!error && data) {
      setLoadError(null);
      const list = data as unknown as Row[];
      const munisList = municipalitiesFromRows(list);
      setRows(list);
      setMunicipalities(munisList);
      setMunicipality((prev) =>
        prev !== "all" && !munisList.some((m) => m.id === prev) ? "all" : prev,
      );
    } else {
      setLoadError(error?.message ?? "Could not load destinations.");
      setRows([]);
      setMunicipalities([]);
      setMunicipality("all");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const locationLabel =
    municipality === "all"
      ? "All municipalities"
      : municipalities.find((m) => m.id === municipality)?.name ?? "Municipality";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const catOk = category === "all" ? true : (r.categories?.slug ?? "") === category;
      const subOk =
        category !== "nature-adventure" || natureSubcategory === "all"
          ? true
          : String(r.subcategory ?? "") === natureSubcategory;
      const munOk = municipality === "all" ? true : (r.municipalities?.id ?? "") === municipality;
      const tags = Array.isArray(r.tags) ? r.tags : [];
      const tagsOk = !q || tags.some((t) => (t ?? "").toLowerCase().includes(q));
      const textOk =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.municipalities?.name ?? "").toLowerCase().includes(q);
      return catOk && subOk && munOk && (textOk || tagsOk);
    });

    // Requirement: when there's no category filter (All), arrange destinations alphabetically.
    if (category === "all") {
      return [...list].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      );
    }

    return list;
  }, [rows, category, natureSubcategory, municipality, search]);

  const listHeader = (
    <View style={{ paddingBottom: 8 }}>
      <View style={[styles.screenHead, { paddingTop: Math.max(insets.top, 8) }]}>
        <TabInlineBackButton />
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Explore</Text>
          <View style={styles.locRow}>
            <Ionicons name="location" size={18} color={colors.accentGreen} />
            <Text style={styles.locText}>{locationLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.searchRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchOpen ? "Close search" : "Search"}
          style={styles.searchHit}
          onPress={() => {
            const next = !searchOpen;
            setSearchOpen(next);
            if (next) {
              Animated.parallel([
                Animated.spring(searchAnim, { toValue: 1, useNativeDriver: true, friction: 9, tension: 90 }),
                Animated.timing(searchWidthAnim, { toValue: 1, duration: 220, useNativeDriver: false }),
              ]).start(() => searchInputRef.current?.focus());
            } else {
              searchInputRef.current?.blur();
              Animated.parallel([
                Animated.timing(searchAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
                Animated.timing(searchWidthAnim, { toValue: 0, duration: 180, useNativeDriver: false }),
              ]).start();
            }
          }}
        >
          <Animated.View
            style={[
              styles.searchMorph,
              {
                width: searchWidthAnim.interpolate({ inputRange: [0, 1], outputRange: [48, searchMaxWidth] }),
                opacity: 1,
                transform: [
                  { scale: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1] }) },
                ],
              },
            ]}
          >
            <Ionicons name="search-outline" size={20} color={colors.muted} />
            <Animated.View
              style={{
                flex: 1,
                marginLeft: 10,
                opacity: searchAnim,
                transform: [
                  { translateX: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) },
                ],
              }}
              pointerEvents={searchOpen ? "auto" : "none"}
            >
              <TextInput
                ref={searchInputRef}
                placeholder="Maghanap ng mga destinasyon…"
                placeholderTextColor={colors.muted}
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                returnKeyType="search"
              />
            </Animated.View>
          </Animated.View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filters"
          style={styles.filterCircle}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Ionicons name="options-outline" size={22} color={colors.white} />
        </Pressable>
      </View>

      {showFilters ? (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {categoryChips.map((chip) => (
              <Pressable
                key={chip.id}
                onPress={() => {
                  setCategory(chip.id);
                  if (chip.id !== "nature-adventure") setNatureSubcategory("all");
                }}
                style={[styles.chip, category === chip.id && styles.chipOn]}
              >
                <Text style={[styles.chipText, category === chip.id && styles.chipTextOn]}>{chip.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {category === "nature-adventure" ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.chipScroll, { paddingBottom: 8 }]}
            >
              {[
                { id: "all" as const, name: "All nature" },
                { id: "waterfalls-swimming" as const, name: "Waterfalls / Swimming" },
                { id: "camping-sightseeing" as const, name: "Camping / Sightseeing" },
              ].map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setNatureSubcategory(s.id)}
                  style={[styles.chipSm, natureSubcategory === s.id && styles.chipOn]}
                >
                  <Text style={[styles.chipTextSm, natureSubcategory === s.id && styles.chipTextOn]}>{s.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.chipScroll, { paddingBottom: 8 }]}
          >
            {[{ id: "all", name: "All towns" }, ...municipalities].map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMunicipality(m.id)}
                style={[styles.chipSm, municipality === m.id && styles.chipOn]}
              >
                <Text style={[styles.chipTextSm, municipality === m.id && styles.chipTextOn]}>{m.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

      {loadError ? (
        <View style={styles.configBanner}>
          <Ionicons name="warning-outline" size={20} color="#9a3412" />
          <Text style={styles.configBannerText}>{loadError}</Text>
        </View>
      ) : null}

      <Text style={styles.listHeading}>Popular Near You</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => {
          const photoUri = firstPhotoPublicUrl(item.business_photos);
          return (
          <Pressable
            style={styles.card}
            onPress={() => navigation.navigate("Detail", { id: item.id })}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.cardThumb} />
            ) : (
              <View style={[styles.cardThumb, styles.cardThumbEmpty]}>
                <Ionicons name="image-outline" size={28} color={colors.muted2} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
              </View>
              <Text style={styles.catLine}>{item.categories?.name ?? "Listing"}</Text>
              {(item.categories?.slug ?? "") === "nature-adventure" && item.subcategory ? (
                <Text style={styles.subcatLine}>
                  {item.subcategory === "waterfalls-swimming"
                    ? "Waterfalls / Swimming"
                    : item.subcategory === "camping-sightseeing"
                      ? "Camping / Sightseeing"
                      : item.subcategory}
                </Text>
              ) : null}
              <Text style={styles.cardMeta} numberOfLines={2}>
                {formatBusinessAddress(item)}
              </Text>
              <View style={styles.ratingRow}>
                {(() => {
                  const p = ratingParts(item.rating_average, item.rating_count);
                  if (p.kind === "new") {
                    return <Text style={styles.ratingSoft}>New</Text>;
                  }
                  return (
                    <>
                      <Text style={styles.ratingSoft}>{p.averageText}</Text>
                      <Ionicons name="star" size={14} color={colors.star} style={{ marginTop: 1 }} />
                      <Text style={styles.ratingSoft}>
                        {p.countText} rating{p.count === 1 ? "" : "s"}
                      </Text>
                    </>
                  );
                })()}
              </View>
            </View>
          </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>No destinations match your filters or search.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screenHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.navy,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  locText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  searchHit: {
    flex: 1,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
          boxShadow: "none",
        } as any)
      : null),
  },
  searchMorph: {
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.pageBg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
          boxShadow: "none",
        } as any)
      : null),
  },
  chipScroll: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  filterCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
  },
  chip: {
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.chipIdle,
  },
  chipOn: {
    backgroundColor: colors.primaryTeal,
  },
  chipText: {
    fontWeight: "600",
    color: colors.navy,
    fontSize: 13,
  },
  chipTextOn: {
    color: colors.white,
  },
  chipSm: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.chipIdle,
  },
  chipTextSm: {
    fontWeight: "600",
    color: colors.navy,
    fontSize: 12,
  },
  configBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#ffedd5",
    borderWidth: 1,
    borderColor: "#fdba74",
  },
  configBannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: "#9a3412",
    fontWeight: "600",
  },
  listHeading: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy,
    marginTop: 8,
    marginBottom: 4,
  },
  card: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowCompat({ opacity: 0.06, radius: 12, offsetY: 4, elevation: 2 }),
  },
  cardThumb: {
    width: 92,
    height: 92,
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  cardThumbEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "flex-start",
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    flex: 1,
  },
  catLine: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primaryTeal,
    marginTop: 4,
  },
  subcatLine: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.muted2,
    marginTop: 2,
  },
  cardMeta: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  ratingSoft: {
    fontWeight: "600",
    color: colors.muted2,
    letterSpacing: 0.1,
  },
  reviews: {
    color: colors.muted2,
    fontWeight: "500",
  },
  empty: {
    textAlign: "center",
    color: colors.muted,
    marginTop: 32,
    paddingHorizontal: 20,
  },
});
