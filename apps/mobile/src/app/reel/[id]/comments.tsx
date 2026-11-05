import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../../lib/api";
import type { ReelComment } from "../../../lib/types";
import { useAuth } from "../../../providers/auth";
import { colors } from "../../../theme";

export default function ReelCommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const cache = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  const comments = useInfiniteQuery({
    queryKey: ["reel-comments", id],
    initialPageParam: null as string | null,
    enabled: Boolean(id),
    queryFn: ({ pageParam }) => api.reelComments(id, pageParam),
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });

  const post = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    const value = body.trim();
    if (!value || busy || value.length > 1000) return;
    setBusy(true);
    try {
      await api.reelComment(id, value);
      setBody("");
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["reel-comments", id] }),
        cache.invalidateQueries({ queryKey: ["reels"] }),
      ]);
    } catch (error) {
      Alert.alert(
        "Comment not posted",
        error instanceof Error ? error.message : "Please try again",
      );
    } finally {
      setBusy(false);
    }
  };

  // Each API page is ascending, but subsequent pages are older.
  // Display latest first without duplicating or inventing comments.
  const latestFirst = (comments.data?.pages ?? []).flatMap((page) =>
    [...page.data].reverse(),
  );
  const deduplicated = latestFirst.filter(
    (entry, index, all) =>
      all.findIndex((other) => other.id === entry.id) === index,
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      {comments.isError && !deduplicated.length ? (
        <View style={styles.empty}>
          <Text style={styles.message}>Couldn't load Reel comments.</Text>
          <Pressable
            style={styles.retry}
            accessibilityRole="button"
            onPress={() => {
              void comments.refetch();
            }}
          >
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList<ReelComment>
          data={deduplicated}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (comments.hasNextPage && !comments.isFetchingNextPage)
              void comments.fetchNextPage();
          }}
          renderItem={({ item }) => (
            <View style={styles.comment}>
              <View style={styles.avatar}>
                <Text style={styles.letter}>
                  {item.user.name[0]?.toUpperCase() ?? "E"}
                </Text>
              </View>
              <View style={styles.commentBody}>
                <Text style={styles.author}>{item.user.name}</Text>
                <Text style={styles.text}>{item.body}</Text>
                <Text style={styles.date}>
                  {new Date(item.createdAt).toLocaleDateString("en-NG")}
                </Text>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              {comments.isPending ? (
                <ActivityIndicator color={colors.orange} />
              ) : (
                <Ionicons
                  name="chatbubble-outline"
                  color={colors.muted}
                  size={34}
                />
              )}
              <Text style={styles.message}>
                {comments.isPending
                  ? "Loading comments…"
                  : "No comments yet. Start the conversation."}
              </Text>
            </View>
          }
          ListFooterComponent={
            comments.isFetchingNextPage ? (
              <ActivityIndicator color={colors.orange} style={styles.footer} />
            ) : comments.isFetchNextPageError ? (
              <Pressable
                style={styles.retry}
                onPress={() => {
                  void comments.fetchNextPage();
                }}
              >
                <Text style={styles.retryText}>Load older comments</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
      <View style={styles.composer}>
        <TextInput
          accessibilityLabel="Reel comment"
          value={body}
          onChangeText={setBody}
          placeholder="Add a comment…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={1000}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Post Reel comment"
          disabled={busy || !body.trim()}
          style={[styles.send, (busy || !body.trim()) && styles.disabled]}
          onPress={() => {
            void post();
          }}
        >
          <Ionicons name="send" size={20} color="white" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 16, flexGrow: 1 },
  comment: {
    flexDirection: "row",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 11,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.orangePale,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { color: colors.orange, fontSize: 16, fontWeight: "800" },
  commentBody: { flex: 1, gap: 4 },
  author: { fontSize: 13, fontWeight: "800", color: colors.ink },
  text: { fontSize: 14, lineHeight: 20, color: colors.ink },
  date: { fontSize: 11, color: colors.muted },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    minHeight: 220,
    paddingHorizontal: 28,
  },
  message: { color: colors.muted, textAlign: "center" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 9,
    padding: 12,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.surface,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.ink,
  },
  send: {
    backgroundColor: colors.orange,
    minWidth: 46,
    minHeight: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  footer: { padding: 15 },
  retry: {
    minHeight: 44,
    minWidth: 130,
    padding: 12,
    alignSelf: "center",
    borderRadius: 22,
    backgroundColor: colors.orange,
  },
  retryText: { color: "white", fontWeight: "700", textAlign: "center" },
});
