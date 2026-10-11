import { StyleSheet, Text, View, useWindowDimensions, Share, Alert, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { ProfileStackParamList } from "../navigation/types";
import { Button, ScreenContainer } from "../components";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { useAuth } from "../context/AuthContext";

type Props = NativeStackScreenProps<ProfileStackParamList, "InviteFriends">;

export default function InviteFriendsScreen(_props: Props) {
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const referralCode = user?.referralCode ?? "";

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Come try Intently -- use my code ${referralCode} when you sign up.`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralCode);
    Alert.alert("Copied", "Referral code copied to clipboard.");
  };

  return (
    <ScreenContainer contentContainerStyle={styles.content}>
      <View style={[styles.imageShadow, { width: width * 0.5, height: width * 0.5, borderRadius: (width * 0.5) / 2 }]}>
        <LinearGradient
          colors={[colors.accent, colors.accentDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.imagePlaceholder, { borderRadius: (width * 0.5) / 2 }]}
        >
          <Ionicons name="gift" size={80} color={colors.accentText} />
        </LinearGradient>
      </View>

      <Text style={styles.title}>Refer A Friend</Text>
      <Text style={styles.subtitle}>Share your code -- Intently gets a bit smarter with every new person searching.</Text>

      <View style={styles.promoContainer}>
        <Text style={styles.promoCode}>{referralCode}</Text>
        <Pressable onPress={handleCopy} hitSlop={8} style={styles.copyIcon}>
          <Ionicons name="copy-outline" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>

      <Button title="Share" onPress={handleShare} variant="dark" style={styles.shareBtn} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xxl },
  imageShadow: {
    marginBottom: spacing.xxl,
    shadowColor: colors.accentShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...typography.h1,
    fontSize: 28,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.bodyBold,
    color: colors.textMuted,
    textAlign: "center",
    marginBottom: spacing.xxl,
  },
  promoContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    width: "100%",
    marginBottom: spacing.xxl,
  },
  promoCode: {
    ...typography.h2,
    color: colors.textPrimary,
    letterSpacing: 2,
  },
  copyIcon: {
    marginLeft: spacing.md,
  },
  shareBtn: {
    width: "100%",
  },
});
