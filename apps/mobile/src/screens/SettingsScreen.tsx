import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { FlashNotice } from "../components/FlashNotice";
import { PasswordField } from "../components/PasswordField";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen(_props: Props) {
  const insets = useSafeAreaInsets();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const clearFlash = useCallback(() => setFlash(null), []);

  const changePassword = async () => {
    const email = (await supabase.auth.getSession()).data.session?.user?.email;
    if (!email) {
      Alert.alert("Settings", "You need to be signed in to change your password.");
      return;
    }
    const cur = currentPassword.trim();
    const next = newPassword.trim();
    const confirm = confirmPassword.trim();
    if (!cur || !next || !confirm) {
      Alert.alert("Settings", "Please fill in all password fields.");
      return;
    }
    if (next.length < 6) {
      Alert.alert("Settings", "New password must be at least 6 characters.");
      return;
    }
    if (next !== confirm) {
      Alert.alert("Settings", "New password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: cur });
      if (signErr) {
        Alert.alert("Settings", "Current password is incorrect.");
        return;
      }
      const { error: updErr } = await supabase.auth.updateUser({ password: next });
      if (updErr) {
        Alert.alert("Settings", updErr.message);
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFlash("Password updated successfully.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingTop: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      <FlashNotice message={flash} variant="success" onDismiss={clearFlash} />
      <View style={styles.card}>
        <Text style={styles.h1}>Change password</Text>
        <Text style={styles.lead}>
          Enter your current password, then choose a new one. Use a strong password you do not reuse elsewhere.
        </Text>

        <Text style={styles.label}>Current password</Text>
        <PasswordField
          autoCapitalize="none"
          editable={!busy}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          placeholder="Enter current password"
          textContentType="password"
        />

        <Text style={[styles.label, styles.labelSp]}>New password</Text>
        <PasswordField
          autoCapitalize="none"
          editable={!busy}
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="New password (min. 6 characters)"
          textContentType="newPassword"
        />

        <Text style={[styles.label, styles.labelSp]}>Confirm new password</Text>
        <PasswordField
          autoCapitalize="none"
          editable={!busy}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter new password"
          textContentType="newPassword"
        />

        <Pressable
          style={[styles.primary, busy && styles.primaryDisabled]}
          onPress={() => void changePassword()}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Update password</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.card, styles.cardMuted]}>
        <Text style={styles.h2}>Account tips</Text>
        <Text style={styles.muted}>
          If you signed in with a provider that does not use a password, password change may not apply. Use the same
          email and password you use on the DestinaPH sign-in screen.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardMuted: {
    marginTop: 16,
    backgroundColor: colors.chipIdle,
  },
  h1: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.navy,
  },
  h2: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  lead: {
    marginTop: 8,
    marginBottom: 18,
    fontSize: 14,
    color: colors.muted,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted2,
  },
  labelSp: {
    marginTop: 12,
  },
  primary: {
    marginTop: 22,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryDisabled: {
    opacity: 0.7,
  },
  primaryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
  muted: {
    fontSize: 13,
    color: colors.muted,
    lineHeight: 19,
  },
});
