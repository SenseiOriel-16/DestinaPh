import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RootStackParamList } from "../../App";
import { isValidUsernameFormat, normalizeUsername } from "../lib/authUsername";
import { supabase } from "../lib/supabase";
import { uploadProfileAvatar } from "../lib/uploadProfileAvatar";
import { colors } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "EditProfile">;

export function EditProfileScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [initialUsernameNorm, setInitialUsernameNorm] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [imgBust, setImgBust] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      setEmail(session.session?.user.email ?? null);
      if (!uid) {
        setFullName("");
        setUsername("");
        setInitialUsernameNorm(null);
        setAvatarUrl(null);
        return;
      }
      const meta = session.session?.user.user_metadata as { full_name?: string; avatar_url?: string } | undefined;
      const { data: row } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, username")
        .eq("id", uid)
        .maybeSingle();
      setFullName(row?.full_name ?? meta?.full_name ?? "");
      const un = row?.username?.trim() ?? "";
      setUsername(un);
      setInitialUsernameNorm(un ? normalizeUsername(un) : null);
      setAvatarUrl(row?.avatar_url ?? meta?.avatar_url ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pickAvatar = async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
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
    setUploading(true);
    try {
      const out = await uploadProfileAvatar(supabase, uid, res.assets[0].uri);
      if ("error" in out) {
        Alert.alert("Upload failed", out.error);
        return;
      }
      setAvatarUrl(out.publicUrl);
      setImgBust(Date.now());
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) {
      Alert.alert("Edit profile", "You need to be signed in.");
      return;
    }
    const name = fullName.trim();
    if (!name) {
      Alert.alert("Edit profile", "Please enter your name.");
      return;
    }
    const unameNorm = username.trim() ? normalizeUsername(username) : "";
    if (username.trim() && !isValidUsernameFormat(username)) {
      Alert.alert("Edit profile", "Username: 3–24 characters, letters, numbers, or underscore only.");
      return;
    }
    if (unameNorm && unameNorm !== initialUsernameNorm) {
      const { data: free, error: availErr } = await supabase.rpc("is_username_available", { p_username: unameNorm });
      if (availErr) {
        Alert.alert("Edit profile", availErr.message);
        return;
      }
      if (free === false) {
        Alert.alert("Edit profile", "That username is already taken.");
        return;
      }
    }
    setSaving(true);
    try {
      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          username: unameNorm || null,
        })
        .eq("id", uid);
      if (pErr) {
        Alert.alert("Edit profile", pErr.message);
        return;
      }
      const { error: aErr } = await supabase.auth.updateUser({
        data: { full_name: name, ...(unameNorm ? { username: unameNorm } : { username: null }) },
      });
      if (aErr) {
        Alert.alert("Edit profile", aErr.message);
        return;
      }
      setInitialUsernameNorm(unameNorm || null);
      setUsername(unameNorm || "");
      Alert.alert("Edit profile", "Your profile has been saved.", [{ text: "OK", onPress: () => navigation.goBack() }]);
    } finally {
      setSaving(false);
    }
  };

  const avatarSource =
    avatarUrl != null && avatarUrl.length > 0
      ? { uri: `${avatarUrl.split("?")[0]}?v=${imgBust}` }
      : email
        ? { uri: `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(email)}` }
        : null;

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={{ paddingBottom: 32 + insets.bottom, paddingTop: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primaryTeal} />
      ) : (
        <>
          <View style={styles.avatarBlock}>
            <Pressable onPress={() => void pickAvatar()} disabled={uploading} style={styles.avatarRing}>
              {avatarSource ? (
                <Image source={avatarSource} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPh]}>
                  <Ionicons name="person" size={40} color={colors.muted2} />
                </View>
              )}
              {uploading ? (
                <View style={styles.avatarOverlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : (
                <View style={styles.camBadge}>
                  <Ionicons name="camera" size={18} color={colors.navy} />
                </View>
              )}
            </Pressable>
            <Text style={styles.avatarHint}>Tap to change photo</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Halimbawa: Juan dela Cruz"
              placeholderTextColor={colors.muted2}
            />
            <Text style={[styles.label, { marginTop: 14 }]}>Username</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Hal.: juandelacruz (3–24 character)"
              placeholderTextColor={colors.muted2}
            />
            {email && (
              <Text style={styles.emailRo}>
                Email: {email}
                {"\n"}
                <Text style={styles.emailNote}>Email cannot be changed here.</Text>
              </Text>
            )}
            <Pressable style={[styles.primary, saving && styles.disabled]} onPress={() => void save()} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Save changes</Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.pageBg,
  },
  avatarBlock: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarRing: {
    position: "relative",
  },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.border,
  },
  avatarPh: {
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  camBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.primaryTeal,
  },
  avatarHint: {
    marginTop: 10,
    fontSize: 13,
    color: colors.muted,
  },
  card: {
    marginHorizontal: 20,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
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
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  emailRo: {
    marginTop: 14,
    fontSize: 13,
    color: colors.muted,
    lineHeight: 18,
  },
  emailNote: {
    fontSize: 12,
    color: colors.muted2,
  },
  primary: {
    marginTop: 20,
    backgroundColor: colors.primaryTeal,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.65,
  },
  primaryText: {
    color: colors.white,
    fontWeight: "700",
    fontSize: 16,
  },
});
