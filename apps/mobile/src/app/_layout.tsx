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
