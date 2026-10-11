import { useState } from "react";
import { StyleSheet, Text, View, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../navigation/types";
import { AppLogo, Button } from "../../components";
import { colors, spacing, typography, fonts } from "../../theme/tokens";
import { Ionicons } from "@expo/vector-icons";

const ONBOARDING_DATA = [
  {
    icon: "chatbubble-ellipses-outline" as const,
    title: "Tell Us What\nYou Need",
    subtitle: "Type it in plain language — budget, location,\ntiming, all help us find the right match",
  },
  {
    icon: "sparkles-outline" as const,
    title: "We Find Real\nMatches",
    subtitle: "Real businesses, real offers, ranked\nfor you — not a feed of ads",
  },
  {
    icon: "rocket-outline" as const,
    title: "Welcome to\nIntently",
    subtitle: "Stop searching. Start asking.",
  },
];

type Props = NativeStackScreenProps<AuthStackParamList, "Onboarding">;

export default function OnboardingScreen({ navigation }: Props) {
  const [step, setStep] = useState(0);
  const { width } = useWindowDimensions();
  const isFinalStep = step === ONBOARDING_DATA.length - 1;

  const handleNext = () => {
    if (step < ONBOARDING_DATA.length - 1) {
      setStep(step + 1);
    } else {
      navigation.navigate("Welcome");
    }
  };

  const handleSkip = () => {
    navigation.navigate("Welcome");
  };

  const current = ONBOARDING_DATA[step]!;
  const illustrationSize = Math.min(width * 0.62, 260);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <View style={styles.header}>
        {!isFinalStep ? (
          <Pressable onPress={handleSkip} style={styles.skipBtn} hitSlop={8}>
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
        ) : (
          <View style={styles.skipBtn} />
        )}
      </View>

      <View style={styles.content}>
        <View
          style={[
            styles.illustrationShadow,
            { width: illustrationSize, height: illustrationSize, borderRadius: illustrationSize * 0.32 },
          ]}
        >
          <LinearGradient
            colors={[colors.accent, colors.accentDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.illustration, { borderRadius: illustrationSize * 0.32 }]}
          >
            {isFinalStep ? (
              // The same brand mark Splash/Welcome use, so onboarding's last
              // beat and the screen right after "Get Started" feel like one
              // continuous moment instead of a generic stock icon.
              <AppLogo size={illustrationSize * 0.42} />
            ) : (
              <Ionicons name={current.icon} size={illustrationSize * 0.34} color={colors.accentText} />
            )}
          </LinearGradient>
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.subtitle}>{current.subtitle}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {ONBOARDING_DATA.map((_, i) => (
            <View key={i} style={[styles.dot, step === i && styles.activeDot]} />
          ))}
        </View>

        {isFinalStep ? (
          <Button title="Get Started" variant="dark" onPress={handleNext} rounded style={{ width: "100%" }} />
        ) : (
          <Pressable onPress={handleNext} style={styles.nextBtn} hitSlop={8}>
            <Ionicons name="arrow-forward" size={24} color={colors.surface} />
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 56,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  skipBtn: { padding: spacing.sm },
  skipText: {
    ...typography.bodyBold,
    color: colors.textMuted,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  illustrationShadow: {
    marginBottom: spacing.xxl,
    shadowColor: colors.accentShadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 6,
  },
  illustration: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    alignItems: "center",
  },
  title: {
    ...typography.h1,
    fontSize: 34,
    textAlign: "center",
    color: colors.textPrimary,
    marginBottom: spacing.md,
    lineHeight: 44,
  },
  subtitle: {
    ...typography.body,
    fontFamily: fonts.medium,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 24,
  },
  footer: {
    padding: spacing.xl,
    paddingBottom: spacing.xxl,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dots: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  activeDot: {
    width: 24,
    backgroundColor: colors.accentDark,
  },
  nextBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentDark,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentShadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
});
