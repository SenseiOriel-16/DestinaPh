import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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
  /** BlurView tint; defaults to light. */
  tint?: "light" | "dark" | "default";
  /** Visual preset. */
  variant?: "frosted" | "subtle";
};

export function GlassPanel({
  children,
  style,
  contentStyle,
  borderRadius = 22,
  intensity,
  tint = "light",
  variant = "frosted",
}: Props) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.outer, styles.webFallback, { borderRadius }, style]}>
        <View style={[styles.content, { borderRadius }, contentStyle]}>{children}</View>
      </View>
    );
  }

  const blur =
    intensity ??
    (variant === "subtle"
      ? Platform.OS === "android"
        ? 28
        : 44
      : Platform.OS === "android"
        ? 44
        : 64);
  return (
    <View style={[styles.outer, variant === "subtle" && styles.outerSubtle, { borderRadius }, style]}>
      <BlurView intensity={blur} tint={tint} style={[StyleSheet.absoluteFill, { borderRadius }]} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, variant === "subtle" ? styles.veilSubtle : styles.veil, { borderRadius }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={
          variant === "subtle"
            ? ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.10)"]
            : ["rgba(255,255,255,0.32)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.10)"]
        }
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.sheen, { borderRadius }]}
      />
      <View style={[styles.content, { borderRadius }, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    position: "relative",
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: "rgba(255,255,255,0.62)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  outerSubtle: {
    borderColor: "rgba(255,255,255,0.46)",
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  veil: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  veilSubtle: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  sheen: {
    opacity: 1,
  },
  content: {
    position: "relative",
  },
  webFallback: {
    backgroundColor: "rgba(255,255,255,0.78)",
  },
});
