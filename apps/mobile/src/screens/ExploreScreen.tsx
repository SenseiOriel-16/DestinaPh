import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import type { TabParamList } from "../navigation/MainTabs";
import { firstPhotoPublicUrl, formatBusinessAddress } from "../lib/businessDisplay";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Explore">,
  NativeStackScreenProps<RootStackParamList>
>;

type Row = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  address_line: string | null;
  categories: { slug: string; name: string } | null;
  municipalities: { id: string; name: string } | null;
  provinces: { name: string } | null;
  barangays: { name: string } | null;
  business_photos?: { storage_path: string; sort_order?: number | null }[] | null;
};

const categoryChips = [
  { id: "all", label: "All" },
  { id: "nature-adventure", label: "Nature & Adventure" },
  { id: "resorts-leisure", label: "Resorts & Leisure" },
  { id: "food-dining", label: "Food & Dining" },
];

export function ExploreScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [municipalities, setMunicipalities] = useState<{ id: string; name: string }[]>([]);
  const [category, setCategory] = useState<string>("all");
  const [municipality, setMunicipality] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showTownFilters, setShowTownFilters] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const slug = route.params?.categorySlug;
      if (slug) setCategory(slug);
    }, [route.params?.categorySlug]),
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id,name,description,status,address_line,categories(slug,name),municipalities(id,name),provinces(name),barangays(name),business_photos(storage_path,sort_order)",
      )
      .eq("status", "approved")
      .order("sort_order", { ascending: true, foreignTable: "business_photos" });
    if (!error && data) setRows(data as unknown as Row[]);
    const { data: munis } = await supabase.from("municipalities").select("id,name").order("name");
    setMunicipalities((munis as { id: string; name: string }[]) ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const locationLabel =
    municipality === "all"
      ? municipalities.find((m) => m.name.toLowerCase().includes("naga"))?.name ?? "Naga City"
      : municipalities.find((m) => m.id === municipality)?.name ?? "Town";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const catOk = category === "all" ? true : (r.categories?.slug ?? "") === category;
      const munOk = municipality === "all" ? true : (r.municipalities?.id ?? "") === municipality;
      const textOk =
        !q ||
        r.name.toLowerCase().includes(q) ||
        (r.description ?? "").toLowerCase().includes(q) ||
        (r.municipalities?.name ?? "").toLowerCase().includes(q);
      return catOk && munOk && textOk;
    });
  }, [rows, category, municipality, search]);

  const listHeader = (
    <View style={{ paddingBottom: 8 }}>
      <View style={[styles.screenHead, { paddingTop: Math.max(insets.top, 10) }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Explore</Text>
          <Pressable style={styles.locRow} onPress={() => setShowTownFilters((v) => !v)}>
            <Ionicons name="location" size={18} color={colors.accentGreen} />
            <Text style={styles.locText}>{locationLabel}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.muted2} />
          </Pressable>
        </View>
        <Pressable style={styles.iconBtn} hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color={colors.muted2} />
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.search}>
          <Ionicons name="search-outline" size={20} color={colors.muted} />
          <TextInput
            placeholder="Search destinations..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
        <Pressable
          style={styles.filterCircle}
          onPress={() => setShowTownFilters((s) => !s)}
          accessibilityLabel="Town filters"
        >
          <Ionicons name="options-outline" size={22} color={colors.white} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipScroll}
      >
        {categoryChips.map((chip) => (
          <Pressable
            key={chip.id}
            onPress={() => setCategory(chip.id)}
            style={[styles.chip, category === chip.id && styles.chipOn]}
          >
            <Text style={[styles.chipText, category === chip.id && styles.chipTextOn]}>{chip.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {showTownFilters && (
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
      )}

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
                <Ionicons name="heart-outline" size={22} color={colors.muted2} />
              </View>
              <Text style={styles.catLine}>{item.categories?.name ?? "Listing"}</Text>
              <Text style={styles.cardMeta} numberOfLines={2}>
                {formatBusinessAddress(item)}
              </Text>
              <Text style={styles.rating}>
                <Ionicons name="star" size={14} color={colors.star} />{" "}
                <Text style={styles.ratingStrong}>4.8</Text>
                <Text style={styles.reviews}> (120)</Text>
              </Text>
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
    alignItems: "flex-start",
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
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.pageBg,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 14,
    marginBottom: 12,
  },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.pageBg,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: colors.text,
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
    borderRadius: 999,
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
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.chipIdle,
  },
  chipTextSm: {
    fontWeight: "600",
    color: colors.navy,
    fontSize: 12,
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
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    justifyContent: "space-between",
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
  cardMeta: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
  },
  rating: {
    marginTop: 8,
    fontSize: 13,
    color: colors.text,
  },
  ratingStrong: {
    fontWeight: "700",
    color: colors.navy,
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
