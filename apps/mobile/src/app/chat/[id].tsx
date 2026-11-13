import * as Crypto from "expo-crypto";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Image } from "expo-image";
import {
  FlatList,
  KeyboardAvoidingView,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import { createChatSendCoordinator } from "../../lib/chat-send-coordinator";
import {
  createChatReadCoordinator,
  shouldShowConversationLoadError,
} from "../../lib/chat-read-coordinator";
import type { ChatMessage } from "../../lib/types";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

export default function ConversationScreen() {
  const { id, productId } = useLocalSearchParams<{
    id: string;
    productId?: string;
  }>();
  const { user, loading } = useAuth();
  const cache = useQueryClient();
  const [draft, setDraft] = useState("");
  const sendCoordinator = useRef(createChatSendCoordinator());
  const currentScope = useRef({ accountId: user?.id, conversationId: id });
  currentScope.current = { accountId: user?.id, conversationId: id };
  const readCoordinator = useRef(createChatReadCoordinator());
  const [shareProductId, setShareProductId] = useState<string | null>(null);
  useEffect(() => {
    if (productId) setShareProductId(productId);
  }, [productId]);
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
  const blockedByMe = Boolean(
    user &&
    conversation &&
    (conversation.buyerId === user.id
      ? conversation.buyerBlockedAt
      : conversation.sellerBlockedAt),
  );
  const isBlocked = Boolean(
    conversation?.buyerBlockedAt || conversation?.sellerBlockedAt,
  );
  const block = useMutation({
    mutationFn: (blocked: boolean) => api.conversationBlock(id, blocked),
    onSuccess: () => {
      void cache.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
    onError: (error) => {
      Alert.alert(
        "Unable to update conversation",
        error instanceof Error ? error.message : "Try again",
      );
    },
  });
  const newestMessageId = messages.data?.pages[0]?.data[0]?.id;
  const accountId = user?.id;
  const conversationId = conversation?.id;
  useEffect(() => {
    if (!accountId || !conversationId || !newestMessageId) return;
    void readCoordinator.current
      .acknowledge({
        accountId,
        conversationId,
        newestMessageId,
        currentScope: () => currentScope.current,
        send: (chatId) => api.conversationRead(chatId),
        refresh: (id) =>
          cache.invalidateQueries({ queryKey: ["conversations", id] }),
      })
      .catch(() => {
        // Retry on the next successful message poll without a busy loop.
      });
    // dataUpdatedAt changes after each poll, permitting delayed retry
    // without repeating an already acknowledged message.
  }, [
    accountId,
    conversationId,
    newestMessageId,
    messages.dataUpdatedAt,
    cache,
  ]);
  const send = useMutation({
    mutationFn: (input: { body: string; key: string; productId?: string }) =>
      api.sendChatMessage(id, input.body, input.key, input.productId),
  });
  const submit = () => {
    void sendCoordinator.current
      .submit({
        accountId: user?.id,
        conversationId: id,
        body: draft,
        productId: shareProductId,
        blocked: isBlocked,
        currentScope: () => currentScope.current,
        makeKey: () => Crypto.randomUUID(),
        send: (payload) => send.mutateAsync(payload),
        confirmed: (sent) => {
          // Only clear fields still matching the acknowledged message.
          setDraft((current) => (current.trim() === sent.body ? "" : current));
          setShareProductId((current) =>
            current === (sent.productId ?? null) ? null : current,
          );
          // Query updates are account/conversation-scoped, and secondary
          // refresh failures must not cause a successfully sent message
          // to be submitted again with a different idempotency key.
          void cache.invalidateQueries({
            queryKey: ["chat-messages", user?.id, id],
          });
          void cache.invalidateQueries({
            queryKey: ["conversations", user?.id],
          });
        },
      })
      .catch(() => {
        // Preserve the coordinator's exact-payload retry ID.
        // React Query exposes the mutation error for visible retry feedback.
      });
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
        <Text style={styles.heading} numberOfLines={1}>
          {other}
        </Text>
        {conversation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Report conversation"
            onPress={() =>
              router.push({
                pathname: "/chat/report",
                params: { conversationId: id },
              })
            }
          >
            <Text style={styles.reportText}>Report</Text>
          </Pressable>
        ) : null}
        {conversation ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              blockedByMe ? "Unblock conversation" : "Block conversation"
            }
            disabled={block.isPending}
            onPress={() => {
              Alert.alert(
                blockedByMe ? "Unblock conversation?" : "Block conversation?",
                blockedByMe
                  ? "Allow messages in this chat again?"
                  : "Neither participant will be able to send new messages until you unblock.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: blockedByMe ? "Unblock" : "Block",
                    style: blockedByMe ? "default" : "destructive",
                    onPress: () => block.mutate(!blockedByMe),
                  },
                ],
              );
            }}
          >
            <Text style={styles.blockText}>
              {blockedByMe ? "Unblock" : "Block"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      {shouldShowConversationLoadError({
        messageError: messages.isError,
        hasMessageData: Boolean(messages.data?.pages.length),
        membershipError: members.isError,
      }) ? (
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
              if (
                messages.hasNextPage &&
                !messages.isFetchingNextPage &&
                !messages.isFetchNextPageError
              )
                void messages.fetchNextPage();
            }}
            ListFooterComponent={
              messages.isFetchingNextPage ? (
                <ScreenState loading message="Loading older messages…" />
              ) : messages.isFetchNextPageError ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading older messages"
                  onPress={() => {
                    if (!messages.isFetchingNextPage)
                      void messages.fetchNextPage();
                  }}
                  style={styles.olderRetry}
                >
                  <Text style={styles.olderRetryText}>
                    Couldn't load older messages. Tap to retry.
                  </Text>
                </Pressable>
              ) : undefined
            }
            renderItem={({ item }) => {
              const mine = item.senderId === user.id;
              return (
                <View
                  style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                >
                  {item.body ? (
                    <Text style={[styles.message, mine && styles.mineText]}>
                      {item.body}
                    </Text>
                  ) : null}
                  {item.product ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`View shared product ${item.product.name}`}
                      onPress={() =>
                        router.push({
                          pathname: "/product/[id]",
                          params: { id: item.product!.id },
                        })
                      }
                      style={styles.sharedProduct}
                    >
                      {item.product.images[0]?.url ? (
                        <Image
                          source={{ uri: item.product.images[0].url }}
                          contentFit="cover"
                          style={styles.productImage}
                        />
                      ) : null}
                      <View style={styles.productDetails}>
                        <Text style={styles.productTitle} numberOfLines={2}>
                          {item.product.name}
                        </Text>
                        <Text style={styles.productPrice}>
                          ₦{Number(item.product.price).toLocaleString("en-NG")}
                        </Text>
                        {!item.product.active ? (
                          <Text style={styles.unavailable}>Unavailable</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  ) : item.productId ? (
                    <Text style={[styles.message, mine && styles.mineText]}>
                      Shared product is no longer available.
                    </Text>
                  ) : null}
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
          {shareProductId ? (
            <View style={styles.sharePreview}>
              <Text style={styles.sharePreviewText}>Sharing a product</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove shared product"
                onPress={() => {
                  setShareProductId(null);
                  send.reset();
                }}
              >
                <Text style={styles.shareRemove}>Remove</Text>
              </Pressable>
            </View>
          ) : null}
          {isBlocked ? (
            <Text style={styles.blockedNotice}>
              Messaging is disabled in this conversation.
            </Text>
          ) : null}
          <View style={styles.composer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Share a product"
              onPress={() =>
                router.push({
                  pathname: "/chat/share-product",
                  params: { conversationId: id },
                })
              }
              style={styles.shareButton}
            >
              <Text style={styles.shareButtonText}>+</Text>
            </Pressable>
            <TextInput
              style={styles.input}
              value={draft}
              placeholder="Type a message"
              placeholderTextColor={colors.muted}
              onChangeText={(value) => {
                setDraft(value);
                send.reset();
              }}
              multiline
              maxLength={4000}
              accessibilityLabel="Message text"
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send message"
              disabled={
                isBlocked ||
                (!draft.trim() && !shareProductId) ||
                send.isPending ||
                sendCoordinator.current.isBusy
              }
              style={[
                styles.sendButton,
                (isBlocked ||
                  (!draft.trim() && !shareProductId) ||
                  send.isPending ||
                  sendCoordinator.current.isBusy) &&
                  styles.disabled,
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  heading: { fontSize: 18, fontWeight: "800", color: colors.ink, flex: 1 },
  blockText: { color: colors.red, fontSize: 13, fontWeight: "700" },
  reportText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  blockedNotice: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: colors.red,
    fontSize: 12,
  },
  list: { padding: 14, gap: 10, flexGrow: 1, justifyContent: "flex-end" },
  olderRetry: {
    padding: 12,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  olderRetryText: { color: colors.orange, fontSize: 13, fontWeight: "700" },
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
  sharedProduct: {
    flexDirection: "row",
    marginTop: 8,
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    minWidth: 200,
  },
  productImage: { width: 70, height: 70 },
  productDetails: { flex: 1, padding: 8, justifyContent: "center", gap: 4 },
  productTitle: { fontSize: 12, color: colors.ink, fontWeight: "700" },
  productPrice: { fontSize: 12, color: colors.orange, fontWeight: "800" },
  unavailable: { color: colors.red, fontSize: 11 },
  sharePreview: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.orangePale,
  },
  sharePreviewText: { color: colors.ink, fontSize: 12 },
  shareRemove: { color: colors.red, fontWeight: "700" },
  shareButton: {
    minHeight: 44,
    width: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  shareButtonText: { color: colors.orange, fontSize: 28, fontWeight: "800" },
  error: {
    color: colors.red,
    fontSize: 12,
    paddingHorizontal: 14,
    paddingTop: 8,
  },
});
