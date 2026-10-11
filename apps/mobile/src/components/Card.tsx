import { Pressable, StyleSheet, View, type ViewProps } from "react-native";
import { colors, radius, spacing, shadows } from "../theme/tokens";

interface CardProps extends ViewProps {
  onPress?: () => void;
  variant?: "default" | "outline";
}

export function Card({ style, onPress, variant = "default", children, ...rest }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          variant === "default" && styles.defaultCard,
          variant === "outline" && styles.outlineCard,
          pressed && styles.pressed,
          style,
        ]}
        {...rest}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View 
      style={[
        styles.card, 
        variant === "default" && styles.defaultCard,
        variant === "outline" && styles.outlineCard,
        style
      ]} 
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  defaultCard: {
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  outlineCard: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  pressed: { opacity: 0.8 },
});
