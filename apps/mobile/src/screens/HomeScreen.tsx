import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  Animated,
  Easing,
  FlatList,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import type { HomeStackParamList, TabParamList } from "../navigation/tabTypes";
import { TabInlineBackButton } from "../components/ScreenBackBar";
import { HERO_BACKGROUND } from "../constants/heroBackground";
import { TRAVEL_CATEGORIES } from "../data/travelCategories";
import { firstPhotoPublicUrl, formatBusinessAddress } from "../lib/businessDisplay";
import { formatRatingPill } from "../lib/businessRatingDisplay";
import { formatDistanceAway, haversineKm, type LatLng } from "../lib/geo";
import { getInterestSlugs } from "../lib/onboardingStorage";
import { supabase } from "../lib/supabase";
import { BrandAppIcon } from "../ui/BrandAppIcon";
import { colors } from "../theme/colors";

type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "HomeMain">,
  CompositeScreenProps<BottomTabScreenProps<TabParamList, "Home">, NativeStackScreenProps<RootStackParamList>>
>;

type Featured = {
  id: string;
  name: string;
  description: string | null;
  address_line: string | null;
  rating_average?: number | null;
  rating_count?: number | null;
  municipalities: { name: string } | null;
  provinces: { name: string } | null;
  barangays: { name: string } | null;
  business_photos?: { storage_path: string; sort_order?: number | null }[] | null;
};

type NearRow = Featured & {
  categories: { slug: string; name: string } | null;
  latitude: number | string | null;
  longitude: number | string | null;
  distanceKm: number | null;
};

const PAGE_HORIZONTAL_PAD = 40;
const CATEGORY_GAP_TOTAL = 20;
const CATEGORY_CARD_HEIGHT = 148;

