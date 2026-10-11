import { RefreshControl, ScrollView, StyleSheet, type ScrollViewProps } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors, spacing } from "../theme/tokens";

interface ScreenContainerProps extends ScrollViewProps {
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  // Screens with a native stack header (headerShown: true) already have
  // their top safe-area inset consumed by that header -- those should pass
  // the default (bottom only). Tab-root screens that hide the native
  // header (headerShown: false) and render their own top content need
  // edges={["top", "bottom"]} or that content renders under the
  // status bar/notch. See navigation/*.tsx for which is which.
  edges?: readonly Edge[];
}

/**
 * Consistent screen chrome (safe area + padding) so individual screens
 * don't each reinvent it -- and don't each get it wrong. Set scroll={false}
 * for screens that manage their own scrolling (e.g. a FlatList).
 */
export function ScreenContainer({
  children,
  scroll = true,
  onRefresh,
  refreshing = false,
  contentContainerStyle,
  edges = ["bottom"],
  ...rest
}: ScreenContainerProps) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.safeArea} edges={edges}>
        {children}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <ScrollView
        contentContainerStyle={[styles.content, contentContainerStyle]}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />
          ) : undefined
        }
        {...rest}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
});

export const screenPadding = { paddingHorizontal: spacing.lg };
