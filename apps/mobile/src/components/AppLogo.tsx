import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/tokens";

interface AppLogoProps {
  size?: number;
}

/**
 * Stand-in for the custom abstract mark in the Figma source
 * (figma.com/design/0rCDlmCaVlIGUaa3OMKe7M, "Logo" group) -- same
 * dark-rounded look, not a pixel-exact vector extraction. Swap the icon (or
 * this whole component) for the real exported asset if pixel-exact
 * branding matters later.
 */
export function AppLogo({ size = 96 }: AppLogoProps) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.32 }]}>
      <Ionicons name="bulb" size={size * 0.5} color={colors.accentText} />
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
