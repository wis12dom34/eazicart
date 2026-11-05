import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { memo, useEffect, useState } from "react";
import { Alert, Pressable, Share, StyleSheet, Text, View } from "react-native";
import { api } from "../lib/api";
import type { Product } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors, touchTarget } from "../theme";

const currency = (value: string) =>
  `₦${Number(value).toLocaleString("en-NG", { maximumFractionDigits: 2 })}`;

type Props = {
  product: Product;
  saved: boolean;
  onSaveChange: (id: string, saved: boolean) => void;
};
function Action({
  name,
  color,
  caption,
  onPress,
  disabled = false,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  color?: string;
  caption: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption}
      disabled={disabled}
      onPress={onPress}
      style={styles.action}
    >
      <Ionicons name={name} color={color ?? colors.muted} size={22} />
      <Text
        style={[styles.actionLabel, color ? { color } : null]}
        numberOfLines={1}
      >
        {caption}
      </Text>
    </Pressable>
  );
}
export const ProductCard = memo(function ProductCard({
  product,
  saved,
  onSaveChange,
}: Props) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(Boolean(product.social?.liked));
  const [likes, setLikes] = useState(product.social?.likes ?? 0);
  const [busy, setBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  useEffect(() => {
    setLiked(Boolean(product.social?.liked));
    setLikes(product.social?.likes ?? 0);
  }, [product.social?.liked, product.social?.likes]);
  const requireLogin = () => {
    if (user) return true;
    router.push("/login");
    return false;
  };
  const toggleLike = async () => {
    if (busy || !requireLogin()) return;
    setBusy(true);
    const previous = { liked, likes };
    setLiked(!liked);
    setLikes(Math.max(0, likes + (liked ? -1 : 1)));
    void Haptics.selectionAsync().catch(() => {});
    try {
      const { data } = liked
        ? await api.unlike(product.id)
        : await api.like(product.id);
      setLiked(data.liked);
      setLikes(data.likes);
    } catch (e) {
      setLiked(previous.liked);
      setLikes(previous.likes);
      Alert.alert(
        "Couldn't update Like",
        e instanceof Error ? e.message : "Please try again",
      );
    } finally {
      setBusy(false);
    }
  };
  const toggleSave = async () => {
    if (saveBusy || !requireLogin()) return;
    setSaveBusy(true);
    try {
      if (saved) await api.unsave(product.id);
      else await api.save(product.id);
      onSaveChange(product.id, !saved);
      void Haptics.selectionAsync().catch(() => {});
    } catch (e) {
      Alert.alert(
        "Couldn't update saved products",
        e instanceof Error ? e.message : "Please try again",
      );
    } finally {
      setSaveBusy(false);
    }
  };
  const openProduct = () =>
    router.push({ pathname: "/product/[id]", params: { id: product.id } });
  const openSeller = () =>
    router.push({
      pathname: "/seller/[id]",
      params: { id: product.seller.id },
    });
  const openComments = () =>
    router.push({
      pathname: "/product/[id]/comments",
      params: { id: product.id },
    });
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${product.seller.displayName} storefront`}
        onPress={openSeller}
        style={styles.sellerRow}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {product.seller.displayName?.charAt(0).toUpperCase() || "E"}
          </Text>
        </View>
        <View style={styles.sellerText}>
          <Text style={styles.sellerName} numberOfLines={1}>
            {product.seller.displayName}
          </Text>
          <Text style={styles.sellerSub}>Shop on EaziCart</Text>
        </View>
        <Ionicons name="ellipsis-horizontal" size={22} color={colors.muted} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`View ${product.name}`}
        onPress={openProduct}
      >
        {product.images[0]?.url ? (
          <Image
            source={{ uri: product.images[0].url }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={150}
          />
        ) : (
          <View style={[styles.image, styles.noImage]}>
            <Ionicons name="image-outline" size={36} color={colors.muted} />
          </View>
        )}
        {(product.imageCount ?? product.images.length) > 1 ? (
          <View style={styles.imageBadge}>
            <Ionicons name="albums-outline" size={14} color="white" />
            <Text style={styles.imageBadgeText}>
              {product.imageCount} photos
            </Text>
          </View>
        ) : null}
      </Pressable>
      <View style={styles.content}>
        <Pressable accessibilityRole="button" onPress={openProduct}>
          <Text style={styles.name} numberOfLines={2}>
            {product.name}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{currency(product.price)}</Text>
            {product.originalPrice &&
            Number(product.originalPrice) > Number(product.price) ? (
              <Text style={styles.original}>
                {currency(product.originalPrice)}
              </Text>
            ) : null}
            {product.discountPercent ? (
              <Text style={styles.discount}>-{product.discountPercent}%</Text>
            ) : null}
          </View>
          {product.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {product.description}
            </Text>
          ) : null}
        </Pressable>
        <View style={styles.actions}>
          <View
            style={styles.action}
            accessibilityLabel={`${product.viewsLabel ?? "0"} views`}
          >
            <Ionicons name="eye-outline" color={colors.muted} size={22} />
            <Text style={styles.actionLabel}>{product.viewsLabel ?? "0"}</Text>
          </View>
          <Action
            name="share-outline"
            caption="Share"
            onPress={() => {
              void Share.share({
                message: `https://eazicart.com/product/${encodeURIComponent(product.id)}`,
              });
            }}
          />
          <Action
            name={saved ? "bookmark" : "bookmark-outline"}
            color={saved ? colors.orange : undefined}
            caption="Save"
            onPress={() => {
              void toggleSave();
            }}
            disabled={saveBusy}
          />
          <Action
            name="chatbubble-outline"
            caption={String(product.social?.comments ?? 0)}
            onPress={openComments}
          />
          <Action
            name={liked ? "heart" : "heart-outline"}
            color={colors.red}
            caption={String(likes)}
            onPress={() => {
              void toggleLike();
            }}
            disabled={busy}
          />
        </View>
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  card: {
    backgroundColor: "white",
    marginBottom: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  sellerRow: {
    height: 62,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.orangePale,
  },
  avatarText: { color: colors.orange, fontSize: 18, fontWeight: "800" },
  sellerText: { flex: 1 },
  sellerName: { fontSize: 14, fontWeight: "700", color: colors.ink },
  sellerSub: { color: colors.muted, fontSize: 11, marginTop: 3 },
  image: { width: "100%", aspectRatio: 1.12, backgroundColor: colors.surface },
  noImage: { justifyContent: "center", alignItems: "center" },
  imageBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  imageBadgeText: { color: "white", fontSize: 11, fontWeight: "600" },
  content: { paddingHorizontal: 16, paddingTop: 13 },
  name: { fontSize: 16, color: colors.ink, fontWeight: "700", lineHeight: 22 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 7,
  },
  price: { color: colors.orange, fontSize: 18, fontWeight: "800" },
  original: {
    color: colors.muted,
    textDecorationLine: "line-through",
    fontSize: 12,
  },
  discount: { color: colors.red, fontSize: 12, fontWeight: "700" },
  description: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 9,
    paddingBottom: 12,
  },
  action: {
    minHeight: touchTarget,
    minWidth: 46,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  actionLabel: { fontSize: 11, color: colors.muted, fontWeight: "600" },
});
