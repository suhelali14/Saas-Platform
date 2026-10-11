import { useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { IntentRequest, MatchResult } from "@intently/shared-types";
import type { SharedStackParamList } from "../navigation/types";
import { Badge, Card, ChatBubble, EmptyState, ErrorState, LoadingState, TextField, Button, type ChatItem } from "../components";
import { colors, radius, spacing, typography } from "../theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { useIntentRequest } from "../hooks/useIntentRequest";
import { useSendIntentMessage } from "../hooks/useSendIntentMessage";
import { recordFunnelEvent } from "../lib/api";

type Props = NativeStackScreenProps<SharedStackParamList, "Results">;

const MESSAGE_MAX_LENGTH = 2000;

// The Activity chat feature (docs/04-multi-agent-design.md "Conversational
// refinement"): every IntentRequest is a thread the user can keep talking
// in -- each reply re-parses with the full conversation + prior understood
// state, updates the match list, and posts a deterministic assistant
// summary. Not a scroll-and-forget results page.
export default function ResultsScreen({ route, navigation }: Props) {
  const { intentRequestId } = route.params;
  const { data, isPending, isError, error, refetch } = useIntentRequest(intentRequestId);
  const sendMessage = useSendIntentMessage(intentRequestId);
  const [draft, setDraft] = useState("");
  // The user's own message + the "assistant is replying" placeholder,
  // rendered locally before the round-trip resolves -- otherwise every
  // refinement turn (a real network + AI call) leaves the chat looking
  // frozen for a couple of seconds after hitting send. Cleared on success
  // since the server's `messages` (primed into the query cache by
  // useSendIntentMessage) already includes the real thing by then; kept
  // around with status "failed" on error so the message isn't just lost --
  // the bubble itself becomes the retry affordance.
  const [pending, setPending] = useState<{ content: string; status: "sending" | "failed" } | null>(null);
  const listRef = useRef<FlatList>(null);
  const headerHeight = useHeaderHeight();

  if (isPending) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <LoadingState label="Loading..." />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
        <ErrorState message={error instanceof Error ? error.message : "Unknown error"} onRetry={refetch} />
      </SafeAreaView>
    );
  }

  const { intentRequest, matches, messages } = data;

  const scrollToEnd = (animated: boolean) => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated }));

  const doSend = (content: string) => {
    setPending({ content, status: "sending" });
    scrollToEnd(true);
    sendMessage.mutate(content, {
      onSuccess: () => {
        setPending(null);
        scrollToEnd(true);
      },
      onError: () => setPending((p) => (p ? { ...p, status: "failed" } : p)),
    });
  };

  const handleSend = () => {
    const content = draft.trim();
    if (!content || pending?.status === "sending") return;
    setDraft("");
    doSend(content);
  };

  const chatItems: ChatItem[] = [
    ...messages.map((message): ChatItem => ({ kind: "message", message })),
    ...(pending ? [{ kind: "pending", id: "pending", content: pending.content, status: pending.status } as const] : []),
    ...(pending?.status === "sending" ? [{ kind: "typing", id: "typing" } as const] : []),
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={headerHeight}
      >
        <FlatList
          ref={listRef}
          style={styles.flex}
          data={chatItems}
          keyExtractor={(item) => (item.kind === "message" ? item.message.id : item.id)}
          renderItem={({ item }) => <ChatBubble item={item} onRetry={doSend} />}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => scrollToEnd(false)}
          ListHeaderComponent={<IntentSummary intentRequest={intentRequest} />}
          ListFooterComponent={
            <MatchesSection
              matches={matches}
              pending={pending?.status === "sending"}
              onPressMatch={(businessId) => {
                recordFunnelEvent("RESULT_OPENED", intentRequestId);
                navigation.navigate("BusinessProfile", { businessId });
              }}
              onPressBook={(match) => navigation.navigate("Booking", { 
                matchId: match.id,
                offerId: match.offer.id,
                businessId: match.business.id,
                offerPrice: match.offer.price,
                offerDescription: match.offer.description,
                businessName: match.business.name,
                hasRazorpay: !!match.business.razorpayKeyId,
                currency: match.offer.currency
              })}
            />
          }
        />

        <View style={styles.inputBar}>
          <View style={styles.inputWrap}>
            <TextField
              variant="outline"
              placeholder="Refine your search..."
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={MESSAGE_MAX_LENGTH}
              editable={pending?.status !== "sending"}
            />
          </View>
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || pending?.status === "sending"}
            style={({ pressed }) => [
              styles.sendButton,
              (!draft.trim() || pending?.status === "sending") && styles.sendButtonDisabled,
              pressed && styles.sendButtonPressed,
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.accentText} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function IntentSummary({ intentRequest }: { intentRequest: IntentRequest }) {
  return (
    <View style={styles.intentChips}>
      <View style={styles.chip}>
        <Text style={styles.chipText}>{intentRequest.category ?? "Unknown category"}</Text>
      </View>
      {intentRequest.budget?.max ? (
        <View style={styles.chip}>
          <Text style={styles.chipText}>
            Under {intentRequest.budget.currency} {intentRequest.budget.max}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function MatchesSection({
  matches,
  pending,
  onPressMatch,
  onPressBook,
}: {
  matches: MatchResult[];
  pending: boolean;
  onPressMatch: (businessId: string) => void;
  onPressBook: (match: MatchResult) => void;
}) {
  return (
    <View style={styles.matchesSection}>
      <Text style={styles.label}>
        {pending
          ? "Updating matches..."
          : matches.length > 0
            ? `${matches.length} Match${matches.length === 1 ? "" : "es"}`
            : "Matches"}
      </Text>
      {matches.length === 0 && !pending ? (
        <EmptyState
          title="No matches yet"
          description="No seeded businesses match this category/budget yet. Try a category the v0 matcher covers: restaurant, gym, or salon."
        />
      ) : (
        matches.map((match) => (
          <MatchCard 
            key={match.id} 
            match={match} 
            onPress={() => onPressMatch(match.business.id)} 
            onPressBook={() => onPressBook(match)} 
          />
        ))
      )}
    </View>
  );
}

function MatchCard({ match, onPress, onPressBook }: { match: MatchResult; onPress: () => void; onPressBook: () => void }) {
  const { ratingAverage, verifiedTransactionCount } = match.business;

  return (
    <Card onPress={onPress} style={styles.matchCard}>
      <View style={styles.matchImagePlaceholder} />
      <View style={styles.matchInfo}>
        <View style={styles.matchHeader}>
          <Text style={styles.matchName} numberOfLines={1}>{match.business.name}</Text>
          {ratingAverage > 0 ? (
            <View style={styles.ratingWrap}>
              <Ionicons name="star" size={14} color="#FFB800" />
              <Text style={styles.ratingText}>{ratingAverage.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.matchDetail}>
          {match.offer.currency} {match.offer.price} · {match.business.city}
          {verifiedTransactionCount > 0 ? ` · ${verifiedTransactionCount} verified` : ""}
        </Text>
        <Text style={styles.matchDescription} numberOfLines={2}>{match.offer.description}</Text>
        {match.reason ? (
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.sm }}>
            <Badge label={match.reason} tone="accent" />
          </View>
        ) : <View style={{ marginTop: spacing.sm }} />}
        <Button 
          title="Book Now" 
          onPress={onPressBook} 
          style={{ marginTop: spacing.sm, alignSelf: 'flex-start', paddingHorizontal: spacing.xl }}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  listContent: { padding: spacing.lg, flexGrow: 1 },
  label: { ...typography.h2, fontSize: 18, color: colors.textPrimary, marginBottom: spacing.sm },
  intentChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.accentDark,
    borderRadius: radius.full,
  },
  chipText: {
    ...typography.caption,
    color: colors.surface,
  },
  matchesSection: { marginTop: spacing.lg },
  matchCard: { padding: spacing.sm, flexDirection: "row", gap: spacing.md, marginBottom: spacing.sm },
  matchImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: radius.md,
    backgroundColor: colors.border,
  },
  matchInfo: {
    flex: 1,
    justifyContent: "center",
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  matchName: { ...typography.bodyBold, color: colors.textPrimary, flex: 1, marginRight: spacing.sm },
  ratingWrap: { flexDirection: "row", alignItems: "center", gap: 2 },
  ratingText: { ...typography.caption, color: colors.textSecondary },
  matchDetail: { ...typography.caption, color: colors.textMuted, marginBottom: 4 },
  matchDescription: { ...typography.caption, color: colors.textSecondary },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  inputWrap: { flex: 1 },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.4 },
  sendButtonPressed: { opacity: 0.85 },
});
