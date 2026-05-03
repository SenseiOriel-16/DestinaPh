import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FlashNotice } from "../components/FlashNotice";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Image,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { RootStackParamList } from "../../App";
import type { HomeStackParamList, TabParamList } from "../navigation/tabTypes";
import { useItinerary } from "../context/ItineraryContext";
import { type AccommodationItem, normalizeAccommodations } from "../lib/accommodations";
import { formatBusinessAddress, sortedPhotoPublicUrls } from "../lib/businessDisplay";
import { ratingParts, formatRatingSubtitle } from "../lib/businessRatingDisplay";
import { fetchBusinessDetailRow } from "../lib/businessesSelectCompat";
import { supabase } from "../lib/supabase";
import { trackListingIntentVisit } from "../lib/trackListingMetric";
import { shadowCompat } from "../lib/rnWebStyleCompat";
import { colors } from "../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPinPreview } from "../components/MapPinPreview";
import { openGoogleMapsDirections, openTurnByTurnNavigation } from "../lib/mapExternal";
import { recordVisitIntentAndStartConfirmation } from "../lib/visitConfirmation";
import {
  travelerPromoVisible,
  formatPromoUntilLabel,
  travelerPromoHeadlineText,
  travelerPromoBodyText,
  travelerPromoValidUntilIso,
} from "../lib/travelerPromo";
type Props = CompositeScreenProps<
  NativeStackScreenProps<HomeStackParamList, "Detail">,
  CompositeScreenProps<BottomTabScreenProps<TabParamList>, NativeStackScreenProps<RootStackParamList>>
>;

type BusinessRow = {
  name: string;
  description: string | null;
  short_description: string | null;
  subcategory?: string | null;
  address_line: string | null;
  latitude: number | null;
  longitude: number | null;
  closed_now?: boolean | null;
  fully_booked?: boolean | null;
  closed_reason?: string | null;
  advisory_text?: string | null;
  operating_variations_text?: string | null;
  promo_headline?: string | null;
  promo_body?: string | null;
  promo_valid_until?: string | null;
  tags: string[] | null;
  accommodations: unknown;
  entrance_fee_pesos: number | null;
  entrance_fee_day_pesos: number | null;
  entrance_fee_night_pesos: number | null;
  operating_day: boolean | null;
  operating_night: boolean | null;
  operating_hours_always_open?: boolean | null;
  operating_open_hour?: number | null;
  operating_open_meridiem?: string | null;
  operating_close_hour?: number | null;
  operating_close_meridiem?: string | null;
  pricing_text: string | null;
  municipalities: { name: string } | null;
  provinces: { name: string } | null;
  barangays: { name: string } | null;
  categories: { name: string } | null;
  business_photos: { storage_path: string; sort_order: number }[] | null;
};

function operatingHoursLine(row: BusinessRow): string | null {
  if (row.operating_hours_always_open === true) return "Always Open";
  const oh = row.operating_open_hour;
  const om = row.operating_open_meridiem;
  const ch = row.operating_close_hour;
  const cm = row.operating_close_meridiem;
  if (
    typeof oh === "number" &&
    typeof ch === "number" &&
    (om === "AM" || om === "PM") &&
    (cm === "AM" || cm === "PM") &&
    oh >= 1 &&
    oh <= 12 &&
    ch >= 1 &&
    ch <= 12
  ) {
    return `${oh} ${om} to ${ch} ${cm}`;
  }
  return null;
}

