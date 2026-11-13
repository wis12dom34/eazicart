import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../providers/auth";
import { createAuthFormCoordinator } from "../lib/auth-form-coordinator";
import { colors } from "../theme";

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef(createAuthFormCoordinator());
  useEffect(() => () => form.current.invalidate(), []);
  const submit = () => {
    if (form.current.isBusy) return;
    if (!email.trim() || !password)
      return Alert.alert("Missing details", "Enter your email and password.");
    // Capture the credentials before awaiting any work. Do not log or persist
    // the password here; the AuthProvider owns secure session storage.
    const capturedEmail = email.trim().toLowerCase();
    const capturedPassword = password;
    setBusy(true);
    void form.current.submit({
      authenticate: () => login(capturedEmail, capturedPassword),
      onSuccess: () => router.back(),
      onError: (error) =>
        Alert.alert(
          "Sign in failed",
          error instanceof Error ? error.message : "Please try again.",
        ),
      onSettled: () => setBusy(false),
    });
  };
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.container}
      >
        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.muted}>Use your existing EaziCart account.</Text>
        <Text style={styles.label}>Email address</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
          autoComplete="current-password"
          secureTextEntry
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          disabled={busy || form.current.isBusy}
          onPress={submit}
          style={[
            styles.button,
            (busy || form.current.isBusy) && styles.disabled,
          ]}
        >
          {busy ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>
        <View style={styles.row}>
          <Text style={styles.muted}>New to EaziCart? </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || form.current.isBusy}
            onPress={() => router.replace("/register")}
          >
            <Text style={styles.link}>Create an account</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "white" },
  container: { padding: 24, paddingTop: 46, gap: 10 },
  heading: { fontSize: 28, fontWeight: "800", color: colors.ink },
  muted: { color: colors.muted, lineHeight: 20 },
  label: { color: colors.ink, fontWeight: "700", marginTop: 12 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 15,
  },
  button: {
    marginTop: 18,
    minHeight: 52,
    backgroundColor: colors.orange,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "white", fontWeight: "800", fontSize: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 25,
    gap: 2,
  },
  link: { color: colors.orange, fontWeight: "800" },
});
