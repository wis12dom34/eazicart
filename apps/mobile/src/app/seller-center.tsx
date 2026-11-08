import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import { formatNaira } from "../lib/commerce";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

export default function SellerCenter() {
  const { user, loading } = useAuth();
  const dashboard = useQuery({
    queryKey: ["seller-dashboard", user?.id],
    queryFn: api.sellerDashboard,
    enabled: Boolean(user) && !loading,
  });
  if (loading) return <ScreenState loading message="Preparing your shop…" />;
  if (!user)
    return (
      <ScreenState
        message="Sign in to manage your EaziCart shop."
        retry={() => router.push("/login")}
      />
    );
  if (dashboard.isPending)
    return <ScreenState loading message="Loading seller dashboard…" />;
  if (dashboard.isError)
    return (
      <ScreenState
        message={
          dashboard.error instanceof Error
            ? dashboard.error.message
            : "Seller dashboard unavailable"
        }
        retry={() => void dashboard.refetch()}
      />
    );
  const { seller, inventory, orders, customers, analytics } =
    dashboard.data.data;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.icon}>
          <Ionicons name="storefront-outline" size={24} color={colors.orange} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Seller center</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {seller.displayName}
          </Text>
        </View>
      </View>
      <Text style={styles.sectionTitle}>Shop overview</Text>
      <View style={styles.grid}>
        <Metric label="Active products" value={inventory.activeProducts} />
        <Metric label="Total units in stock" value={inventory.unitsInStock} />
        <Metric label="Orders" value={orders.total} />
        <Metric label="Customers" value={customers.total} />
      </View>
      {inventory.outOfStockProducts > 0 ? (
        <Text style={styles.warning}>
          {inventory.outOfStockProducts} active products are out of stock.
        </Text>
      ) : null}
      <Text style={styles.sectionTitle}>Order status</Text>
      <View style={styles.grid}>
        <Metric label="Pending" value={orders.pending} />
        <Metric label="Confirmed" value={orders.confirmed} />
        <Metric label="Fulfilled" value={orders.fulfilled} />
        <Metric label="Cancelled" value={orders.cancelled} />
      </View>
      {analytics.revenue.length ? (
        <View style={styles.revenue}>
          <Text style={styles.sectionTitle}>Paid revenue</Text>
          {analytics.revenue.map((entry) => (
            <Text style={styles.revenueNumber} key={entry.currency}>
              {entry.currency === "NGN"
                ? formatNaira(entry.gross)
                : `${entry.currency} ${entry.gross}`}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.actions}>
        <Destination
          icon="cube-outline"
          label="Manage inventory"
          detail="View products, stock and availability"
          onPress={() => router.push("/seller-inventory")}
        />
        <Destination
          icon="receipt-outline"
          label="Store orders"
          detail="Review customers and fulfillment status"
          onPress={() => router.push("/seller-orders")}
        />
        <Destination
          icon="storefront-outline"
          label="View storefront"
          detail="See your public shop"
          onPress={() =>
            router.push({ pathname: "/seller/[id]", params: { id: seller.id } })
          }
        />
      </View>
      <Text style={styles.footnote}>
        Shop information is read directly from EaziCart's authenticated seller
        API.
      </Text>
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value.toLocaleString("en-NG")}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function Destination({
  icon,
  label,
  detail,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.destination}
    >
      <Ionicons name={icon} color={colors.orange} size={23} />
      <View style={{ flex: 1 }}>
        <Text style={styles.destinationTitle}>{label}</Text>
        <Text style={styles.destinationDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  container: { padding: 18, paddingBottom: 44, gap: 17 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.orangePale,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: { color: colors.ink, fontWeight: "800", fontSize: 23 },
  subtitle: { color: colors.muted, fontSize: 13, marginTop: 3 },
  sectionTitle: { color: colors.ink, fontWeight: "800", fontSize: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: {
    width: "48%",
    minWidth: 135,
    flexGrow: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    gap: 8,
  },
  metricValue: { color: colors.ink, fontWeight: "800", fontSize: 23 },
  metricLabel: { color: colors.muted, fontSize: 12 },
  warning: {
    backgroundColor: colors.orangePale,
    color: colors.orange,
    padding: 12,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: "700",
  },
  revenue: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  revenueNumber: { fontSize: 19, fontWeight: "800", color: colors.ink },
  actions: { gap: 10 },
  destination: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    minHeight: 78,
  },
  destinationTitle: { color: colors.ink, fontWeight: "800", fontSize: 14 },
  destinationDetail: { color: colors.muted, fontSize: 12, marginTop: 4 },
  footnote: { color: colors.muted, fontSize: 11, lineHeight: 16 },
});
