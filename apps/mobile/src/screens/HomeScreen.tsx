import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { HomeStackParamList } from "../navigation/types";
import { Button, Card, EmptyState, ScreenContainer, TextField } from "../components";
import { colors, radius, spacing, typography, shadows } from "../theme/tokens";
import { useSubmitIntent } from "../hooks/useSubmitIntent";
import { useIntentRequests } from "../hooks/useIntentRequests";
import { useBusinesses } from "../hooks/useBusinesses";
import { useAuth } from "../context/AuthContext";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<HomeStackParamList, "Home">;

// Matches the categories the v0 matcher actually supports
// (apps/api/src/services/ai/schema.ts SUPPORTED_CATEGORIES) -- these are
// shortcuts into a real search, not decorative.
const CATEGORIES = [
  { name: "restaurant", label: "Restaurant", icon: "restaurant-outline" as const },
  { name: "gym", label: "Fitness", icon: "barbell-outline" as const },
  { name: "salon", label: "Salon", icon: "cut-outline" as const },
];

export default function HomeScreen({ navigation }: Props) {
  const [text, setText] = useState("");
  const { mutateAsync, isPending } = useSubmitIntent();
  const { user } = useAuth();
  const { data: recentRequests } = useIntentRequests();
  const { data: businesses } = useBusinesses();

  async function submit(rawText: string) {
    if (!rawText.trim()) return;
    try {
      const response = await mutateAsync(rawText.trim());
      setText("");
      navigation.navigate("Results", { intentRequestId: response.intentRequest.id });
    } catch (error) {
      Alert.alert("Something went wrong", error instanceof Error ? error.message : "Unknown error");
    }
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }

  const recentTwo = recentRequests?.slice(0, 2) ?? [];
  const nearbyBusinesses = businesses?.slice(0, 4) ?? [];

  return (
    <ScreenContainer contentContainerStyle={styles.content} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {getGreeting()}, {user?.name ?? "Guest"}
          </Text>
        </View>
        <View style={styles.avatarPlaceholder}>
          <Ionicons name="person" size={20} color={colors.accentText} />
        </View>
      </View>

      <Card style={styles.searchCard}>
        <TextField
          placeholder="What do you need today?"
          leadingIcon="search-outline"
          value={text}
          onChangeText={setText}
          editable={!isPending}
          onSubmitEditing={() => submit(text)}
          returnKeyType="search"
          clearable
          onClear={() => setText("")}
        />
        {text.length > 0 && (
          <Button title="Find it" onPress={() => submit(text)} loading={isPending} size="sm" style={{ marginTop: spacing.md }} />
        )}
      </Card>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Categories</Text>
        <View style={styles.categoryRow}>
          {CATEGORIES.map((cat) => (
            <Pressable key={cat.name} style={styles.categoryItem} onPress={() => submit(cat.name)} disabled={isPending}>
              <View style={styles.categoryIconWrap}>
                <Ionicons name={cat.icon} size={24} color={colors.accentDark} />
              </View>
              <Text style={styles.categoryText}>{cat.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {recentTwo.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Searches</Text>
          {recentTwo.map((request) => (
            <Card
              key={request.id}
              variant="outline"
              style={styles.recentCard}
              onPress={() => navigation.navigate("Results", { intentRequestId: request.id })}
            >
              <Ionicons name="time-outline" size={20} color={colors.textMuted} />
              <Text style={styles.recentText} numberOfLines={1}>
                {request.rawText}
              </Text>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Businesses</Text>
        {nearbyBusinesses.length === 0 ? (
          <EmptyState title="Nothing here yet" description="Search above to see real matches." />
        ) : (
          <View style={styles.businessRow}>
            {nearbyBusinesses.map((business) => (
              <Card
                key={business.id}
                style={styles.businessCard}
                onPress={() => navigation.navigate("BusinessProfile", { businessId: business.id })}
              >
                <View style={styles.businessImagePlaceholder} />
                <Text style={styles.businessTitle} numberOfLines={1}>
                  {business.name}
                </Text>
                <Text style={styles.businessSub}>{business.categories[0] ?? business.city}</Text>
              </Card>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingVertical: spacing.xl, gap: spacing.xxl },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  greeting: { ...typography.h2, color: colors.textPrimary },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
  },
  searchCard: {
    marginHorizontal: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.xl,
  },
  section: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  sectionTitle: { ...typography.h2, fontSize: 18, color: colors.textPrimary },
  categoryRow: {
    flexDirection: "row",
    gap: spacing.xl,
  },
  categoryItem: {
    alignItems: "center",
    gap: spacing.sm,
  },
  categoryIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.card,
  },
  categoryText: { ...typography.caption, color: colors.textSecondary },
  recentCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  recentText: { ...typography.body, color: colors.textSecondary, flex: 1 },
  businessRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  businessCard: {
    width: "47%",
    padding: spacing.sm,
  },
  businessImagePlaceholder: {
    width: "100%",
    height: 100,
    backgroundColor: colors.background,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  businessTitle: { ...typography.bodyBold, color: colors.textPrimary },
  businessSub: { ...typography.caption, color: colors.textMuted, textTransform: "capitalize" },
});
