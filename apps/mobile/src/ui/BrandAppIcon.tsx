import { useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";
import { LogoMark } from "./LogoMark";

/** `apps/mobile/assets/System_Icon.png` — i-sync mula sa `apps/System_Icon.png` (`npm run sync:icon`). */
const SYSTEM_ICON_ASSETS = require("../../assets/System_Icon.png") as number;
const EXPO_APP_ICON = require("../../assets/icon.png") as number;

type Phase = "assets" | "expo" | null;

type Props = {
  /** Outer box (width & height). */
  size?: number;
};

export function BrandAppIcon({ size = 96 }: Props) {
  const [phase, setPhase] = useState<Phase>("assets");
  const r = Math.round(size * 0.24);

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: r }]}>
      {phase === null ? (
        <LogoMark size={Math.round(size * 0.78)} />
      ) : (
        <Image
          key={phase}
          source={phase === "assets" ? SYSTEM_ICON_ASSETS : EXPO_APP_ICON}
          style={styles.img}
          resizeMode="contain"
          accessibilityLabel="DestinaPH"
          onError={() => setPhase((prev) => (prev === "assets" ? "expo" : null))}
        />
      )}
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
  img: {
    width: "92%",
    height: "92%",
  },
});
