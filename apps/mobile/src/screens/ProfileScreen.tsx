import { Alert, Linking, StyleSheet, Text, View, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "../navigation/types";
import { Badge, ScreenContainer } from "../components";
import { colors, radius, spacing, typography, shadows } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<ProfileStackParamList, "Profile">;

const SUPPORT_EMAIL = "support@intently.app";

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  function handleLogout() {
    Alert.alert("Log out?", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Log out", style: "destructive", onPress: logout },
    ]);
  }

  function handleSupport() {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Intently Support`).catch(() =>
      Alert.alert("Couldn't open mail app", `Reach us at ${SUPPORT_EMAIL}`),
    );
  }

  return (
    <ScreenContainer edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color={colors.accentText} />
        </View>
        <Text style={styles.accountName}>{user?.name ?? "Guest"}</Text>
        {user?.email ? (
          <Text style={styles.accountEmail}>{user.email}</Text>
        ) : (
          <View style={{ marginTop: spacing.sm }}>
            <Badge label="Browsing as guest" tone="neutral" />
          </View>
        )}
      </View>

      <View style={styles.menuContainer}>
        <MenuItem icon="settings-outline" title="Preferences" onPress={() => navigation.navigate("Preferences")} />
        <MenuItem
          icon="lock-closed-outline"
          title="Change Password"
          onPress={() => navigation.navigate("ChangePassword")}
        />
        <MenuItem icon="gift-outline" title="Invite Your Friends" onPress={() => navigation.navigate("InviteFriends")} />
        <MenuItem icon="headset-outline" title="Customer Support" onPress={handleSupport} />
        <MenuItem icon="log-out-outline" title="Logout" onPress={handleLogout} isDestructive />
      </View>
    </ScreenContainer>
  );
}

function MenuItem({
  icon,
  title,
  onPress,
  isDestructive = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  isDestructive?: boolean;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]} onPress={onPress}>
      <View style={styles.menuIconWrap}>
        <Ionicons name={icon} size={20} color={isDestructive ? colors.danger : colors.textPrimary} />
      </View>
      <Text style={[styles.menuTitle, isDestructive && { color: colors.danger }]}>{title}</Text>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    marginBottom: spacing.xxl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    ...shadows.card,
  },
  accountName: { ...typography.h1, fontSize: 24, color: colors.textPrimary },
  accountEmail: { ...typography.body, color: colors.textSecondary, marginTop: 4 },
  menuContainer: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.md,
    ...shadows.card,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemPressed: {
    opacity: 0.7,
  },
  menuIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  menuTitle: {
    flex: 1,
    ...typography.bodyBold,
    color: colors.textPrimary,
  },
});
