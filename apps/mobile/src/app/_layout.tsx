import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
              name="chat/share-product"
              options={{ title: "Share product" }}
            />
            <Stack.Screen
              name="notifications"
              options={{ title: "Notifications" }}
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
            <Stack.Screen
              name="seller-center"
              options={{ title: "Seller center" }}
            />
            <Stack.Screen
              name="seller-product-editor"
              options={{ title: "Product details" }}
            />
            <Stack.Screen
              name="seller-inventory"
              options={{ title: "My inventory" }}
            />
            <Stack.Screen
              name="seller-orders"
              options={{ title: "Store orders" }}
            />
            <Stack.Screen
              name="seller-order/[id]"
              options={{ title: "Seller order details" }}
            />
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
