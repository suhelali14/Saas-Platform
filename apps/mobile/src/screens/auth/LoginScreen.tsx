import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { Button, ScreenContainer, TextField } from "../../components";
import { colors, spacing, typography } from "../../theme/tokens";
import { useAuth } from "../../context/AuthContext";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      Alert.alert("Couldn't log in", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Text style={styles.title}>Login Your{"\n"}Account</Text>

      <TextField
        placeholder="Enter Your Email"
        leadingIcon="mail-outline"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        editable={!loading}
      />
      <TextField
        placeholder="Password"
        leadingIcon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        secureToggle
        secureTextEntry
        editable={!loading}
      />

      <Button title="Login" onPress={handleSubmit} loading={loading} disabled={!email.trim() || !password} />

      <Pressable onPress={() => navigation.navigate("Register")} style={styles.link}>
        <Text style={styles.linkText}>
          Create New Account? <Text style={styles.linkTextBold}>Sign up</Text>
        </Text>
      </Pressable>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: "center", gap: spacing.md },
  title: { ...typography.h1, fontSize: 30, color: colors.textSecondary, marginBottom: spacing.md },
  link: { alignItems: "center", marginTop: spacing.sm },
  linkText: { ...typography.caption, color: colors.textFaint },
  linkTextBold: { color: colors.textSecondary, fontFamily: typography.bodyBold.fontFamily },
});
