import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { AppLogo, Button } from "../../components";
import { colors, spacing, typography } from "../../theme/tokens";
import { useAuth } from "../../context/AuthContext";

type Props = NativeStackScreenProps<AuthStackParamList, "Welcome">;

export default function WelcomeScreen({ navigation }: Props) {
  const { continueAsGuest } = useAuth();
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleGuest() {
    setGuestLoading(true);
    try {
      await continueAsGuest();
    } catch (error) {
      Alert.alert("Something went wrong", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.center}>
        <AppLogo size={130} />
        <Text style={styles.title}>Welcome to{"\n"}Intently</Text>
      </View>

      <View style={styles.actions}>
        <Button title="Log In" onPress={() => navigation.navigate("Login")} rounded />
        <Button title="Sign Up" variant="secondary" onPress={() => navigation.navigate("Register")} rounded />
        <Button title="Continue as Guest" variant="ghost" onPress={handleGuest} loading={guestLoading} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xl },
  title: { ...typography.h1, fontSize: 32, color: colors.textSecondary, textAlign: "center" },
  actions: { padding: spacing.xl, gap: spacing.md },
});
