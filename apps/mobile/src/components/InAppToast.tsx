import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../theme/colors";
import { shadowCompat } from "../lib/rnWebStyleCompat";

export type ToastModel = {
  title: string;
  body: string;
  onPress?: () => void;
};

export function InAppToast({
  toast,
  onDismiss,
}: {
  toast: ToastModel | null;
  onDismiss: () => void;
}) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => onDismiss(), 6500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;

  return (
    <View style={[styles.wrap, { paddingTop: Math.max(insets.top, 12), pointerEvents: "box-none" as any }]}>
      <Pressable
        style={styles.card}
        onPress={() => {
          toast.onPress?.();
          onDismiss();
        }}
        accessibilityRole="button"
        accessibilityLabel="Open notification"
      >
        <View style={styles.dot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {toast.title}
          </Text>
          <Text style={styles.body} numberOfLines={2}>
            {toast.body}
          </Text>
        </View>
        <Text style={styles.x} accessibilityLabel="Dismiss">
          ×
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 9999,
    paddingHorizontal: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.35)",
    ...shadowCompat({ opacity: 0.12, radius: 12, offsetY: 6, elevation: 5 }),
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.primaryTeal,
  },
  title: { fontSize: 14.5, fontWeight: "900", color: colors.navy },
  body: { marginTop: 2, fontSize: 13, fontWeight: "700", color: colors.muted2, lineHeight: 17 },
  x: { fontSize: 22, fontWeight: "900", color: colors.muted2, marginLeft: 4 },
});

