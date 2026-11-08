import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import { formatNaira } from "../lib/commerce";
import type { Product } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

export default function SellerInventory() {
  const { user, loading } = useAuth();
  const products = useQuery({
    queryKey: ["own-seller-products", user?.id],
    queryFn: api.ownSellerProducts,
    enabled: Boolean(user) && !loading,
  });
  if (loading) return <ScreenState loading message="Preparing inventory…" />;
  if (!user)
    return (
      <ScreenState
        message="Sign in to view your seller inventory."
        retry={() => router.push("/login")}
      />
    );
  if (products.isError)
    return (
      <ScreenState
        message={
          products.error instanceof Error
            ? products.error.message
            : "Inventory unavailable"
        }
        retry={() => void products.refetch()}
      />
    );
  return (
    <FlatList<Product>
      style={styles.root}
      contentContainerStyle={styles.content}
      data={products.data?.data ?? []}
      keyExtractor={(item) => item.id}
      refreshing={products.isRefetching}
      onRefresh={() => void products.refetch()}
      ListHeaderComponent={
        <View style={styles.heading}>
          <Text style={styles.title}>My inventory</Text>
          <Text style={styles.subheading}>
            All products, including unpublished listings
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a product"
            style={styles.addButton}
            onPress={() => router.push("/seller-product-editor")}
          >
            <Ionicons name="add-circle-outline" size={20} color="white" />
            <Text style={styles.addLabel}>Add product</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <ScreenState
          loading={products.isPending}
          message={
            products.isPending
              ? "Loading products…"
              : "You haven't added any products."
          }
        />
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.name}`}
          onPress={() =>
            router.push({
              pathname: "/seller-product-editor",
              params: { id: item.id },
            })
          }
        >
          {item.images[0]?.url ? (
            <Image
              source={{ uri: item.images[0].url }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={26} color={colors.muted} />
            </View>
          )}
          <View style={styles.details}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>{formatNaira(item.price)}</Text>
            <Text style={styles.stock}>
              {item.active === false
                ? "Unpublished"
                : item.stock === 0
                  ? "Out of stock"
                  : `${item.stock} in stock`}
            </Text>
          </View>
          <Ionicons name="create-outline" color={colors.orange} size={20} />
        </Pressable>
      )}
    />
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 17, paddingBottom: 40 },
  heading: { gap: 6, marginBottom: 15 },
  addButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    paddingHorizontal: 20,
    backgroundColor: colors.orange,
    minHeight: 46,
    borderRadius: 24,
    justifyContent: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addLabel: { color: "white", fontWeight: "800" },
  title: { fontSize: 23, fontWeight: "800", color: colors.ink },
  subheading: { fontSize: 12, color: colors.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 98,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
  },
  image: { width: 74, height: 74, borderRadius: 10 },
  imagePlaceholder: {
    width: 74,
    height: 74,
    backgroundColor: colors.surface,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  details: { flex: 1, gap: 5 },
  name: { fontSize: 14, fontWeight: "800", color: colors.ink },
  price: { fontSize: 13, fontWeight: "700", color: colors.orange },
  stock: { fontSize: 12, color: colors.muted },
});
