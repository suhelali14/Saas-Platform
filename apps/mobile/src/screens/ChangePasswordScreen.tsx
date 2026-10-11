import { useState } from "react";
import { Alert, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "../navigation/types";
import { Button, ScreenContainer, TextField } from "../components";
import { colors, spacing, typography } from "../theme/tokens";
import { useChangePassword } from "../hooks/useChangePassword";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<ProfileStackParamList, "ChangePassword">;

export default function ChangePasswordScreen({ navigation }: Props) {
  const { user } = useAuth();
  const { mutateAsync, isPending } = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const newPasswordTooShort = newPassword.length > 0 && newPassword.length < 8;

  async function handleSubmit() {
    try {
      await mutateAsync({ currentPassword, newPassword });
      Alert.alert("Password updated", undefined, [{ text: "OK", onPress: () => navigation.goBack() }]);
    } catch (error) {
      Alert.alert("Couldn't update password", error instanceof Error ? error.message : "Unknown error");
    }
  }

  if (user?.isGuest) {
    return (
      <ScreenContainer contentContainerStyle={styles.content}>
        <Text style={styles.guestNotice}>
          Guest accounts don't have a password. Create an account from the Profile tab to set one.
        </Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <TextField
        label="Current Password"
        value={currentPassword}
        onChangeText={setCurrentPassword}
        secureToggle
        secureTextEntry
        editable={!isPending}
      />
      <TextField
        label="New Password"
        value={newPassword}
        onChangeText={setNewPassword}
        secureToggle
        secureTextEntry
        error={newPasswordTooShort ? "At least 8 characters" : null}
        editable={!isPending}
      />
      <Button
        title="Update Password"
        onPress={handleSubmit}
        loading={isPending}
        disabled={!currentPassword || newPassword.length < 8}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", gap: spacing.md },
  guestNotice: { ...typography.body, color: colors.textMuted, textAlign: "center" },
});
