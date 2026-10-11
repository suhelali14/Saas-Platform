import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { SharedStackParamList } from "../navigation/types";
import { Button } from "../components";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { Ionicons } from "@expo/vector-icons";

type Props = NativeStackScreenProps<SharedStackParamList, "BookingConfirm">;

export default function BookingConfirmScreen({ route, navigation }: Props) {
  const { bookingId, status, paymentMode, scheduledAt, businessName } = route.params;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Ionicons name="checkmark-circle" size={80} color={colors.accent} />
        <Text style={styles.title}>Booking Confirmed!</Text>
        <Text style={styles.subtitle}>Your appointment with {businessName} is set.</Text>
        
        <View style={styles.detailsBox}>
          <View style={styles.row}>
            <Text style={styles.label}>Date & Time</Text>
            <Text style={styles.value}>{new Date(scheduledAt).toLocaleString()}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{status}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Payment</Text>
            <Text style={styles.value}>{paymentMode === "RAZORPAY" ? "Paid Online" : "Pay at Venue"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Booking ID</Text>
            <Text style={styles.value}>#{bookingId.slice(-6).toUpperCase()}</Text>
          </View>
        </View>

        <Button 
          title="View My Bookings" 
          onPress={() => {
            navigation.popToTop();
            // In a real app we'd switch to the Bookings tab here
          }} 
          style={{ width: '100%', marginTop: spacing.xl }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl, alignItems: "center", justifyContent: "center" },
  title: { ...typography.h1, color: colors.textPrimary, marginTop: spacing.lg, marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.xl, textAlign: "center" },
  detailsBox: { width: '100%', backgroundColor: colors.surface, padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  label: { ...typography.body, color: colors.textSecondary },
  value: { ...typography.body, color: colors.textPrimary, fontWeight: "600" },
});
