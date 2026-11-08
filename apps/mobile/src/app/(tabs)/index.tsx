import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ProductCard } from "../../components/ProductCard";
import { StoryRail } from "../../components/StoryRail";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

export default function HomeScreen() {
  const { user, loading } = useAuth();
  const cache = useQueryClient();
  const feed = useInfiniteQuery({
    queryKey: ["feed", user?.id ?? "guest"],
    enabled: !loading,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => api.feed(pageParam, Boolean(user)),
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
  });
  const notificationQuery = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: Boolean(user) && !loading,
    queryFn: api.notifications,
    staleTime: 30_000,
  });
  const unreadCount = notificationQuery.data?.meta.unreadCount ?? 0;
  const savedQuery = useQuery({
    queryKey: ["saved", user?.id],
    enabled: Boolean(user) && !loading,
    queryFn: api.saved,
    staleTime: 30_000,
  });
  const saved = new Set(
    savedQuery.data?.data.map((item) => item.productId) ?? [],
  );
  const products = feed.data?.pages.flatMap((page) => page.data) ?? [];
  const sellerIds = new Set<string>();
  const featuredSellers = products.flatMap((product) => {
    const seller = product.seller;
    if (!seller.userId || sellerIds.has(seller.userId) || sellerIds.size >= 12)
      return [];
    sellerIds.add(seller.userId);
    return [seller];
  });
  const onSaveChange = (id: string, isSaved: boolean) => {
    cache.setQueryData<{ data: { productId: string }[] }>(
      ["saved", user?.id],
      (old) => {
        if (!old) return { data: isSaved ? [{ productId: id }] : [] };
        return {
          data: isSaved
            ? [
                ...old.data.filter((item) => item.productId !== id),
                { productId: id },
              ]
            : old.data.filter((item) => item.productId !== id),
        };
      },
    );
  };
  if (loading)
    return (
      <ScreenState loading message="Preparing your EaziCart experience…" />
    );
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.logo}>
          Eazi<Text style={styles.logoAccent}>Cart</Text>
        </Text>
        <View style={styles.headerActions}>
          <Text style={styles.tagline}>Discover what you love</Text>
          {user ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                unreadCount > 0
                  ? `Notifications, ${unreadCount} unread`
                  : "Notifications"
              }
              onPress={() => router.push("/notifications")}
              style={styles.bell}
              hitSlop={8}
            >
              <Ionicons name="notifications-outline" size={23} color={colors.ink} />
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>
                    {unreadCount > 99 ? "99+" : String(unreadCount)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          ) : null}
        </View>
      </View>
      {feed.isError && !products.length ? (
        <ScreenState
          message={
            feed.error instanceof Error
              ? feed.error.message
              : "Unable to load feed"
          }
          retry={() => {
            void feed.refetch();
          }}
        />
      ) : (
        <FlatList<Product>
          data={products}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              saved={saved.has(item.id)}
              onSaveChange={onSaveChange}
            />
          )}
          ListHeaderComponent={<StoryRail sellers={featuredSellers} />}
          initialNumToRender={4}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.65}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage)
              void feed.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              tintColor={colors.orange}
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => {
                void feed.refetch();
              }}
            />
          }
          ListEmptyComponent={
            <ScreenState
              message={
                feed.isPending
                  ? "Loading products…"
                  : "No products to display yet."
              }
              loading={feed.isPending}
            />
          }
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ScreenState loading message="Loading more products…" />
            ) : feed.isFetchNextPageError ? (
              <Pressable
                onPress={() => {
                  void feed.fetchNextPage();
                }}
              >
                <Text style={styles.retry}>
                  Couldn't load more products. Tap to retry.
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingTop: 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: "white",
  },
  logo: {
    fontSize: 23,
    fontWeight: "900",
    color: colors.ink,
    letterSpacing: -1,
  },
  logoAccent: { color: colors.orange },
  tagline: { fontSize: 11, color: colors.muted },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  bell: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 19,
    height: 19,
    paddingHorizontal: 3,
    borderRadius: 10,
    backgroundColor: colors.red,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadBadgeText: { color: "white", fontWeight: "800", fontSize: 10 },
  retry: { padding: 18, color: colors.orange, textAlign: "center" },
});
