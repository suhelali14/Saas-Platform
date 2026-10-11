import { StyleSheet, Text, View } from "react-native";
import { colors, fonts, radius, spacing, typography } from "../theme/tokens";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "accent";

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

const TONE_STYLES: Record<BadgeTone, { bg: string; text: string }> = {
  neutral: { bg: colors.accentSubtle, text: colors.textSecondary },
  success: { bg: colors.successBg, text: colors.success },
  warning: { bg: colors.warningBg, text: colors.warning },
  danger: { bg: colors.dangerBg, text: colors.danger },
  accent: { bg: colors.accentShadow, text: colors.accent },
};

export function Badge({ label, tone = "neutral" }: BadgeProps) {
  const { bg, text } = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  text: { ...typography.caption, fontFamily: fonts.semiBold },
});
