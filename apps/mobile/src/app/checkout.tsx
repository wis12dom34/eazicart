import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import {
  canCheckoutReview,
  formatNaira,
  hasCartChanged,
} from "../lib/commerce";
import { NATIVE_CHECKOUT_BLOCK_REASON } from "../lib/checkout-safety";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

/** Review-only until the active production payment gateway is verified as KoraPay. */
export default function CheckoutScreen() {
  const { user, loading } = useAuth();
  const cache = useQueryClient();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const cartKey = ["cart", user?.id];
  const cart = useQuery({
    queryKey: cartKey,
    queryFn: api.cart,
    enabled: Boolean(user) && !loading,
  });
  const addresses = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: api.addresses,
    enabled: Boolean(user) && !loading,
  });
  const data = cart.data?.data;
  const preferred =
    addresses.data?.data.find((item) => item.id === selectedAddress) ??
    addresses.data?.data.find((item) => item.isDefault) ??
    addresses.data?.data[0];
  const review = async () => {
    if (!data || checking) return;
    setChecking(true);
    setNotice(null);
    try {
      const latest = (await api.cart()).data;
      if (hasCartChanged(data, latest)) {
        await cache.invalidateQueries({ queryKey: cartKey });
        setNotice(
          "Your cart changed. Review the refreshed prices and quantities before continuing.",
        );
      } else {
        setNotice(
          "Your cart and delivery address are ready for review. Online payment is disabled in this development build until the KoraPay backend is verified.",
        );
      }
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Unable to refresh your cart");
    } finally {
      setChecking(false);
    }
  };
  if (loading) return <ScreenState loading message="Preparing checkout…" />;
  if (!user)
    return (
      <ScreenState
        message="Sign in to review your EaziCart checkout."
        retry={() => router.push("/login")}
      />
    );
  if (cart.isError || addresses.isError)
    return (
      <ScreenState
        message="Checkout details are unavailable."
        retry={() => {
          void cart.refetch();
          void addresses.refetch();
        }}
      />
    );
  if (cart.isPending || addresses.isPending)
    return (
      <ScreenState loading message="Loading current cart and addresses…" />
    );
  if (!data || !canCheckoutReview(data))
    return (
      <ScreenState
        message="Cart is empty, out of stock, or needs review. Return to your cart."
        retry={() => router.replace("/(tabs)/cart")}
      />
    );
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Checkout review</Text>
      <Text style={styles.subtitle}>
        Review the items in your existing EaziCart cart.
      </Text>
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.heading}>Delivery address</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/addresses")}
          >
            <Text style={styles.link}>Manage</Text>
          </Pressable>
        </View>
        {addresses.data.data.length ? (
          addresses.data.data.map((address) => (
            <Pressable
              key={address.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: preferred?.id === address.id }}
              style={[
                styles.address,
                preferred?.id === address.id && styles.selected,
              ]}
              onPress={() => setSelectedAddress(address.id)}
            >
              <Ionicons
                name={
                  preferred?.id === address.id
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={21}
                color={colors.orange}
              />
              <View style={styles.addressText}>
                <Text style={styles.addressName}>
                  {address.label || "Delivery address"}
                </Text>
                <Text style={styles.meta}>
                  {[
                    address.line1,
                    address.city,
                    address.region,
                    address.country,
                  ].join(", ")}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <Text style={styles.meta}>
            Add a delivery address before continuing.
          </Text>
        )}
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>Items ({data.items.length})</Text>
        {data.items.map((item) => (
          <View key={item.id} style={styles.line}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName} numberOfLines={2}>
                {item.product.name}
              </Text>
              <Text style={styles.meta}>Quantity {item.quantity}</Text>
            </View>
            <Text style={styles.value}>{formatNaira(item.lineTotal)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.heading}>Order summary</Text>
        <View style={styles.line}>
          <Text style={styles.meta}>Subtotal</Text>
          <Text style={styles.value}>{formatNaira(data.subtotal)}</Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.meta}>Delivery</Text>
          <Text style={styles.meta}>
            {data.delivery == null ? "Not added" : formatNaira(data.delivery)}
          </Text>
        </View>
        <View style={styles.line}>
          <Text style={styles.meta}>Service fee</Text>
          <Text style={styles.meta}>
            {data.serviceFee == null
              ? "Not added"
              : formatNaira(data.serviceFee)}
          </Text>
        </View>
        <View style={[styles.line, styles.totalLine]}>
          <Text style={styles.heading}>Current cart total</Text>
          <Text style={styles.total}>{formatNaira(data.total)}</Text>
        </View>
      </View>
      <View style={styles.warning}>
        <Ionicons
          name="shield-checkmark-outline"
          size={23}
          color={colors.orange}
        />
        <Text style={styles.warningText}>
          {NATIVE_CHECKOUT_BLOCK_REASON} No payment or order will be initiated
          from this screen.
        </Text>
      </View>
      {notice ? (
        <Text accessibilityRole="text" style={styles.notice}>
          {notice}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        disabled={!preferred || checking}
        style={[styles.button, (!preferred || checking) && { opacity: 0.5 }]}
        onPress={() => {
          void review();
        }}
      >
        {checking ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.buttonText}>Recheck cart details</Text>
        )}
      </Pressable>
      <Text style={styles.disabledText}>
        Place order / Pay securely — unavailable until payment integration
        approval.
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { padding: 18, paddingBottom: 38, gap: 18 },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink },
  subtitle: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  section: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  heading: { fontSize: 16, fontWeight: "800", color: colors.ink },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  link: { color: colors.orange, fontWeight: "700" },
  address: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
  },
  selected: { borderColor: colors.orange, backgroundColor: colors.orangePale },
  addressText: { flex: 1, gap: 4 },
  addressName: { fontSize: 13, fontWeight: "700", color: colors.ink },
  meta: { fontSize: 12, color: colors.muted, lineHeight: 19 },
  line: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
  },
  itemName: { fontSize: 13, fontWeight: "600", color: colors.ink },
  value: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  totalLine: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  total: { fontSize: 20, fontWeight: "900", color: colors.orange },
  warning: {
    backgroundColor: colors.orangePale,
    padding: 14,
    borderRadius: 13,
    flexDirection: "row",
    gap: 11,
  },
  warningText: { flex: 1, fontSize: 12, color: colors.ink, lineHeight: 19 },
  notice: {
    fontSize: 13,
    color: colors.orange,
    fontWeight: "700",
    lineHeight: 20,
  },
  button: {
    minHeight: 50,
    backgroundColor: colors.orange,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "white", fontWeight: "800" },
  disabledText: {
    color: colors.muted,
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
  },
});
