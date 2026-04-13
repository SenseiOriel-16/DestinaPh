import { BlurView } from "expo-blur";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  /** Outer frame (width, margin, flex, etc.). */
  style?: StyleProp<ViewStyle>;
  /** Padding around children. */
  contentStyle?: StyleProp<ViewStyle>;
  borderRadius?: number;
  /** Blur strength; tuned lower on Android for stability. */
  intensity?: number;
};

export function GlassPanel({ children, style, contentStyle, borderRadius = 22, intensity }: Props) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.outer, styles.webFallback, { borderRadius }, style]}>
        <View style={[styles.content, { borderRadius }, contentStyle]}>{children}</View>
      </View>
    );
  }

  const blur = intensity ?? (Platform.OS === "android" ? 32 : 52);
  return (
    <View style={[styles.outer, { borderRadius }, style]}>
      <BlurView intensity={blur} tint="light" style={[StyleSheet.absoluteFill, { borderRadius }]} />
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, { borderRadius }]} />
      <View style={[styles.content, { borderRadius }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "relative",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.55)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  veil: {
    backgroundColor: "rgba(255,255,255,0.34)",
  },
  content: {
    position: "relative",
  },
  webFallback: {
    backgroundColor: "rgba(255,255,255,0.82)",
  },
});
