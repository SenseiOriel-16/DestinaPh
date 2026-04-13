export const destinaphTheme = {
  colors: {
    primary: "#0B3C5D",
    secondary: "#00A896",
    accent: "#FFB703",
    background: "#F8F9FA",
    surface: "#FFFFFF",
    text: "#212529",
    textMuted: "#6C757D",
    border: "#E9ECEF",
    success: "#4CAF50",
    warning: "#FF7A3D",
    danger: "#DC3545",
  },
  radii: {
    sm: 10,
    md: 14,
    lg: 18,
    xl: 22,
  },
  fontFamily: "'Poppins', system-ui, sans-serif",
} as const;

export type DestinaphTheme = typeof destinaphTheme;
