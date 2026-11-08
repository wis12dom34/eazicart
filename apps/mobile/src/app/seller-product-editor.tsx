import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import {
  validateSellerProductDraft,
  type SellerProductDraft,
} from "../lib/product-form";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

const emptyDraft: SellerProductDraft = {
  name: "",
  description: "",
  price: "",
  originalPrice: "",
  stock: "0",
  categoryId: "",
};

export default function SellerProductEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const inventory = useQuery({
    queryKey: ["own-seller-products", user?.id],
    queryFn: api.ownSellerProducts,
    enabled: Boolean(user && id) && !loading,
  });
  const categories = useQuery({
    queryKey: ["seller-categories"],
    queryFn: api.categories,
  });
  const existing = inventory.data?.data.find((item) => item.id === id);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<SellerProductDraft>(emptyDraft);
  const [working, setWorking] = useState(false);
  useEffect(() => {
    if (!id) {
      setLoadedId(null);
      setDraft(emptyDraft);
      return;
    }
    if (!existing || loadedId === id) return;
    setDraft({
      name: existing.name,
      description: existing.description ?? "",
      price: existing.price,
      originalPrice: existing.originalPrice ?? "",
      stock: String(existing.stock),
      categoryId: existing.category?.id ?? "",
    });
    setLoadedId(id);
  }, [id, existing, loadedId]);
  const updateField = (field: keyof SellerProductDraft, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: ["own-seller-products", user?.id],
      }),
      queryClient.invalidateQueries({
        queryKey: ["seller-dashboard", user?.id],
      }),
    ]);
  };

  const save = async () => {
    if (working || (id && !existing)) return;
    const result = validateSellerProductDraft(draft);
    if (!result.ok) {
      Alert.alert("Check product details", result.message);
      return;
    }
    if (
      !categories.data?.data.some(
        (category) => category.id === result.data.categoryId,
      )
    ) {
      Alert.alert("Invalid category", "Select an available product category.");
      return;
    }
    setWorking(true);
    try {
      if (id) {
        // Never send images here: PATCH would replace/deletе existing product photos.
        await api.updateSellerProduct(id, result.data);
      } else {
        await api.createSellerProduct(result.data);
      }
      await refresh();
      Alert.alert("Product saved", "Your product details have been saved.", [
        { text: "Done", onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert(
        "Unable to save product",
        error instanceof Error ? error.message : "Please try again",
      );
    } finally {
      setWorking(false);
    }
  };
  const archive = () => {
    if (!id || !existing || working || existing.active === false) return;
    Alert.alert(
      "Unpublish this product?",
      "It will disappear from the public storefront. Existing orders will not be deleted.",
      [
        { text: "Keep product", style: "cancel" },
        {
          text: "Unpublish",
          style: "destructive",
          onPress: async () => {
            setWorking(true);
            try {
              await api.archiveSellerProduct(id);
              await refresh();
              router.back();
            } catch (error) {
              Alert.alert(
                "Unable to unpublish",
                error instanceof Error ? error.message : "Please retry",
              );
            } finally {
              setWorking(false);
            }
          },
        },
      ],
    );
  };
  if (loading)
    return <ScreenState loading message="Preparing seller editor…" />;
  if (!user)
    return (
      <ScreenState
        message="Sign in to manage your products."
        retry={() => router.push("/login")}
      />
    );
  if (inventory.isError || categories.isError)
    return (
      <ScreenState
        message="Unable to load product details and categories."
        retry={() => {
          void inventory.refetch();
          void categories.refetch();
        }}
      />
    );
  if (categories.isPending || (id && inventory.isPending))
    return <ScreenState loading message="Loading product editor…" />;
  if (id && !existing)
    return <ScreenState message="This product is not in your inventory." />;
  if (id && loadedId !== id)
    return <ScreenState loading message="Preparing product details…" />;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>{id ? "Edit product" : "Add product"}</Text>
      <Text style={styles.note}>
        {id
          ? "Update your listing without replacing any existing product images."
          : "Set up a product listing with its details, price and available quantity."}
      </Text>
      <Field
        label="Product name"
        value={draft.name}
        onChangeText={(v) => updateField("name", v)}
        maxLength={160}
      />
      <Field
        label="Description"
        value={draft.description}
        onChangeText={(v) => updateField("description", v)}
        multiline
        maxLength={5000}
      />
      <Field
        label="Price (₦)"
        value={draft.price}
        onChangeText={(v) => updateField("price", v)}
        keyboardType="decimal-pad"
        placeholder="e.g. 4500.00"
      />
      <Field
        label="Original price (₦, optional)"
        value={draft.originalPrice}
        onChangeText={(v) => updateField("originalPrice", v)}
        keyboardType="decimal-pad"
        placeholder="e.g. 6000.00"
      />
      <Text style={styles.note}>
        If the original price is higher than your selling price, buyers see the
        discount automatically. Leave this blank to remove the discount.
      </Text>
      <Field
        label="Units in stock"
        value={draft.stock}
        onChangeText={(v) => updateField("stock", v)}
        keyboardType="number-pad"
      />
      <View style={styles.section}>
        <Text style={styles.label}>Category</Text>
        <View style={styles.categories}>
          {categories.data?.data.map((category) => (
            <Pressable
              key={category.id}
              accessibilityRole="button"
              accessibilityState={{
                selected: draft.categoryId === category.id,
              }}
              accessibilityLabel={category.name}
              style={[
                styles.category,
                draft.categoryId === category.id && styles.categorySelected,
              ]}
              onPress={() => updateField("categoryId", category.id)}
            >
              <Text
                style={[
                  styles.categoryLabel,
                  draft.categoryId === category.id && styles.selectedLabel,
                ]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.imageNote}>
        <Ionicons name="images-outline" size={22} color={colors.orange} />
        <Text style={styles.help}>
          Product photo uploads are not yet available in the native app.
          Existing images are preserved when editing.
        </Text>
      </View>
      {existing?.active === false ? (
        <Text style={styles.archiveNote}>
          This product is unpublished. Editing will not automatically republish
          it.
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Save product"
        disabled={working}
        style={[styles.save, working && styles.disabled]}
        onPress={() => {
          void save();
        }}
      >
        {working ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text style={styles.saveLabel}>Save product</Text>
        )}
      </Pressable>
      {id && existing?.active !== false ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Unpublish product"
          disabled={working}
          style={styles.archive}
          onPress={archive}
        >
          <Text style={styles.archiveLabel}>Unpublish product</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  multiline,
  keyboardType,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  multiline?: boolean;
  keyboardType?: "decimal-pad" | "number-pad";
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        keyboardType={keyboardType}
        placeholder={placeholder}
        maxLength={maxLength}
        placeholderTextColor={colors.muted}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, gap: 16, paddingBottom: 48 },
  title: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  note: { color: colors.muted, fontSize: 13, lineHeight: 20 },
  section: { gap: 8 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "800" },
  input: {
    minHeight: 48,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 13,
    color: colors.ink,
    fontSize: 15,
  },
  multiline: { minHeight: 115, textAlignVertical: "top" },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  category: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 44,
    justifyContent: "center",
  },
  categorySelected: {
    backgroundColor: colors.orangePale,
    borderColor: colors.orange,
  },
  categoryLabel: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  selectedLabel: { color: colors.orange, fontWeight: "800" },
  imageNote: {
    backgroundColor: colors.orangePale,
    padding: 14,
    borderRadius: 12,
    gap: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  help: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 19 },
  archiveNote: { color: colors.red, fontSize: 12 },
  save: {
    minHeight: 50,
    borderRadius: 25,
    backgroundColor: colors.orange,
    justifyContent: "center",
    alignItems: "center",
  },
  disabled: { opacity: 0.5 },
  saveLabel: { color: "white", fontSize: 14, fontWeight: "800" },
  archive: {
    padding: 13,
    minHeight: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  archiveLabel: { color: colors.red, fontWeight: "800" },
});
