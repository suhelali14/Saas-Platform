import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import DateTimePicker from "@react-native-community/datetimepicker";
// @ts-ignore
import RazorpayCheckout from "react-native-razorpay";
import type { SharedStackParamList } from "../navigation/types";
import { Button, TextField, LoadingState } from "../components";
import { colors, spacing, typography, radius } from "../theme/tokens";
import { authedFetch } from "../lib/api";

type Props = NativeStackScreenProps<SharedStackParamList, "Booking">;

export default function BookingScreen({ route, navigation }: Props) {
  const { offerId, businessId, matchId, offerPrice, offerDescription, businessName, hasRazorpay, currency } = route.params;
  const [date, setDate] = useState(new Date(Date.now() + 24 * 60 * 60 * 1000));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<"PAY_AT_VENUE" | "RAZORPAY">("PAY_AT_VENUE");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBooking = async () => {
    setIsSubmitting(true);
    try {
      const res = await authedFetch<any>("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          offerId,
          scheduledAt: date.toISOString(),
          durationMin: 60,
          notes,
          paymentMode,
          matchId,
        }),
      });

      if (res.error) {
        Alert.alert("Error", res.error);
        setIsSubmitting(false);
        return;
      }

      if (res.requiresPayment) {
        const payRes = await authedFetch<any>(`/api/bookings/${res.booking.id}/pay`, { method: "POST" });
        if (payRes.error) {
          Alert.alert("Payment Error", payRes.error);
          setIsSubmitting(false);
          return;
        }

        const options = {
          description: offerDescription,
          image: "https://intently.com/logo.png",
          currency: payRes.currency,
          key: payRes.keyId,
          amount: payRes.amount,
          name: businessName,
          order_id: payRes.razorpayOrderId,
          theme: { color: colors.accent },
        };

        RazorpayCheckout.open(options).then((data: any) => {
          navigation.replace("BookingConfirm", {
            bookingId: res.booking.id,
            status: "CONFIRMED",
            paymentMode: "RAZORPAY",
            scheduledAt: res.booking.scheduledAt,
            businessName,
          });
        }).catch((error: any) => {
          Alert.alert("Payment Failed", error.description || "The payment was cancelled.");
          setIsSubmitting(false);
        });
      } else {
        navigation.replace("BookingConfirm", {
          bookingId: res.booking.id,
          status: "PENDING",
          paymentMode: "PAY_AT_VENUE",
          scheduledAt: res.booking.scheduledAt,
          businessName,
        });
      }
    } catch (e) {
      Alert.alert("Error", "Could not complete booking.");
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>Book: {businessName}</Text>
          <Text style={styles.description}>{offerDescription}</Text>
          <Text style={styles.price}>{currency} {offerPrice}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Date & Time</Text>
          <View style={styles.row}>
            <Button title={date.toLocaleDateString()} onPress={() => setShowDatePicker(true)} variant="secondary" />
            <Button title={date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} onPress={() => setShowTimePicker(true)} variant="secondary" />
          </View>
          {showDatePicker && (
            <DateTimePicker
              value={date}
              mode="date"
              minimumDate={new Date()}
              onChange={(e: any, d?: Date) => { setShowDatePicker(false); if (d) setDate(d); }}
            />
          )}
          {showTimePicker && (
            <DateTimePicker
              value={date}
              mode="time"
              onChange={(e: any, d?: Date) => { setShowTimePicker(false); if (d) setDate(d); }}
            />
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (optional)</Text>
          <TextField placeholder="Any special requests?" value={notes} onChangeText={setNotes} multiline />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment</Text>
          <Button 
            title="Pay at Venue" 
            variant={paymentMode === "PAY_AT_VENUE" ? "primary" : "secondary"}
            onPress={() => setPaymentMode("PAY_AT_VENUE")}
            style={{ marginBottom: spacing.sm }}
          />
          {hasRazorpay && (
            <Button 
              title="Pay Now Online" 
              variant={paymentMode === "RAZORPAY" ? "primary" : "secondary"}
              onPress={() => setPaymentMode("RAZORPAY")}
            />
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <Button title={isSubmitting ? "Processing..." : "Confirm Booking"} onPress={handleBooking} disabled={isSubmitting} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 100 },
  card: { padding: spacing.lg, backgroundColor: colors.surface, borderRadius: radius.lg, marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs },
  description: { ...typography.body, color: colors.textSecondary, marginBottom: spacing.sm },
  price: { ...typography.bodyBold, color: colors.accent },
  section: { marginBottom: spacing.xl },
  sectionTitle: { ...typography.bodyBold, color: colors.textPrimary, marginBottom: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
