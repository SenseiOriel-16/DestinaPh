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
import { ratingParts } from "../lib/businessRatingDisplay";
import { formatDistanceAway, haversineKm, type LatLng } from "../lib/geo";
import { getInterestSlugs } from "../lib/onboardingStorage";
import { supabase } from "../lib/supabase";
import { BrandAppIcon } from "../ui/BrandAppIcon";
import { colors } from "../theme/colors";
import { BookingNotificationBell } from "../components/BookingNotificationBell";
import { shadowCompat, textShadowCompat } from "../lib/rnWebStyleCompat";

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
  estimated_cost_min_pesos?: number | null;
  estimated_cost_max_pesos?: number | null;
  best_visit_times?: string[] | null;
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
  const [recommendedNear, setRecommendedNear] = useState<NearRow[]>([]);
  const [hasLocation, setHasLocation] = useState(false);
  const heroCtaPulse = useRef(new Animated.Value(1)).current;
  const useNativeDriver = Platform.OS !== "web";

  const categoryCardWidth = useMemo(() => {
    const inner = windowWidth - PAGE_HORIZONTAL_PAD - CATEGORY_GAP_TOTAL;
    return Math.max(96, Math.floor(inner / 3));
  }, [windowWidth]);

  const nearCardWidth = useMemo(() => Math.min(320, Math.max(260, windowWidth - 52)), [windowWidth]);
  const nearSnapGap = 14;

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
        "id,name,description,address_line,latitude,longitude,rating_average,rating_count,estimated_cost_min_pesos,estimated_cost_max_pesos,best_visit_times,categories(slug,name),municipalities(name),provinces(name),barangays(name),business_photos(storage_path,sort_order)",
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

  useFocusEffect(
    useCallback(() => {
      void loadRecommended();
    }, [loadRecommended]),
  );

  const heroTarget = recommendedNear[0];

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(heroCtaPulse, {
          toValue: 1.06,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(heroCtaPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [heroCtaPulse, useNativeDriver]);

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
        <BookingNotificationBell variant="inline" />
      </View>

      <View style={styles.hero} collapsable={false}>
        <Image source={HERO_BACKGROUND} style={styles.heroBg} resizeMode="cover" />
        <View style={[styles.heroOverlay, { pointerEvents: "box-none" }]}>
          <View style={[styles.heroTextWrap, { pointerEvents: "none" }]}>
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
                  <View style={styles.nearImgWrap}>
                    {uri ? (
                      <Image source={{ uri }} style={styles.nearImg} resizeMode="cover" />
                    ) : (
                      <View style={[styles.nearImg, styles.destImgEmpty]}>
                        <Ionicons name="image-outline" size={28} color={colors.muted2} />
                      </View>
                    )}

                    <View style={styles.nearRatingOverlay} pointerEvents="none">
                      {(() => {
                        const p = ratingParts(item.rating_average, item.rating_count);
                        if (p.kind === "new") {
                          return <Text style={styles.nearOverlayText}>New</Text>;
                        }
                        return (
                          <>
                            <Text style={styles.nearOverlayText}>{p.averageText}</Text>
                            <Ionicons name="star" size={13} color={colors.star} style={{ marginTop: 1 }} />
                            <Text style={styles.nearOverlayText}>
                              {p.count} rating{p.count === 1 ? "" : "s"}
                            </Text>
                          </>
                        );
                      })()}
                    </View>
                  </View>
                  <Text numberOfLines={2} style={styles.nearName}>
                    {item.name}
                  </Text>

                  <View style={styles.nearMunRow}>
                    <View style={styles.nearMunLeft}>
                      <Ionicons name="location-outline" size={14} color={colors.muted2} />
                      <Text numberOfLines={1} style={styles.nearMun}>
                        {mun}
                      </Text>
                    </View>
                    {distLabel ? (
                      <View style={styles.nearDistancePill}>
                        <Ionicons name="navigate-outline" size={13} color={colors.primaryTeal} />
                        <Text style={styles.nearDistanceText}>{distLabel}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      )}
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
    ...textShadowCompat({ color: "rgba(0,0,0,0.9)", offsetY: 1, radius: 6 }),
  },
  heroTitle: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "800",
    marginTop: 2,
    ...textShadowCompat({ color: "rgba(0,0,0,0.92)", offsetY: 2, radius: 12 }),
  },
  heroSub: {
    color: "#fff",
    fontSize: 14,
    marginTop: 6,
    fontWeight: "600",
    ...textShadowCompat({ color: "rgba(0,0,0,0.9)", offsetY: 1, radius: 8 }),
  },
  heroCta: {
    backgroundColor: colors.primaryTeal,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    ...shadowCompat({ opacity: 0.35, radius: 5, offsetY: 3, elevation: 6 }),
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
    ...shadowCompat({ opacity: 0.1, radius: 6, offsetY: 3, elevation: 3 }),
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
    ...shadowCompat({ opacity: 0.06, radius: 8, offsetY: 2, elevation: 2 }),
  },
  nearImg: {
    width: "100%",
    aspectRatio: 16 / 10,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  nearImgWrap: {
    position: "relative",
  },
  nearRatingOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.78)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.60)",
  },
  nearOverlayText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.navy,
  },
  nearName: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "800",
    color: colors.navy,
  },
  nearMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  nearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.pageBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nearPillTeal: {
    backgroundColor: "rgba(8,143,143,0.08)",
    borderColor: "rgba(8,143,143,0.18)",
  },
  nearPillStar: {
    backgroundColor: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.18)",
  },
  nearPillText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.navy,
  },
  nearPillTextTeal: {
    color: colors.primaryTeal,
  },
  nearMunRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  nearMunLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    paddingRight: 10,
  },
  nearMun: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted2,
  },
  nearDistancePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(8,143,143,0.08)",
    borderWidth: 1,
    borderColor: "rgba(8,143,143,0.18)",
  },
  nearDistanceText: {
    fontSize: 12.5,
    fontWeight: "800",
    color: colors.primaryTeal,
  },
  nearCost: { marginTop: 8, fontSize: 12.5, fontWeight: "800", color: colors.navy },
});
