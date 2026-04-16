import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { colors } from "../theme/colors";

export type PasswordFieldProps = Omit<TextInputProps, "secureTextEntry" | "style"> & {
  containerStyle?: StyleProp<ViewStyle>;
  inputStyle?: StyleProp<TextStyle>;
  /**
   * contained: full bordered field (Settings, Profile).
   * inline: flex row, no border — use inside WelcomeAuth `inputShell` after the leading icon.
   */
  variant?: "contained" | "inline";
};

export function PasswordField({
  variant = "contained",
  containerStyle,
  inputStyle,
  editable,
  placeholderTextColor = colors.muted2,
  ...rest
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  const eye = (
    <Pressable
      style={({ pressed }) => [styles.eyeBtn, pressed && { opacity: 0.72 }]}
      onPress={() => setVisible((v) => !v)}
      disabled={editable === false}
      accessibilityRole="button"
      accessibilityLabel={visible ? "Hide password" : "Show password"}
    >
      <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} size={22} color={colors.muted2} />
    </Pressable>
  );

  if (variant === "inline") {
    return (
      <View style={[styles.inlineWrap, containerStyle]}>
        <TextInput
          style={[styles.inputInline, inputStyle]}
          secureTextEntry={!visible}
          editable={editable}
          placeholderTextColor={placeholderTextColor}
          {...rest}
        />
        {eye}
      </View>
    );
  }

  return (
    <View style={[styles.containedWrap, containerStyle]}>
      <TextInput
        style={[styles.inputContained, inputStyle]}
        secureTextEntry={!visible}
        editable={editable}
        placeholderTextColor={placeholderTextColor}
        {...rest}
      />
      {eye}
    </View>
  );
}

const styles = StyleSheet.create({
  containedWrap: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingLeft: 12,
    paddingRight: 4,
    backgroundColor: colors.white,
  },
  inputContained: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 8,
    fontSize: 15,
    color: colors.text,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
          boxShadow: "none",
        } as any)
      : null),
  },
  inlineWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  inputInline: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
          outlineWidth: 0,
          boxShadow: "none",
        } as any)
      : null),
  },
  eyeBtn: {
    padding: 8,
  },
});
