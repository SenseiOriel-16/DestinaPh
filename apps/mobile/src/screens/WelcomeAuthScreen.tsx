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
import { isValidUsernameFormat, normalizeUsername, resolveLoginEmail } from "../lib/authUsername";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";
import { shadowCompat, textShadowCompat } from "../lib/rnWebStyleCompat";
import { PasswordField } from "../components/PasswordField";
import { BrandAppIcon } from "../ui/BrandAppIcon";
import { GlassPanel } from "../ui/GlassPanel";

type Props = NativeStackScreenProps<RootStackParamList, "WelcomeAuth">;

export function WelcomeAuthScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const mode = route.params.mode;
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setFullName("");
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setMessage(null);
  }, [route.params.mode]);

  const goInterests = () => {
    navigation.navigate("InterestSelect", { intent: "onboarding" });
  };

  const onSignUp = async () => {
    setMessage(null);
    const name = fullName.trim();
    const uname = normalizeUsername(username);
    const mail = email.trim().toLowerCase();
    if (!name) {
      setMessage("Please enter your full name.");
      return;
    }
    if (!isValidUsernameFormat(uname)) {
      setMessage("Username: 3–24 characters, letters, numbers, or underscore only.");
      return;
    }
    if (!mail.includes("@")) {
      setMessage("Please enter a valid email.");
      return;
    }
    if (password.length < 6) {
      setMessage("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    const { data: free, error: availErr } = await supabase.rpc("is_username_available", { p_username: uname });
    if (availErr) {
      setBusy(false);
      setMessage(availErr.message);
      return;
    }
    if (free === false) {
      setBusy(false);
      setMessage("That username is already taken.");
      return;
    }
    const { data, error } = await supabase.auth.signUp({
      email: mail,
      password,
      options: {
        data: {
          full_name: name,
          username: uname,
          role: "consumer",
        },
      },
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    if (!data.session) {
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email: mail, password });
      if (signInErr) {
        setBusy(false);
        setMessage(
          "Account created. Open the link in your email to confirm your address, then return here and sign in.",
        );
        return;
      }
    }
    setBusy(false);
    goInterests();
  };

  const onSignIn = async () => {
    setMessage(null);
    setBusy(true);
    const resolved = await resolveLoginEmail(supabase, email);
    if (resolved.error || !resolved.email) {
      setBusy(false);
      setMessage(resolved.error ?? "We could not find that email or username.");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolved.email,
      password,
    });
    if (error) {
      setBusy(false);
      setMessage(error.message);
      return;
    }
    const uid = data.user?.id;
    if (uid) {
      const metaRole = (data.user?.user_metadata as any)?.role;
      if (metaRole && metaRole !== "consumer") {
        await supabase.auth.signOut();
        setBusy(false);
        setMessage("This email is not a mobile user account. Please use the correct app for your account type.");
        return;
      }
      // Fallback to profiles only if role is missing in metadata.
      if (!metaRole) {
        const { data: profile, error: profErr } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", uid)
          .maybeSingle();
        if (profErr) {
          // If profiles is temporarily broken (e.g. RLS recursion), don't block sign-in.
          console.warn("[DestinaPH] role check skipped:", profErr.message);
        } else if ((profile as any)?.role && (profile as any)?.role !== "consumer") {
          await supabase.auth.signOut();
          setBusy(false);
          setMessage("This email is not a mobile user account. Please use the correct app for your account type.");
          return;
        }
      }
    }
    setBusy(false);
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

            <GlassPanel
              style={styles.brandGlassOuter}
              contentStyle={styles.brandGlassInner}
              borderRadius={24}
              variant="frosted"
              intensity={60}
            >
              <BrandAppIcon size={72} glass />
              <Text style={styles.brandName}>DestinaPH</Text>
              <View style={styles.taglineRow}>
                <View style={styles.taglineLine} />
                <Text style={styles.taglineText}>{"Discover Destinations Para Sa'yo."}</Text>
                <View style={styles.taglineLine} />
              </View>
            </GlassPanel>

            <Text style={styles.screenTitle}>{mode === "signup" ? "Create account" : "Sign in"}</Text>
            <Text style={styles.screenSub}>
              {mode === "signup"
                ? "Choose a unique username and the email you will use for booking confirmations."
                : "Sign in with your email or username — you will pick your interests next."}
            </Text>

            <GlassPanel style={styles.cardOuter} contentStyle={styles.cardInner} borderRadius={22} intensity={58}>
              {mode === "signup" && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Full name</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="person-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      value={fullName}
                      onChangeText={setFullName}
                      placeholder="Halimbawa: Juan dela Cruz"
                      placeholderTextColor={colors.muted2}
                    />
                  </View>
                </View>
              )}

              {mode === "signup" && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Username</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="at-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="Hal.: juandelacruz"
                      placeholderTextColor={colors.muted2}
                    />
                  </View>
                </View>
              )}

              <View style={[styles.fieldBlock, mode === "signup" && { marginTop: 4 }]}>
                <Text style={styles.label}>{mode === "signup" ? "Email" : "Email or username"}</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="mail-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType={mode === "signup" ? "email-address" : "default"}
                    autoComplete={mode === "signup" ? "email" : "username"}
                    value={email}
                    onChangeText={setEmail}
                    placeholder={mode === "signup" ? "email@halimbawa.com" : "Email o username"}
                    placeholderTextColor={colors.muted2}
                  />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Password</Text>
                <View style={styles.inputShell}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
                  <PasswordField
                    variant="inline"
                    inputStyle={styles.input}
                    value={password}
                    onChangeText={setPassword}
                    placeholder={mode === "signup" ? "Minimum 6 characters" : "Enter password"}
                    autoComplete={mode === "signup" ? "password-new" : "password"}
                    textContentType={mode === "signup" ? "newPassword" : "password"}
                  />
                </View>
              </View>

              {mode === "signup" && (
                <View style={styles.fieldBlock}>
                  <Text style={styles.label}>Confirm password</Text>
                  <View style={styles.inputShell}>
                    <Ionicons name="lock-closed-outline" size={20} color={colors.muted2} style={styles.inputIcon} />
                    <PasswordField
                      variant="inline"
                      inputStyle={styles.input}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-enter password"
                      autoComplete="password-new"
                      textContentType="newPassword"
                    />
                  </View>
                </View>
              )}

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

              {mode === "signin" ? (
                <Pressable
                  style={styles.forgotRow}
                  onPress={() => navigation.navigate("ForgotPassword")}
                  disabled={busy}
                  hitSlop={8}
                >
                  <Text style={[styles.switchLink, busy && styles.disabledText]}>Forgot password?</Text>
                </Pressable>
              ) : null}
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
  brandGlassOuter: {
    alignSelf: "center",
    maxWidth: 360,
    width: "100%",
    marginBottom: 20,
  },
  brandGlassInner: {
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
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
    ...textShadowCompat({ color: "rgba(0,0,0,0.2)", offsetY: 1, radius: 4 }),
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
    borderColor: "rgba(255,255,255,0.68)",
    backgroundColor: "rgba(255,255,255,0.22)",
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
    ...shadowCompat({ opacity: 0.18, radius: 10, offsetY: 4, elevation: 4 }),
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
  forgotRow: {
    marginTop: 14,
    alignItems: "center",
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
  disabledText: {
    opacity: 0.6,
  },
});
