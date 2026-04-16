import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import type { NavigationProp } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import type { TabParamList } from "../navigation/tabTypes";
import { PasswordField } from "../components/PasswordField";
import { TabInlineBackButton } from "../components/ScreenBackBar";
import { isValidUsernameFormat, normalizeUsername, resolveLoginEmail } from "../lib/authUsername";
import { shadowCompat } from "../lib/rnWebStyleCompat";
import { supabase } from "../lib/supabase";
import { uploadProfileAvatar } from "../lib/uploadProfileAvatar";
import { colors } from "../theme/colors";
import { openTermsPrivacy } from "../lib/termsPrivacy";

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, "Profile">,
  NativeStackScreenProps<RootStackParamList>
>;

type MenuItem = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
};

function rootNav(navigation: Props["navigation"]): NavigationProp<RootStackParamList> | undefined {
  return navigation.getParent() as NavigationProp<RootStackParamList> | undefined;
}

/** Stack screens opened from the Profile tab (typed for `navigate`). */
type ProfileStackLink = "Settings" | "HelpSupport" | "AboutDestinaPH" | "Favorites" | "Reviews" | "EditProfile";

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarBust, setAvatarBust] = useState(0);
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const refresh = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const mail = session.session?.user.email ?? null;
    const uid = session.session?.user.id ?? null;
    setSessionEmail(mail);
    setUserId(uid);
    const meta = session.session?.user.user_metadata as { full_name?: string; avatar_url?: string } | undefined;
    if (uid) {
      const { data: row } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, username")
        .eq("id", uid)
        .maybeSingle();
      const uname = row?.username?.trim() || null;
      setProfileUsername(uname);
      setDisplayName(row?.full_name?.trim() || meta?.full_name || mail?.split("@")[0] || "Traveler");
      setAvatarUrl(row?.avatar_url ?? meta?.avatar_url ?? null);
    } else {
      setProfileUsername(null);
      setDisplayName(mail?.split("@")[0] ?? "Traveler");
      setAvatarUrl(null);
    }
    setAvatarBust(Date.now());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("destinaph-profile-updated", () => {
      void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const mail = session?.user.email ?? null;
      const uid = session?.user.id ?? null;
      setSessionEmail(mail);
      setUserId(uid);
      if (!uid) {
        setProfileUsername(null);
        setAvatarUrl(null);
        setDisplayName(mail?.split("@")[0] ?? "Traveler");
        setAvatarBust(Date.now());
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signUp = async () => {
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
    if (!mail || !mail.includes("@")) {
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
    const { data: free, error: availErr } = await supabase.rpc("is_username_available", { p_username: uname });
    if (availErr) {
      setMessage(availErr.message);
      return;
    }
    if (free === false) {
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
      setMessage(error.message);
      return;
    }
    if (data.session) {
      setMessage("Welcome! You're signed in.");
      setConfirmPassword("");
      await refresh();
      return;
    }
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: mail, password });
    if (!signInErr) {
      setMessage("Welcome! You're signed in.");
      setConfirmPassword("");
      await refresh();
      return;
    }
    setMessage(
      "Account created. Open the link in your email to confirm, then use Sign in here.",
    );
    setConfirmPassword("");
  };

  const signIn = async () => {
    setMessage(null);
    const resolved = await resolveLoginEmail(supabase, email);
    if (resolved.error || !resolved.email) {
      setMessage(resolved.error ?? "We could not find that email or username.");
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: resolved.email, password });
    setMessage(error ? error.message : "Welcome back!");
    await refresh();
  };

  const signOut = async () => {
    // Ensure UI updates immediately even if network is slow/unavailable.
    setSessionEmail(null);
    setUserId(null);
    setProfileUsername(null);
    setAvatarUrl(null);
    setDisplayName("Traveler");
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      // Keep this silent-ish; user stays signed-in if signOut fails.
      setMessage(error.message);
    }
    await refresh();
  };

  const confirmSignOut = () => {
    setLogoutOpen(true);
  };

  const openRoot = (name: ProfileStackLink) => {
    rootNav(navigation)?.navigate(name);
  };

  const pickAvatar = async () => {
    if (!userId || !sessionEmail) {
      Alert.alert("Profile", "Sign in to set a profile photo.");
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Photos", "Please allow photo library access to change your picture.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]?.uri) return;
    setAvatarBusy(true);
    try {
      const out = await uploadProfileAvatar(supabase, userId, res.assets[0].uri);
      if ("error" in out) {
        Alert.alert("Upload failed", out.error);
        return;
      }
      setAvatarUrl(out.publicUrl);
      setAvatarBust(Date.now());
    } finally {
      setAvatarBusy(false);
    }
  };

  const menu: MenuItem[] = [
    {
      key: "bookings",
      label: "My Bookings",
      icon: "calendar-outline",
      onPress: () => navigation.navigate("Bookings"),
    },
    {
      key: "messages",
      label: "Messages",
      icon: "chatbubble-ellipses-outline",
      onPress: () => rootNav(navigation)?.navigate("MessagesInbox" as any),
    },
    {
      key: "fav",
      label: "My Favorites",
      icon: "heart-outline",
      onPress: () => openRoot("Favorites"),
    },
    {
      key: "rev",
      label: "My Reviews",
      icon: "star-outline",
      onPress: () => openRoot("Reviews"),
    },
    {
      key: "help",
      label: "Help & Support",
      icon: "help-circle-outline",
      onPress: () => openRoot("HelpSupport"),
    },
    {
      key: "about",
      label: "About DestinaPH",
      icon: "information-circle-outline",
      onPress: () => openRoot("AboutDestinaPH"),
    },
    {
      key: "settings",
      label: "Settings",
      icon: "settings-outline",
      onPress: () => openRoot("Settings"),
    },
    {
      key: "terms",
      label: "Terms & Privacy",
      icon: "document-text-outline",
      onPress: () => openTermsPrivacy(),
    },
  ];

  const avatarUri =
    avatarUrl && avatarUrl.length > 0
      ? `${avatarUrl.split("?")[0]}?v=${avatarBust}`
      : sessionEmail
        ? `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(sessionEmail)}`
        : null;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 110 }}
      bounces={false}
    >
      <Modal visible={logoutOpen} transparent animationType="fade" onRequestClose={() => setLogoutOpen(false)}>
        <Pressable style={styles.logoutOverlay} onPress={() => setLogoutOpen(false)} />
        <View style={styles.logoutWrap} pointerEvents="box-none">
          <View style={styles.logoutModal}>
            <View style={styles.logoutIconWrap}>
              <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            </View>
            <Text style={styles.logoutTitle}>Log out?</Text>
            <Text style={styles.logoutSub}>Are you sure you want to log out of your account?</Text>

            <View style={styles.logoutBtns}>
              <Pressable
                style={({ pressed }) => [styles.logoutBtn, styles.logoutBtnGhost, pressed && { opacity: 0.9 }]}
                onPress={() => setLogoutOpen(false)}
              >
                <Text style={styles.logoutBtnGhostTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.logoutBtn, styles.logoutBtnDanger, pressed && { opacity: 0.92 }]}
                onPress={() => {
                  setLogoutOpen(false);
                  void signOut();
                }}
              >
                <Text style={styles.logoutBtnDangerTxt}>Log out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <View style={[styles.header, { paddingTop: Math.max(insets.top, 18) }]}>
        <View style={styles.headerRow}>
          <TabInlineBackButton iconColor={colors.white} size={28} />
          <Pressable onPress={() => void pickAvatar()} style={styles.avatarWrap} disabled={avatarBusy || !sessionEmail}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Ionicons name="person" size={40} color={colors.white} />
              </View>
            )}
            {avatarBusy ? (
              <View style={styles.avatarBusy}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : null}
            {sessionEmail ? (
              <View style={styles.camDot}>
                <Ionicons name="camera" size={14} color={colors.navy} />
              </View>
            ) : null}
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            {sessionEmail && profileUsername ? <Text style={styles.usernameLine}>@{profileUsername}</Text> : null}
            <Text style={styles.email}>{sessionEmail ?? "Sign in to sync your account"}</Text>
            <Pressable
              style={[styles.editBtn, !sessionEmail && { opacity: 0.45 }]}
              disabled={!sessionEmail}
              onPress={() => openRoot("EditProfile")}
            >
              <Ionicons name="create-outline" size={16} color={colors.white} />
              <Text style={styles.editTxt}>Edit Profile</Text>
            </Pressable>
            {sessionEmail ? (
              <Text style={styles.tapHint}>Tap your photo to change it</Text>
            ) : null}
          </View>
        </View>
      </View>

      {sessionEmail ? (
        <View style={styles.menu}>
          {menu.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              style={[styles.menuRow, i > 0 && styles.menuBorder]}
            >
              <Ionicons name={item.icon} size={22} color={colors.muted2} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.border} />
            </Pressable>
          ))}
          <Pressable onPress={confirmSignOut} style={[styles.menuRow, styles.menuBorder]}>
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            <Text style={[styles.menuLabel, { color: colors.danger }]}>Log Out</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.authCard}>
        <Text style={styles.authTitle}>Account</Text>
        <Text style={styles.authSub}>
          {sessionEmail ? `Signed in as ${sessionEmail}` : "Create a traveler account to use bookings."}
        </Text>
        {!sessionEmail && (
          <>
            <View style={styles.authModeRow}>
              <Pressable
                style={[styles.authModeBtn, authMode === "signin" && styles.authModeBtnOn]}
                onPress={() => {
                  setAuthMode("signin");
                  setMessage(null);
                }}
              >
                <Text style={[styles.authModeTxt, authMode === "signin" && styles.authModeTxtOn]}>Sign in</Text>
              </Pressable>
              <Pressable
                style={[styles.authModeBtn, authMode === "signup" && styles.authModeBtnOn]}
                onPress={() => {
                  setAuthMode("signup");
                  setMessage(null);
                }}
              >
                <Text style={[styles.authModeTxt, authMode === "signup" && styles.authModeTxtOn]}>Sign up</Text>
              </Pressable>
            </View>

            {authMode === "signup" ? (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Halimbawa: Juan dela Cruz"
                  placeholderTextColor={colors.muted2}
                />
                <Text style={[styles.label, { marginTop: 10 }]}>Username</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Hal.: juandelacruz"
                  placeholderTextColor={colors.muted2}
                />
                <Text style={[styles.label, { marginTop: 10 }]}>Email</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="email@halimbawa.com"
                  placeholderTextColor={colors.muted2}
                />
                <Text style={[styles.label, { marginTop: 10 }]}>Password</Text>
                <PasswordField
                  inputStyle={styles.passwordInputInner}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password (min. 6 characters)"
                  textContentType="newPassword"
                />
                <Text style={[styles.label, { marginTop: 10 }]}>Confirm password</Text>
                <PasswordField
                  inputStyle={styles.passwordInputInner}
                  autoCapitalize="none"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Re-enter password"
                  textContentType="newPassword"
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { marginTop: 12 }]}>Email or username</Text>
                <TextInput
                  style={styles.input}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email o username"
                  placeholderTextColor={colors.muted2}
                />
                <Text style={[styles.label, { marginTop: 10 }]}>Password</Text>
                <PasswordField
                  inputStyle={styles.passwordInputInner}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  textContentType="password"
                />
              </>
            )}

            {message ? <Text style={styles.msg}>{message}</Text> : null}

            <Pressable
              style={[styles.primaryFull, { marginTop: 16 }]}
              onPress={() => void (authMode === "signup" ? signUp() : signIn())}
            >
              <Text style={styles.primaryText}>{authMode === "signup" ? "Create account" : "Sign in"}</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    backgroundColor: colors.primaryTealDeep,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
  },
  avatarWrap: {
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 999,
    position: "relative",
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  avatarPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 38,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  camDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primaryTeal,
  },
  tapHint: {
    marginTop: 8,
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.white,
  },
  usernameLine: {
    marginTop: 2,
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.92)",
  },
  email: {
    marginTop: 4,
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.85)",
  },
  editTxt: {
    color: colors.white,
    fontWeight: "600",
    fontSize: 13,
  },
  menu: {
    marginTop: 18,
    paddingHorizontal: 8,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  menuBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  menuLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: colors.navy,
  },
  authCard: {
    marginHorizontal: 20,
    marginTop: 24,
    backgroundColor: colors.pageBg,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  authTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.navy,
  },
  authSub: {
    marginTop: 6,
    color: colors.muted,
    fontSize: 13,
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.muted2,
  },
  input: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: colors.white,
    color: colors.text,
  },
  passwordInputInner: {
    paddingVertical: 10,
  },
  msg: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
  },
  primaryFull: {
    backgroundColor: colors.primaryTeal,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  authModeRow: {
    flexDirection: "row",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginTop: 8,
  },
  authModeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  authModeBtnOn: {
    backgroundColor: colors.primaryTeal,
  },
  authModeTxt: {
    fontWeight: "700",
    fontSize: 14,
    color: colors.muted2,
  },
  authModeTxtOn: {
    color: "#fff",
  },

  // Logout confirm modal
  logoutOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 23, 42, 0.55)" },
  logoutWrap: { flex: 1, justifyContent: "center", paddingHorizontal: 18 },
  logoutModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadowCompat({ opacity: 0.18, radius: 22, offsetY: 12, elevation: 12 }),
  },
  logoutIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(239,68,68,0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logoutTitle: { fontSize: 18, fontWeight: "900", color: colors.navy },
  logoutSub: { marginTop: 6, fontSize: 13.5, fontWeight: "600", color: colors.muted2, lineHeight: 18 },
  logoutBtns: { flexDirection: "row", gap: 10, marginTop: 16 },
  logoutBtn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  logoutBtnGhost: { backgroundColor: "rgba(15,23,42,0.06)", borderWidth: 1, borderColor: "rgba(148,163,184,0.30)" },
  logoutBtnGhostTxt: { fontSize: 14.5, fontWeight: "800", color: colors.navy },
  logoutBtnDanger: { backgroundColor: colors.danger },
  logoutBtnDangerTxt: { fontSize: 14.5, fontWeight: "900", color: "#fff" },
});
