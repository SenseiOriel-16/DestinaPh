import { useMemo } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

export function TermsPrivacyModal({
  visible,
  mustAccept,
  onAccept,
  onClose,
}: {
  visible: boolean;
  mustAccept: boolean;
  onAccept: () => void;
  onClose: () => void;
}) {
  const updated = useMemo(() => new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }), []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={mustAccept ? undefined : onClose}>
      <Pressable style={styles.overlay} onPress={mustAccept ? undefined : onClose} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.headIcon}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primaryTeal} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Terms & Privacy</Text>
              <Text style={styles.sub}>Last updated {updated}</Text>
            </View>
            {!mustAccept ? (
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.muted2} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            <Text style={styles.h}>Terms & Conditions</Text>
            <Text style={styles.p}>
              By using DestinaPH, you agree to use the app responsibly, provide accurate information, and follow platform rules.
              Bookings and payments are subject to the listing owner’s confirmation and policies.
            </Text>

            <Text style={styles.h}>Privacy Policy</Text>
            <Text style={styles.p}>
              We collect the information needed to operate the app (e.g., account info, bookings, and basic usage). We don’t sell
              your personal data. We may share data with service providers only to deliver core features.
            </Text>

            <Text style={styles.h}>Questions?</Text>
            <Text style={styles.p}>
              Contact us at{" "}
              <Text style={styles.link} onPress={() => void Linking.openURL("mailto:help@destinaph.app")}>
                help@destinaph.app
              </Text>
              .
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            {!mustAccept ? (
              <Pressable style={({ pressed }) => [styles.btnGhost, pressed && styles.btnPressed]} onPress={onClose}>
                <Text style={styles.btnGhostTxt}>Close</Text>
              </Pressable>
            ) : null}
            <Pressable style={({ pressed }) => [styles.btnPrimary, pressed && styles.btnPressed]} onPress={onAccept}>
              <Text style={styles.btnPrimaryTxt}>{mustAccept ? "I Agree" : "I Agree (Save)"}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.55)" },
  wrap: { flex: 1, justifyContent: "flex-end", padding: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.10)",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(15,23,42,0.08)",
    backgroundColor: "rgba(11,184,196,0.06)",
  },
  headIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(11,184,196,0.14)",
    borderWidth: 1,
    borderColor: "rgba(11,184,196,0.22)",
  },
  title: { fontSize: 16, fontWeight: "900", color: colors.navy },
  sub: { marginTop: 2, fontSize: 12.5, fontWeight: "700", color: colors.muted },
  body: { maxHeight: 360, paddingHorizontal: 14, paddingVertical: 14 },
  h: { marginTop: 8, fontSize: 14, fontWeight: "900", color: colors.navy },
  p: { marginTop: 6, fontSize: 13.5, lineHeight: 19, color: colors.text, fontWeight: "500" },
  link: { color: colors.primaryTeal, fontWeight: "800" },
  actions: { padding: 14, gap: 10, flexDirection: "row", borderTopWidth: 1, borderTopColor: "rgba(15,23,42,0.08)" },
  btnPrimary: { flex: 1, backgroundColor: colors.primaryTeal, paddingVertical: 13, borderRadius: 14, alignItems: "center" },
  btnPrimaryTxt: { color: "#fff", fontWeight: "900", fontSize: 14.5 },
  btnGhost: {
    flex: 1,
    backgroundColor: "#f8fafc",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)",
  },
  btnGhostTxt: { color: colors.navy, fontWeight: "900", fontSize: 14.5 },
  btnPressed: { opacity: 0.9 },
});

