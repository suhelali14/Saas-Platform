import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { Button, ScreenContainer, TextField } from "../../components";
import { colors, spacing, typography } from "../../theme/tokens";
import { useAuth } from "../../context/AuthContext";

type Props = NativeStackScreenProps<AuthStackParamList, "Register">;

export default function RegisterScreen({ navigation }: Props) {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordTooShort = password.length > 0 && password.length < 8;

  async function handleSubmit() {
    setLoading(true);
    try {
      await register(name.trim(), email.trim(), password);
    } catch (error) {
      Alert.alert("Couldn't create account", error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <Text style={styles.title}>Create your{"\n"}Account</Text>

      <TextField
        placeholder="Full Name"
        leadingIcon="person-outline"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        editable={!loading}
      />
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
        error={passwordTooShort ? "At least 8 characters" : null}
        editable={!loading}
      />

      <Button
        title="Register"
        onPress={handleSubmit}
        loading={loading}
        disabled={!name.trim() || !email.trim() || password.length < 8}
      />

      <Pressable onPress={() => navigation.navigate("Login")} style={styles.link}>
        <Text style={styles.linkText}>
          Already Have An Account? <Text style={styles.linkTextBold}>Sign In</Text>
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
