import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import type { Conversation } from "../../lib/types";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

export default function ChatInbox() {
  const { user, loading } = useAuth();
  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: api.conversations,
    enabled: Boolean(user) && !loading,
    refetchInterval: 15000,
  });
  if (loading)
    return <ScreenState loading message="Preparing your messages…" />;
  if (!user)
    return (
      <View style={styles.center}>
        <ScreenState message="Sign in to message EaziCart sellers." />
        <Pressable
          accessibilityRole="button"
          style={styles.button}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.buttonText}>Sign in</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={styles.screen}>
      <Text style={styles.heading}>Messages</Text>
      {conversations.isError ? (
        <ScreenState
          message="Unable to load messages."
          retry={() => void conversations.refetch()}
        />
      ) : (
        <FlatList<Conversation>
          data={conversations.data?.data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={false}
          refreshControl={
            <RefreshControl
              refreshing={conversations.isRefetching}
              tintColor={colors.orange}
              onRefresh={() => void conversations.refetch()}
            />
          }
          ListEmptyComponent={
            <ScreenState
              loading={conversations.isPending}
              message={
                conversations.isPending
                  ? "Loading conversations…"
                  : "No conversations yet. Open a seller storefront to start chatting."
              }
            />
          }
          renderItem={({ item }) => {
            const other =
              item.buyerId === user.id
                ? (item.seller.sellerProfile?.displayName ?? item.seller.name)
                : item.buyer.name;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open conversation with ${other}`}
                onPress={() =>
                  router.push({
                    pathname: "/chat/[id]",
                    params: { id: item.id },
                  })
                }
                style={styles.item}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {other.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.details}>
                  <Text style={styles.name} numberOfLines={1}>
                    {other}
                  </Text>
                  <Text style={styles.meta}>Tap to view messages</Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={19}
                  color={colors.muted}
                />
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: "center", padding: 16 },
  heading: { fontSize: 24, fontWeight: "800", color: colors.ink, padding: 18 },
  item: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 16,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangePale,
  },
  avatarText: { color: colors.orange, fontWeight: "800", fontSize: 19 },
  details: { flex: 1, gap: 4 },
  name: { color: colors.ink, fontWeight: "800", fontSize: 15 },
  meta: { color: colors.muted, fontSize: 12 },
  button: {
    alignSelf: "center",
    backgroundColor: colors.orange,
    borderRadius: 24,
    minHeight: 44,
    paddingHorizontal: 30,
    justifyContent: "center",
  },
  buttonText: { color: "white", fontWeight: "800" },
});
