import { Alert, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { Offer } from "@intently/shared-types";
import type { SharedStackParamList } from "../navigation/types";
import { Badge, Button, Card, ErrorState, LoadingState, ScreenContainer } from "../components";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useBusiness } from "../hooks/useBusiness";

type Props = NativeStackScreenProps<SharedStackParamList, "BusinessProfile">;

/**
 * Read-only for Phase 1 (docs/07-roadmap-phases.md) -- the "Contact" CTA
 * below is real UI but intentionally shows an honest "not built yet"
 * message rather than pretending to message the business, since
 * direct messaging needs the Transaction/Payments service (Phase 2).
 */
export default function BusinessProfileScreen({ route }: Props) {
  const { businessId } = route.params;
  const { data: business, isPending, isError, error, refetch } = useBusiness(businessId);

  if (isPending) {
    return (
      <ScreenContainer>
        <LoadingState label="Loading..." />
      </ScreenContainer>
    );
  }

  if (isError) {
    return (
      <ScreenContainer>
        <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={refetch} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <View style={styles.heroPlaceholder}>
        <Ionicons name="image-outline" size={48} color={colors.textMuted} />
      </View>

      <View style={styles.detailsContainer}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={2}>
            {business.name}
          </Text>
          {business.verificationStatus === "VERIFIED" && <Badge label="Verified" tone="accent" />}
        </View>

        <View style={styles.ratingRow}>
          <Ionicons name="star" size={16} color="#FFB800" />
          <Text style={styles.ratingText}>
            {business.ratingAverage > 0 ? business.ratingAverage.toFixed(1) : "New"}
          </Text>
          <Text style={styles.reviewCount}>({business.verifiedTransactionCount} verified)</Text>
          <View style={styles.dot} />
          <Text style={styles.locationText}>
            {business.address ? `${business.address}, ` : ""}
            {business.city}
          </Text>
        </View>

        <View style={styles.badgeRow}>
          {business.categories.map((category) => (
            <Badge key={category} label={category} />
          ))}
        </View>

        <Text style={styles.label}>
          {business.offers.length > 0 ? `${business.offers.length} Offer${business.offers.length === 1 ? "" : "s"}` : "Offers"}
        </Text>

        {business.offers.length === 0 ? (
          <Text style={styles.muted}>No active offers right now.</Text>
        ) : (
          business.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)
        )}
      </View>
    </ScreenContainer>
  );
}

function OfferCard({ offer }: { offer: Offer }) {
  const handleContact = () => {
    Alert.alert("Coming Soon", "Direct messaging ships with Phase 2's transaction flow.");
  };

  return (
    <Card style={styles.offerCard}>
      <View style={styles.offerInfo}>
        <Text style={styles.offerPrice}>
          {offer.currency} {offer.price}
        </Text>
        <Text style={styles.offerDescription}>{offer.description}</Text>
      </View>
      <Button title="Contact" onPress={handleContact} size="sm" variant="dark" />
    </Card>
  );
}

const styles = StyleSheet.create({
  content: { padding: 0, paddingBottom: spacing.xxl },
  heroPlaceholder: {
    width: "100%",
    height: 200,
    backgroundColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  detailsContainer: {
    padding: spacing.xl,
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    marginTop: -radius.xl,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  name: { ...typography.h1, fontSize: 24, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.lg,
    flexWrap: "wrap",
  },
  ratingText: { ...typography.bodyBold, color: colors.textPrimary, marginLeft: 4 },
  reviewCount: { ...typography.caption, color: colors.textMuted, marginLeft: 4 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, marginHorizontal: spacing.sm },
  locationText: { ...typography.caption, color: colors.textSecondary },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginBottom: spacing.xl },
  label: { ...typography.h2, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.md },
  muted: { ...typography.body, color: colors.textMuted },
  offerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  offerInfo: { flex: 1 },
  offerPrice: { ...typography.h2, fontSize: 16, color: colors.textPrimary, marginBottom: 4 },
  offerDescription: { ...typography.caption, color: colors.textSecondary },
});
