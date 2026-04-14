import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type Props = {
  message: string | null;
  variant?: "success" | "error";
  onDismiss: () => void;
  autoHideMs?: number;
};

export function FlashNotice({ message, variant = "success", onDismiss, autoHideMs = 4500 }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(t);
  }, [message, onDismiss, autoHideMs]);

  if (!message) return null;

  return (
    <View
      style={[styles.box, variant === "success" ? styles.success : styles.error]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, variant === "success" ? styles.textOk : styles.textErr]}>{message}</Text>
      <Pressable onPress={onDismiss} hitSlop={12} accessibilityLabel="Dismiss notice">
        <Text style={styles.close}>×</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  success: {
    backgroundColor: "#ecfdf5",
    borderColor: "#6ee7b7",
  },
  error: {
    backgroundColor: "#fff7f7",
    borderColor: "#fecaca",
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  textOk: {
    color: "#065f46",
  },
  textErr: {
    color: "#991b1b",
  },
  close: {
    fontSize: 22,
    fontWeight: "400",
    color: colors.muted2,
    lineHeight: 24,
    paddingHorizontal: 4,
  },
});
