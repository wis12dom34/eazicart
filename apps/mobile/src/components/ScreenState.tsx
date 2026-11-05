import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { colors } from "../theme";

export function ScreenState({
  message,
  retry,
  loading = false,
}: {
  message: string;
  retry?: () => void;
  loading?: boolean;
}) {
  return (
    <View style={styles.wrapper}>
      {loading ? <ActivityIndicator color={colors.orange} /> : null}
      <Text style={styles.message}>{message}</Text>
      {retry ? (
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          style={styles.retry}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: {
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
  },
  retry: {
    backgroundColor: colors.orange,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 22,
    minHeight: 44,
    justifyContent: "center",
  },
  retryText: { color: "white", fontWeight: "700" },
});
