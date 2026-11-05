import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StoryVideo } from "../../components/StoryVideo";
import { api } from "../../lib/api";
import { colors } from "../../theme";

const IMAGE_DURATION_MS = 5500;
export default function StoryViewer() {
  const { userId, name } = useLocalSearchParams<{
    userId: string;
    name?: string;
  }>();
  const insets = useSafeAreaInsets();
  const touchStartedAt = useRef(0);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inForeground, setInForeground] = useState(
    AppState.currentState === "active",
  );
  const elapsed = useRef(0);
  const request = useQuery({
    queryKey: ["stories", userId],
    enabled: Boolean(userId),
    queryFn: () => api.storiesForUser(userId),
    staleTime: 20_000,
    refetchOnMount: "always",
  });
  const items = request.data?.data ?? [];
  const current = items[index];
  const playing = focused && inForeground && !held;
  const close = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, []);
  const previous = useCallback(() => setIndex((n) => Math.max(0, n - 1)), []);
  const next = useCallback(() => {
    if (index < items.length - 1) setIndex(index + 1);
    else close();
  }, [index, items.length, close]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) =>
      setInForeground(state === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
    setHeld(false);
  }, [index]);

  const video =
    current?.contentType?.startsWith("video/") ||
    /\.(mp4|mov|webm)(\?|$)/i.test(current?.url ?? "");
  useEffect(() => {
    if (!current || video || !playing) return;
    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      elapsed.current += Math.min(250, Math.max(0, now - last));
      last = now;
      const nextProgress = Math.min(1, elapsed.current / IMAGE_DURATION_MS);
      setProgress(nextProgress);
      if (nextProgress >= 1) next();
    }, 100);
    return () => clearInterval(interval);
  }, [current, video, playing, next]);

  if (request.isPending)
    return (
      <View style={styles.center}>
        <ActivityIndicator color="white" />
        <Text style={styles.help}>Loading story…</Text>
      </View>
    );
  if (request.isError)
    return (
      <View style={styles.center}>
        <Text style={styles.help}>Couldn't load this story.</Text>
        <Pressable
          onPress={() => {
            void request.refetch();
          }}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
        <Pressable onPress={close} style={styles.button}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </View>
    );
  if (!current)
    return (
      <View style={styles.center}>
        <Text style={styles.help}>
          This story has expired or is no longer available.
        </Text>
        <Pressable onPress={close} style={styles.button}>
          <Text style={styles.buttonText}>Close</Text>
        </Pressable>
      </View>
    );
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {video ? (
        <StoryVideo
          key={current.id}
          uri={current.url}
          playing={playing}
          onDone={next}
          onProgress={setProgress}
        />
      ) : (
        <Image
          key={current.id}
          source={{ uri: current.url }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      )}
      <View style={styles.shade} pointerEvents="none" />
      <View
        style={[styles.progressRow, { top: Math.max(15, insets.top + 6) }]}
        pointerEvents="none"
      >
        {items.map((story, i) => (
          <View key={story.id} style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${(i < index ? 1 : i > index ? 0 : progress) * 100}%`,
                },
              ]}
            />
          </View>
        ))}
      </View>
      <View style={[styles.header, { top: Math.max(30, insets.top + 20) }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarLetter}>
            {(name ?? "E").charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.user}>
          <Text style={styles.username} numberOfLines={1}>
            {name || "Seller story"}
          </Text>
          <Text style={styles.count}>
            {index + 1} of {items.length}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close story"
          onPress={close}
          style={styles.close}
        >
          <Ionicons name="close" size={30} color="white" />
        </Pressable>
      </View>
      <View style={styles.tapArea} pointerEvents="box-none">
        <Pressable
          style={styles.half}
          accessibilityRole="button"
          accessibilityLabel="Previous story"
          onPressIn={() => {
            touchStartedAt.current = Date.now();
            setHeld(true);
          }}
          onPressOut={() => setHeld(false)}
          onPress={() => {
            if (Date.now() - touchStartedAt.current < 300) previous();
          }}
        />
        <Pressable
          style={styles.half}
          accessibilityRole="button"
          accessibilityLabel="Next story"
          onPressIn={() => {
            touchStartedAt.current = Date.now();
            setHeld(true);
          }}
          onPressOut={() => setHeld(false)}
          onPress={() => {
            if (Date.now() - touchStartedAt.current < 300) next();
          }}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="View seller storefront"
        onPress={() =>
          router.push({ pathname: "/seller/[id]", params: { id: userId } })
        }
        style={[styles.store, { bottom: Math.max(35, insets.bottom + 18) }]}
      >
        <Ionicons name="storefront-outline" size={19} color="white" />
        <Text style={styles.storeText}>View store</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#090909" },
  center: {
    flex: 1,
    backgroundColor: "#090909",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
    gap: 16,
  },
  help: {
    color: "white",
    fontWeight: "600",
    lineHeight: 23,
    textAlign: "center",
  },
  button: {
    minHeight: 44,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orange,
    borderRadius: 22,
  },
  buttonText: { color: "white", fontWeight: "800" },
  shade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  progressRow: {
    position: "absolute",
    top: 18,
    left: 12,
    right: 12,
    height: 3,
    flexDirection: "row",
    gap: 4,
  },
  track: {
    height: 3,
    flex: 1,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.36)",
  },
  fill: { height: 3, backgroundColor: "white" },
  header: {
    position: "absolute",
    top: 31,
    left: 14,
    right: 14,
    height: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 37,
    height: 37,
    borderRadius: 19,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "white", fontSize: 18, fontWeight: "800" },
  user: { flex: 1 },
  username: { color: "white", fontWeight: "800", fontSize: 14 },
  count: { color: "#E5E5E5", fontSize: 11, marginTop: 3 },
  close: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  tapArea: {
    position: "absolute",
    top: 100,
    bottom: 100,
    left: 0,
    right: 0,
    flexDirection: "row",
  },
  half: { width: "50%" },
  store: {
    position: "absolute",
    bottom: 35,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "#777",
    minHeight: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  storeText: { color: "white", fontWeight: "800" },
});
