import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import { formatNaira } from "../../lib/commerce";
import {
  allowedSellerFulfillmentActions,
  type NextFulfillmentAction,
} from "../../lib/seller-fulfillment";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

export default function SellerOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading } = useAuth();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false);
  const order = useQuery({
    queryKey: ["own-seller-order", user?.id, id],
    queryFn: () => api.ownSellerOrder(id),
    enabled: Boolean(user && id) && !loading,
  });
  const changeStatus = (action: NextFulfillmentAction) => {
    if (!user || busy || !order.data?.data) return;
    Alert.alert(action.title + "?", action.message, [
      { text: "Back", style: "cancel" },
      {
        text: action.title,
        style: action.destructive ? "destructive" : "default",
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          try {
            // Re-check the authoritative state immediately before attempting a write.
            const latest = (await api.ownSellerOrder(id)).data;
            const allowed = allowedSellerFulfillmentActions(latest.status);
            if (!allowed.some((option) => option.status === action.status)) {
              await order.refetch();
              Alert.alert(
                "Order status changed",
                "Another update changed this order. Review its latest status.",
              );
              return;
            }
            await api.updateSellerOrderStatus(id, action.status);
            await Promise.all([
              client.invalidateQueries({
                queryKey: ["own-seller-orders", user.id],
              }),
              client.invalidateQueries({
                queryKey: ["own-seller-order", user.id, id],
              }),
              client.invalidateQueries({
                queryKey: ["seller-dashboard", user.id],
              }),
            ]);
            Alert.alert(
              "Order updated",
              "The seller order status was updated successfully.",
            );
          } catch (error) {
            await order.refetch();
            Alert.alert(
              "Unable to update order",
              error instanceof Error ? error.message : "Please try again.",
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };
  if (loading) return <ScreenState loading message="Preparing seller order…" />;
  if (!user)
    return (
      <ScreenState
        message="Sign in to manage seller orders."
        retry={() => router.push("/login")}
      />
    );
  if (order.isPending)
    return <ScreenState loading message="Loading order details…" />;
  if (order.isError)
    return (
      <ScreenState
        message={
          order.error instanceof Error
            ? order.error.message
            : "This order is unavailable."
        }
        retry={() => void order.refetch()}
      />
    );
  const item = order.data.data;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <Text style={styles.title}>Order {item.id.slice(0, 10)}</Text>
        <Text style={styles.status}>{item.status}</Text>
      </View>
      <Text style={styles.note}>
        Seller fulfillment status is separate from the buyer's overall order
        status.
      </Text>
      <View style={styles.card}>
        <Text style={styles.section}>Order details</Text>
        <Text style={styles.label}>Customer: {item.customer.name}</Text>
        <Text style={styles.label}>
          Placed: {new Date(item.createdAt).toLocaleString("en-NG")}
        </Text>
        <Text style={styles.label}>Overall order: {item.globalStatus}</Text>
        <Text style={styles.label}>
          Ship to: {item.address.city}, {item.address.region},{" "}
          {item.address.country}
        </Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.section}>Your products in this order</Text>
        {item.items.map((entry) => (
          <View key={entry.id} style={styles.item}>
            <Text style={styles.name}>
              {entry.quantity} × {entry.productName}
            </Text>
            <Text style={styles.amount}>{formatNaira(entry.unitPrice)}</Text>
          </View>
        ))}
        <View style={styles.subtotalRow}>
          <Text style={styles.section}>Your subtotal</Text>
          <Text style={styles.amount}>{formatNaira(item.subtotal)}</Text>
        </View>
      </View>
      <Text style={styles.section}>Fulfillment actions</Text>
      {allowedSellerFulfillmentActions(item.status).map((action) => (
        <Pressable
          accessibilityRole="button"
          key={action.status}
          accessibilityLabel={action.title}
          disabled={busy}
          onPress={() => changeStatus(action)}
          style={[
            styles.action,
            action.destructive && styles.destructive,
            busy && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons
                name={
                  action.destructive
                    ? "close-circle-outline"
                    : "checkmark-circle-outline"
                }
                size={21}
                color={action.destructive ? colors.red : "white"}
              />
              <Text
                style={[
                  styles.actionLabel,
                  action.destructive && styles.destructiveLabel,
                ]}
              >
                {action.title}
              </Text>
            </>
          )}
        </Pressable>
      ))}
      {allowedSellerFulfillmentActions(item.status).length === 0 ? (
        <Text style={styles.note}>
          This seller fulfillment is finalized. No more status changes are
          available.
        </Text>
      ) : null}
      <Text style={styles.footnote}>
        Status changes are checked again by the authenticated EaziCart API. The
        server enforces ownership, allowed transitions and payment verification.
      </Text>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 15, paddingBottom: 44 },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { fontSize: 23, fontWeight: "800", color: colors.ink, flex: 1 },
  status: { color: colors.orange, fontSize: 12, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  section: { color: colors.ink, fontSize: 15, fontWeight: "800" },
  label: { color: colors.ink, fontSize: 13, lineHeight: 18 },
  item: { flexDirection: "row", justifyContent: "space-between", gap: 10 },
  name: { color: colors.ink, fontSize: 13, flex: 1 },
  amount: { color: colors.orange, fontWeight: "800", fontSize: 14 },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 12,
    borderTopColor: colors.border,
  },
  action: {
    minHeight: 49,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.orange,
    borderRadius: 25,
  },
  destructive: {
    backgroundColor: colors.orangePale,
    borderWidth: 1,
    borderColor: colors.red,
  },
  actionLabel: { color: "white", fontWeight: "800", fontSize: 14 },
  destructiveLabel: { color: colors.red },
  disabled: { opacity: 0.5 },
  footnote: { fontSize: 11, lineHeight: 18, color: colors.muted },
});
