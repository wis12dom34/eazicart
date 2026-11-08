import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { api } from "../../lib/api";
import { ScreenState } from "../../components/ScreenState";
import type { Product } from "../../lib/types";
import { colors } from "../../theme";

export default function ShareProductScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const conversations = useQuery({
    queryKey: ["share-products-conversation", conversationId],
    queryFn: api.conversations,
    enabled: Boolean(conversationId),
  });
  const conversation = conversations.data?.data.find(
    (c) => c.id === conversationId,
  );
  const sellerProducts = useQuery({
    queryKey: ["share-products", conversation?.sellerId],
    queryFn: () => api.sellerProducts(conversation!.sellerId),
    enabled: Boolean(conversation),
  });
  if (conversations.isPending || sellerProducts.isPending)
    return <ScreenState loading message="Loading products…" />;
  if (conversations.isError || sellerProducts.isError || !conversation)
    return (
      <ScreenState
        message="Unable to load products from this conversation."
        retry={() => {
          void conversations.refetch();
          void sellerProducts.refetch();
        }}
      />
    );
  const products =
    sellerProducts.data?.data.filter((p) => p.active !== false) ?? [];
  return (
    <FlatList<Product>
      data={products}
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyExtractor={(p) => p.id}
      ListHeaderComponent={
        <Text style={styles.caption}>
          Choose a product from this seller to share.
        </Text>
      }
      ListEmptyComponent={
        <ScreenState message="This seller has no available products." />
      }
      renderItem={({ item }) => (
        <Pressable
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={`Share ${item.name}`}
          onPress={() =>
            router.replace({
              pathname: "/chat/[id]",
              params: { id: conversationId, productId: item.id },
            })
          }
        >
          {item.images[0]?.url ? (
            <Image
              source={{ uri: item.images[0].url }}
              contentFit="cover"
              style={styles.image}
            />
          ) : (
            <View style={styles.image} />
          )}
          <View style={styles.detail}>
            <Text style={styles.name} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.price}>
              ₦{Number(item.price).toLocaleString("en-NG")}
            </Text>
          </View>
        </Pressable>
      )}
    />
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16 },
  caption: { color: colors.muted, paddingBottom: 16 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  image: {
    width: 75,
    height: 75,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  detail: { flex: 1, gap: 8 },
  name: { color: colors.ink, fontWeight: "700" },
  price: { color: colors.orange, fontWeight: "800" },
});
