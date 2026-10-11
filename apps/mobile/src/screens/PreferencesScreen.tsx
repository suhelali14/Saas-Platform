import { StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "../navigation/types";
import { Card, EmptyState, ErrorState, LoadingState, ScreenContainer } from "../components";
import { colors, radius, spacing, typography, shadows } from "../theme/tokens";
import { useUserProfile } from "../hooks/useUserProfile";

type Props = NativeStackScreenProps<ProfileStackParamList, "Preferences">;

// Account-level settings (Change Password, Invite Friends) live on the
// Profile screen's menu, not here -- this screen is only the structured
// UserProfile view (docs/13-ai-cost-optimization-personalization.md Part
// 2A), so its heading matches what's actually on it.
export default function PreferencesScreen({}: Props) {
  const { data: profile, isPending, isError, error, refetch, isFetching } = useUserProfile();

  const categories = profile ? Object.entries(profile.categoryAffinity).sort((a, b) => b[1] - a[1]) : [];
  const maxCount = categories[0]?.[1] ?? 1;

  return (
    <ScreenContainer onRefresh={refetch} refreshing={isFetching}>
      <View style={styles.preferencesHeader}>
        <Text style={styles.sectionTitle}>Your AI Preferences</Text>
        <Text style={styles.subtitle}>Built from what you've searched for.</Text>
      </View>

      {isPending ? (
        <LoadingState label="Loading..." />
      ) : isError ? (
        <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={refetch} />
      ) : categories.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          description="Search for something on Home and this fills in automatically."
        />
      ) : (
        <Card style={styles.card}>
          {categories.map(([category, count]) => {
            const avgBudget = profile?.avgBudgetByCategory[category];
            return (
              <View key={category} style={styles.row}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowLabel}>{category}</Text>
                  <Text style={styles.rowValue}>
                    {count} request{count === 1 ? "" : "s"}
                    {avgBudget ? ` · avg budget ${avgBudget}` : ""}
                  </Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${Math.max(8, (count / maxCount) * 100)}%` }]} />
                </View>
              </View>
            );
          })}
        </Card>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { ...typography.h2, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md },
  preferencesHeader: { marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: colors.textMuted, marginBottom: spacing.md },
  card: { gap: spacing.lg, ...shadows.card },
  row: { gap: spacing.xs },
  rowHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  rowLabel: { ...typography.bodyBold, color: colors.textPrimary, textTransform: "capitalize" },
  rowValue: { ...typography.caption, color: colors.textMuted },
  barTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: colors.accentSubtle,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
});
