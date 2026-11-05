import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
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
import { ScreenState } from "../../../components/ScreenState";
import { api } from "../../../lib/api";
import type { ProductComment } from "../../../lib/types";
import { useAuth } from "../../../providers/auth";
import { colors } from "../../../theme";

export default function CommentsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const comments = useInfiniteQuery({
    queryKey: ["comments", id],
    enabled: Boolean(id),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.comments(id, pageParam),
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
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await api.comment(id, body.trim());
      setBody("");
      await client.invalidateQueries({ queryKey: ["comments", id] });
    } catch (error) {
      Alert.alert(
        "Couldn't post comment",
        error instanceof Error ? error.message : "Please try again",
      );
    } finally {
      setBusy(false);
    }
  };
  const rows = comments.data?.pages.flatMap((page) => page.data) ?? [];
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      {comments.isError && !rows.length ? (
        <ScreenState
          message={
            comments.error instanceof Error
              ? comments.error.message
              : "Unable to load comments"
          }
          retry={() => {
            void comments.refetch();
          }}
        />
      ) : (
        <FlatList<ProductComment>
          data={rows}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          onEndReached={() => {
            if (comments.hasNextPage && !comments.isFetchingNextPage)
              void comments.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => (
            <View style={styles.comment}>
              <Text style={styles.author}>{item.user.name}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <Text style={styles.date}>
                {new Date(item.createdAt).toLocaleDateString("en-NG")}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <ScreenState
              loading={comments.isPending}
              message={
                comments.isPending
                  ? "Loading comments…"
                  : "Be the first to comment."
              }
            />
          }
          ListFooterComponent={
            comments.isFetchingNextPage ? (
              <ActivityIndicator color={colors.orange} />
            ) : undefined
          }
        />
      )}
      <View style={styles.composer}>
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write a comment…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          maxLength={1000}
          multiline
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || !body.trim()}
          onPress={() => {
            void post();
          }}
          style={[styles.send, (busy || !body.trim()) && { opacity: 0.5 }]}
        >
          <Text style={styles.sendText}>{busy ? "…" : "Post"}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  comment: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  author: { fontWeight: "800", color: colors.ink },
  body: { color: colors.ink, lineHeight: 20 },
  date: { color: colors.muted, fontSize: 11, marginTop: 2 },
  composer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    backgroundColor: colors.surface,
    color: colors.ink,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderRadius: 18,
  },
  send: {
    minHeight: 44,
    paddingHorizontal: 17,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.orange,
  },
  sendText: { color: "white", fontWeight: "800" },
});
