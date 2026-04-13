import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";
import { buildSatelliteMapPreviewHtml } from "../lib/satelliteMapHtml";
import { colors } from "../theme/colors";

type Props = {
  latitude: number;
  longitude: number;
  title: string;
  onPressExpand: () => void;
};

/** In-app satellite-style preview (Esri tiles + Leaflet). Expand opens full route map. */
export function MapPinPreview({ latitude, longitude, title, onPressExpand }: Props) {
  const html = buildSatelliteMapPreviewHtml(latitude, longitude, title);

  return (
    <View style={styles.mapBox} accessibilityLabel="Satellite map preview">
      <WebView
        style={StyleSheet.absoluteFill}
        originWhitelist={["*"]}
        source={{ html }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled={false}
        setSupportMultipleWindows={false}
      />
      <Pressable
        style={styles.mapExpand}
        onPress={onPressExpand}
        accessibilityRole="button"
        accessibilityLabel="Open full map with route"
      >
        <Ionicons name="expand-outline" size={20} color={colors.navy} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  mapBox: {
    marginTop: 10,
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.border,
  },
  mapExpand: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
});
