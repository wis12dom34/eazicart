import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import { canCheckoutReview, formatNaira } from "../../lib/commerce";
import { createExclusiveMutationGate } from "../../lib/exclusive-mutation-gate";
import type { CartItem } from "../../lib/types";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

export default function CartScreen() {
  const { user, loading } = useAuth();
  const cache = useQueryClient();
  const [busyItem, setBusyItem] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  // Acquire synchronously to prevent duplicate native taps before re-render.
  const mutationGate = useRef(createExclusiveMutationGate());
  const queryKey = ["cart", user?.id];
  const cart = useQuery({
    queryKey,
    queryFn: api.cart,
    enabled: Boolean(user) && !loading,
  });
  const current = cart.data?.data;

  const updateQuantity = async (item: CartItem, quantity: number) => {
    if (!user) return;
    await mutationGate.current.run(async () => {
      setBusyItem(item.id);
      try {
        if (quantity < 1) await api.cartRemove(item.id);
        else await api.cartUpdate(item.id, quantity);
        void cache.invalidateQueries({ queryKey });
      } catch (error) {
        Alert.alert(
          "Couldn't update cart",
          error instanceof Error ? error.message : "Please try again.",
        );
        void cart.refetch();
      } finally {
        setBusyItem(null);
      }
    });
  };
  const clearCart = () => {
    if (mutationGate.current.isBusy) return;
    Alert.alert("Clear cart?", "Remove all products from your cart?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: () => {
          if (!user) return;
          void mutationGate.current.run(async () => {
            setClearing(true);
            try {
              await api.cartClear();
              void cache.invalidateQueries({ queryKey });
            } catch (error) {
              Alert.alert(
                "Couldn't clear cart",
                error instanceof Error ? error.message : "Please try again",
              );
            } finally {
              setClearing(false);
            }
          });
        },
      },
    ]);
  };

  if (loading) return <ScreenState loading message="Loading your account…" />;
  if (!user)
    return (
      <View style={styles.empty}>
        <Ionicons name="bag-handle-outline" size={57} color={colors.orange} />
        <Text style={styles.title}>Your EaziCart basket</Text>
        <Text style={styles.muted}>
          Sign in to use the same cart as the website.
        </Text>
        <Pressable
          style={styles.primary}
          onPress={() => router.push("/login")}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </View>
    );
  if (cart.isError)
    return (
      <ScreenState
        message={
          cart.error instanceof Error
            ? cart.error.message
            : "Cart is unavailable."
        }
        retry={() => {
          void cart.refetch();
        }}
      />
    );

  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <Text style={styles.title}>Your cart</Text>
        {current?.items.length ? (
          <Pressable
            accessibilityRole="button"
            onPress={clearCart}
            disabled={clearing || Boolean(busyItem)}
          >
            <Text style={styles.clear}>Clear cart</Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList<CartItem>
        data={current?.items ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={cart.isRefetching}
            onRefresh={() => {
              void cart.refetch();
            }}
            tintColor={colors.orange}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: item.product.id },
                })
              }
              accessibilityRole="button"
            >
              {item.product.images[0]?.url ? (
                <Image
                  source={{ uri: item.product.images[0].url }}
                  cachePolicy="memory-disk"
                  contentFit="cover"
                  style={styles.photo}
                />
              ) : (
                <View style={[styles.photo, styles.placeholder]}>
                  <Ionicons
                    name="image-outline"
                    color={colors.muted}
                    size={26}
                  />
                </View>
              )}
            </Pressable>
            <View style={styles.details}>
              <Text style={styles.product} numberOfLines={2}>
                {item.product.name}
              </Text>
              <Text style={styles.seller} numberOfLines={1}>
                {item.product.seller.displayName}
              </Text>
              <Text style={styles.price}>{formatNaira(item.lineTotal)}</Text>
              {item.product.originalPrice &&
              Number(item.product.originalPrice) >
                Number(item.product.price) ? (
                <Text style={styles.discount}>
                  Reduced from {formatNaira(item.product.originalPrice)} each
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.quantity === 1
                      ? "Remove from cart"
                      : "Decrease quantity"
                  }
                  disabled={Boolean(busyItem) || clearing}
                  onPress={() => {
                    void updateQuantity(item, item.quantity - 1);
                  }}
                  style={styles.step}
                >
                  <Ionicons
                    name={item.quantity === 1 ? "trash-outline" : "remove"}
                    color={colors.ink}
                    size={19}
                  />
                </Pressable>
                {busyItem === item.id ? (
                  <ActivityIndicator size="small" color={colors.orange} />
                ) : (
                  <Text style={styles.quantity}>{item.quantity}</Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Increase quantity"
                  disabled={
                    Boolean(busyItem) ||
                    clearing ||
                    item.quantity >= item.product.stock
                  }
                  onPress={() => {
                    void updateQuantity(item, item.quantity + 1);
                  }}
                  style={styles.step}
                >
                  <Ionicons name="add" color={colors.ink} size={19} />
                </Pressable>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <ScreenState
            loading={cart.isPending}
            message={
              cart.isPending
                ? "Loading your cart…"
                : "Your cart is empty. Explore products to get started."
            }
          />
        }
      />
      {current?.items.length ? (
        <View style={styles.footer}>
          <View style={styles.totalRow}>
            <Text style={styles.muted}>Subtotal</Text>
            <Text style={styles.total}>{formatNaira(current.subtotal)}</Text>
          </View>
          <Text style={styles.disclaimer}>
            Delivery and any additional charges will be shown when available.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/checkout")}
            disabled={
              Boolean(busyItem) || clearing || !canCheckoutReview(current)
            }
            style={[
              styles.primary,
              !canCheckoutReview(current) && styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>Review checkout</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heading: {
    padding: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontWeight: "800", fontSize: 24, color: colors.ink },
  clear: { fontWeight: "700", color: colors.red },
  list: { paddingHorizontal: 16, paddingBottom: 22, flexGrow: 1 },
  item: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 14,
    gap: 13,
  },
  photo: {
    width: 106,
    height: 119,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  placeholder: { alignItems: "center", justifyContent: "center" },
  details: { flex: 1, gap: 4 },
  product: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  seller: { color: colors.muted, fontSize: 12 },
  price: {
    color: colors.orange,
    fontSize: 17,
    fontWeight: "800",
    marginTop: 3,
  },
  discount: { color: colors.muted, fontSize: 11 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 5,
  },
  step: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  quantity: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 9,
  },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  total: { fontSize: 19, fontWeight: "800", color: colors.ink },
  muted: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  primary: {
    minHeight: 50,
    backgroundColor: colors.orange,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 5,
    paddingHorizontal: 22,
  },
  disabled: { opacity: 0.5 },
  primaryText: { color: "white", fontWeight: "800", fontSize: 15 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 13,
    padding: 25,
  },
});