export function HomeScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const [featured, setFeatured] = useState<Featured[]>([]);
  const [recommendedNear, setRecommendedNear] = useState<NearRow[]>([]);
  const [hasLocation, setHasLocation] = useState(false);
  const heroCtaPulse = useRef(new Animated.Value(1)).current;

  const categoryCardWidth = useMemo(() => {
    const inner = windowWidth - PAGE_HORIZONTAL_PAD - CATEGORY_GAP_TOTAL;
    return Math.max(96, Math.floor(inner / 3));
  }, [windowWidth]);

  const nearCardWidth = useMemo(() => Math.min(320, Math.max(260, windowWidth - 52)), [windowWidth]);
  const nearSnapGap = 14;

  const loadFeatured = useCallback(async () => {
    const { data } = await supabase
      .from("businesses")
      .select(
        "id,name,description,address_line,rating_average,rating_count,municipalities(name),provinces(name),barangays(name),business_photos(storage_path,sort_order)",
      )
      .eq("status", "approved")
      .eq("is_featured", true)
      .order("sort_order", { ascending: true, foreignTable: "business_photos" })
      .limit(12);
    setFeatured((data as unknown as Featured[]) ?? []);
  }, []);

  const loadRecommended = useCallback(async () => {
    const slugs = await getInterestSlugs();
    if (!slugs.length) {
      setRecommendedNear([]);
      setHasLocation(false);
      return;
    }

    let userPos: LatLng | null = null;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === "granted") {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        userPos = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setHasLocation(true);
      } else {
        setHasLocation(false);
      }
    } catch {
      setHasLocation(false);
    }

    const { data } = await supabase
      .from("businesses")
      .select(
        "id,name,description,address_line,latitude,longitude,rating_average,rating_count,categories(slug,name),municipalities(name),provinces(name),barangays(name),business_photos(storage_path,sort_order)",
      )
      .eq("status", "approved")
      .order("sort_order", { ascending: true, foreignTable: "business_photos" });

    const rows = (data as unknown as Omit<NearRow, "distanceKm">[]) ?? [];
    const slugSet = new Set(slugs);
    const filtered = rows.filter((r) => slugSet.has(r.categories?.slug ?? ""));

    const withDist: NearRow[] = filtered.map((r) => {
      const lat = r.latitude != null && r.latitude !== "" ? Number(r.latitude) : NaN;
      const lng = r.longitude != null && r.longitude !== "" ? Number(r.longitude) : NaN;
      let distanceKm: number | null = null;
      if (userPos && Number.isFinite(lat) && Number.isFinite(lng)) {
        distanceKm = haversineKm(userPos, { latitude: lat, longitude: lng });
      }
      return { ...r, distanceKm };
    });

    withDist.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });

    setRecommendedNear(withDist.slice(0, 20));
  }, []);

  useEffect(() => {
    void loadFeatured();
  }, [loadFeatured]);

  useFocusEffect(
    useCallback(() => {
      void loadRecommended();
    }, [loadRecommended]),
  );

  const heroTarget = featured[0];

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(heroCtaPulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(heroCtaPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [heroCtaPulse]);

  return (
    <ScrollView
      style={[styles.page, { paddingTop: Math.max(insets.top, 18) }]}
      contentContainerStyle={{ paddingBottom: 28 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topRow}>
        <TabInlineBackButton />
        <View style={styles.brandRow}>
          <BrandAppIcon size={48} />
          <View style={styles.brandText}>
            <Text style={styles.brandName}>DestinaPH</Text>
            <Text style={styles.brandTag}>Discover Destinations. Plan Smarter.</Text>
          </View>
        </View>
        <Pressable style={styles.bell} hitSlop={8}>
          <Ionicons name="notifications-outline" size={22} color={colors.muted2} />
          <View style={styles.bellDot} />
        </Pressable>
      </View>

      <View style={styles.hero} collapsable={false}>
        <Image source={HERO_BACKGROUND} style={styles.heroBg} resizeMode="cover" />
        <View style={styles.heroOverlay} pointerEvents="box-none">
          <View style={styles.heroTextWrap} pointerEvents="none">
            <Text style={styles.heroEyebrow}>Discover the beauty of</Text>
            <Text style={styles.heroTitle}>Camarines Sur</Text>
            <Text style={styles.heroSub}>Explore top destinations near you!</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              heroTarget ? `Open ${heroTarget.name}` : "Explore destinations"
            }
            hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
            style={({ pressed }) => [styles.heroCtaWrap, pressed && { opacity: 0.9 }]}
            onPress={() =>
              heroTarget
                ? navigation.navigate("Detail", { id: heroTarget.id })
                : navigation.navigate("Explore")
            }
          >
            <Animated.View style={[styles.heroCta, { transform: [{ scale: heroCtaPulse }] }]}>
              <Text style={styles.heroCtaText}>Explore Now</Text>
            </Animated.View>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <Pressable onPress={() => navigation.navigate("Explore")}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>
      <View style={styles.categoryRow}>
        {TRAVEL_CATEGORIES.map((c) => (
          <Pressable
            key={c.slug}
            accessibilityRole="button"
            accessibilityLabel={`${c.label}. Open listings in this category.`}
            android_ripple={null}
            onPress={() =>
              navigation.navigate("Explore", { screen: "ExploreMain", params: { categorySlug: c.slug } })
            }
            style={({ pressed }) => [
              styles.categoryCardWrap,
              {
                width: categoryCardWidth,
                height: CATEGORY_CARD_HEIGHT,
              },
              Platform.OS === "ios" && pressed && styles.categoryCardPressed,
            ]}
          >
            <Image
              key={`cat-img-${c.slug}`}
              source={c.image}
              style={{
                width: categoryCardWidth,
                height: CATEGORY_CARD_HEIGHT,
              }}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </View>

      {recommendedNear.length > 0 && (
        <>
          <View style={styles.sectionHead}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.sectionTitle}>Recommended for you</Text>
              <Text style={styles.sectionSub}>
                {hasLocation
                  ? "Based on your interests and distance from you."
                  : "Based on your interests. Turn on location to see how far each place is."}
              </Text>
            </View>
            <Pressable onPress={() => navigation.navigate("Explore")} style={{ alignSelf: "flex-start" }}>
              <Text style={styles.viewAll}>View All</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={nearCardWidth + nearSnapGap}
            contentContainerStyle={{ gap: nearSnapGap, paddingRight: 8, paddingBottom: 4 }}
          >
            {recommendedNear.map((item) => {
              const uri = firstPhotoPublicUrl(item.business_photos);
              const mun = item.municipalities?.name?.trim() || "—";
              const distLabel =
                item.distanceKm != null ? formatDistanceAway(item.distanceKm) : hasLocation ? "" : null;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => navigation.navigate("Detail", { id: item.id })}
                  style={[styles.nearCard, { width: nearCardWidth }]}
                >
                  {uri ? (
                    <Image source={{ uri }} style={styles.nearImg} resizeMode="cover" />
                  ) : (
                    <View style={[styles.nearImg, styles.destImgEmpty]}>
                      <Ionicons name="image-outline" size={28} color={colors.muted2} />
                    </View>
                  )}
                  <Text numberOfLines={2} style={styles.nearName}>
                    {item.name}
                  </Text>
                  {distLabel ? <Text style={styles.nearDist}>{distLabel}</Text> : null}
                  <View style={styles.nearMunRow}>
                    <Ionicons name="location-outline" size={14} color={colors.primaryTeal} />
                    <Text numberOfLines={1} style={styles.nearMun}>
                      {mun}
                    </Text>
                  </View>
                  <View style={styles.nearRatingRow}>
                    <Ionicons name="star" size={13} color={colors.star} />
                    <Text style={styles.nearRatingText}>{formatRatingPill(item.rating_average, item.rating_count)}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}

      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>Featured Destinations</Text>
        <Pressable onPress={() => navigation.navigate("Explore")}>
          <Text style={styles.viewAll}>View All</Text>
        </Pressable>
      </View>
      <FlatList
        horizontal
        data={featured}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 14, paddingRight: 8 }}
        renderItem={({ item }) => {
          const uri = firstPhotoPublicUrl(item.business_photos);
          return (
          <Pressable onPress={() => navigation.navigate("Detail", { id: item.id })} style={styles.destCard}>
            {uri ? (
              <Image source={{ uri }} style={styles.destImg} resizeMode="cover" />
            ) : (
              <View style={[styles.destImg, styles.destImgEmpty]}>
                <Ionicons name="image-outline" size={22} color={colors.muted2} />
              </View>
            )}
            <Text numberOfLines={1} style={styles.destName}>
              {item.name}
            </Text>
            <Text numberOfLines={2} style={styles.destLoc}>
              {formatBusinessAddress(item)}
            </Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={colors.star} />
              <Text style={styles.ratingNum}>{formatRatingPill(item.rating_average, item.rating_count)}</Text>
            </View>
          </Pressable>
          );
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
    paddingHorizontal: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  brandText: {
    flex: 1,
  },
  brandName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.primaryTeal,
    letterSpacing: -0.3,
  },
  brandTag: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.white,
  },
  hero: {
    height: 220,
    borderRadius: 22,
    overflow: "hidden",
    marginBottom: 24,
    position: "relative",
    backgroundColor: "#0b3c5d",
  },
  heroBg: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
    elevation: 2,
  },
  heroTextWrap: {
    position: "absolute",
    left: 18,
    right: 18,
    bottom: 88,
  },
  heroCtaWrap: {
    position: "absolute",
    left: 18,
    bottom: 18,
    zIndex: 20,
    elevation: 20,
  },
  heroEyebrow: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
    textShadowColor: "rgba(0,0,0,0.92)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  heroSub: {
    color: "#fff",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  heroCta: {
    backgroundColor: colors.primaryTeal,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 6,
  },
  heroCtaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  sectionHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy,
  },
  sectionSub: {
    marginTop: 4,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 16,
  },
  viewAll: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primaryTeal,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 26,
  },
  categoryCardWrap: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  categoryCardPressed: {
    opacity: 0.88,
  },
  destCard: {
    width: 132,
  },
  destImg: {
    width: 132,
    aspectRatio: 16 / 10,
    borderRadius: 16,
    backgroundColor: colors.border,
  },
  destImgEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  destName: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "700",
    color: colors.navy,
  },
  destLoc: {
    fontSize: 12,
    color: colors.muted,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  ratingNum: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy,
  },
  nearCard: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  nearImg: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  nearName: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy,
  },
  nearDist: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryTeal,
  },
  nearMunRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  nearMun: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted2,
  },
  nearRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  nearRatingText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.navy,
  },
});
