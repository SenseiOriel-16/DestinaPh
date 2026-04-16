import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import { DeviceEventEmitter, FlatList, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { firstPhotoPublicUrl } from "../lib/businessDisplay";
import { listMyConversations, type ConversationRow } from "../lib/chat";
import { colors } from "../theme/colors";
import { shadowCompat } from "../lib/rnWebStyleCompat";
import { CHAT_OPEN_EVENT } from "../components/ChatOverlay";

export function MessagesInboxScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [hint, setHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    const out = await listMyConversations();
    if ("error" in out) {
      setHint(out.error);
      setRows([]);
      return;
    }
    setHint(null);
    setRows(out.rows);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={[styles.page, { paddingTop: 12 }]}>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}

      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 12) + 20, gap: 12, paddingTop: 8 }}
        renderItem={({ item }) => {
          const b = item.businesses;
          const thumb = firstPhotoPublicUrl(b?.business_photos as any);
          return (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.96 }]}
              onPress={() => DeviceEventEmitter.emit(CHAT_OPEN_EVENT, { businessId: item.business_id })}
            >
              {thumb ? (
                <Image source={{ uri: thumb }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]}>
                  <Ionicons name="business" size={18} color={colors.primaryTealDeep} />
                </View>
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{b?.name ?? "Business"}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {item.last_message_text?.trim() ? item.last_message_text.trim() : "Tap to message"}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted2} />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          !hint ? <Text style={styles.empty}>No messages yet. Open any destination and tap the message icon.</Text> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg, paddingHorizontal: 20 },
  hint: { marginTop: 6, color: colors.muted, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowCompat({ opacity: 0.06, radius: 10, offsetY: 4, elevation: 2 }),
  },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(4,120,126,0.10)" },
  avatarPh: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(4,120,126,0.20)" },
  name: { fontSize: 15, fontWeight: "800", color: colors.navy },
  preview: { marginTop: 2, fontSize: 13, fontWeight: "600", color: colors.muted2 },
  empty: { marginTop: 24, textAlign: "center", color: colors.muted2, fontSize: 14, lineHeight: 20 },
});

