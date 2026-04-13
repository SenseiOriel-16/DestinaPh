import { StyleSheet, View } from "react-native";
import { colors } from "../theme/colors";

/**
 * Vector mark — walang bundled PNG para hindi masira ang Metro kung wala ang `assets/System_Icon.png`.
 * Para sa production icon, ilagay ang `apps/System_Icon.png` at patakbuhin ang `npm run sync:icon` mula sa repo root.
 */
export function LogoMark({ size = 44 }: { size?: number }) {
  const t = size;
  const o = 0.22 * t;
  const u = 0.26 * t;
  return (
    <View
      style={[styles.wrap, { width: t, height: 0.92 * t }]}
      accessibilityRole="image"
      accessibilityLabel="DestinaPH"
    >
      <View style={[styles.sun, { width: 0.2 * t, height: 0.2 * t, top: 0, right: 0.02 * t }]} />
      <View style={styles.peaks}>
        <View
          style={[
            styles.tri,
            {
              borderLeftWidth: o,
              borderRightWidth: o,
              borderBottomWidth: 0.48 * t,
              borderBottomColor: colors.primaryTeal,
              marginRight: -0.16 * t,
            },
          ]}
        />
        <View
          style={[
            styles.tri,
            {
              borderLeftWidth: u,
              borderRightWidth: u,
              borderBottomWidth: 0.56 * t,
              borderBottomColor: colors.primaryTealDeep,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sun: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: colors.star,
    zIndex: 2,
  },
  peaks: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    marginBottom: 2,
  },
  tri: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
