import { Platform, type TextStyle, type ViewStyle } from "react-native";

type ShadowParams = {
  color?: string;
  opacity?: number;
  radius?: number;
  offsetX?: number;
  offsetY?: number;
  elevation?: number;
};

export function shadowCompat({
  color = "#000",
  opacity = 0.15,
  radius = 12,
  offsetX = 0,
  offsetY = 6,
  elevation = 6,
}: ShadowParams): ViewStyle {
  if (Platform.OS === "web") {
    return {
      // RN Web prefers CSS-like shadows.
      boxShadow: `${offsetX}px ${offsetY}px ${radius}px rgba(0,0,0,${opacity})`,
    } as any;
  }
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radius,
    shadowOffset: { width: offsetX, height: offsetY },
    elevation,
  };
}

type TextShadowParams = {
  color?: string;
  offsetX?: number;
  offsetY?: number;
  radius?: number;
};

export function textShadowCompat({
  color = "rgba(0,0,0,0.3)",
  offsetX = 0,
  offsetY = 1,
  radius = 6,
}: TextShadowParams): TextStyle {
  if (Platform.OS === "web") {
    return {
      textShadow: `${offsetX}px ${offsetY}px ${radius}px ${color}`,
    } as any;
  }
  return {
    textShadowColor: color,
    textShadowOffset: { width: offsetX, height: offsetY },
    textShadowRadius: radius,
  };
}

