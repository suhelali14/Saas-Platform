import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import { Button } from "./Button";

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.textMuted} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.description}>{message}</Text>
      {onRetry ? (
        <View style={styles.retryButton}>
          <Button title="Try again" onPress={onRetry} variant="secondary" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  label: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  title: { ...typography.bodyBold, color: colors.textPrimary, textAlign: "center" },
  description: { ...typography.caption, color: colors.textMuted, textAlign: "center" },
  retryButton: { marginTop: spacing.md },
});
