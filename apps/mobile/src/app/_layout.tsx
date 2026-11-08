import { Stack } from "expo-router";
import {
  focusManager,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { isNativeAppFocused } from "../lib/app-focus";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../providers/auth";
import { colors } from "../theme";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 20_000,
      gcTime: 5 * 60_000,
      refetchOnReconnect: true,
    },
  },
});

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === "web") return;
    focusManager.setFocused(isNativeAppFocused(AppState.currentState));
    const subscription = AppState.addEventListener("change", (state) => {
      focusManager.setFocused(isNativeAppFocused(state));
    });
    return () => {
      subscription.remove();
      focusManager.setFocused(undefined);
    };
  }, []);
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.ink,
              contentStyle: { backgroundColor: colors.background },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="login"
              options={{ title: "Sign in", presentation: "modal" }}
            />
            <Stack.Screen
              name="register"
              options={{ title: "Create account", presentation: "modal" }}
            />
            <Stack.Screen
              name="story/[userId]"
              options={{ headerShown: false, presentation: "fullScreenModal" }}
            />
            <Stack.Screen name="following" options={{ title: "Following" }} />
            <Stack.Screen name="chat/[id]" options={{ title: "Messages" }} />
            <Stack.Screen
              name="chat/report"
              options={{ title: "Report conversation" }}
            />
            <Stack.Screen
              name="chat/share-product"
              options={{ title: "Share product" }}
            />
            <Stack.Screen
              name="notifications"
              options={{ title: "Notifications" }}
            />
            <Stack.Screen
              name="admin-chat-reports"
              options={{ title: "Chat moderation" }}
            />
            <Stack.Screen
              name="admin-audit"
              options={{ title: "Finance audit preview" }}
            />
            <Stack.Screen
              name="addresses"
              options={{ title: "Delivery addresses" }}
            />
            <Stack.Screen
              name="checkout"
              options={{ title: "Checkout review" }}
            />
            <Stack.Screen name="orders" options={{ title: "Order history" }} />
            <Stack.Screen name="product/[id]" options={{ title: "Product" }} />
            <Stack.Screen
              name="product/[id]/comments"
              options={{ title: "Comments" }}
            />
            <Stack.Screen
              name="reel/[id]/comments"
              options={{ title: "Reel comments" }}
            />
            <Stack.Screen
              name="seller/[id]"
              options={{ title: "Storefront" }}
            />
          </Stack>
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
