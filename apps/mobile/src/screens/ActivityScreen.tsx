import { useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View, Pressable } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ActivityStackParamList } from "../navigation/types";
import { Badge, EmptyState, ErrorState, LoadingState, ScreenContainer, TextField } from "../components";
import { colors, spacing, typography } from "../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useIntentRequests } from "../hooks/useIntentRequests";

type Props = NativeStackScreenProps<ActivityStackParamList, "Activity">;

const STATUS_TONE: Record<string, "neutral" | "success" | "warning"> = {
  OPEN: "neutral",
  MATCHED: "success",
  FULFILLED: "success",
  EXPIRED: "warning",
};

export default function ActivityScreen({ navigation }: Props) {
  const { data, isPending, isError, error, refetch, isFetching } = useIntentRequests();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!query.trim()) return data;
    const q = query.trim().toLowerCase();
    return data.filter((item) => item.rawText.toLowerCase().includes(q) || item.category?.toLowerCase().includes(q));
  }, [data, query]);

  if (isPending) {
    return (
      <ScreenContainer scroll={false} edges={["top", "bottom"]}>
        <LoadingState label="Loading..." />
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer scroll={false} edges={["top", "bottom"]}>
        <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={refetch} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll={false} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextField
          variant="outline"
          placeholder="Search your requests"
          leadingIcon="search-outline"
          value={query}
          onChangeText={setQuery}
          clearable
          onClear={() => setQuery("")}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        onRefresh={refetch}
        refreshing={isFetching}
        ListEmptyComponent={
          <EmptyState
            title={query ? "No matches" : "No history yet"}
            description={query ? "Try a different search." : "Everything you ask for shows up here."}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.listItem, pressed && styles.listItemSelected]}
            onPress={() => navigation.navigate("Results", { intentRequestId: item.id })}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="time-outline" size={20} color={colors.accentText} />
            </View>
            <View style={styles.listTextWrap}>
              <Text style={styles.rawText} numberOfLines={1}>
                {item.rawText}
              </Text>
              <View style={styles.metaRow}>
                {item.category ? <Badge label={item.category} /> : null}
                <Badge label={item.status} tone={STATUS_TONE[item.status] ?? "neutral"} />
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  title: { ...typography.h1, fontSize: 24, color: colors.textPrimary },
  searchContainer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  listContent: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  listItemSelected: {
    backgroundColor: colors.surface,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  listTextWrap: {
    flex: 1,
    marginRight: spacing.md,
  },
  rawText: { ...typography.bodyBold, fontSize: 16, color: colors.textPrimary },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: spacing.sm },
  date: { ...typography.caption, color: colors.textMuted },
});
