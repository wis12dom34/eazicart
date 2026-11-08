import { useMutation, useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { FollowButton } from "../../components/FollowButton";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";
import { colors } from "../../theme";
import { useAuth } from "../../providers/auth";

export default function SellerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const startChat = useMutation({
    mutationFn: api.startConversation,
    onSuccess: ({ data }) =>
      router.push({ pathname: "/chat/[id]", params: { id: data.id } }),
    onError: (error) =>
      Alert.alert(
        "Unable to start chat",
        error instanceof Error ? error.message : "Please retry",
      ),
  });
  const seller = useQuery({
    queryKey: ["seller", id],
    queryFn: () => api.seller(id),
    enabled: Boolean(id),
  });
  const products = useQuery({
    queryKey: ["seller-products", id],
    queryFn: () => api.sellerProducts(id),
    enabled: Boolean(id),
  });
  if (seller.isPending || products.isPending)
    return <ScreenState loading message="Loading storefront…" />;
  if (seller.isError || products.isError)
    return (
      <ScreenState
        message="This storefront is unavailable."
        retry={() => {
          void seller.refetch();
          void products.refetch();
        }}
      />
    );
  const info = seller.data.data;
  return (
    <FlatList<Product>
      style={styles.screen}
      contentContainerStyle={styles.grid}
      numColumns={3}
      columnWrapperStyle={styles.column}
      data={products.data.data}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {info.displayName[0]?.toUpperCase() ?? "E"}
            </Text>
          </View>
          <Text style={styles.title}>{info.displayName}</Text>
          <FollowButton sellerUserId={info.userId} />
          {user?.id !== info.userId ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Message seller"
              disabled={startChat.isPending}
              style={styles.chatButton}
              onPress={() => {
                if (!user) {
                  router.push("/login");
                  return;
                }
                startChat.mutate(info.userId);
              }}
            >
              <Ionicons name="chatbubble-outline" size={19} color="white" />
              <Text style={styles.chatButtonLabel}>
                {startChat.isPending ? "Opening chat…" : "Message seller"}
              </Text>
            </Pressable>
          ) : null}
          {info.bio ? <Text style={styles.bio}>{info.bio}</Text> : null}
          <View style={styles.stats}>
            <Text style={styles.stat}>{info.followerCount ?? 0} followers</Text>
            <Text style={styles.stat}>
              {products.data.data.length} products
            </Text>
            {info.joinedAt ? (
              <Text style={styles.stat}>
                Joined {new Date(info.joinedAt).getFullYear()}
              </Text>
            ) : null}
          </View>
          <View style={styles.divider} />
          <Text style={styles.section}>Products</Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`View ${item.name}`}
          onPress={() =>
            router.push({ pathname: "/product/[id]", params: { id: item.id } })
          }
          style={styles.tile}
        >
          {item.images[0]?.url ? (
            <Image
              source={{ uri: item.images[0].url }}
              contentFit="cover"
              style={styles.image}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.image, styles.noImage]}>
              <Ionicons name="image-outline" color={colors.muted} size={22} />
            </View>
          )}
          <Text numberOfLines={1} style={styles.productName}>
            {item.name}
          </Text>
          <Text style={styles.price} numberOfLines={1}>
            ₦{Number(item.price).toLocaleString("en-NG")}
          </Text>
        </Pressable>
      )}
      ListEmptyComponent={<ScreenState message="No products published yet." />}
    />
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  grid: { padding: 9, paddingBottom: 32 },
  chatButton: {
    minHeight: 44,
    minWidth: 160,
    borderRadius: 24,
    backgroundColor: colors.orange,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
  },
  chatButtonLabel: { color: "white", fontSize: 13, fontWeight: "800" },
  column: { gap: 6 },
  header: { alignItems: "center", gap: 10, paddingTop: 18, paddingBottom: 20 },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.orangePale,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", fontSize: 32, color: colors.orange },
  title: { fontSize: 23, fontWeight: "800", color: colors.ink },
  bio: {
    fontSize: 13,
    textAlign: "center",
    color: colors.muted,
    paddingHorizontal: 16,
  },
  stats: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 13,
  },
  stat: { fontSize: 11, color: colors.muted },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: colors.border,
    marginTop: 10,
  },
  section: {
    alignSelf: "flex-start",
    marginTop: 5,
    fontSize: 17,
    fontWeight: "800",
    color: colors.ink,
  },
  tile: { flex: 1, maxWidth: "33%", paddingBottom: 14 },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 7,
    backgroundColor: colors.surface,
  },
  noImage: { justifyContent: "center", alignItems: "center" },
  productName: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 6,
  },
  price: {
    color: colors.orange,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
});
