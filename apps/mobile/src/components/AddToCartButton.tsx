import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import { api } from "../lib/api";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

export function AddToCartButton({
  productId,
  stock,
}: {
  productId: string;
  stock: number;
}) {
  const { user } = useAuth();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (stock <= 0 || busy) return;
    setBusy(true);
    try {
      await api.cartAdd(productId, 1);
      void cache.invalidateQueries({ queryKey: ["cart", user.id] });
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      router.push("/(tabs)/cart");
    } catch (error) {
      Alert.alert(
        "Couldn't add to cart",
        error instanceof Error ? error.message : "Try again",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add product to cart"
      disabled={busy || stock < 1}
      onPress={() => {
        void add();
      }}
      style={[styles.button, (busy || stock < 1) && styles.disabled]}
    >
      {busy ? (
        <ActivityIndicator color="white" />
      ) : (
        <Text style={styles.text}>
          {stock < 1 ? "Out of stock" : "Add to cart"}
        </Text>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.orange,
    borderRadius: 14,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
  },
  disabled: { opacity: 0.5 },
  text: { color: "white", fontSize: 15, fontWeight: "800" },
});
