import { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { IntentMessageDTO } from "@intently/shared-types";
import { colors, radius, spacing, typography } from "../theme/tokens";

// What ResultsScreen's chat thread actually renders, one item per row:
// - a real, persisted IntentMessage from the server
// - the user's own message while its refinement request is in flight or
//   just failed (optimistic -- rendered before the round-trip completes so
//   sending feels instant, per docs/04's "Conversational refinement")
// - the assistant "thinking" placeholder while that same request is pending
export type ChatItem =
  | { kind: "message"; message: IntentMessageDTO }
  | { kind: "pending"; id: string; content: string; status: "sending" | "failed" }
  | { kind: "typing"; id: string };

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ChatBubble({ item, onRetry }: { item: ChatItem; onRetry?: (content: string) => void }) {
  if (item.kind === "typing") {
    return (
      <View style={[styles.row, styles.rowAssistant]}>
        <View style={[styles.bubble, styles.bubbleAssistant, styles.typingBubble]}>
          <TypingDots />
        </View>
      </View>
    );
  }

  if (item.kind === "pending") {
    return (
      <View style={[styles.row, styles.rowUser]}>
        <View style={styles.pendingColumn}>
          <View style={[styles.bubble, styles.bubbleUser, item.status === "failed" && styles.bubbleFailed]}>
            <Text style={[styles.text, styles.textUser]}>{item.content}</Text>
          </View>
          <View style={styles.statusRow}>
            {item.status === "sending" ? (
              <Text style={styles.statusText}>Sending...</Text>
            ) : (
              <Pressable style={styles.retryRow} onPress={() => onRetry?.(item.content)} hitSlop={8}>
                <Ionicons name="alert-circle" size={13} color={colors.danger} />
                <Text style={styles.retryText}>Failed · Tap to retry</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    );
  }

  const { message } = item;
  const isUser = message.role === "USER";

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={isUser ? styles.pendingColumn : undefined}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>{message.content}</Text>
        </View>
        <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAssistant]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

function TypingDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, easing: Easing.ease, useNativeDriver: true }),
          Animated.delay((2 - i) * 150),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.dotsRow}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginBottom: spacing.md },
  rowUser: { justifyContent: "flex-end" },
  rowAssistant: { justifyContent: "flex-start" },
  pendingColumn: { maxWidth: "82%", alignItems: "flex-end" },
  bubble: {
    maxWidth: "82%",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
  },
  bubbleUser: { backgroundColor: colors.accentDark, borderBottomRightRadius: radius.sm },
  bubbleAssistant: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm },
  bubbleFailed: { backgroundColor: colors.dangerBg, borderWidth: 1, borderColor: colors.danger },
  text: { ...typography.body, fontSize: 15 },
  textUser: { color: colors.accentText },
  textAssistant: { color: colors.textPrimary },
  timestamp: { ...typography.caption, fontSize: 11, color: colors.textFaint, marginTop: 2 },
  timestampUser: { marginRight: 4 },
  timestampAssistant: { marginLeft: 4 },
  statusRow: { marginTop: 2, marginRight: 4 },
  statusText: { ...typography.caption, fontSize: 11, color: colors.textFaint },
  retryRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  retryText: { ...typography.caption, fontSize: 11, color: colors.danger },
  typingBubble: { paddingVertical: spacing.md + 2 },
  dotsRow: { flexDirection: "row", gap: 4 },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.textFaint },
});
