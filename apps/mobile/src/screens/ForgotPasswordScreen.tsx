import { Ionicons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { RootStackParamList } from "../../App";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { PasswordField } from "../components/PasswordField";

/** Supabase Edge Function **slug** (last path segment). */
const FN_PASSWORD_RESET_REQUEST =
  process.env.EXPO_PUBLIC_EDGE_FN_PASSWORD_RESET_REQUEST ?? "password-reset-request";
const FN_PASSWORD_RESET_VERIFY =
  process.env.EXPO_PUBLIC_EDGE_FN_PASSWORD_RESET_VERIFY ?? "password-reset-verify";
const FN_PASSWORD_RESET_CONFIRM =
  process.env.EXPO_PUBLIC_EDGE_FN_PASSWORD_RESET_CONFIRM ?? "password-reset-confirm";

type Props = NativeStackScreenProps<RootStackParamList, "ForgotPassword">;
type Step = "email" | "otp" | "reset" | "done";

function formatSeconds(s: number) {
  const n = Math.max(0, Math.floor(s));
  const mm = String(Math.floor(n / 60)).padStart(2, "0");
  const ss = String(n % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function ForgotPasswordScreen({ navigation }: Props) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [resendRemaining, setResendRemaining] = useState(0);
  const canResend = step === "otp" && resendRemaining <= 0 && !busy;

  useEffect(() => {
    if (resendRemaining <= 0) return;
    const t = setInterval(() => setResendRemaining((x) => Math.max(0, x - 1)), 1000);
    return () => clearInterval(t);
  }, [resendRemaining]);

  const emailOk = useMemo(() => email.trim().includes("@"), [email]);
  const pwOk = useMemo(
    () => newPassword.length >= 6 && newPassword === confirmPassword,
    [newPassword, confirmPassword],
  );

  const requestOtp = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke(FN_PASSWORD_RESET_REQUEST, {
        body: { email: email.trim().toLowerCase() },
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      const retry = typeof (data as any)?.retry_after_seconds === "number" ? (data as any).retry_after_seconds : 60;
      setResendRemaining(Math.max(1, Math.min(60, retry)));
      setStep("otp");
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke(FN_PASSWORD_RESET_VERIFY, {
        body: { email: email.trim().toLowerCase(), otp: otp.trim() },
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      const token = (data as any)?.reset_token as string | undefined;
      if (!token) {
        setMessage("Unable to verify OTP.");
        return;
      }
      setResetToken(token);
      setStep("reset");
    } finally {
      setBusy(false);
    }
  };

  const confirmReset = async () => {
    if (!resetToken) return;
    if (!pwOk) {
      setMessage("Passwords must match and be at least 6 characters.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.functions.invoke(FN_PASSWORD_RESET_CONFIRM, {
        body: { email: email.trim().toLowerCase(), reset_token: resetToken, new_password: newPassword },
      });
      if (error) {
        setMessage(error.message);
        return;
      }
      setStep("done");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.headRow}>
        <Pressable onPress={() => navigation.goBack()} disabled={busy} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
          <Text style={styles.backText}>Back</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.sub}>We’ll email you a 6-digit OTP. It expires in 5 minutes.</Text>

        {step === "email" ? (
          <>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputShell}>
              <Ionicons name="mail-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
                placeholder="email@halimbawa.com"
                placeholderTextColor={colors.muted2}
              />
            </View>
          </>
        ) : null}

        {step === "otp" ? (
          <>
            <Text style={styles.label}>Enter OTP</Text>
            <View style={styles.inputShell}>
              <Ionicons name="keypad-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                inputMode="numeric"
                keyboardType="number-pad"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/[^\d]/g, "").slice(0, 6))}
                placeholder="6 digits"
                placeholderTextColor={colors.muted2}
              />
            </View>

            <View style={styles.row}>
              <Pressable
                disabled={!canResend}
                onPress={() => void requestOtp()}
                style={({ pressed }) => [
                  styles.miniBtn,
                  pressed && canResend && { opacity: 0.92 },
                  !canResend && styles.miniBtnDisabled,
                ]}
              >
                <Text style={[styles.miniBtnText, !canResend && styles.miniBtnTextDisabled]}>
                  {canResend ? "Resend OTP" : `Resend in ${formatSeconds(resendRemaining)}`}
                </Text>
              </Pressable>
              <Pressable
                disabled={busy}
                onPress={() => setStep("email")}
                style={({ pressed }) => [
                  styles.miniBtn,
                  pressed && !busy && { opacity: 0.92 },
                  busy && styles.miniBtnDisabled,
                ]}
              >
                <Text style={[styles.miniBtnText, busy && styles.miniBtnTextDisabled]}>Change email</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {step === "reset" ? (
          <>
            <Text style={styles.label}>New password</Text>
            <View style={styles.inputShell}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
              <PasswordField
                variant="inline"
                inputStyle={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                autoComplete="new-password"
              />
            </View>

            <Text style={styles.label}>Confirm password</Text>
            <View style={styles.inputShell}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
              <PasswordField
                variant="inline"
                inputStyle={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                autoComplete="new-password"
              />
            </View>
          </>
        ) : null}

        {message ? (
          <View style={styles.msgBox}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={styles.msg}>{message}</Text>
          </View>
        ) : null}

        {step === "done" ? (
          <View style={styles.msgBoxOk}>
            <Ionicons name="checkmark-circle" size={18} color={colors.primaryTeal} />
            <Text style={styles.msgOk}>Password updated. You can sign in now.</Text>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.btn, pressed && !busy && { opacity: 0.92 }, busy && styles.btnDisabled]}
          disabled={
            busy ||
            (step === "email" && !emailOk) ||
            (step === "otp" && otp.length !== 6) ||
            (step === "reset" && !pwOk) ||
            step === "done"
          }
          onPress={() => void (step === "email" ? requestOtp() : step === "otp" ? verifyOtp() : confirmReset())}
        >
          <Text style={styles.btnText}>
            {step === "email" ? (busy ? "Sending…" : "Send OTP") : null}
            {step === "otp" ? (busy ? "Verifying…" : "Verify OTP") : null}
            {step === "reset" ? (busy ? "Updating…" : "Update password") : null}
            {step === "done" ? "Done" : null}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.pageBg, padding: 18 },
  headRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 },
  backText: { fontSize: 16, fontWeight: "700", color: colors.text },
  card: {
    borderRadius: 18,
    padding: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 20, fontWeight: "900", color: colors.text, letterSpacing: -0.2 },
  sub: { marginTop: 6, color: colors.muted2, fontWeight: "600", lineHeight: 18 },
  label: { marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: "800", color: colors.text },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(15, 31, 53, 0.03)",
    paddingHorizontal: 4,
  },
  inputIcon: { marginLeft: 10 },
  input: { flex: 1, paddingHorizontal: 10, paddingVertical: 12, fontSize: 16, color: colors.text },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
  miniBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(14, 201, 182, 0.35)",
    backgroundColor: "rgba(14, 201, 182, 0.10)",
  },
  miniBtnDisabled: { opacity: 0.55 },
  miniBtnText: { fontWeight: "900", color: colors.primaryTeal, fontSize: 13 },
  miniBtnTextDisabled: { color: colors.muted2 },
  msgBox: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(220, 53, 69, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(220, 53, 69, 0.22)",
  },
  msg: { flex: 1, color: colors.danger, fontWeight: "700", lineHeight: 18 },
  msgBoxOk: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(14, 201, 182, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(14, 201, 182, 0.22)",
  },
  msgOk: { flex: 1, color: colors.text, fontWeight: "700", lineHeight: 18 },
  btn: {
    marginTop: 16,
    backgroundColor: colors.primaryTeal,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
});