function entranceSummary(row: BusinessRow): string | null {
  const parts: string[] = [];
  if (row.operating_day && row.entrance_fee_day_pesos != null) {
    parts.push(`Daytime: ₱${row.entrance_fee_day_pesos.toLocaleString("en-PH")}`);
  }
  if (row.operating_night && row.entrance_fee_night_pesos != null) {
    parts.push(`Night: ₱${row.entrance_fee_night_pesos.toLocaleString("en-PH")}`);
  }
  if (parts.length) return parts.join(" · ");
  if (row.entrance_fee_pesos != null) {
    return `Entrance: ₱${row.entrance_fee_pesos.toLocaleString("en-PH")}`;
  }
  const pt = row.pricing_text?.trim();
  if (pt) return pt;
  return null;
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const la1 = (a.latitude * Math.PI) / 180;
  const la2 = (b.latitude * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export function DestinationDetailScreen({ route, navigation }: Props) {
  const { id } = route.params;
  const { width: screenW } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const reserveCtaPulse = useRef(new Animated.Value(1)).current;
  const useNativeDriver = Platform.OS !== "web";
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [accommodationsOpen, setAccommodationsOpen] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [entranceLine, setEntranceLine] = useState<string | null>(null);
  const [opHours, setOpHours] = useState<string | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<string | null>(null);
  const [bestTimes, setBestTimes] = useState<string[]>([]);
  const [accommodations, setAccommodations] = useState<AccommodationItem[]>([]);
  const [advisoryText, setAdvisoryText] = useState<string | null>(null);
  const [operatingVariations, setOperatingVariations] = useState<string | null>(null);
  const [promoHeadline, setPromoHeadline] = useState<string | null>(null);
  const [promoBody, setPromoBody] = useState<string | null>(null);
  const [promoValidUntil, setPromoValidUntil] = useState<string | null>(null);
  const [closedNow, setClosedNow] = useState(false);
  const [closedReasonText, setClosedReasonText] = useState<string | null>(null);
  const [closedAdvisoryModalVisible, setClosedAdvisoryModalVisible] = useState(false);
  const [fullyBooked, setFullyBooked] = useState(false);
  const [statusExpanded, setStatusExpanded] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [allowRes, setAllowRes] = useState(true);
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);
  const [ratingCount, setRatingCount] = useState(0);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [myStars, setMyStars] = useState<number | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [actionFlash, setActionFlash] = useState<string | null>(null);
  const clearActionFlash = useCallback(() => setActionFlash(null), []);

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(reserveCtaPulse, {
          toValue: 1.03,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
        Animated.timing(reserveCtaPulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [reserveCtaPulse, useNativeDriver]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    setClosedAdvisoryModalVisible(false);
    void (async () => {
      await supabase.rpc("track_business_metric", { target: id, metric: "view" });

      const { data, error } = await fetchBusinessDetailRow(supabase, id);

      if (error) {
        // eslint-disable-next-line no-console
        console.warn(
          "[DestinaPH] detail load:",
          error.message,
          (error as { code?: string; details?: string }).code,
          (error as { details?: string }).details,
        );
      }

      if (data) {
        const row = data as unknown as BusinessRow & {
          owner_id?: string;
          rating_average?: number | null;
          rating_count?: number | null;
          allow_reservations?: boolean | null;
        };
          setClosedNow(row.closed_now === true);
          setFullyBooked(row.fully_booked === true);
        setOwnerId(typeof row.owner_id === "string" ? row.owner_id : null);
        setAllowRes(row.allow_reservations !== false);
        const ra = row.rating_average;
        setRatingAvg(ra != null && !Number.isNaN(Number(ra)) ? Number(ra) : null);
        setRatingCount(Math.max(0, Math.floor(Number(row.rating_count ?? 0))));
        setTitle(row.name);
        const long = row.description?.trim() || "";
        const short = row.short_description?.trim() || "";
        if (long) {
          setDescription(long);
          setTagline(short && short !== long ? short : null);
        } else {
          setDescription(short);
          setTagline(null);
        }
        setAddress(formatBusinessAddress(row));
        setCategoryName(row.categories?.name ?? null);
        setSubcategory(typeof (row as any).subcategory === "string" ? String((row as any).subcategory) : null);
        setTags(Array.isArray(row.tags) ? row.tags : []);
        setLat(row.latitude);
        setLng(row.longitude);
        setImages(sortedPhotoPublicUrls(row.business_photos).slice(0, 5));
        setEntranceLine(entranceSummary(row));
        setOpHours(operatingHoursLine(row));
        const cmin = (row as any).estimated_cost_min_pesos;
        const cmax = (row as any).estimated_cost_max_pesos;
        if (typeof cmin === "number" && typeof cmax === "number" && cmin >= 0 && cmax >= cmin) {
          setEstimatedCost(`₱${cmin.toLocaleString("en-PH")}–₱${cmax.toLocaleString("en-PH")} / person`);
        } else {
          setEstimatedCost(null);
        }
        const bt = (row as any).best_visit_times;
        setBestTimes(Array.isArray(bt) ? bt.filter((x) => typeof x === "string") : []);
        setAccommodations(normalizeAccommodations(row.accommodations));
        const cr = (row as any).closed_reason;
        setClosedReasonText(typeof cr === "string" && cr.trim() ? String(cr) : null);
        setAdvisoryText(typeof (row as any).advisory_text === "string" ? String((row as any).advisory_text) : null);
        setOperatingVariations(
          typeof (row as any).operating_variations_text === "string" ? String((row as any).operating_variations_text) : null,
        );
        setPromoHeadline(travelerPromoHeadlineText((row as any).promo_headline));
        setPromoBody(travelerPromoBodyText((row as any).promo_body));
        setPromoValidUntil(travelerPromoValidUntilIso((row as any).promo_valid_until));

        if (row.closed_now === true) {
          setClosedAdvisoryModalVisible(true);
        }
      } else {
        setImages([]);
        setEntranceLine(null);
        setOpHours(null);
        setEstimatedCost(null);
        setBestTimes([]);
        setAccommodations([]);
        setClosedReasonText(null);
        setAdvisoryText(null);
        setOperatingVariations(null);
        setPromoHeadline(null);
        setPromoBody(null);
        setPromoValidUntil(null);
          setClosedNow(false);
          setFullyBooked(false);
        setOwnerId(null);
        setRatingAvg(null);
        setRatingCount(0);
      }
    })();
  }, [id]);

  const refreshDistance = useCallback(async () => {
    if (lat == null || lng == null) {
      setDistanceKm(null);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setDistanceKm(null);
      return;
    }
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const km = haversineKm(
        { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
        { latitude: lat, longitude: lng },
      );
      setDistanceKm(km);
    } catch {
      setDistanceKm(null);
    }
  }, [lat, lng]);

  useEffect(() => {
    void refreshDistance();
  }, [refreshDistance]);

  const loadFavorite = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setFavorited(false);
      return;
    }
    const { data } = await supabase
      .from("user_favorites")
      .select("id")
      .eq("user_id", session.user.id)
      .eq("business_id", id)
      .maybeSingle();
    setFavorited(Boolean(data));
  }, [id]);

  const loadMyRating = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const sid = session?.user?.id ?? null;
    setSessionUserId(sid);
    if (!sid) {
      setMyStars(null);
      return;
    }
    const { data } = await supabase
      .from("business_ratings")
      .select("stars")
      .eq("business_id", id)
      .eq("user_id", sid)
      .maybeSingle();
    setMyStars(typeof data?.stars === "number" ? data.stars : null);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadFavorite();
      void loadMyRating();
    }, [loadFavorite, loadMyRating]),
  );

  const submitRating = async (stars: number) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      Alert.alert("Ratings", "Sign in to rate this destination.");
      return;
    }
    if (ownerId && uid === ownerId) return;
    setRatingBusy(true);
    try {
      const { error } = await supabase.from("business_ratings").upsert(
        { business_id: id, user_id: uid, stars },
        { onConflict: "business_id,user_id" },
      );
      if (error) {
        Alert.alert("Ratings", error.message);
        return;
      }
      setMyStars(stars);
      setActionFlash("Thanks! Your rating was saved.");
      const { data: biz } = await supabase.from("businesses").select("rating_average, rating_count").eq("id", id).maybeSingle();
      if (biz) {
        const b = biz as { rating_average?: number | null; rating_count?: number | null };
        const ra = b.rating_average;
        setRatingAvg(ra != null && !Number.isNaN(Number(ra)) ? Number(ra) : null);
        setRatingCount(Math.max(0, Math.floor(Number(b.rating_count ?? 0))));
      }
    } finally {
      setRatingBusy(false);
    }
  };

  const removeRating = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      Alert.alert("Ratings", "Sign in to manage your rating.");
      return;
    }
    if (myStars == null) return;
    if (ownerId && uid === ownerId) return;

    Alert.alert("Remove rating?", "Your rating will be removed from this destination.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          void (async () => {
            setRatingBusy(true);
            try {
              const { error } = await supabase
                .from("business_ratings")
                .delete()
                .eq("business_id", id)
                .eq("user_id", uid);
              if (error) {
                Alert.alert("Ratings", error.message);
                return;
              }
              setMyStars(null);
              setActionFlash("Your rating was removed.");
              const { data: biz } = await supabase
                .from("businesses")
                .select("rating_average, rating_count")
                .eq("id", id)
                .maybeSingle();
              if (biz) {
                const b = biz as { rating_average?: number | null; rating_count?: number | null };
                const ra = b.rating_average;
                setRatingAvg(ra != null && !Number.isNaN(Number(ra)) ? Number(ra) : null);
                setRatingCount(Math.max(0, Math.floor(Number(b.rating_count ?? 0))));
              }
            } finally {
              setRatingBusy(false);
            }
          })();
        },
      },
    ]);
  };

  const toggleFavorite = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      Alert.alert("Favorites", "Sign in to save this place to your favorites.");
      return;
    }
    setFavoriteBusy(true);
    try {
      if (favorited) {
        const { error } = await supabase
          .from("user_favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("business_id", id);
        if (error) {
          Alert.alert("Favorites", error.message);
          return;
        }
        setFavorited(false);
        setActionFlash("Removed from favorites.");
      } else {
        const { error } = await supabase.from("user_favorites").insert({
          user_id: session.user.id,
          business_id: id,
        });
        if (error) {
          if (error.code === "23505") {
            setFavorited(true);
            setActionFlash("Saved to favorites.");
            return;
          }
          Alert.alert("Favorites", error.message);
          return;
        }
        setFavorited(true);
        setActionFlash("Saved to favorites.");
      }
    } finally {
      setFavoriteBusy(false);
    }
  };

  const openInAppMap = () => {
    if (lat == null || lng == null) return;
    const requiresOrder = (categoryName ?? "").toLowerCase().includes("food");
    void recordVisitIntentAndStartConfirmation({
      businessId: id,
      source: "in_app_map",
      categoryName,
      destLat: lat,
      destLng: lng,
      requireFoodOrder: requiresOrder,
    });
    navigation.navigate("DestinationMap", { title, destLat: lat, destLng: lng, businessId: id, categoryName });
  };

  const heroSlideW = screenW;
  const heroH = Math.min(Math.round(screenW * 0.78), 360);
  const aboutPreviewLen = 160;
  const aboutNeedsToggle = description.length > aboutPreviewLen;
  const aboutShown =
    aboutExpanded || !aboutNeedsToggle ? description : `${description.slice(0, aboutPreviewLen).trim()}…`;

  const mapPreview = lat != null && lng != null;
  const hasOwnerPromo = travelerPromoVisible(promoHeadline, promoValidUntil, promoBody);
  const closedNoticeBody = (closedReasonText?.trim() || advisoryText?.trim() || "").trim();

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / Math.max(heroSlideW, 1));
    setPhotoIndex(Math.min(Math.max(idx, 0), Math.max(images.length - 1, 0)));
  };

  return (
    <View style={styles.page}>
      <Modal
        visible={closedAdvisoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setClosedAdvisoryModalVisible(false)}
      >
        <View
          style={[styles.closedModalRoot, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityLabel="Dismiss"
            onPress={() => setClosedAdvisoryModalVisible(false)}
          />
          <View style={styles.closedModalCard}>
            <View style={styles.closedModalIconWrap}>
              <Ionicons name="close-circle" size={44} color={colors.danger} />
            </View>
            <Text style={styles.closedModalTitle}>Closed now</Text>
            <Text style={styles.closedModalSub}>This place is not welcoming guests at the moment.</Text>
            {closedNoticeBody ? (
              <View style={styles.closedModalReasonBox}>
                <Text style={styles.closedModalReasonText}>{closedNoticeBody}</Text>
              </View>
            ) : (
              <Text style={styles.closedModalNoReason}>No extra details were shared.</Text>
            )}
            <Pressable
              style={({ pressed }) => [styles.closedModalBtn, pressed && { opacity: 0.92 }]}
              onPress={() => setClosedAdvisoryModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Dismiss closed notice"
            >
              <Text style={styles.closedModalBtnTxt}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <ScrollView
        style={styles.mainScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 + tabBarHeight }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroHost, { height: heroH }]}>
          {images.length > 0 ? (
            <FlatList
              data={images}
              horizontal
              pagingEnabled
              nestedScrollEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={(uri, i) => `${uri}-${i}`}
              onMomentumScrollEnd={onPhotoScroll}
              getItemLayout={(_, index) => ({
                length: heroSlideW,
                offset: heroSlideW * index,
                index,
              })}
              snapToInterval={heroSlideW}
              snapToAlignment="start"
              decelerationRate="fast"
              removeClippedSubviews={false}
              renderItem={({ item: uri }) => (
                <View style={{ width: heroSlideW, height: heroH, backgroundColor: colors.border }}>
                  <Image source={{ uri }} style={{ width: heroSlideW, height: heroH }} resizeMode="cover" />
                </View>
              )}
            />
          ) : (
            <View style={[styles.heroEmpty, { width: heroSlideW, height: heroH }]}>
              <Ionicons name="image-outline" size={48} color={colors.muted2} />
              <Text style={styles.heroEmptyText}>No photos yet</Text>
            </View>
          )}

          {/** Removed floating CLOSED badge (Status chip already shows it). */}

          <View style={[styles.heroTopRow, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.heroIconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={24} color={colors.navy} />
            </Pressable>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable
                style={styles.heroIconBtn}
                onPress={() => void toggleFavorite()}
                disabled={favoriteBusy}
                accessibilityLabel={favorited ? "Remove favorite" : "Add favorite"}
              >
                <Ionicons
                  name={favorited ? "heart" : "heart-outline"}
                  size={22}
                  color={favorited ? colors.danger : colors.navy}
                />
              </Pressable>
            </View>
          </View>

          {images.length > 0 ? (
            <View style={styles.photoBadge}>
              <Ionicons name="images-outline" size={14} color={colors.navy} />
              <Text style={styles.photoBadgeText}>
                {photoIndex + 1}/{images.length}
              </Text>
            </View>
          ) : null}
        </View>

        <FlashNotice message={actionFlash} variant="success" onDismiss={clearActionFlash} />

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.ratingPill}>
              {(() => {
                const p = ratingParts(ratingAvg, ratingCount);
                if (p.kind === "new") {
                  return <Text style={styles.ratingText}>New</Text>;
                }
                return (
                  <>
                    <Text style={styles.ratingText}>{p.averageText}</Text>
                    <Ionicons name="star" size={14} color={colors.star} style={{ marginTop: 1 }} />
                    <Text style={styles.ratingText}>{p.countText}</Text>
                  </>
                );
              })()}
            </View>
          </View>
          <Text style={styles.ratingSub}>{formatRatingSubtitle(ratingAvg, ratingCount)}</Text>

          {hasOwnerPromo ? (
            <View style={styles.promoBox} accessibilityLabel="Promotional offer set by this business">
              {travelerPromoHeadlineText(promoHeadline) ? (
                <>
                  <View style={styles.promoHeaderRow}>
                    <Ionicons name="gift-outline" size={18} color={colors.primaryTeal} />
                    <Text style={styles.promoTitle}>{travelerPromoHeadlineText(promoHeadline)}</Text>
                  </View>
                  {travelerPromoBodyText(promoBody) ? (
                    <Text style={styles.promoBody}>{travelerPromoBodyText(promoBody)}</Text>
                  ) : null}
                </>
              ) : (
                <View style={styles.promoHeaderRow}>
                  <Ionicons name="gift-outline" size={18} color={colors.primaryTeal} />
                  <Text style={styles.promoTitle}>{travelerPromoBodyText(promoBody) ?? ""}</Text>
                </View>
              )}
              {promoValidUntil?.trim() ? (
                <Text style={styles.promoUntil}>Valid through {formatPromoUntilLabel(promoValidUntil.trim())}</Text>
              ) : null}
              <Text style={styles.promoFoot}>Shown as the owner entered it · confirm before you pay or travel.</Text>
            </View>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
            {categoryName ? (
              <View style={[styles.chip, styles.chipCategory]}>
                <Text style={styles.chipCategoryText}>{categoryName}</Text>
              </View>
            ) : null}
            {categoryName === "Nature & Adventure" && subcategory ? (
              <View style={[styles.chip, styles.chipSubcategory]}>
                <Text style={styles.chipSubcategoryText}>
                  {subcategory === "waterfalls-swimming"
                    ? "Waterfalls / Swimming"
                    : subcategory === "camping-sightseeing"
                      ? "Camping / Sightseeing"
                      : subcategory}
                </Text>
              </View>
            ) : null}
            {tags.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
          </ScrollView>

          {ownerId && sessionUserId && sessionUserId === ownerId ? (
            <Text style={styles.rateHintOwn}>Your listing — guests can leave star ratings here.</Text>
          ) : !sessionUserId ? (
            <Text style={styles.rateHint}>Sign in to leave a star rating for this place.</Text>
          ) : (
            <View style={styles.rateBlock}>
              <Text style={styles.sectionTitle}>Your rating</Text>
              <View style={styles.starRow}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => void submitRating(s)}
                    disabled={ratingBusy}
                    hitSlop={6}
                    accessibilityLabel={`${s} star${s === 1 ? "" : "s"}`}
                  >
                    <Ionicons
                      name={(myStars ?? 0) >= s ? "star" : "star-outline"}
                      size={30}
                      color={(myStars ?? 0) >= s ? colors.star : colors.muted2}
                    />
                  </Pressable>
                ))}
              </View>
              {myStars != null ? (
                <View style={styles.rateFoot}>
                  <Text style={styles.rateSaved}>Saved · tap another star to change</Text>
                  <Pressable
                    onPress={() => void removeRating()}
                    disabled={ratingBusy}
                    style={({ pressed }) => [styles.rateRemoveBtn, pressed && { opacity: 0.9 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Remove rating"
                  >
                    <Text style={styles.rateRemoveTxt}>Remove rating</Text>
                  </Pressable>
                </View>
              ) : (
                <Text style={styles.rateSaved}>Tap the stars to submit</Text>
              )}
            </View>
          )}

          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={18} color={colors.muted2} />
            <Text style={styles.locText}>{address || "Address not set"}</Text>
          </View>

          <View style={styles.locRow}>
            <Ionicons name="navigate-outline" size={18} color={colors.primaryTeal} />
            <Text style={styles.distText}>
              {distanceKm != null
                ? `${distanceKm < 10 ? distanceKm.toFixed(1) : Math.round(distanceKm)} km from you`
                : lat != null && lng != null
                  ? "Allow location to see distance"
                  : "Pin location not set by owner"}
            </Text>
          </View>

          {(() => {
            const cat = (categoryName ?? "").toLowerCase();
            const isFood = cat.includes("food");
            const isResort = cat.includes("resort");

            // Requirement:
            // - Food: show only "Estimated cost"
            // - Resort: show only "Entrance & fees"
            // Fallback: for other categories, show whatever is available.
            const showEntrance = isResort ? true : isFood ? false : Boolean(entranceLine);
            const showEstimated = isFood ? true : isResort ? false : Boolean(estimatedCost);

            return (
              <>
                {showEntrance && entranceLine ? (
                  <View style={styles.entranceBox}>
                    <View style={styles.entranceHeader}>
                      <Ionicons name="pricetag-outline" size={18} color={colors.primaryTeal} />
                      <Text style={styles.entranceTitle}>Entrance & fees</Text>
                    </View>
                    <Text style={styles.entranceText}>{entranceLine}</Text>
                  </View>
                ) : null}

                {opHours ? (
                  <Pressable
                    onPress={() => setStatusExpanded((v) => !v)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: statusExpanded }}
                    style={({ pressed }) => [styles.statusBox, pressed && { opacity: 0.96 }]}
                  >
                    <View style={styles.statusHeaderRow}>
                      <View style={styles.statusHeaderLeft}>
                        <Ionicons name="time-outline" size={18} color={colors.primaryTeal} />
                        <Text style={styles.entranceTitle}>Status</Text>
                        {closedNow ? (
                          <View style={styles.statusChipClosed}>
                            <Text style={styles.statusChipClosedText}>Closed now</Text>
                          </View>
                        ) : fullyBooked ? (
                          <View style={styles.statusChipBooked}>
                            <Text style={styles.statusChipBookedText}>Fully booked</Text>
                          </View>
                        ) : (
                          <View style={styles.statusChipOpen}>
                            <Text style={styles.statusChipOpenText}>Open</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.statusChevron}>
                        <Ionicons name={statusExpanded ? "chevron-down" : "chevron-up"} size={18} color={colors.muted2} />
                      </View>
                    </View>

                    {statusExpanded ? (
                      <>
                        <View style={styles.statusRow}>
                          <Text style={styles.statusLabel}>Hours</Text>
                          <Text style={styles.statusValue} numberOfLines={1}>
                            {opHours}
                          </Text>
                        </View>

                        {operatingVariations?.trim() ? (
                          <View style={[styles.statusRow, styles.statusRowBorder]}>
                            <Text style={styles.statusLabel}>Schedule</Text>
                            <Text style={styles.statusValue} numberOfLines={4}>
                              {operatingVariations.trim()}
                            </Text>
                          </View>
                        ) : null}

                        {advisoryText?.trim() ? (
                          <View style={[styles.statusRow, styles.statusRowBorder]}>
                            <Text style={styles.statusLabel}>Advisory</Text>
                            <Text style={styles.statusValue} numberOfLines={4}>
                              {advisoryText.trim()}
                            </Text>
                          </View>
                        ) : null}

                        {!operatingVariations?.trim() && !advisoryText?.trim() ? (
                          <Text style={styles.statusHint} numberOfLines={1}>
                            No updates from the owner.
                          </Text>
                        ) : null}
                      </>
                    ) : null}
                  </Pressable>
                ) : null}

                {showEstimated && estimatedCost ? (
                  <View style={styles.entranceBox}>
                    <View style={styles.entranceHeader}>
                      <Ionicons name="cash-outline" size={18} color={colors.primaryTeal} />
                      <Text style={styles.entranceTitle}>Estimated cost</Text>
                    </View>
                    <Text style={styles.entranceText}>{estimatedCost}</Text>
                    {bestTimes.length ? (
                      <View style={styles.bestTimesRow}>
                        {bestTimes.slice(0, 3).map((t) => (
                          <View key={t} style={styles.bestTimeChip}>
                            <Text style={styles.bestTimeChipTxt}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </>
            );
          })()}

          {tagline ? <Text style={styles.tagline}>{tagline}</Text> : null}

          <Text style={styles.sectionTitle}>About this place</Text>
          {description ? (
            <>
              <Text style={styles.body}>{aboutShown}</Text>
              {aboutNeedsToggle ? (
                <Pressable onPress={() => setAboutExpanded((e) => !e)}>
                  <Text style={styles.showMore}>{aboutExpanded ? "Show less" : "Show more"}</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <Text style={styles.muted}>No description yet.</Text>
          )}

          {accommodations.length > 0 ? (
            <View style={styles.accomAccordion}>
              <Pressable
                style={styles.accomAccordionHeader}
                onPress={() => setAccommodationsOpen((o) => !o)}
                accessibilityRole="button"
                accessibilityState={{ expanded: accommodationsOpen }}
                accessibilityLabel={
                  accommodationsOpen
                    ? "Collapse accommodations list"
                    : `Accommodations, ${accommodations.length} types. Expand list`
                }
              >
                <View style={styles.accomAccordionHeaderText}>
                  <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>Accommodations</Text>
                  <Text style={styles.accomSummarySecondary}>
                    {accommodations.length} type{accommodations.length === 1 ? "" : "s"} ·{" "}
                    {accommodationsOpen ? "Tap to hide" : "Tap to show rates"}
                  </Text>
                </View>
                <Ionicons
                  name={accommodationsOpen ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.muted2}
                />
              </Pressable>
              {accommodationsOpen ? (
                <View style={styles.accomAccordionBody}>
                  <Text style={styles.accomHint}>Room types and rates from the owner. Availability may change.</Text>
                  {accommodations.map((a, i) => (
                    <View key={`${a.name}-${i}`} style={[styles.accRow, !a.available && styles.accRowMuted]}>
                      <View style={styles.accMain}>
                        <Text style={[styles.accName, !a.available && styles.accNameMuted]}>{a.name}</Text>
                        {a.pax ? (
                          <Text style={styles.accMeta} numberOfLines={1}>
                            {a.pax}
                          </Text>
                        ) : null}
                        <Text style={[styles.accPrice, !a.available && styles.accPriceMuted]}>
                          {a.price_pesos > 0 ? `₱${a.price_pesos.toLocaleString("en-PH")}` : "Price on request"}
                        </Text>
                      </View>
                      <View style={[styles.availBadge, a.available ? styles.availYes : styles.availNo]}>
                        <Text style={[styles.availBadgeText, a.available ? styles.availYesText : styles.availNoText]}>
                          {a.available ? "Available" : "Not available"}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {tags.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Highlights</Text>
              <View style={styles.facilityGrid}>
                {tags.slice(0, 8).map((t) => (
                  <View key={t} style={styles.facilityItem}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.primaryTeal} />
                    <Text style={styles.facilityLabel} numberOfLines={2}>
                      {t}
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          <View style={styles.navRow}>
            <Pressable
              style={[styles.navPrimary, lat == null && styles.navDisabled]}
              onPress={() => {
                if (lat == null || lng == null) return;
                const requiresOrder = (categoryName ?? "").toLowerCase().includes("food");
                void recordVisitIntentAndStartConfirmation({
                  businessId: id,
                  source: "navigate",
                  categoryName,
                  destLat: lat,
                  destLng: lng,
                  requireFoodOrder: requiresOrder,
                });
                void openTurnByTurnNavigation(lat, lng);
              }}
              disabled={lat == null || lng == null}
            >
              <Ionicons name="navigate" size={20} color="#fff" />
              <View>
                <Text style={styles.navPrimaryTitle}>Navigate</Text>
                <Text style={styles.navPrimarySub}>Turn-by-turn from you</Text>
              </View>
            </Pressable>
            <Pressable
              style={[styles.navSecondary, lat == null && styles.navDisabled]}
              onPress={() => {
                if (lat == null || lng == null) return;
                const requiresOrder = (categoryName ?? "").toLowerCase().includes("food");
                void recordVisitIntentAndStartConfirmation({
                  businessId: id,
                  source: "google_maps",
                  categoryName,
                  destLat: lat,
                  destLng: lng,
                  requireFoodOrder: requiresOrder,
                });
                void openGoogleMapsDirections(lat, lng);
              }}
              disabled={lat == null || lng == null}
            >
              <Ionicons name="logo-google" size={20} color={colors.navy} />
              <View style={{ flex: 1 }}>
                <Text style={styles.navSecondaryTitle}>Google Maps</Text>
                <Text style={styles.navSecondarySub}>Driving route</Text>
              </View>
            </Pressable>
          </View>

          {mapPreview ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 18 }]}>Location preview</Text>
              <MapPinPreview
                latitude={lat!}
                longitude={lng!}
                title={title}
              />
              <Text style={styles.mapHint}>
                Map preview only (not clickable). Use “Navigate” or “Google Maps” above.
              </Text>
            </>
          ) : (
            <Text style={[styles.muted, { marginTop: 16 }]}>
              The owner has not added map coordinates yet. Ask them to add latitude & longitude in the listing editor.
            </Text>
          )}

          {(() => {
            const canReserve = allowRes && !fullyBooked;
            const reserveLabel = !allowRes ? "Reservations disabled" : fullyBooked ? "Fully booked" : "Reserve now";
            return (
              <Pressable
            accessibilityRole="button"
            accessibilityLabel={reserveLabel}
            disabled={!canReserve}
            hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.reserveCtaWrap,
              !canReserve && { opacity: 0.55 },
              pressed && { opacity: 0.9 },
            ]}
            onPress={() => {
              if (!canReserve) return;
              trackListingIntentVisit(id);
              navigation.navigate("BookingRequest", { businessId: id });
            }}
          >
            <Animated.View style={[styles.reserveCta, { transform: [{ scale: reserveCtaPulse }] }]}>
              <Text style={styles.reserveCtaText}>{reserveLabel}</Text>
            </Animated.View>
              </Pressable>
            );
          })()}
        </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  closedModalRoot: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: colors.overlayDark,
  },
  closedModalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowCompat({ opacity: 0.14, radius: 20, offsetY: 10, elevation: 8 }),
  },
  closedModalIconWrap: {
    alignItems: "center",
    marginBottom: 10,
  },
  closedModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.navy,
    textAlign: "center",
  },
  closedModalSub: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted2,
    textAlign: "center",
    lineHeight: 20,
  },
  closedModalReasonBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.chipIdle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  closedModalReasonText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    lineHeight: 22,
  },
  closedModalNoReason: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: "500",
    color: colors.muted,
    textAlign: "center",
    fontStyle: "italic",
  },
  closedModalBtn: {
    marginTop: 20,
    borderRadius: 12,
    paddingVertical: 14,
    backgroundColor: colors.primaryTeal,
    alignItems: "center",
  },
  closedModalBtnTxt: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.white,
  },
  heroHost: {
    width: "100%",
    backgroundColor: colors.border,
    position: "relative",
    overflow: "hidden",
  },
  // closedBadge* removed (no longer used)

  statusBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.chipIdle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusHeaderRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 6,
    paddingRight: 26,
  },
  statusHeaderLeft: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, flexShrink: 1, minWidth: 0 },
  statusChevron: { position: "absolute", right: 0, top: 0, paddingTop: 2 },
  statusChipOpen: {
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(46, 155, 76, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(46, 155, 76, 0.22)",
  },
  statusChipOpenText: { fontSize: 11, fontWeight: "900", color: colors.accentGreen, letterSpacing: 0.3 },
  statusChipClosed: {
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(244, 67, 54, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.20)",
  },
  statusChipClosedText: { fontSize: 11, fontWeight: "900", color: colors.danger, letterSpacing: 0.3 },
  statusChipBooked: {
    marginLeft: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 152, 0, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(255, 152, 0, 0.22)",
  },
  statusChipBookedText: { fontSize: 11, fontWeight: "900", color: colors.navy, letterSpacing: 0.3 },
  statusRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 10 },
  statusRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "rgba(0,0,0,0.06)", marginTop: 10 },
  statusLabel: { width: 78, fontSize: 12, fontWeight: "800", color: colors.muted2 },
  statusValue: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: "500", color: colors.text, lineHeight: 19 },
  statusHint: { paddingTop: 10, fontSize: 12, color: colors.muted, fontWeight: "500" },

  // closedPill* removed (replaced by closedBadge)
  promoBox: {
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(11,184,196,0.08)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.28)",
  },
  promoHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  promoTitle: { flex: 1, fontSize: 14, fontWeight: "800", color: colors.navy, lineHeight: 19 },
  promoBody: { marginTop: 8, fontSize: 13, fontWeight: "500", color: colors.text, lineHeight: 19 },
  promoUntil: { marginTop: 8, fontSize: 12, fontWeight: "700", color: colors.primaryTeal },
  promoFoot: { marginTop: 8, fontSize: 11, fontWeight: "500", color: colors.muted2, lineHeight: 15 },

  entranceBox: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.chipIdle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  entranceHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  entranceTitle: { fontSize: 14, fontWeight: "700", color: colors.navy },
  entranceText: { fontSize: 13, fontWeight: "500", color: colors.text, lineHeight: 19 },
  bestTimesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  bestTimeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(11,184,196,0.10)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.22)",
  },
  bestTimeChipTxt: { fontSize: 12, fontWeight: "700", color: colors.primaryTeal },
  accomAccordion: {
    marginTop: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  accomAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: colors.chipIdle,
  },
  accomAccordionHeaderText: { flex: 1, minWidth: 0 },
  accomSummarySecondary: {
    fontSize: 12,
    fontWeight: "500",
    color: colors.muted,
    marginTop: 2,
    lineHeight: 16,
  },
  accomAccordionBody: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  accomHint: { fontSize: 11, color: colors.muted, marginTop: 10, marginBottom: 6, lineHeight: 15, fontWeight: "400" },
  accRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  accRowMuted: { opacity: 0.92 },
  accMain: { flex: 1, minWidth: 0 },
  accName: { fontSize: 14, fontWeight: "600", color: colors.navy },
  accNameMuted: { color: colors.muted2 },
  accMeta: { fontSize: 12, color: colors.muted, marginTop: 2, fontWeight: "400" },
  accPrice: { fontSize: 13, fontWeight: "600", color: colors.primaryTeal, marginTop: 3 },
  accPriceMuted: { color: colors.muted2 },
  availBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    flexShrink: 0,
  },
  availYes: { backgroundColor: "rgba(46, 155, 76, 0.18)" },
  availNo: { backgroundColor: colors.border },
  availBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.15 },
  availYesText: { color: colors.accentGreen },
  availNoText: { color: colors.muted2 },
  heroEmpty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.border,
  },
  heroEmptyText: { marginTop: 8, color: colors.muted, fontWeight: "600" },
  heroTopRow: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    zIndex: 2,
  },
  heroIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoBadge: {
    position: "absolute",
    right: 14,
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    zIndex: 2,
  },
  photoBadgeText: { fontWeight: "700", color: colors.navy, fontSize: 13 },
  mainScroll: { flex: 1 },
  card: {
    marginTop: -22,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 8,
    minHeight: 200,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 21,
    fontWeight: "700",
    color: colors.navy,
    lineHeight: 26,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.chipIdle,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  ratingText: { fontSize: 12, fontWeight: "700", color: colors.navy },
  ratingSub: { marginTop: 6, fontSize: 12, fontWeight: "600", color: colors.muted },
  rateBlock: { marginTop: 16 },
  starRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  rateFoot: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 10 },
  rateSaved: { fontSize: 12, color: colors.muted2, fontWeight: "500", flex: 1, flexShrink: 1, paddingRight: 6 },
  rateRemoveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexShrink: 0,
  },
  rateRemoveTxt: { fontSize: 12, fontWeight: "700", color: colors.danger },
  rateHint: { marginTop: 14, fontSize: 13, color: colors.muted, fontWeight: "500" },
  rateHintOwn: { marginTop: 14, fontSize: 13, color: colors.primaryTeal, fontWeight: "600" },
  tagRow: { flexDirection: "row", gap: 8, marginTop: 14, paddingRight: 8 },
  chip: {
    backgroundColor: colors.chipIdle,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.navy },
  chipCategory: { backgroundColor: `${colors.primaryTeal}18` },
  chipCategoryText: { fontSize: 12, fontWeight: "700", color: colors.primaryTeal },
  chipSubcategory: { backgroundColor: `${colors.accentGreen}18` },
  chipSubcategoryText: { fontSize: 12, fontWeight: "700", color: colors.accentGreen },
  locRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 12 },
  locText: { flex: 1, fontSize: 13, color: colors.muted2, fontWeight: "500", lineHeight: 18 },
  distText: { flex: 1, fontSize: 13, color: colors.primaryTeal, fontWeight: "600" },
  tagline: { marginTop: 10, fontSize: 13, color: colors.text, fontWeight: "500", lineHeight: 19 },
  sectionTitle: { marginTop: 16, fontSize: 15, fontWeight: "700", color: colors.navy, letterSpacing: -0.2 },
  sectionTitleInline: { marginTop: 0 },
  body: { marginTop: 6, fontSize: 14, lineHeight: 21, color: colors.text, fontWeight: "400" },
  showMore: { marginTop: 6, fontSize: 13, fontWeight: "600", color: colors.primaryTeal },
  muted: { marginTop: 8, fontSize: 13, color: colors.muted, fontWeight: "400" },
  facilityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 10,
    gap: 12,
  },
  facilityItem: {
    width: "30%",
    minWidth: 100,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  facilityLabel: { flex: 1, fontSize: 12, fontWeight: "500", color: colors.navy },
  navRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  navPrimary: {
    flex: 1,
    backgroundColor: colors.primaryTeal,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  navPrimaryTitle: { color: "#fff", fontWeight: "800", fontSize: 15 },
  navPrimarySub: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 2 },
  navSecondary: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navSecondaryTitle: { color: colors.navy, fontWeight: "800", fontSize: 14 },
  navSecondarySub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  navDisabled: { opacity: 0.45 },
  mapHint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.muted,
    textAlign: "center",
    fontWeight: "600",
  },
  cta: {
    marginTop: 22,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  reserveCtaWrap: {
    marginTop: 12,
    alignSelf: "stretch",
    alignItems: "center",
  },
  reserveCta: {
    width: "100%",
    backgroundColor: colors.primaryTeal,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    ...shadowCompat({ opacity: 0.35, radius: 5, offsetY: 3, elevation: 6 }),
  },
  reserveCtaText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
});
