import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useMemo } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { openGoogleMapsDirections } from "../lib/mapExternal";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "DestinationMap">;

export function DestinationMapScreen({ route, navigation }: Props) {
  const { title, destLat, destLng } = route.params;
  const insets = useSafeAreaInsets();
  const embedUrl = useMemo(() => {
    // Works without an API key.
    const q = `${destLat},${destLng}`;
    return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
  }, [destLat, destLng]);

  const openGoogleDirections = () => {
    void openGoogleMapsDirections(destLat, destLng);
  };

  return (
    <View style={[styles.page, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
      <Text style={styles.h1}>Map</Text>
      <Text style={styles.place} numberOfLines={2}>
        {title}
      </Text>

      <View style={styles.mapFrame}>
        {Platform.OS === "web" ? (
          <iframe
            title="Google Map"
            src={embedUrl}
            style={{ width: "100%", height: "100%", border: "0", borderRadius: 16 }}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <View style={styles.mapFallback}>
            <Text style={styles.muted}>Map preview is available on web only.</Text>
          </View>
        )}
      </View>

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
  place: { fontSize: 17, fontWeight: "700", color: colors.navy, marginBottom: 16 },
  muted: { color: colors.muted, fontWeight: "600" },
  mapFrame: {
    width: "100%",
    height: 360,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    marginBottom: 16,
  },
  mapFallback: { flex: 1, alignItems: "center", justifyContent: "center" },
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
