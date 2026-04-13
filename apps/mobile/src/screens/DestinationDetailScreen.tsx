import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import {
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import type { RootStackParamList } from "../../App";
import { useItinerary } from "../context/ItineraryContext";
import { type AccommodationItem, normalizeAccommodations } from "../lib/accommodations";
import { formatBusinessAddress, sortedPhotoPublicUrls } from "../lib/businessDisplay";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MapPinPreview } from "../components/MapPinPreview";
import { openGoogleMapsDirections, openTurnByTurnNavigation } from "../lib/mapExternal";

type Props = NativeStackScreenProps<RootStackParamList, "Detail">;

type BusinessRow = {
  name: string;
  description: string | null;
  short_description: string | null;
  address_line: string | null;
  latitude: number | null;
  longitude: number | null;
  is_premium: boolean;
  tags: string[] | null;
  accommodations: unknown;
  entrance_fee_pesos: number | null;
  entrance_fee_day_pesos: number | null;
  entrance_fee_night_pesos: number | null;
  operating_day: boolean | null;
  operating_night: boolean | null;
  pricing_text: string | null;
  municipalities: { name: string } | null;
  provinces: { name: string } | null;
  barangays: { name: string } | null;
  categories: { name: string } | null;
  business_photos: { storage_path: string; sort_order: number }[] | null;
};

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
  const { addStop } = useItinerary();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagline, setTagline] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [accommodationsOpen, setAccommodationsOpen] = useState(false);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [entranceLine, setEntranceLine] = useState<string | null>(null);
  const [accommodations, setAccommodations] = useState<AccommodationItem[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    void (async () => {
      await supabase.rpc("track_business_metric", { target: id, metric: "view" });

      const { data, error } = await supabase
        .from("businesses")
        .select(
          `
          name,
          description,
          short_description,
          address_line,
          latitude,
          longitude,
          is_premium,
          tags,
          accommodations,
          entrance_fee_pesos,
          entrance_fee_day_pesos,
          entrance_fee_night_pesos,
          operating_day,
          operating_night,
          pricing_text,
          municipalities(name),
          provinces(name),
          barangays(name),
          categories(name),
          business_photos(storage_path,sort_order)
        `,
        )
        .eq("id", id)
        .order("sort_order", { ascending: true, foreignTable: "business_photos" })
        .maybeSingle();

      if (error) {
        console.warn("[DestinaPH] detail load:", error.message);
      }

      if (data) {
        const row = data as unknown as BusinessRow;
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
        setTags(Array.isArray(row.tags) ? row.tags : []);
        setLat(row.latitude);
        setLng(row.longitude);
        setIsPremium(Boolean(row.is_premium));
        setImages(sortedPhotoPublicUrls(row.business_photos).slice(0, 5));
        setEntranceLine(entranceSummary(row));
        setAccommodations(normalizeAccommodations(row.accommodations));
      } else {
        setImages([]);
        setIsPremium(false);
        setEntranceLine(null);
        setAccommodations([]);
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

  const addItinerary = () => {
    if (lat == null || lng == null) return;
    addStop({
      id,
      name: title,
      latitude: lat,
      longitude: lng,
      categoryName: categoryName ?? undefined,
      photoUrl: images[0] ?? null,
    });
  };

  const openInAppMap = () => {
    if (lat == null || lng == null) return;
    navigation.navigate("DestinationMap", { title, destLat: lat, destLng: lng });
  };

  const heroSlideW = screenW;
  const heroH = Math.min(Math.round(screenW * 0.78), 360);
  const aboutPreviewLen = 160;
  const aboutNeedsToggle = description.length > aboutPreviewLen;
  const aboutShown =
    aboutExpanded || !aboutNeedsToggle ? description : `${description.slice(0, aboutPreviewLen).trim()}…`;

  const mapPreview = lat != null && lng != null;

  const onPhotoScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / Math.max(heroSlideW, 1));
    setPhotoIndex(Math.min(Math.max(idx, 0), Math.max(images.length - 1, 0)));
  };

  return (
    <View style={styles.page}>
      <ScrollView
        style={styles.mainScroll}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
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

          <View style={[styles.heroTopRow, { paddingTop: insets.top + 8 }]}>
            <Pressable style={styles.heroIconBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={24} color={colors.navy} />
            </Pressable>
            <Pressable
              style={styles.heroIconBtn}
              onPress={() => setFavorited((v) => !v)}
              accessibilityLabel={favorited ? "Remove favorite" : "Add favorite"}
            >
              <Ionicons name={favorited ? "heart" : "heart-outline"} size={22} color={favorited ? colors.danger : colors.navy} />
            </Pressable>
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

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={14} color={colors.star} />
              <Text style={styles.ratingText}>Soon</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
            {categoryName ? (
              <View style={[styles.chip, styles.chipCategory]}>
                <Text style={styles.chipCategoryText}>{categoryName}</Text>
              </View>
            ) : null}
            {tags.map((t) => (
              <View key={t} style={styles.chip}>
                <Text style={styles.chipText}>{t}</Text>
              </View>
            ))}
      </ScrollView>

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

          {entranceLine ? (
            <View style={styles.entranceBox}>
              <View style={styles.entranceHeader}>
                <Ionicons name="pricetag-outline" size={18} color={colors.primaryTeal} />
                <Text style={styles.entranceTitle}>Entrance & fees</Text>
              </View>
              <Text style={styles.entranceText}>{entranceLine}</Text>
            </View>
          ) : null}

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
                onPressExpand={openInAppMap}
              />
              <Text style={styles.mapHint}>
                Satellite-style map in-app (no extra API keys). Tap expand for full map and driving route from you.
              </Text>
            </>
          ) : (
            <Text style={[styles.muted, { marginTop: 16 }]}>
              The owner has not added map coordinates yet. Ask them to add latitude & longitude in the listing editor.
            </Text>
          )}

      <Pressable
        style={[styles.cta, lat == null && { opacity: 0.5 }]}
        disabled={lat == null || lng == null}
        onPress={addItinerary}
      >
        <Text style={styles.ctaText}>Add to itinerary</Text>
      </Pressable>
          {isPremium && (
            <Pressable
              style={styles.ctaSecondary}
              onPress={() => navigation.navigate("BookingRequest", { businessId: id })}
            >
              <Text style={styles.ctaSecondaryText}>Booking / reservation</Text>
            </Pressable>
          )}
        </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  heroHost: {
    width: "100%",
    backgroundColor: colors.border,
    position: "relative",
    overflow: "hidden",
  },
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
  ctaSecondary: {
    marginTop: 12,
    backgroundColor: colors.white,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 2,
    borderColor: colors.primaryTeal,
  },
  ctaSecondaryText: { color: colors.primaryTeal, fontWeight: "800", fontSize: 16 },
});
