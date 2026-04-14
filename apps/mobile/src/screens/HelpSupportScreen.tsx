import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "HelpSupport">;

const FAQ = [
  {
    q: "How do I book a destination?",
    a: "Open Explore or Home, pick a place, then tap Reserve now. You need a traveler account; the listing must be approved on the platform.",
  },
  {
    q: "How does the itinerary work?",
    a: "Add stops from destination details, then open the Itinerary tab to reorder or optimize your route for the day.",
  },
  {
    q: "I forgot my password",
    a: "Use Forgot password on the sign-in flow if enabled by your project, or change password from Profile → Settings while signed in.",
  },
];

export function HelpSupportScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const supportEmail = "help@destinaph.app";

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingTop: 12 }}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>Help &amp; Support</Text>
        <Text style={styles.heroSub}>
          Quick answers below. For account-specific issues, email us and include your registered email address.
        </Text>
      </View>

      {FAQ.map((item, i) => (
        <View key={i} style={[styles.card, i > 0 && styles.cardGap]}>
          <Text style={styles.q}>{item.q}</Text>
          <Text style={styles.a}>{item.a}</Text>
        </View>
      ))}

      <View style={[styles.card, styles.cardGap]}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.muted}>We typically reply within 1–2 business days.</Text>
        <Pressable onPress={() => void Linking.openURL(`mailto:${supportEmail}`)} style={styles.emailBtn}>
          <Text style={styles.emailTxt}>{supportEmail}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  hero: {
    marginHorizontal: 20,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.navy,
  },
  heroSub: {
    marginTop: 8,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardGap: {
    marginTop: 12,
  },
  q: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
  },
  a: {
    marginTop: 8,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 6,
  },
  muted: {
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  emailBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryTeal,
  },
  emailTxt: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 15,
  },
});
