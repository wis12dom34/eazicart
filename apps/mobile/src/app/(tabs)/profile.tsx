import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";
import { currentAuditPreviewBase } from "../../lib/admin-audit-preview";

export default function ProfileScreen() {
  const { user, loading, logout } = useAuth();
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Your account</Text>
      {loading ? (
        <ActivityIndicator color={colors.orange} />
      ) : user ? (
        <>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>
              {user.name[0]?.toUpperCase() ?? "E"}
            </Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <Text style={styles.muted}>
            Your existing EaziCart account is connected.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View shops you follow"
            style={styles.followingLink}
            onPress={() => router.push("/following")}
          >
            <Ionicons name="people-outline" color={colors.orange} size={23} />
            <Text style={styles.followingText}>Shops you follow</Text>
            <Ionicons name="chevron-forward" color={colors.muted} size={20} />
          </Pressable>
          <Pressable
            style={styles.followingLink}
            accessibilityRole="button"
            accessibilityLabel="Your notifications"
            onPress={() => router.push("/notifications")}
          >
            <Ionicons
              name="notifications-outline"
              color={colors.orange}
              size={23}
            />
            <Text style={styles.followingText}>Notifications</Text>
            <Ionicons name="chevron-forward" color={colors.muted} size={20} />
          </Pressable>
          <Pressable
            style={styles.followingLink}
            accessibilityRole="button"
            onPress={() => router.push("/orders")}
          >
            <Ionicons name="receipt-outline" color={colors.orange} size={23} />
            <Text style={styles.followingText}>Your orders</Text>
            <Ionicons name="chevron-forward" color={colors.muted} size={20} />
          </Pressable>
          <Pressable
            style={styles.followingLink}
            accessibilityRole="button"
            onPress={() => router.push("/addresses")}
          >
            <Ionicons name="location-outline" color={colors.orange} size={23} />
            <Text style={styles.followingText}>Delivery addresses</Text>
            <Ionicons name="chevron-forward" color={colors.muted} size={20} />
          </Pressable>
          {currentAuditPreviewBase() ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Development finance audit preview"
              style={styles.followingLink}
              onPress={() => router.push("/admin-audit")}
            >
              <Ionicons
                name="shield-checkmark-outline"
                color={colors.orange}
                size={23}
              />
              <Text style={styles.followingText}>Finance audit (dev only)</Text>
              <Ionicons name="chevron-forward" color={colors.muted} size={20} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.secondary}
            accessibilityRole="button"
            onPress={() =>
              Alert.alert("Sign out", "Sign out of your EaziCart account?", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Sign out",
                  style: "destructive",
                  onPress: () => {
                    void logout();
                  },
                },
              ])
            }
          >
            <Ionicons name="log-out-outline" color={colors.ink} size={20} />
            <Text style={styles.secondaryText}>Sign out</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Ionicons
            name="person-circle-outline"
            size={74}
            color={colors.orange}
          />
          <Text style={styles.intro}>
            Sign in to like, save, and connect with sellers.
          </Text>
          <Pressable
            accessibilityRole="button"
            style={styles.primary}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.primaryText}>Sign in</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.secondary}
            onPress={() => router.push("/register")}
          >
            <Text style={styles.secondaryText}>Create account</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    backgroundColor: colors.background,
    gap: 13,
  },
  title: {
    fontSize: 24,
    color: colors.ink,
    fontWeight: "800",
    alignSelf: "flex-start",
    marginBottom: 24,
  },
  avatar: {
    borderRadius: 44,
    width: 88,
    height: 88,
    backgroundColor: colors.orangePale,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 37, fontWeight: "800", color: colors.orange },
  name: { color: colors.ink, fontWeight: "800", fontSize: 21 },
  email: { color: colors.muted, fontSize: 14 },
  muted: { color: colors.muted, fontSize: 12, textAlign: "center" },
  intro: {
    color: colors.ink,
    fontSize: 16,
    textAlign: "center",
    marginVertical: 16,
  },
  primary: {
    minHeight: 48,
    backgroundColor: colors.orange,
    borderRadius: 24,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  primaryText: { color: "white", fontWeight: "800" },
  secondary: {
    minHeight: 48,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 22,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
  },
  secondaryText: { fontWeight: "700", color: colors.ink },
  followingLink: {
    flexDirection: "row",
    minHeight: 58,
    alignSelf: "stretch",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
  },
  followingText: { flex: 1, color: colors.ink, fontWeight: "700" },
});
