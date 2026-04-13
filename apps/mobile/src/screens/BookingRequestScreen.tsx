import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { RootStackParamList } from "../../App";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "BookingRequest">;

export function BookingRequestScreen({ route, navigation }: Props) {
  const { businessId } = route.params;
  const [placeName, setPlaceName] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("businesses").select("name").eq("id", businessId).maybeSingle();
      if (data) setPlaceName(String(data.name ?? ""));
    })();
  }, [businessId]);

  const submit = async () => {
    setSending(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) {
        Alert.alert("Sign in", "Please sign in as a traveler (consumer) to book.");
        return;
      }
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      if (profile?.role !== "consumer") {
        Alert.alert("Consumer account required", "Bookings are for traveler accounts (consumer role) only.");
        return;
      }
      const { error } = await supabase.from("bookings").insert({
        business_id: businessId,
        user_id: uid,
        notes: notes.trim() || null,
        status: "requested",
      });
      if (error) {
        Alert.alert("Could not submit", error.message);
        return;
      }
      Alert.alert("Thank you", "Your booking request has been sent.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={styles.title}>Booking / reservation</Text>
      <Text style={styles.sub}>{placeName || "Destination"}</Text>
      <Text style={styles.hint}>
        Include date, time, party size, or any details the business should know.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Booking details…"
        placeholderTextColor={colors.muted}
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />
      <Pressable style={[styles.btn, sending && { opacity: 0.7 }]} disabled={sending} onPress={() => void submit()}>
        <Text style={styles.btnTxt}>{sending ? "Submitting…" : "Send request"}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.pageBg },
  title: { fontSize: 22, fontWeight: "800", color: colors.navy },
  sub: { marginTop: 6, fontSize: 16, fontWeight: "600", color: colors.primaryTeal },
  hint: { marginTop: 12, fontSize: 14, color: colors.muted, lineHeight: 20 },
  input: {
    marginTop: 16,
    minHeight: 140,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.white,
  },
  btn: {
    marginTop: 20,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  btnTxt: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
