import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { activeTouristSeasonalTip } from "../lib/touristSeasonalTip";
import { colors } from "../theme/colors";

const STORAGE_PREFIX = "@destinaph/tourist-seasonal-dismissed:";

export function TouristSeasonalBanner() {
  const tip = useMemo(() => activeTouristSeasonalTip(), []);
  const year = new Date().getFullYear();
  const key = tip ? `${STORAGE_PREFIX}${tip.id}:${year}` : "";

  const [resolved, setResolved] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!tip || !key) {
      setResolved(true);
      return;
    }
    let cancelled = false;
    void AsyncStorage.getItem(key).then((v) => {
      if (!cancelled) {
        setDismissed(v === "1");
        setResolved(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [tip, key]);

  const onDismiss = () => {
    setDismissed(true);
    if (key) void AsyncStorage.setItem(key, "1");
  };

  if (!tip || !resolved || dismissed) return null;

  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <View style={styles.iconCircle}>
        <Ionicons name="calendar-outline" size={20} color={colors.primaryTeal} />
      </View>
      <View style={styles.textCol}>
        <Text style={styles.title}>{tip.title}</Text>
        <Text style={styles.body}>{tip.body}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss seasonal tip"
        hitSlop={10}
        onPress={onDismiss}
        style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.75 }]}
      >
        <Text style={styles.closeTxt}>{"\u2715"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderRadius: 14,
    backgroundColor: "rgba(11,184,196,0.09)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.28)",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
  },
  textCol: { flex: 1, minWidth: 0 },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.2,
  },
  body: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.75)",
  },
  closeTxt: {
    fontSize: 14,
    color: colors.muted2,
    fontWeight: "700",
  },
});
