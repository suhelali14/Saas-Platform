import { useMemo, useState } from "react";
import { StyleSheet, Text, View, ScrollView, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ExploreStackParamList } from "../navigation/types";
import { ScreenContainer, Card, EmptyState, ErrorState, LoadingState, Badge } from "../components";
import { colors, radius, spacing, typography, fonts } from "../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useBusinesses } from "../hooks/useBusinesses";

type Props = NativeStackScreenProps<ExploreStackParamList, "Explore">;

// Matches the categories the v0 matcher supports (apps/api/src/services/ai/schema.ts).
const CATEGORY_TABS = ["All", "restaurant", "gym", "salon"];

export default function ExploreScreen({ navigation }: Props) {
  const [activeTab, setActiveTab] = useState("All");
  const { data: businesses, isPending, isError, error, refetch, isFetching } = useBusinesses();

  const filtered = useMemo(() => {
    if (!businesses) return [];
    if (activeTab === "All") return businesses;
    return businesses.filter((b) => b.categories.includes(activeTab));
  }, [businesses, activeTab]);

  return (
    <ScreenContainer
      contentContainerStyle={styles.content}
      edges={["top", "bottom"]}
      onRefresh={refetch}
      refreshing={isFetching}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Explore Businesses</Text>
      </View>

      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {CATEGORY_TABS.map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tab, activeTab === tab && styles.activeTab]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        {isPending ? (
          <LoadingState label="Loading businesses..." />
        ) : isError ? (
          <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No businesses yet" description="Nothing matches this category yet." />
        ) : (
          filtered.map((business) => (
            <Card
              key={business.id}
              style={styles.businessCard}
              onPress={() => navigation.navigate("BusinessProfile", { businessId: business.id })}
            >
              <View style={styles.businessImagePlaceholder}>
                <Ionicons name="storefront-outline" size={24} color={colors.textMuted} />
              </View>
              <View style={styles.businessInfo}>
                <Text style={styles.businessName} numberOfLines={1}>
                  {business.name}
                </Text>
                <Text style={styles.businessCity}>{business.city}</Text>
                <View style={styles.badgeRow}>
                  {business.categories.map((c) => (
                    <Badge key={c} label={c} />
                  ))}
                </View>
              </View>
            </Card>
          ))
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingVertical: spacing.xl, gap: spacing.xl },
  header: { paddingHorizontal: spacing.xl },
  title: { ...typography.h1, fontSize: 24, color: colors.textPrimary },
  tabsContainer: { marginTop: spacing.sm },
  tabsScroll: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
  },
  activeTab: { backgroundColor: colors.accentDark },
  tabText: { ...typography.caption, fontFamily: fonts.medium, color: colors.textSecondary, textTransform: "capitalize" },
  activeTabText: { color: colors.accentText },
  section: { paddingHorizontal: spacing.xl, gap: spacing.md },
  businessCard: { flexDirection: "row", gap: spacing.md, padding: spacing.sm },
  businessImagePlaceholder: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  businessInfo: { flex: 1, justifyContent: "center", gap: 4 },
  businessName: { ...typography.bodyBold, color: colors.textPrimary },
  businessCity: { ...typography.caption, color: colors.textMuted },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: 4 },
});
