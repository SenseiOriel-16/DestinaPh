import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import type { RootStackParamList } from "../../App";
import { formatDistanceKm, formatDuration, type LatLng } from "../lib/destinationMapUtils";
import { openGoogleMapsDirections } from "../lib/mapExternal";
import { recordVisitIntentAndStartConfirmation } from "../lib/visitConfirmation";
import { colors } from "../theme/colors";
import { shadowCompat, textShadowCompat } from "../lib/rnWebStyleCompat";
import { GlassPanel } from "../ui/GlassPanel";

type Props = NativeStackScreenProps<RootStackParamList, "DestinationMap">;

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
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

export function DestinationMapScreen({ route, navigation }: Props) {
  const { title, destLat, destLng, businessId, categoryName } = route.params;
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [permDenied, setPermDenied] = useState(false);

  const destination = useMemo(() => ({ latitude: destLat, longitude: destLng }), [destLat, destLng]);

  const load = useCallback(async () => {
    setDurationSec(null);
    setDistanceM(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPermDenied(true);
      setUserLoc(null);
      return;
    }
    setPermDenied(false);
    let from: LatLng | null = null;
    let usedLastKnown = false;
    try {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
      if (last) {
        usedLastKnown = true;
        from = { latitude: last.coords.latitude, longitude: last.coords.longitude };
        setUserLoc(from);
      }
      if (!from) {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
        from = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setUserLoc(from);
      }
    } catch {
      setUserLoc(null);
      return;
    }

    // No external routing providers. Show straight-line estimate only.
    const meters = haversineMeters(from, destination);
    setDistanceM(meters);
    // Assume ~25 km/h average (town driving) for an ETA-ish estimate.
    setDurationSec((meters / 1000 / 25) * 3600);

    if (usedLastKnown) {
      void (async () => {
        try {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
          const refined: LatLng = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setUserLoc(refined);
          const meters2 = haversineMeters(refined, destination);
          setDistanceM(meters2);
          setDurationSec((meters2 / 1000 / 25) * 3600);
        } catch {
          /* keep first estimate */
        }
      })();
    }
  }, [destination]);

  useEffect(() => {
    void load();
  }, [load]);

  const initialRegion = useMemo(
    () => ({
      latitude: destination.latitude,
      longitude: destination.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }),
    [destination.latitude, destination.longitude],
  );

  const onMapReady = useCallback(() => {
    mapRef.current?.animateToRegion(initialRegion, 0);
  }, [initialRegion]);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (userLoc) {
        mapRef.current?.fitToCoordinates([userLoc, destination], {
          edgePadding: { top: 100, right: 36, bottom: 220, left: 36 },
          animated: true,
        });
      }
    });
    return () => cancelAnimationFrame(id);
  }, [userLoc, destination]);

  const openGoogleDirections = () => {
    if (businessId) {
      const requiresOrder = (categoryName ?? "").toLowerCase().includes("food");
      void recordVisitIntentAndStartConfirmation({
        businessId,
        source: "google_maps",
        categoryName: categoryName ?? null,
        destLat,
        destLng,
        requireFoodOrder: requiresOrder,
      });
    }
    void openGoogleMapsDirections(destLat, destLng);
  };

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        onMapReady={onMapReady}
        loadingEnabled={false}
        showsUserLocation={Boolean(userLoc)}
        showsMyLocationButton={false}
      >
        <Marker coordinate={destination} title={title} pinColor="#c0392b" />
        {userLoc ? <Marker coordinate={userLoc} title="Your location" pinColor={colors.primaryTeal} /> : null}
      </MapView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.iconCircleOuter} onPress={() => navigation.goBack()} hitSlop={12}>
          <GlassPanel style={styles.iconCircle} contentStyle={styles.iconCircleContent} borderRadius={20} variant="subtle" intensity={50}>
            <Text style={styles.iconText}>‹</Text>
          </GlassPanel>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>
          Map
        </Text>
        <Pressable style={styles.iconCircleOuter} onPress={() => navigation.goBack()} hitSlop={12}>
          <GlassPanel style={styles.iconCircle} contentStyle={styles.iconCircleContent} borderRadius={20} variant="subtle" intensity={50}>
            <Text style={styles.iconText}>✕</Text>
          </GlassPanel>
        </Pressable>
      </View>

      <GlassPanel style={styles.loadingBanner} contentStyle={styles.loadingBannerContent} borderRadius={14} variant="subtle" intensity={54}>
        <ActivityIndicator color={colors.primaryTeal} />
        <Text style={styles.loadingText}>Loading map…</Text>
      </GlassPanel>

      {permDenied ? (
        <GlassPanel
          style={[styles.card, styles.floatingCard, { top: insets.top + 56 }]}
          contentStyle={styles.cardContent}
          borderRadius={16}
          variant="subtle"
          intensity={54}
        >
          <Text style={styles.cardTitle}>Location off</Text>
          <Text style={styles.cardBody}>
            Turn on location to see driving directions from you to this place. You can still open Google Maps below.
          </Text>
        </GlassPanel>
      ) : null}

      <View style={[styles.bottomCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <BlurView intensity={58} tint="light" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.bottomVeil, { pointerEvents: "none" as any }]} />
        <View style={styles.summaryRow}>
          <Text style={styles.summaryIcon}>🚗</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.summaryMain}>
              {formatDuration(durationSec)} ({formatDistanceKm(distanceM)})
            </Text>
            <Text style={styles.summarySub}>
              {userLoc ? "Estimated straight-line distance. Open Google Maps for turn-by-turn." : "Open Google Maps for navigation."}
            </Text>
          </View>
        </View>
        <Pressable style={styles.startNav} onPress={openGoogleDirections}>
          <Text style={styles.startNavText}>Start navigation</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    zIndex: 2,
  },
  iconCircleOuter: { width: 40, height: 40 },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconCircleContent: { alignItems: "center", justifyContent: "center", width: "100%", height: "100%" },
  iconText: { fontSize: 22, color: colors.navy, fontWeight: "700", marginTop: -2 },
  topTitle: {
    flex: 1,
    textAlign: "center",
    color: "#fff",
    fontWeight: "800",
    fontSize: 17,
    ...textShadowCompat({ color: "rgba(0,0,0,0.45)", offsetY: 1, radius: 4 }),
  },
  loadingBanner: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    overflow: "hidden",
    zIndex: 1,
  },
  loadingBannerContent: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  loadingText: { fontWeight: "600", color: colors.navy },
  card: {
    marginHorizontal: 16,
    overflow: "hidden",
  },
  cardContent: { padding: 14 },
  floatingCard: { position: "absolute", left: 0, right: 0, zIndex: 1 },
  cardTitle: { fontWeight: "800", color: colors.navy, marginBottom: 6 },
  cardBody: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  bottomCard: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 16,
    overflow: "hidden",
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: "rgba(255,255,255,0.55)",
    ...shadowCompat({ opacity: 0.2, radius: 18, offsetY: -8, elevation: 14 }),
  },
  bottomVeil: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 14 },
  summaryIcon: { fontSize: 22, marginTop: 2 },
  summaryMain: { fontSize: 17, fontWeight: "800", color: colors.navy },
  summarySub: { fontSize: 13, color: colors.muted, marginTop: 4, lineHeight: 18 },
  startNav: {
    backgroundColor: colors.primaryTeal,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  startNavText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
