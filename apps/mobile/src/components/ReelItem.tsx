import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import { VideoView, useVideoPlayer } from "expo-video";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import React, { memo, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../lib/api";
import type { Reel } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

type Props = {
  reel: Reel;
  active: boolean;
  preload: boolean;
  height: number;
  onWatched: (
    id: string,
    watchMs: number,
    completed: boolean,
  ) => Promise<boolean>;
};
const compact = (value: number) =>
  Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
const money = (value: string) =>
  "₦" + Number(value).toLocaleString("en-NG", { maximumFractionDigits: 0 });

function ReelVideo({
  uri,
  active,
  onWatched,
}: {
  uri: string;
  active: boolean;
  onWatched: (ms: number, completed: boolean) => void;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [paused, setPaused] = useState(false);
  const watched = useRef(0);
  const previous = useRef(0);
  const sent = useRef(false);
  const player = useVideoPlayer({ uri, useCaching: true }, (instance) => {
    instance.loop = true;
    instance.timeUpdateEventInterval = 0.5;
    instance.staysActiveInBackground = false;
    instance.showNowPlayingNotification = false;
  });

  useEffect(() => {
    if (active && !paused && !error) player.play();
    else player.pause();
    return () => {
      player.pause();
    };
  }, [active, paused, error, player]);

  useEffect(() => {
    const status = player.addListener("statusChange", ({ status: next }) => {
      if (next === "error") setError(true);
    });
    const progress = player.addListener("timeUpdate", ({ currentTime }) => {
      if (!active || !player.playing || sent.current) return;
      const difference = currentTime - previous.current;
      // Loop resets and unexpected seeking must never count as continuous watch time.
      if (difference > 0 && difference < 1.6) watched.current += difference;
      previous.current = currentTime;
      if (watched.current >= 2) {
        sent.current = true;
        onWatched(Math.round(watched.current * 1000), false);
      }
    });
    const ended = player.addListener("playToEnd", () => {
      if (!active || sent.current || watched.current < 1) return;
      sent.current = true;
      onWatched(Math.round(watched.current * 1000), true);
    });
    return () => {
      status.remove();
      progress.remove();
      ended.remove();
    };
  }, [active, onWatched, player]);

  useEffect(() => {
    // Prevent the first update on resuming a previously paused item from
    // counting the entire inactive interval.
    previous.current = player.currentTime;
  }, [active, player]);

  return (
    <View style={StyleSheet.absoluteFill}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => setReady(true)}
      />
      {!ready && !error ? (
        <ActivityIndicator
          size="large"
          color="white"
          style={styles.centerSpinner}
        />
      ) : null}
      {error ? (
        <View style={styles.centerMessage}>
          <Text style={styles.message}>
            Video couldn't load. Swipe to try another.
          </Text>
        </View>
      ) : null}
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel={paused ? "Play Reel" : "Pause Reel"}
        onPress={() => setPaused((current) => !current)}
      />
      {paused && active ? (
        <Ionicons
          name="play"
          size={60}
          color="white"
          style={styles.centerPlay}
          pointerEvents="none"
        />
      ) : null}
    </View>
  );
}

export const ReelItem = memo(function ReelItem({
  reel,
  active,
  preload,
  height,
  onWatched,
}: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likes, setLikes] = useState(reel._count.likes);
  const [saves, setSaves] = useState(reel._count.saves);
  const [views, setViews] = useState(reel._count.views);
  const [likeBusy, setLikeBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const interactions = useQuery({
    queryKey: ["reel-interactions", user?.id, reel.id],
    enabled: active && Boolean(user),
    queryFn: () => api.reelInteractions(reel.id),
    staleTime: 15_000,
  });
  useEffect(() => {
    if (!user) {
      setLiked(false);
      setSaved(false);
      return;
    }
    if (interactions.data) {
      setLiked(interactions.data.data.liked);
      setSaved(interactions.data.data.saved);
    }
  }, [interactions.data, user]);

  const requireLogin = () => {
    if (user) return true;
    router.push("/login");
    return false;
  };
  const toggleLike = async () => {
    if (likeBusy || !requireLogin() || !interactions.data) return;
    setLikeBusy(true);
    const before = { liked, likes };
    setLiked(!liked);
    setLikes((count) => Math.max(0, count + (liked ? -1 : 1)));
    void Haptics.selectionAsync().catch(() => {});
    try {
      const result = await api.reelLike(reel.id, liked);
      setLiked(result.data.liked);
      setLikes(result.data.count);
      await queryClient.invalidateQueries({
        queryKey: ["reel-interactions", user?.id, reel.id],
      });
    } catch (error) {
      setLiked(before.liked);
      setLikes(before.likes);
      Alert.alert(
        "Couldn't update Like",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setLikeBusy(false);
    }
  };
  const toggleSave = async () => {
    if (saveBusy || !requireLogin() || !interactions.data) return;
    setSaveBusy(true);
    const before = { saved, saves };
    setSaved(!saved);
    setSaves((count) => Math.max(0, count + (saved ? -1 : 1)));
    void Haptics.selectionAsync().catch(() => {});
    try {
      const result = await api.reelSave(reel.id, saved);
      setSaved(result.data.saved);
      setSaves(result.data.count);
      await queryClient.invalidateQueries({
        queryKey: ["reel-interactions", user?.id, reel.id],
      });
    } catch (error) {
      setSaved(before.saved);
      setSaves(before.saves);
      Alert.alert(
        "Couldn't save Reel",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setSaveBusy(false);
    }
  };
  const share = () => {
    void Share.share({
      message: "https://eazicart.com/reels?reel=" + encodeURIComponent(reel.id),
    });
  };
  const original = () => {
    if (reel.externalUrl && /^https:\/\//i.test(reel.externalUrl)) {
      void Linking.openURL(reel.externalUrl);
    }
  };
  const poster = reel.thumbnailUrl ?? reel.product?.images[0]?.url ?? null;

  return (
    <View style={[styles.root, { height }]}>
      {poster ? (
        <Image
          source={{ uri: poster }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}
      {reel.videoUrl && (active || preload) ? (
        <ReelVideo
          key={reel.id}
          uri={reel.videoUrl}
          active={active}
          onWatched={(watchMs, completed) => {
            void onWatched(reel.id, watchMs, completed).then((recorded) => {
              if (recorded) setViews((count) => count + 1);
            });
          }}
        />
      ) : !poster ? (
        <View style={styles.placeholder}>
          <Ionicons name="play-circle-outline" size={56} color="#A3A3A3" />
        </View>
      ) : null}
      <View pointerEvents="none" style={styles.shade} />
      <View pointerEvents="box-none" style={styles.views}>
        <Ionicons name="eye-outline" size={15} color="white" />
        <Text style={styles.viewsText}>{compact(views)}</Text>
      </View>
      <View style={styles.sidebar}>
        <View style={styles.actionSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={liked ? "Unlike Reel" : "Like Reel"}
            disabled={likeBusy || (Boolean(user) && !interactions.data)}
            onPress={() => {
              void toggleLike();
            }}
            style={styles.action}
          >
            <Ionicons
              name={liked ? "heart" : "heart-outline"}
              size={31}
              color={liked ? colors.red : "white"}
            />
            <Text style={styles.countText}>{compact(likes)}</Text>
          </Pressable>
        </View>
        <View style={styles.actionSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Read Reel comments"
            onPress={() =>
              router.push({
                pathname: "/reel/[id]/comments",
                params: { id: reel.id },
              })
            }
            style={styles.action}
          >
            <Ionicons name="chatbubble-outline" size={29} color="white" />
            <Text style={styles.countText}>
              {compact(reel._count.comments)}
            </Text>
          </Pressable>
        </View>
        <View style={styles.actionSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={saved ? "Unsave Reel" : "Save Reel"}
            disabled={saveBusy || (Boolean(user) && !interactions.data)}
            onPress={() => {
              void toggleSave();
            }}
            style={styles.action}
          >
            <Ionicons
              name={saved ? "bookmark" : "bookmark-outline"}
              size={29}
              color={saved ? colors.orange : "white"}
            />
            <Text style={styles.countText}>{compact(saves)}</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Share Reel"
          onPress={share}
          style={styles.action}
        >
          <Ionicons name="arrow-redo-outline" size={30} color="white" />
          <Text style={styles.countText}>Share</Text>
        </Pressable>
      </View>
      <View style={styles.bottom}>
        {reel.seller ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"Visit " + reel.seller.displayName}
            style={styles.seller}
            onPress={() =>
              router.push({
                pathname: "/seller/[id]",
                params: { id: reel.seller!.id },
              })
            }
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {reel.seller.displayName.slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.sellerName} numberOfLines={1}>
              {reel.seller.displayName}
            </Text>
            <Ionicons name="chevron-forward" color="white" size={14} />
          </Pressable>
        ) : null}
        {reel.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {reel.caption}
          </Text>
        ) : null}
        {reel.product ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={"View product " + reel.product.name}
            style={styles.product}
            onPress={() =>
              router.push({
                pathname: "/product/[id]",
                params: { id: reel.product!.id },
              })
            }
          >
            <Ionicons name="bag-handle-outline" color="white" size={17} />
            <Text style={styles.productName} numberOfLines={1}>
              {reel.product.name}
            </Text>
            <Text style={styles.productPrice}>{money(reel.product.price)}</Text>
            <Ionicons name="chevron-forward" color="white" size={17} />
          </Pressable>
        ) : reel.externalUrl && /^https:\/\//i.test(reel.externalUrl) ? (
          <Pressable
            accessibilityRole="link"
            onPress={original}
            style={styles.product}
          >
            <Ionicons name="open-outline" size={17} color="white" />
            <Text style={styles.productName}>View original source</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  root: { width: "100%", backgroundColor: "#080808", overflow: "hidden" },
  centerSpinner: { position: "absolute", alignSelf: "center", top: "46%" },
  centerPlay: { position: "absolute", alignSelf: "center", top: "45%" },
  centerMessage: {
    position: "absolute",
    top: "43%",
    left: 30,
    right: 30,
    alignItems: "center",
  },
  message: { color: "white", fontSize: 15, textAlign: "center" },
  placeholder: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  shade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent",
    borderBottomWidth: 240,
    borderBottomColor: "rgba(0,0,0,0.22)",
  },
  views: {
    position: "absolute",
    top: 67,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  viewsText: { color: "white", fontSize: 12, fontWeight: "700" },
  sidebar: {
    position: "absolute",
    right: 10,
    bottom: 130,
    gap: 14,
    alignItems: "center",
  },
  actionSlot: { minHeight: 52 },
  action: {
    minWidth: 52,
    minHeight: 55,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  countText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    textShadowColor: "#000",
    textShadowRadius: 2,
  },
  bottom: { position: "absolute", bottom: 22, left: 14, right: 75, gap: 10 },
  seller: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 42 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.orange,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "white",
  },
  avatarText: { color: "white", fontSize: 16, fontWeight: "900" },
  sellerName: {
    color: "white",
    fontSize: 16,
    fontWeight: "800",
    maxWidth: 175,
  },
  caption: { color: "white", fontSize: 14, lineHeight: 20 },
  product: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 10,
  },
  productName: { color: "white", fontWeight: "700", fontSize: 12, flex: 1 },
  productPrice: { color: "white", fontWeight: "900", fontSize: 12 },
});
