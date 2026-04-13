import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import {
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { HERO_BACKGROUND } from "../constants/heroBackground";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { BrandAppIcon } from "../ui/BrandAppIcon";
import { GlassPanel } from "../ui/GlassPanel";

type Props = NativeStackScreenProps<RootStackParamList, "WelcomeAuth">;

export function WelcomeAuthScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const mode = route.params.mode;
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName("");
    setEmail("");
    setPassword("");
    setMessage(null);
  }, [route.params.mode]);

  const goInterests = () => {
    navigation.navigate("InterestSelect", { intent: "onboarding" });
  };

  const onSignUp = async () => {
    setMessage(null);
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role: "consumer",
        },
      },
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    goInterests();
  };

  const onSignIn = async () => {
    setMessage(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    goInterests();
  };

  const switchMode = () => {
    navigation.replace("WelcomeAuth", { mode: mode === "signup" ? "signin" : "signup" });
  };

  return (
    <View style={styles.root}>
      <ImageBackground source={HERO_BACKGROUND} style={styles.bgImage} resizeMode="cover">
        <View style={styles.scrim} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollOuter,
              { paddingBottom: Math.max(insets.bottom, 24), paddingTop: Math.max(insets.top, 12) },
            ]}
          >
            <Pressable style={styles.backRow} onPress={() => navigation.goBack()} disabled={busy} hitSlop={12}>
              <Ionicons name="chevron-back" size={22} color="rgba(255,255,255,0.95)" />
              <Text style={styles.backText}>Back</Text>
            </Pressable>

            <View style={styles.brandCard}>
              <BrandAppIcon size={72} />
              <Text style={styles.brandName}>DestinaPH</Text>
              <View style={styles.taglineRow}>
                <View style={styles.taglineLine} />
                <Text style={styles.taglineText}>{"Discover Destinations Para Sa'yo."}</Text>
                <View style={styles.taglineLine} />
              </View>
            </View>

            <Text style={styles.screenTitle}>{mode === "signup" ? "Create account" : "Sign in"}</Text>
            <Text style={styles.screenSub}>
              {mode === "signup"
                ? "Use the same email you will use for booking confirmations."
                : "Sign in to continue — you will pick your interests next."}
            </Text>

            <GlassPanel style={styles.cardOuter} contentStyle={styles.cardInner} borderRadius={22}>
              {mode === "signup" && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Full name</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="person-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Your name"
                      placeholderTextColor={colors.muted2}
                    />
                  </View>
                </View>
              )}

              <View style={[styles.fieldBlock, mode === "signup" && { marginTop: 4 }]}>
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
                    placeholder="you@example.com"
                    placeholderTextColor={colors.muted2}
                  />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    secureTextEntry
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.muted2}
                    autoComplete={mode === "signup" ? "password-new" : "password"}
                  />
                </View>
              </View>

              {message ? (
                <View style={styles.msgBox}>
                  <Ionicons name="alert-circle" size={18} color={colors.danger} />
                  <Text style={styles.msg}>{message}</Text>
                </View>
              ) : null}

              <Pressable
                style={({ pressed }) => [
                  styles.gradPress,
                  mode === "signin" && styles.signInSubmitOuter,
                  busy && styles.disabled,
                  pressed && !busy && { opacity: 0.92 },
                ]}
                disabled={busy}
                onPress={() => void (mode === "signup" ? onSignUp() : onSignIn())}
              >
                <LinearGradient
                  colors={mode === "signup" ? ["#0BB8C4", "#2A7CC7"] : ["#0F1F35", "#1E3A5F"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.gradInner}
                >
                  <Text style={styles.primaryText}>
                    {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
                  </Text>
                </LinearGradient>
              </Pressable>

              <Pressable style={styles.switchRow} onPress={switchMode} disabled={busy}>
                <Text style={styles.switchMuted}>
                  {mode === "signup" ? "Already have an account? " : "New to DestinaPH? "}
                </Text>
                <Text style={styles.switchLink}>{mode === "signup" ? "Sign in" : "Create account"}</Text>
              </Pressable>
            </GlassPanel>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.heroLetterbox,
  },
  bgImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18, 48, 72, 0.4)",
  },
  flex: {
    flex: 1,
  },
  scrollOuter: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingVertical: 6,
  },
  backText: {
    color: "rgba(255,255,255,0.95)",
    fontWeight: "700",
    fontSize: 16,
  },
  brandCard: {
    alignSelf: "center",
    alignItems: "center",
    maxWidth: 360,
    width: "100%",
    marginBottom: 20,
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.06)",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  brandName: {
    marginTop: 8,
    fontSize: 20,
    fontWeight: "800",
    color: colors.navy,
    letterSpacing: -0.3,
  },
  taglineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
    width: "100%",
    paddingHorizontal: 2,
  },
  taglineLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(30, 43, 78, 0.28)",
    maxHeight: 1,
  },
  taglineText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: "600",
    color: colors.muted2,
    textAlign: "center",
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.5,
    textShadowColor: "rgba(0,0,0,0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  screenSub: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    maxWidth: 340,
    alignSelf: "center",
    fontWeight: "500",
  },
  cardOuter: {
    width: "100%",
  },
  cardInner: {
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
  },
  fieldBlock: {
    marginTop: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.navy,
    marginBottom: 8,
  },
  inputShell: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.55)",
    backgroundColor: "rgba(255,255,255,0.45)",
    paddingHorizontal: 4,
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  msgBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(220, 53, 69, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(220, 53, 69, 0.28)",
  },
  msg: {
    flex: 1,
    color: colors.danger,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  gradPress: {
    marginTop: 22,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  signInSubmitOuter: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.92)",
  },
  gradInner: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
  disabled: {
    opacity: 0.55,
  },
  switchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 4,
  },
  switchMuted: {
    fontSize: 15,
    color: colors.muted2,
  },
  switchLink: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primaryTeal,
  },
});
