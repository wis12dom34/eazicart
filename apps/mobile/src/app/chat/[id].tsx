import * as Crypto from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import type { ChatMessage } from "../../lib/types";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useAuth();
  const cache = useQueryClient();
  const [draft, setDraft] = useState("");
  const [retryKey, setRetryKey] = useState<string | null>(null);
  const messages = useInfiniteQuery({
    queryKey: ["chat-messages", user?.id, id],
    enabled: Boolean(id && user) && !loading,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.conversationMessages(id, pageParam),
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
    refetchInterval: 12000,
  });
  const members = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: api.conversations,
    enabled: Boolean(id && user) && !loading,
  });
  const conversation = members.data?.data.find((c) => c.id === id);
  const other =
    user && conversation
      ? conversation.buyerId === user.id
        ? (conversation.seller.sellerProfile?.displayName ??
          conversation.seller.name)
        : conversation.buyer.name
      : "Conversation";
  const send = useMutation({
    mutationFn: (input: { body: string; key: string }) =>
      api.sendChatMessage(id, input.body, input.key),
    onSuccess: async () => {
      setDraft("");
      setRetryKey(null);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["chat-messages", user?.id, id] }),
        cache.invalidateQueries({ queryKey: ["conversations", user?.id] }),
      ]);
    },
  });
  const submit = () => {
    const body = draft.trim();
    if (!body || send.isPending || body.length > 4000) return;
    const key = retryKey ?? Crypto.randomUUID();
    setRetryKey(key);
    send.mutate({ body, key });
  };
  if (loading) return <ScreenState loading message="Loading conversation…" />;
  if (!user) {
    return (
      <View style={styles.center}>
        <ScreenState message="Sign in to view private messages." />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/login")}
        >
          <Text style={styles.signIn}>Sign in</Text>
        </Pressable>
      </View>
    );
  }
  const items = messages.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
    >
      <View style={styles.header}>
        <Text style={styles.heading}>{other}</Text>
      </View>
      {messages.isError || members.isError ? (
        <ScreenState
          message="Unable to open this conversation."
          retry={() => {
            void messages.refetch();
            void members.refetch();
          }}
        />
      ) : members.isPending || messages.isPending ? (
        <ScreenState loading message="Loading messages…" />
      ) : !conversation ? (
        <ScreenState message="This conversation is unavailable." />
      ) : (
        <>
          <FlatList<ChatMessage>
            data={items}
            inverted
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            onEndReachedThreshold={0.5}
            onEndReached={() => {
              if (messages.hasNextPage && !messages.isFetchingNextPage)
                void messages.fetchNextPage();
            }}
            ListFooterComponent={
              messages.isFetchingNextPage ? (
                <ScreenState loading message="Loading older messages…" />
              ) : undefined
            }
            renderItem={({ item }) => {
              const mine = item.senderId === user.id;
              return (
                <View
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                >
                  <Text style={[styles.message, mine && styles.mineText]}>
                    {item.body}
                  </Text>
                </View>
              );
            }}
            ListEmptyComponent={
              <ScreenState message="Say hello to start the conversation." />
            }
          />
          {send.error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              Message not confirmed. Retry the same message or edit it.
            </Text>
          ) : null}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={draft}
              placeholder="Type a message"
              placeholderTextColor={colors.muted}
              onChangeText={(value) => {
                setDraft(value);
                setRetryKey(null);
                send.reset();
              }}
              multiline
              maxLength={4000}
              accessibilityLabel="Message text"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={!draft.trim() || send.isPending}
              style={[
                styles.sendButton,
                (!draft.trim() || send.isPending) && styles.disabled,
              ]}
              onPress={submit}
            >
              <Text style={styles.sendText}>
                {send.isPending ? "…" : "Send"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", padding: 18 },
  signIn: { textAlign: "center", color: colors.orange, fontWeight: "800" },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heading: { fontSize: 18, fontWeight: "800", color: colors.ink },
  list: { padding: 14, gap: 10, flexGrow: 1, justifyContent: "flex-end" },
  bubble: { maxWidth: "84%", padding: 12, borderRadius: 18 },
  mine: { alignSelf: "flex-end", backgroundColor: colors.orange },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.orangePale },
  message: { fontSize: 14, lineHeight: 20, color: colors.ink },
  mineText: { color: "white" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 125,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 15,
    paddingVertical: 10,
    color: colors.ink,
  },
  sendButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: colors.orange,
    justifyContent: "center",
  },
  disabled: { opacity: 0.45 },
  sendText: { color: "white", fontWeight: "800" },
  error: {
    color: colors.red,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
});
