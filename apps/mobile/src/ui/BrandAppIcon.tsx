import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";
import { LogoMark } from "./LogoMark";
import { GlassPanel } from "./GlassPanel";

/** `apps/mobile/assets/System_Icon.png` — i-sync mula sa `apps/System_Icon.png` (`npm run sync:icon`). */
const SYSTEM_ICON = require("../../assets/System_Icon.png") as number;

type Props = {
  /** Outer box (width & height). */
  size?: number;
  /** Render the icon container as a frosted glass tile. */
  glass?: boolean;
};

export function BrandAppIcon({ size = 96, glass = false }: Props) {
  const [loadFailed, setLoadFailed] = useState(false);
  const r = Math.round(size * 0.24);

  const inner = loadFailed ? (
    <LogoMark size={Math.round(size * 0.78)} />
  ) : (
    <Image
      source={SYSTEM_ICON}
      style={styles.img}
      resizeMode="contain"
      accessibilityLabel="DestinaPH"
      onError={() => setLoadFailed(true)}
    />
  );

  if (glass) {
    return (
      <GlassPanel
        variant="frosted"
        intensity={58}
        borderRadius={r}
        style={[styles.wrapGlass, { width: size, height: size, borderRadius: r }]}
        contentStyle={styles.glassInner}
      >
        {inner}
      </GlassPanel>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: r }]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  wrapGlass: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
  },
  glassInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  img: {
    width: "92%",
    height: "92%",
  },
});
