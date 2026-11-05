import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollView,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { AddToCartButton } from "../../components/AddToCartButton";
import { api } from "../../lib/api";
import { colors } from "../../theme";

export default function ProductDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const query = useQuery({
    queryKey: ["product", id],
    enabled: Boolean(id),
    queryFn: () => api.product(id),
  });
  if (query.isPending)
    return <ScreenState loading message="Loading product…" />;
  if (query.isError)
    return (
      <ScreenState
        message={
          query.error instanceof Error
            ? query.error.message
            : "Product unavailable"
        }
        retry={() => {
          void query.refetch();
        }}
      />
    );
  const product = query.data.data;
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
      >
        {product.images.length ? (
          product.images.map((image, i) => (
            <Image
              key={image.id ?? String(i)}
              source={{ uri: image.url }}
              style={{ width, aspectRatio: 1, backgroundColor: colors.surface }}
              contentFit="contain"
              cachePolicy="memory-disk"
            />
          ))
        ) : (
          <View
            style={{
              width,
              aspectRatio: 1,
              backgroundColor: colors.surface,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="image-outline" size={45} color={colors.muted} />
          </View>
        )}
      </ScrollView>
      {product.images.length > 1 ? (
        <Text style={styles.hint}>
          Swipe to see all {product.images.length} photos
        </Text>
      ) : null}
      <View style={styles.details}>
        <Text style={styles.title}>{product.name}</Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>
            ₦{Number(product.price).toLocaleString("en-NG")}
          </Text>
          {product.originalPrice &&
          Number(product.originalPrice) > Number(product.price) ? (
            <Text style={styles.original}>
              ₦{Number(product.originalPrice).toLocaleString("en-NG")}
            </Text>
          ) : null}
        </View>
        {product.discountPercent ? (
          <Text style={styles.discount}>{product.discountPercent}% off</Text>
        ) : null}
        <Text style={styles.stock}>
          {product.stock > 0 ? "In stock" : "Out of stock"}
        </Text>
        {product.description ? (
          <Text style={styles.description}>{product.description}</Text>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/seller/[id]",
              params: { id: product.seller.id },
            })
          }
          style={styles.actionRow}
        >
          <Ionicons name="storefront-outline" size={22} color={colors.orange} />
          <Text style={styles.actionText}>
            Visit {product.seller.displayName}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({
              pathname: "/product/[id]/comments",
              params: { id: product.id },
            })
          }
          style={styles.actionRow}
        >
          <Ionicons name="chatbubbles-outline" size={22} color={colors.ink} />
          <Text style={styles.actionText}>Read comments</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void Share.share({
              message: `https://eazicart.com/product/${encodeURIComponent(product.id)}`,
            });
          }}
          style={styles.share}
        >
          <Ionicons name="share-social-outline" size={19} color="white" />
          <Text style={styles.shareText}>Share product</Text>
        </Pressable>
        <AddToCartButton productId={product.id} stock={product.stock} />
        <Text style={styles.phase}>
          Cart management and checkout review are available. Online payment is
          disabled until the KoraPay production backend is verified.
        </Text>
      </View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { paddingBottom: 36 },
  hint: { textAlign: "center", color: colors.muted, fontSize: 12, padding: 10 },
  details: { padding: 20, gap: 12 },
  title: { fontSize: 23, fontWeight: "800", color: colors.ink },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  price: { fontSize: 24, fontWeight: "900", color: colors.orange },
  original: {
    fontSize: 14,
    textDecorationLine: "line-through",
    color: colors.muted,
  },
  discount: { color: colors.red, fontWeight: "700" },
  stock: { color: colors.success, fontWeight: "700" },
  description: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 23,
    marginVertical: 8,
  },
  actionRow: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  actionText: { color: colors.ink, fontWeight: "700", flex: 1 },
  share: {
    minHeight: 52,
    backgroundColor: colors.orange,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    flexDirection: "row",
    marginTop: 12,
  },
  shareText: { color: "white", fontWeight: "800" },
  phase: { fontSize: 12, color: colors.muted, lineHeight: 18, marginTop: 6 },
});
