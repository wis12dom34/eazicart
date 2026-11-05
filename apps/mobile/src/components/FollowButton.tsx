import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

/** The follows API takes a *seller user ID*, never a SellerProfile ID. */
export function FollowButton({ sellerUserId }: { sellerUserId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const followingKey = ["following", user?.id];
  const following = useQuery({
    queryKey: followingKey,
    queryFn: api.following,
    enabled: Boolean(user && sellerUserId && user.id !== sellerUserId),
    staleTime: 30_000,
  });
  const count = useQuery({
    queryKey: ["seller-followers", sellerUserId],
    queryFn: () => api.followerCount(sellerUserId),
    enabled: Boolean(sellerUserId),
    staleTime: 30_000,
  });

  if (!sellerUserId || user?.id === sellerUserId) return null;
  const followed = Boolean(
    following.data?.data.some((item) => item.sellerId === sellerUserId),
  );
  const label = !user
    ? "Sign in to follow"
    : following.isError
      ? "Retry"
      : followed
        ? "Following"
        : "Follow";
  const countLabel = count.data?.data.count;

  const toggle = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (busy) return;
    if (following.isError || !following.data) {
      void following.refetch();
      return;
    }
    setBusy(true);
    try {
      if (followed) await api.unfollowSeller(sellerUserId);
      else await api.followSeller(sellerUserId);
      void Haptics.selectionAsync().catch(() => {});
      // Invalidate after mutation instead of guessing the new remote count.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: followingKey }),
        queryClient.invalidateQueries({
          queryKey: ["seller-followers", sellerUserId],
        }),
        queryClient.invalidateQueries({ queryKey: ["seller"] }),
      ]);
    } catch (error) {
      // A concurrent request may have already reached the intended state.
      if (
        error instanceof ApiError &&
        ((error.status === 409 && !followed) ||
          (error.status === 404 && followed))
      ) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: followingKey }),
          queryClient.invalidateQueries({
            queryKey: ["seller-followers", sellerUserId],
          }),
        ]);
      } else {
        Alert.alert(
          "Couldn't update follow",
          error instanceof Error ? error.message : "Try again",
        );
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{
          disabled: busy || (Boolean(user) && following.isPending),
        }}
        disabled={busy || (Boolean(user) && following.isPending)}
        onPress={() => {
          void toggle();
        }}
        style={[styles.button, followed && styles.followingButton]}
      >
        {busy ? (
          <ActivityIndicator
            color={followed ? colors.orange : "white"}
            size="small"
          />
        ) : (
          <Ionicons
            name={followed ? "checkmark" : "person-add-outline"}
            color={followed ? colors.orange : "white"}
            size={18}
          />
        )}
        <Text style={[styles.buttonText, followed && styles.followingText]}>
          {label}
        </Text>
      </Pressable>
      {typeof countLabel === "number" ? (
        <Text style={styles.count}>
          {countLabel.toLocaleString("en-NG")} followers
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  button: {
    minHeight: 46,
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  buttonText: { color: "white", fontWeight: "800", fontSize: 14 },
  followingButton: {
    backgroundColor: colors.orangePale,
    borderWidth: 1,
    borderColor: colors.orange,
  },
  followingText: { color: colors.orange },
  count: { fontSize: 12, color: colors.muted, fontWeight: "600" },
});
