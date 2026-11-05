import * as Crypto from "expo-crypto";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useInfiniteQuery } from "@tanstack/react-query";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ReelItem } from "../../components/ReelItem";
import { api } from "../../lib/api";
import type { Reel } from "../../lib/types";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

export default function ReelsScreen() {
  const { user, loading } = useAuth();
  const [height, setHeight] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const [inForeground, setInForeground] = useState(
    AppState.currentState === "active",
  );
  const counted = useRef(new Set<string>());
  const viewKeys = useRef(new Map<string, string>());
  const feed = useInfiniteQuery({
    queryKey: ["reels", user?.id ?? "guest"],
    initialPageParam: null as string | null,
    enabled: !loading,
    queryFn: ({ pageParam }) => api.reelsFeed(pageParam, Boolean(user)),
    getNextPageParam: (last) =>
      last.pagination.hasMore
        ? (last.pagination.nextCursor ?? undefined)
        : undefined,
    staleTime: 20_000,
  });

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) =>
      setInForeground(state === "active"),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // A new account is a separate view-tracking identity.
    counted.current.clear();
    viewKeys.current.clear();
    setActiveIndex(0);
  }, [user?.id]);

  const reels = useMemo(() => {
    const unique = new Map<string, Reel>();
    for (const page of feed.data?.pages ?? []) {
      for (const reel of page.data) {
        if (!unique.has(reel.id)) unique.set(reel.id, reel);
      }
    }
    return [...unique.values()];
  }, [feed.data]);

  const reportWatch = useCallback(
    async (id: string, watchMs: number, completed: boolean) => {
      if (!user) return false; // The existing API intentionally requires authentication.
      const scope = user.id + ":" + id;
      if (counted.current.has(scope)) return false;
      counted.current.add(scope);
      let key = viewKeys.current.get(scope);
      if (!key) {
        key = Crypto.randomUUID();
        viewKeys.current.set(scope, key);
      }
      try {
        await api.reelView(id, watchMs, completed, key);
        return true;
      } catch {
        // A retry reuses the same UUID, preventing duplicate view records.
        counted.current.delete(scope);
        return false;
      }
    },
    [user],
  );

  const openHome = () => router.replace("/(tabs)");
  const playing = focused && inForeground;

  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        const measured = Math.round(event.nativeEvent.layout.height);
        if (measured > 0 && measured !== height) setHeight(measured);
      }}
    >
      {focused ? <StatusBar style="light" /> : null}
      {height > 0 && (reels.length || !feed.isPending) ? (
        <FlatList<Reel>
          data={reels}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ReelItem
              reel={item}
              height={height}
              active={playing && activeIndex === index}
              preload={playing && index === activeIndex + 1}
              onWatched={reportWatch}
            />
          )}
          style={styles.list}
          pagingEnabled
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
          getItemLayout={(_data, index) => ({
            length: height,
            offset: index * height,
            index,
          })}
          onMomentumScrollEnd={(event) =>
            setActiveIndex(
              Math.max(
                0,
                Math.round(event.nativeEvent.contentOffset.y / height),
              ),
            )
          }
          onEndReachedThreshold={0.8}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage)
              void feed.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching && !feed.isFetchingNextPage}
              onRefresh={() => {
                setActiveIndex(0);
                void feed.refetch();
              }}
              tintColor={colors.orange}
            />
          }
          ListEmptyComponent={
            <View style={[styles.empty, { height }]}>
              <Ionicons
                name={feed.isError ? "cloud-offline-outline" : "film-outline"}
                size={52}
                color="white"
              />
              <Text style={styles.emptyText}>
                {feed.isError
                  ? "Could not load Reels."
                  : "No published Reels yet."}
              </Text>
              {feed.isError ? (
                <Pressable
                  onPress={() => {
                    void feed.refetch();
                  }}
                  style={styles.retry}
                >
                  <Text style={styles.retryText}>Try again</Text>
                </Pressable>
              ) : null}
            </View>
          }
        />
      ) : (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.orange} />
          <Text style={styles.emptyText}>Loading EaziCart Reels…</Text>
        </View>
      )}
      <View style={styles.topRow} pointerEvents="box-none">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to Home"
          onPress={openHome}
          style={styles.back}
        >
          <Ionicons name="arrow-back" size={22} color="white" />
        </Pressable>
        <Text style={styles.heading}>Reels</Text>
        {feed.isFetchingNextPage ? (
          <ActivityIndicator color="white" style={styles.loadingMore} />
        ) : (
          <View style={styles.loadingMore} />
        )}
      </View>
      {feed.isFetchNextPageError ? (
        <Pressable
          onPress={() => {
            void feed.fetchNextPage();
          }}
          style={styles.pageError}
        >
          <Text style={styles.retryText}>
            More Reels unavailable · Tap to retry
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080808" },
  list: { flex: 1, backgroundColor: "#080808" },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 15 },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 15,
    paddingHorizontal: 30,
  },
  emptyText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  retry: {
    paddingHorizontal: 24,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.orange,
  },
  retryText: { color: "white", fontWeight: "800", textAlign: "center" },
  topRow: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.38)",
  },
  heading: {
    color: "white",
    fontSize: 20,
    fontWeight: "800",
    textShadowRadius: 4,
    textShadowColor: "rgba(0,0,0,0.6)",
  },
  loadingMore: { width: 44 },
  pageError: {
    position: "absolute",
    top: 70,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    padding: 12,
    borderRadius: 15,
  },
});
