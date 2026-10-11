import { StyleSheet, Text, View } from "react-native";
import { AppLogo } from "../../components";
import { colors, spacing, typography } from "../../theme/tokens";

/**
 * Shown while AuthContext resolves the initial session check (see
 * App.tsx / AuthContext) -- the native splash (app.json) hands off to this
 * once JS is running, matching the Figma "Splash" frame's layout.
 */
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <AppLogo size={110} />
      </View>
      <View style={styles.footer}>
        <Text style={styles.title}>Intently</Text>
        <Text style={styles.version}>Version 1.0</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  footer: { alignItems: "center", paddingBottom: spacing.xxl * 2, gap: spacing.xs },
  title: { ...typography.h1, color: colors.textPrimary },
  version: { ...typography.caption, color: colors.textMuted },
});
