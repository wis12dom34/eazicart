import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import type { Product } from "../../lib/types";
import { colors } from "../../theme";

export default function SearchScreen() {
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  useEffect(() => {
    const timeout = setTimeout(() => setTerm(search.trim()), 350);
    return () => clearTimeout(timeout);
  }, [search]);
  const results = useQuery({
    queryKey: ["search", term],
    queryFn: () => api.search(term),
    staleTime: 30_000,
  });
  const items = results.data?.data ?? [];
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" color={colors.muted} size={20} />
          <TextInput
            style={styles.input}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
            placeholder="Search products"
            placeholderTextColor={colors.muted}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setSearch("")}
            >
              <Ionicons name="close-circle" color={colors.muted} size={20} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {results.isError ? (
        <ScreenState
          message={
            results.error instanceof Error
              ? results.error.message
              : "Search unavailable"
          }
          retry={() => {
            void results.refetch();
          }}
        />
      ) : (
        <FlatList<Product>
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.columns}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${item.name}`}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: item.id },
                })
              }
              style={styles.tile}
            >
              {item.images[0]?.url ? (
                <Image
                  source={{ uri: item.images[0].url }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              ) : (
                <View style={[styles.image, styles.placeholder]}>
                  <Ionicons
                    name="image-outline"
                    color={colors.muted}
                    size={28}
                  />
                </View>
              )}
              <Text style={styles.productName} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={styles.price}>
                ₦{Number(item.price).toLocaleString("en-NG")}
              </Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <ScreenState
              loading={results.isPending}
              message={
                results.isPending
                  ? "Finding products…"
                  : "No matching products."
              }
            />
          }
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  title: { fontSize: 24, fontWeight: "800", color: colors.ink },
  searchBox: {
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    height: 48,
  },
  input: { flex: 1, marginLeft: 8, fontSize: 15, color: colors.ink },
  grid: { padding: 12, paddingBottom: 30 },
  columns: { gap: 10 },
  tile: { flex: 1, maxWidth: "49%", marginBottom: 18 },
  image: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: colors.surface,
  },
  placeholder: { alignItems: "center", justifyContent: "center" },
  productName: {
    fontWeight: "600",
    color: colors.ink,
    lineHeight: 19,
    marginTop: 8,
    fontSize: 13,
  },
  price: {
    color: colors.orange,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 4,
  },
});
