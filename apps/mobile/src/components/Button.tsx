import { ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { colors, fonts, radius, spacing, typography } from "../theme/tokens";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  // Pill-shaped with an accent shadow, matching the Figma Welcome screen's
  // hero CTAs -- opt-in per screen rather than the app-wide default, since
  // the source design itself only uses this treatment there.
  rounded?: boolean;
  style?: ViewStyle;
}

export function Button({ title, onPress, variant = "primary", size = "md", loading, disabled, icon, rounded, style }: ButtonProps) {
  const isDisabled = disabled || loading;

  const renderContent = () => {
    if (loading) {
      return <ActivityIndicator color={variant === "primary" || variant === "dark" ? colors.accentText : colors.accent} />;
    }
    return (
      <View style={styles.content}>
        {icon && <View style={styles.iconContainer}>{icon}</View>}
        <Text style={[
          styles.text, 
          variant === "primary" || variant === "dark" ? styles.textPrimary : styles.textOther,
          size === "sm" && styles.textSm
        ]}>
          {title}
        </Text>
      </View>
    );
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        sizeStyles[size],
        variantStyles[variant],
        rounded && styles.rounded,
        rounded && variant === "primary" && styles.roundedPrimaryShadow,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {renderContent()}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  rounded: { borderRadius: radius.full, paddingVertical: spacing.lg },
  roundedPrimaryShadow: {
    shadowColor: colors.accentShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
  text: { ...typography.bodyBold },
  textSm: { ...typography.caption, fontFamily: fonts.semiBold },
  textPrimary: { color: colors.accentText },
  textOther: { color: colors.accentDark },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent },
  dark: { backgroundColor: colors.accentDark },
  secondary: { backgroundColor: colors.accentSubtle },
  ghost: { backgroundColor: "transparent" },
});

const sizeStyles = StyleSheet.create({
  sm: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md },
  md: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg },
  lg: { paddingVertical: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radius.xl },
});
