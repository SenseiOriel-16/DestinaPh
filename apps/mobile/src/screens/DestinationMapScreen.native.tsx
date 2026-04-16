import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import type { RootStackParamList } from "../../App";
import {
  fetchOsrmRoute,
  formatDistanceKm,
  formatDuration,
  type LatLng,
} from "../lib/destinationMapUtils";
import { openGoogleMapsDirections } from "../lib/mapExternal";
import { recordVisitIntentAndStartConfirmation } from "../lib/visitConfirmation";
import { colors } from "../theme/colors";
import { shadowCompat, textShadowCompat } from "../lib/rnWebStyleCompat";
import { GlassPanel } from "../ui/GlassPanel";

type Props = NativeStackScreenProps<RootStackParamList, "DestinationMap">;

export function DestinationMapScreen({ route, navigation }: Props) {
  const { title, destLat, destLng, businessId, categoryName } = route.params;
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [permDenied, setPermDenied] = useState(false);

  const destination = useMemo(() => ({ latitude: destLat, longitude: destLng }), [destLat, destLng]);

  const load = useCallback(async () => {
    setLoading(true);
    setRouteCoords([]);
    setDurationSec(null);
    setDistanceM(null);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setPermDenied(true);
      setUserLoc(null);
      setLoading(false);
      return;
    }
    setPermDenied(false);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const from = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setUserLoc(from);
      const { coords, durationSec: d, distanceM: dist } = await fetchOsrmRoute(from, destination);
      setRouteCoords(coords);
      setDurationSec(d);
      setDistanceM(dist);
    } catch {
      setUserLoc(null);
    } finally {
      setLoading(false);
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

  useEffect(() => {
    if (loading) return;
    const id = requestAnimationFrame(() => {
      if (routeCoords.length > 1) {
        mapRef.current?.fitToCoordinates(routeCoords, {
          edgePadding: { top: 100, right: 36, bottom: 220, left: 36 },
          animated: true,
        });
        return;
      }
      if (userLoc) {
        mapRef.current?.fitToCoordinates([userLoc, destination], {
          edgePadding: { top: 100, right: 36, bottom: 220, left: 36 },
          animated: true,
        });
        return;
      }
      mapRef.current?.animateToRegion(initialRegion, 350);
    });
    return () => cancelAnimationFrame(id);
  }, [loading, userLoc, destination, routeCoords, initialRegion]);

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
        showsUserLocation={Boolean(userLoc)}
        showsMyLocationButton={false}
      >
        <Marker coordinate={destination} title={title} pinColor="#c0392b" />
        {userLoc ? <Marker coordinate={userLoc} title="Your location" pinColor={colors.primaryTeal} /> : null}
        {routeCoords.length > 1 ? (
          <Polyline coordinates={routeCoords} strokeColor={colors.primaryTeal} strokeWidth={4} />
        ) : null}
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

      {loading ? (
        <GlassPanel style={styles.loadingBanner} contentStyle={styles.loadingBannerContent} borderRadius={14} variant="subtle" intensity={54}>
          <ActivityIndicator color={colors.primaryTeal} />
          <Text style={styles.loadingText}>Loading route…</Text>
        </GlassPanel>
      ) : null}

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
              {routeCoords.length > 1
                ? "via OSRM routing (OpenStreetMap data)."
                : userLoc
                  ? "Straight line — route unavailable."
                  : "Open Google Maps for full navigation."}
            </Text>
          </View>
        </View>
        <Pressable style={styles.startNav} onPress={openGoogleDirections}>
          <Text style={styles.startNavText}>Start navigation</Text>
        </Pressable>
        <Text style={styles.osmNote}>Map data © OpenStreetMap contributors</Text>
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
  osmNote: {
    marginTop: 10,
    fontSize: 11,
    color: colors.muted2,
    textAlign: "center",
  },
});
