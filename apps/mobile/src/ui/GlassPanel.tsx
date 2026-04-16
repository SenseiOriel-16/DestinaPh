import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { shadowCompat } from "../lib/rnWebStyleCompat";

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
  variant?: "frosted" | "subtle" | "smoke";
};

export function GlassPanel({
  children,
  style,
  contentStyle,
  borderRadius = 22,
  intensity,
  tint,
  variant = "frosted",
}: Props) {
  if (Platform.OS === "web") {
    return (
      <View style={[styles.outer, styles.webFallback, { borderRadius }, style]}>
        <View style={[styles.content, { borderRadius }, contentStyle]}>{children}</View>
      </View>
    );
  }

  const resolvedTint = tint ?? (variant === "smoke" ? "dark" : "light");
  const blur =
    intensity ??
    (variant === "subtle"
      ? Platform.OS === "android"
        ? 28
        : 44
      : variant === "smoke"
        ? Platform.OS === "android"
          ? 56
          : 78
        : Platform.OS === "android"
          ? 44
          : 64);
  return (
    <View
      style={[
        styles.outer,
        variant === "subtle" && styles.outerSubtle,
        variant === "smoke" && styles.outerSmoke,
        { borderRadius },
        style,
      ]}
    >
      <BlurView intensity={blur} tint={resolvedTint} style={[StyleSheet.absoluteFill, { borderRadius }]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          variant === "subtle" ? styles.veilSubtle : variant === "smoke" ? styles.veilSmoke : styles.veil,
          { borderRadius, pointerEvents: "none" as any },
        ]}
      />
      <LinearGradient
        colors={
          variant === "subtle"
            ? ["rgba(255,255,255,0.16)", "rgba(255,255,255,0.04)", "rgba(255,255,255,0.10)"]
            : variant === "smoke"
              ? ["rgba(255,255,255,0.10)", "rgba(255,255,255,0.02)", "rgba(0,0,0,0.24)"]
              : ["rgba(255,255,255,0.32)", "rgba(255,255,255,0.06)", "rgba(0,0,0,0.10)"]
        }
        locations={[0, 0.55, 1]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={[StyleSheet.absoluteFill, styles.sheen, { borderRadius, pointerEvents: "none" as any }]}
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
    ...shadowCompat({ opacity: 0.12, radius: 14, offsetY: 6, elevation: 6 }),
  },
  outerSubtle: {
    borderColor: "rgba(255,255,255,0.46)",
    ...shadowCompat({ opacity: 0.1, radius: 12, offsetY: 6, elevation: 6 }),
  },
  outerSmoke: {
    borderColor: "rgba(255,255,255,0.26)",
    ...shadowCompat({ opacity: 0.22, radius: 22, offsetY: 10, elevation: 10 }),
  },
  veil: {
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  veilSubtle: {
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  veilSmoke: {
    backgroundColor: "rgba(10, 15, 25, 0.22)",
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
