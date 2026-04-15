import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { fetchOsrmRoute, formatDistanceKm, formatDuration, type LatLng } from "../lib/destinationMapUtils";
import { openGoogleMapsDirections } from "../lib/mapExternal";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "DestinationMap">;

export function DestinationMapScreen({ route, navigation }: Props) {
  const { title, destLat, destLng } = route.params;
  const insets = useSafeAreaInsets();
  const destination: LatLng = { latitude: destLat, longitude: destLng };
  const [loading, setLoading] = useState(true);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [permDenied, setPermDenied] = useState(false);

  function getBrowserPosition(): Promise<{ latitude: number; longitude: number }> {
    return new Promise((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        reject(new Error("Geolocation is not available in this browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(err),
        { enableHighAccuracy: false, maximumAge: 15_000, timeout: 12_000 },
      );
    });
  }

  const load = useCallback(async () => {
    setLoading(true);
    setDurationSec(null);
    setDistanceM(null);
    try {
      const from = await getBrowserPosition();
      setPermDenied(false);
      const { durationSec: d, distanceM: dist } = await fetchOsrmRoute(from, destination);
      setDurationSec(d);
      setDistanceM(dist);
    } catch {
      setPermDenied(true);
    } finally {
      setLoading(false);
    }
  }, [destination]);

  useEffect(() => {
    void load();
  }, [load]);

  const openGoogleDirections = () => {
    void openGoogleMapsDirections(destLat, destLng);
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.h1}>Map</Text>
      <Text style={styles.lead}>
        Embedded maps are not available in the browser preview. Use the DestinaPH app on a phone for the full map, or
        open directions below.
      </Text>
      <Text style={styles.place} numberOfLines={2}>
        {title}
      </Text>

      {loading ? (
        <View style={styles.row}>
          <ActivityIndicator color={colors.primaryTeal} />
          <Text style={styles.muted}>Checking route…</Text>
        </View>
      ) : null}

      {!loading && !permDenied ? (
        <Text style={styles.summary}>
          {formatDuration(durationSec)} ({formatDistanceKm(distanceM)})
        </Text>
      ) : null}

      {permDenied ? <Text style={styles.warn}>Location permission denied — route summary unavailable in browser.</Text> : null}

      <Pressable style={styles.primaryBtn} onPress={openGoogleDirections}>
        <Text style={styles.primaryBtnText}>Open in Google Maps</Text>
      </Pressable>
      <Pressable style={styles.secondaryBtn} onPress={() => navigation.goBack()}>
        <Text style={styles.secondaryBtnText}>Go back</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg, paddingHorizontal: 22 },
  h1: { fontSize: 24, fontWeight: "800", color: colors.navy, marginBottom: 10 },
  lead: { fontSize: 15, color: colors.muted, lineHeight: 22, marginBottom: 16 },
  place: { fontSize: 17, fontWeight: "700", color: colors.navy, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  muted: { color: colors.muted, fontWeight: "600" },
  summary: { fontSize: 16, fontWeight: "700", color: colors.primaryTeal, marginBottom: 16 },
  warn: { fontSize: 14, color: "#b45309", marginBottom: 16 },
  primaryBtn: {
    backgroundColor: colors.primaryTeal,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  secondaryBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  secondaryBtnText: { color: colors.navy, fontWeight: "700", fontSize: 16 },
});
