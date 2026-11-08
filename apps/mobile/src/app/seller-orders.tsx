import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import { formatNaira } from "../lib/commerce";
import type { SellerOrder } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

export default function SellerOrders() {
  const { user, loading } = useAuth();
  const orders = useQuery({
    queryKey: ["own-seller-orders", user?.id],
    queryFn: api.ownSellerOrders,
    enabled: Boolean(user) && !loading,
  });
  if (loading) return <ScreenState loading message="Preparing store orders…" />;
  if (!user)
    return (
      <ScreenState
        message="Sign in to view seller orders."
        retry={() => router.push("/login")}
      />
    );
  if (orders.isError)
    return (
      <ScreenState
        message={
          orders.error instanceof Error
            ? orders.error.message
            : "Store orders are unavailable"
        }
        retry={() => void orders.refetch()}
      />
    );
  return (
    <FlatList<SellerOrder>
      style={styles.root}
      contentContainerStyle={styles.content}
      data={orders.data?.data ?? []}
      keyExtractor={(order) => order.id}
      refreshing={orders.isRefetching}
      onRefresh={() => void orders.refetch()}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.title}>Store orders</Text>
          <Text style={styles.note}>
            Only orders authorized for your seller account are shown.
          </Text>
        </View>
      }
      ListEmptyComponent={
        <ScreenState
          loading={orders.isPending}
          message={
            orders.isPending ? "Loading store orders…" : "No seller orders yet."
          }
        />
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Manage order ${item.id.slice(0, 10)}`}
          onPress={() =>
            router.push({
              pathname: "/seller-order/[id]",
              params: { id: item.id },
            })
          }
          style={styles.card}
        >
          <View style={styles.row}>
            <Text style={styles.orderId}>Order {item.id.slice(0, 10)}</Text>
            <Text style={styles.status}>{item.status}</Text>
          </View>
          <Text style={styles.name}>{item.customer.name}</Text>
          <Text style={styles.meta}>
            {new Date(item.createdAt).toLocaleDateString("en-NG")} ·{" "}
            {item.items.length} items
          </Text>
          {item.items.slice(0, 3).map((entry) => (
            <Text style={styles.item} numberOfLines={1} key={entry.id}>
              {entry.quantity} × {entry.productName}
            </Text>
          ))}
          <View style={styles.row}>
            <Text style={styles.meta}>
              {item.address.city}, {item.address.region}
            </Text>
            <Text style={styles.total}>{formatNaira(item.subtotal)}</Text>
          </View>
          <Text style={styles.manageLink}>View order details and actions</Text>
        </Pressable>
      )}
    />
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 40, gap: 12 },
  header: { gap: 6, marginBottom: 10 },
  title: { fontSize: 23, fontWeight: "800", color: colors.ink },
  note: { fontSize: 12, color: colors.muted, lineHeight: 17 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  orderId: { fontSize: 14, fontWeight: "800", color: colors.ink, flex: 1 },
  status: { fontSize: 11, color: colors.orange, fontWeight: "800" },
  name: { color: colors.ink, fontWeight: "700", fontSize: 14 },
  meta: { color: colors.muted, fontSize: 12 },
  item: { color: colors.ink, fontSize: 12 },
  total: { color: colors.ink, fontSize: 16, fontWeight: "800" },
  manageLink: {
    color: colors.orange,
    fontWeight: "800",
    fontSize: 12,
    marginTop: 5,
  },
});
