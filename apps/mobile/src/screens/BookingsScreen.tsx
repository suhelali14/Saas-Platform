import { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import { authedFetch } from "../lib/api";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { Badge, Card } from "../components";
import { Ionicons } from "@expo/vector-icons";

export default function BookingsScreen() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookings();
  }, []);

  const loadBookings = async () => {
    try {
      const res = await authedFetch<any>("/api/bookings");
      // Fastify might return the array directly or in a { data: ... } wrapper
      if (res?.data) {
        setBookings(res.data);
      } else if (Array.isArray(res)) {
        setBookings(res);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const getStatusTone = (status: string): "neutral" | "success" | "warning" | "danger" | "accent" => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'CONFIRMED': return 'accent';
      case 'IN_PROGRESS': return 'accent';
      case 'COMPLETED': return 'success';
      case 'CANCELLED': return 'danger';
      default: return 'neutral';
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={colors.accent} /></View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={bookings}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={colors.textFaint} />
              <Text style={styles.emptyText}>No bookings found.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.businessName}>{item.business?.name || "Business"}</Text>
                <Badge label={item.status} tone={getStatusTone(item.status)} />
              </View>
              <Text style={styles.description}>{item.offer.description}</Text>
              
              <View style={styles.detailsRow}>
                <View style={styles.detail}>
                  <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{new Date(item.scheduledAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</Text>
                </View>
                <View style={styles.detail}>
                  <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.detailText}>{(item.amount / 100).toLocaleString('en-IN', { style: 'currency', currency: item.currency })}</Text>
                </View>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { ...typography.h1, color: colors.textPrimary },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  list: { padding: spacing.lg, paddingBottom: 100 },
  card: { padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
  businessName: { ...typography.bodyBold, color: colors.textPrimary },
  description: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  detailsRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.xs },
  detail: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  detailText: { ...typography.caption, color: colors.textSecondary },
  empty: { padding: spacing.xl, alignItems: "center", marginTop: 40 },
  emptyText: { ...typography.body, color: colors.textSecondary, marginTop: spacing.md },
});
