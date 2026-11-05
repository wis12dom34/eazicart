import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import type { FollowRecord } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

export default function FollowingScreen() {
  const { user, loading } = useAuth();
  const query = useQuery({
    queryKey: ["following", user?.id],
    queryFn: api.following,
    enabled: !loading && Boolean(user),
    staleTime: 30_000,
  });

  if (loading) return <ScreenState message="Loading your account…" loading />;
  if (!user) {
    return (
      <View style={styles.center}>
        <Ionicons name="people-outline" size={58} color={colors.orange} />
        <Text style={styles.hint}>Sign in to see the sellers you follow.</Text>
        <Pressable
          style={styles.login}
          accessibilityRole="button"
          onPress={() => router.push("/login")}
        >
          <Text style={styles.loginText}>Sign in</Text>
        </Pressable>
      </View>
    );
  }
  if (query.isError)
    return (
      <ScreenState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Couldn't load followed sellers"
        }
        retry={() => {
          void query.refetch();
        }}
      />
    );
  return (
    <FlatList<FollowRecord>
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={query.data?.data ?? []}
      keyExtractor={(item) => item.sellerId}
      onRefresh={() => {
        void query.refetch();
      }}
      refreshing={query.isRefetching}
      ListHeaderComponent={<Text style={styles.heading}>Shops you follow</Text>}
      ListEmptyComponent={
        <ScreenState
          loading={query.isPending}
          message={
            query.isPending
              ? "Loading followed shops…"
              : "You aren't following any shops yet. Discover sellers from the Home feed."
          }
        />
      }
      renderItem={({ item }) => {
        const name = item.seller.sellerProfile?.displayName || item.seller.name;
        const sellerId = item.seller.sellerProfile?.id || item.sellerId;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Visit ${name} storefront`}
            style={styles.item}
            onPress={() =>
              router.push({
                pathname: "/seller/[id]",
                params: { id: sellerId },
              })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.letter}>{name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={styles.nameContainer}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.subtitle}>Following</Text>
            </View>
            <Ionicons name="chevron-forward" color={colors.muted} size={20} />
          </Pressable>
        );
      }}
    />
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { padding: 18, flexGrow: 1 },
  heading: {
    fontWeight: "800",
    fontSize: 22,
    color: colors.ink,
    marginBottom: 16,
  },
  item: {
    flexDirection: "row",
    minHeight: 66,
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.orangePale,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { fontWeight: "800", fontSize: 19, color: colors.orange },
  nameContainer: { flex: 1, gap: 3 },
  name: { fontWeight: "700", fontSize: 15, color: colors.ink },
  subtitle: { color: colors.muted, fontSize: 12 },
  center: {
    flex: 1,
    padding: 32,
    justifyContent: "center",
    alignItems: "center",
    gap: 18,
  },
  hint: { color: colors.ink, textAlign: "center", fontSize: 15 },
  login: {
    minHeight: 48,
    minWidth: 170,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.orange,
  },
  loginText: { color: "white", fontWeight: "800" },
});
