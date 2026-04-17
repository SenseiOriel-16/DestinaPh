import { Ionicons } from "@expo/vector-icons";
import { Platform, StyleSheet, Text, View } from "react-native";
import type { ReactNode } from "react";
import { shadowCompat } from "../lib/rnWebStyleCompat";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  hintRight?: string;
  children: ReactNode;
};

/**
 * Shared input container style (copied from the "Enter entrance budget" field).
 * Use this to keep all input fields consistent across the app.
 */
export function FieldShell({ icon, hintRight, children }: Props) {
  return (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={17} color="#9CA3AF" />
        </View>
      ) : null}
      <View style={styles.body}>{children}</View>
      {hintRight ? <Text style={styles.hint}>{hintRight}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.22)",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 11,
    ...shadowCompat({ opacity: 0.05, radius: 10, offsetY: 6, elevation: 2 }),
  },
  iconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  hint: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(71,85,105,0.55)",
  },
});

export const fieldTextInputStyle = StyleSheet.create({
  input: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1E1B4B",
    minWidth: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: "transparent",
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
        } as any)
      : null),
  },
}).input;

