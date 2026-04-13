import { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import { CompositeScreenProps, useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NavigationProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../App";
import type { TabParamList } from "../navigation/MainTabs";
import { supabase } from "../lib/supabase";
import { colors } from "../theme/colors";

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

export function ProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const mail = session.session?.user.email ?? null;
    setSessionEmail(mail);
    const { data: userData } = await supabase.auth.getUser();
    const meta = userData.user?.user_metadata as { full_name?: string } | undefined;
    setDisplayName(meta?.full_name ?? mail?.split("@")[0] ?? "Traveler");
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const signUp = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: "consumer",
        },
      },
    });
    setMessage(error ? error.message : "Check your inbox to confirm your email, then sign in.");
  };

  const signIn = async () => {
    setMessage(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setMessage(error ? error.message : "Welcome back!");
    await refresh();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    await refresh();
  };

  const openTravelInterests = () => {
    const tabNav = navigation.getParent();
    const rootNav = tabNav?.getParent() as NavigationProp<RootStackParamList> | undefined;
    rootNav?.navigate("InterestSelect", { intent: "edit" });
  };

  const menu: MenuItem[] = [
    {
      key: "bookings",
      label: "My Bookings",
      icon: "calendar-outline",
      onPress: () => navigation.navigate("Bookings"),
    },
    {
      key: "interests",
      label: "Travel interests",
      icon: "compass-outline",
      onPress: openTravelInterests,
    },
    {
      key: "fav",
      label: "My Favorites",
      icon: "heart-outline",
      onPress: () => Alert.alert("DestinaPH", "Favorites are coming soon."),
    },
    {
      key: "rev",
      label: "My Reviews",
      icon: "star-outline",
      onPress: () => Alert.alert("DestinaPH", "Reviews are coming soon."),
    },
    {
      key: "pay",
      label: "Payment Methods",
      icon: "card-outline",
      onPress: () => Alert.alert("DestinaPH", "Payment methods are coming soon."),
    },
    {
      key: "notif",
      label: "Notifications",
      icon: "notifications-outline",
      onPress: () => Alert.alert("DestinaPH", "Notification settings are coming soon."),
    },
    {
      key: "help",
      label: "Help & Support",
      icon: "help-circle-outline",
      onPress: () => Alert.alert("DestinaPH", "help@destinaph.example"),
    },
    {
      key: "about",
      label: "About DestinaPH",
      icon: "information-circle-outline",
      onPress: () => Alert.alert("DestinaPH", "Discover Destinations. Plan Smarter."),
    },
    {
      key: "settings",
      label: "Settings",
      icon: "settings-outline",
      onPress: () => Alert.alert("DestinaPH", "Settings are coming soon."),
    },
  ];

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 32 }} bounces={false}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 14) }]}>
        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            {sessionEmail ? (
              <Image
                source={{
                  uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(sessionEmail)}`,
                }}
                style={styles.avatar}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarPh]}>
                <Ionicons name="person" size={40} color={colors.white} />
              </View>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{displayName}</Text>
            <Text style={styles.email}>{sessionEmail ?? "Sign in to sync your account"}</Text>
            <Pressable style={styles.editBtn} onPress={() => Alert.alert("Profile", "Profile editing is coming soon.")}>
              <Ionicons name="create-outline" size={16} color={colors.white} />
              <Text style={styles.editTxt}>Edit Profile</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.floatCard}>
        <Pressable
          style={styles.premium}
          onPress={() => Alert.alert("Premium", "Premium membership is coming soon.")}
        >
          <Ionicons name="ribbon" size={28} color={colors.gold} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.premTitle}>Premium Member</Text>
            <Text style={styles.premSub}>Enjoy exclusive access and features.</Text>
            <Text style={styles.premDate}>Valid until June 30, 2026</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.85)" />
        </Pressable>
      </View>

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
        <Pressable
          onPress={() => sessionEmail && void signOut()}
          style={[styles.menuRow, styles.menuBorder, !sessionEmail && { opacity: 0.35 }]}
          disabled={!sessionEmail}
        >
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text style={[styles.menuLabel, { color: colors.danger }]}>Log Out</Text>
        </Pressable>
      </View>

      <View style={styles.authCard}>
        <Text style={styles.authTitle}>Account</Text>
        <Text style={styles.authSub}>
          {sessionEmail ? `Signed in as ${sessionEmail}` : "Create a traveler account to use bookings."}
        </Text>
        {!sessionEmail && (
          <>
            <Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} />
            <Text style={[styles.label, { marginTop: 10 }]}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Text style={[styles.label, { marginTop: 10 }]}>Password</Text>
            <TextInput style={styles.input} secureTextEntry value={password} onChangeText={setPassword} />
            {message && <Text style={styles.msg}>{message}</Text>}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable style={styles.primary} onPress={signUp}>
                <Text style={styles.primaryText}>Sign up</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={signIn}>
                <Text style={styles.secondaryText}>Sign in</Text>
              </Pressable>
            </View>
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
    paddingBottom: 56,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatarWrap: {
    borderWidth: 3,
    borderColor: colors.white,
    borderRadius: 999,
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
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.white,
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
  floatCard: {
    marginTop: -40,
    paddingHorizontal: 20,
    zIndex: 2,
  },
  premium: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.navyCard,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  premTitle: {
    color: colors.white,
    fontWeight: "800",
    fontSize: 16,
  },
  premSub: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 12,
    marginTop: 4,
  },
  premDate: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    marginTop: 6,
  },
  menu: {
    marginTop: 22,
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
  msg: {
    marginTop: 10,
    color: colors.muted,
    fontSize: 13,
  },
  primary: {
    flex: 1,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  primaryText: {
    color: "#fff",
    fontWeight: "700",
  },
  secondary: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.navy,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryText: {
    color: colors.navy,
    fontWeight: "700",
  },
});
