// Single source of truth for the app's visual language. Screens and
// components pull from here instead of hardcoding hex values / sizes --
// change the look of the whole app by editing this file, not N screens.
//
// Colors/fonts below are pulled from the real Figma design
// (figma.com/design/0rCDlmCaVlIGUaa3OMKe7M) via the Figma MCP server, not
// guessed -- see the auth-flow screens for where each token is used.

export const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",
  surfaceMuted: "#FFFFFFAB",
  border: "#E5E7EB",

  textPrimary: "#141718",
  textSecondary: "#323142",
  textMuted: "#8E9295",
  textFaint: "#C2C3CB",

  accent: "#17CE92",
  accentDark: "#141718",
  accentText: "#FFFFFF",
  accentSubtle: "#E3E3E3",
  accentShadow: "#17CE9240",

  success: "#059669",
  successBg: "#ECFDF5",
  warning: "#92400E",
  warningBg: "#FEF3C7",
  danger: "#DC2626",
  dangerBg: "#FEF2F2",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

export const shadows = {
  card: {
    shadowColor: "#0F0F0F",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
  },
} as const;

// Loaded via @expo-google-fonts/poppins in App.tsx -- fall back to the
// system font (undefined) if a screen renders before fonts finish loading,
// which shouldn't happen since App.tsx gates rendering on font load.
export const fonts = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semiBold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

export const typography = {
  h1: { fontSize: 28, fontFamily: fonts.semiBold },
  h2: { fontSize: 20, fontFamily: fonts.semiBold },
  body: { fontSize: 16, fontFamily: fonts.regular },
  bodyBold: { fontSize: 16, fontFamily: fonts.semiBold },
  caption: { fontSize: 13, fontFamily: fonts.medium },
  label: {
    fontSize: 12,
    fontFamily: fonts.semiBold,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
};
