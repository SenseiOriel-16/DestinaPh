import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { shadowCompat } from "../lib/rnWebStyleCompat";
import {
  BOOKING_NOTIFICATION_EVENT,
  BOOKING_OPEN_DETAIL_EVENT,
  type BookingNotificationEvent,
} from "../lib/bookingNotificationEvents";
import { DeviceEventEmitter } from "react-native";
import { navigateToBookingsMain } from "../navigation/navRef";

type NotifItem = BookingNotificationEvent & { read: boolean };

export type BookingNotificationBellProps = {
  /** `fab` = absolute top-right overlay (legacy). `inline` = sits in a header row (e.g. Home). */
  variant?: "fab" | "inline";
};

function fmtTime(ts: number) {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

export function BookingNotificationBell({ variant = "fab" }: BookingNotificationBellProps) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const isInline = variant === "inline";

  const unread = useMemo(() => items.reduce((n, it) => (it.read ? n : n + 1), 0), [items]);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(BOOKING_NOTIFICATION_EVENT, (evt: BookingNotificationEvent) => {
      setItems((prev) => [{ ...evt, read: false }, ...prev].slice(0, 50));
    });
    return () => sub.remove();
  }, []);

  const openPanel = () => {
    setOpen(true);
    setItems((prev) => prev.map((it) => ({ ...it, read: true })));
  };

  const panelTop = isInline
    ? Math.max(insets.top, 18) + 56
    : Math.max(insets.top, 10) + 54;

  return (
    <>
      <View
        style={[
          isInline ? styles.inlineWrap : [styles.fabWrap, { top: Math.max(insets.top, 10) + 6 }],
          { pointerEvents: "box-none" as any },
        ]}
      >
        <Pressable
          onPress={openPanel}
          style={({ pressed }) =>
            isInline
              ? [styles.inlineBell, pressed && styles.inlineBellPressed]
              : [styles.bellBtn, pressed && { transform: [{ scale: 0.98 }] }]
          }
          accessibilityRole="button"
          accessibilityLabel="Open notifications"
        >
          <Ionicons name="notifications-outline" size={22} color={isInline ? colors.muted2 : colors.white} />
          {unread > 0 ? (
            <View style={[styles.badge, isInline && styles.badgeInline]}>
              <Text style={styles.badgeText}>{unread > 99 ? "99+" : `${unread}`}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)} />
        <View style={[styles.panel, { marginTop: panelTop }]}>
          <View style={styles.panelHead}>
            <Text style={styles.panelTitle}>Notifications</Text>
            <Pressable onPress={() => setItems([])} accessibilityRole="button" accessibilityLabel="Clear notifications">
              <Text style={styles.clearBtn}>Clear</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={{ paddingBottom: 10 }}>
            {items.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No notifications yet</Text>
                <Text style={styles.emptyText}>Reservation updates will appear here.</Text>
              </View>
            ) : (
              items.map((it) => (
                <Pressable
                  key={it.id}
                  style={styles.item}
                  onPress={() => {
                    setOpen(false);
                    navigateToBookingsMain();
                    DeviceEventEmitter.emit(BOOKING_OPEN_DETAIL_EVENT, { bookingId: it.bookingId });
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open booking details: ${it.title}`}
                >
                  <View style={styles.itemDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle} numberOfLines={1}>
                      {it.title}
                    </Text>
                    <Text style={styles.itemBody} numberOfLines={2}>
                      {it.body}
                    </Text>
                    <Text style={styles.itemTime}>{fmtTime(it.createdAt)}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  inlineWrap: {
    flexShrink: 0,
  },
  inlineBell: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  inlineBellPressed: {
    opacity: 0.92,
  },
  fabWrap: {
    position: "absolute",
    right: 14,
    zIndex: 9998,
  },
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(11,18,32,0.86)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.28)",
    justifyContent: "center",
    alignItems: "center",
    ...shadowCompat({ opacity: 0.25, radius: 16, offsetY: 10, elevation: 8 }),
  },
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(11,18,32,0.92)",
  },
  badgeInline: {
    right: 6,
    top: 6,
    borderColor: colors.white,
  },
  badgeText: { color: "#fff", fontWeight: "900", fontSize: 10 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  panel: {
    marginHorizontal: 14,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(15,22,34,0.92)",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.18)",
    ...shadowCompat({ opacity: 0.35, radius: 26, offsetY: 16, elevation: 12 }),
    maxHeight: "70%",
  },
  panelHead: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  panelTitle: { color: "#fff", fontWeight: "900", fontSize: 15 },
  clearBtn: { color: "rgba(148,163,184,0.95)", fontWeight: "800", fontSize: 13 },
  list: { paddingHorizontal: 12, paddingTop: 10 },
  empty: { paddingVertical: 18, paddingHorizontal: 10 },
  emptyTitle: { color: "#fff", fontWeight: "900", fontSize: 14, marginBottom: 4 },
  emptyText: { color: "rgba(148,163,184,0.9)", fontWeight: "700", fontSize: 12.5, lineHeight: 18 },
  item: {
    flexDirection: "row",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 10,
  },
  itemDot: { width: 10, height: 10, borderRadius: 6, backgroundColor: colors.primaryTeal, marginTop: 3 },
  itemTitle: { color: "rgba(226,232,240,0.96)", fontWeight: "900", fontSize: 13.5 },
  itemBody: { marginTop: 2, color: "rgba(148,163,184,0.92)", fontWeight: "700", fontSize: 12.5, lineHeight: 17 },
  itemTime: { marginTop: 6, color: "rgba(148,163,184,0.75)", fontWeight: "700", fontSize: 11.5 },
});

