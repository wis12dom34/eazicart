import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import { formatNaira } from "../lib/commerce";
import type { OrderSummary } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

export default function OrdersScreen() {
  const { user, loading } = useAuth();
  const orders = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: api.orders,
    enabled: Boolean(user) && !loading,
  });
  if (loading) return <ScreenState loading message="Loading orders…" />;
  if (!user)
    return (
      <ScreenState
        message="Sign in to see your EaziCart order history."
        retry={() => router.push("/login")}
      />
    );
  if (orders.isError)
    return (
      <ScreenState
        message={
          orders.error instanceof Error
            ? orders.error.message
            : "Orders unavailable"
        }
        retry={() => {
          void orders.refetch();
        }}
      />
    );
  return (
    <FlatList<OrderSummary>
      data={orders.data?.data ?? []}
      style={styles.root}
      contentContainerStyle={styles.list}
      refreshing={orders.isRefetching}
      onRefresh={() => {
        void orders.refetch();
      }}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={<Text style={styles.heading}>Order history</Text>}
      ListEmptyComponent={
        <ScreenState
          loading={orders.isPending}
          message={
            orders.isPending
              ? "Loading orders…"
              : "You haven't placed an order yet."
          }
        />
      }
      renderItem={({ item }) => (
        <View style={styles.order}>
          <View style={styles.row}>
            <Ionicons name="receipt-outline" color={colors.orange} size={22} />
            <Text style={styles.id} numberOfLines={1}>
              Order {item.id.slice(0, 10)}
            </Text>
            <Text style={styles.status}>{item.status}</Text>
          </View>
          <Text style={styles.info}>
            {new Date(item.createdAt).toLocaleDateString("en-NG")} ·{" "}
            {item.items.length} items
          </Text>
          <Text style={styles.total}>{formatNaira(item.total)}</Text>
        </View>
      )}
    />
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: 18, flexGrow: 1, gap: 12 },
  heading: {
    color: colors.ink,
    fontWeight: "800",
    fontSize: 22,
    marginBottom: 8,
  },
  order: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 9 },
  id: { fontWeight: "700", color: colors.ink, flex: 1 },
  status: { fontSize: 11, color: colors.orange, fontWeight: "800" },
  info: { fontSize: 12, color: colors.muted },
  total: { color: colors.ink, fontWeight: "800", fontSize: 17 },
});
