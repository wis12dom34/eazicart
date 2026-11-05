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
        <Text style={styles.tagline}>Discover what you love</Text>
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
  retry: { padding: 18, color: colors.orange, textAlign: "center" },
});
