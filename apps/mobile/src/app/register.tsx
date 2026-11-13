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

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const form = useRef(createAuthFormCoordinator());
  useEffect(() => () => form.current.invalidate(), []);
  const submit = () => {
    if (form.current.isBusy) return;
    if (name.trim().length < 2 || !email.includes("@") || password.length < 8) {
      return Alert.alert(
        "Check your details",
        "Enter your name, a valid email, and a password of at least 8 characters.",
      );
    }
    const capturedName = name.trim();
    const capturedEmail = email.trim().toLowerCase();
    const capturedPassword = password;
    setBusy(true);
    void form.current.submit({
      authenticate: () =>
        register(capturedName, capturedEmail, capturedPassword),
      onSuccess: () => router.back(),
      onError: (error) =>
        Alert.alert(
          "Registration failed",
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
        <Text style={styles.heading}>Join EaziCart</Text>
        <Text style={styles.muted}>
          Shop and connect with Nigerian sellers.
        </Text>
        <Text style={styles.label}>Full name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoComplete="name"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
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
          placeholder="At least 8 characters"
          secureTextEntry
          autoComplete="new-password"
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
            <Text style={styles.buttonText}>Create account</Text>
          )}
        </Pressable>
        <View style={styles.row}>
          <Text style={styles.muted}>Already registered? </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy || form.current.isBusy}
            onPress={() => router.replace("/login")}
          >
            <Text style={styles.link}>Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "white" },
  container: { padding: 24, paddingTop: 40, gap: 10 },
  heading: { fontWeight: "800", fontSize: 28, color: colors.ink },
  muted: { color: colors.muted },
  label: { fontWeight: "700", color: colors.ink, marginTop: 12 },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 14,
    color: colors.ink,
    fontSize: 15,
  },
  button: {
    marginTop: 16,
    minHeight: 52,
    backgroundColor: colors.orange,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.6 },
  buttonText: { color: "white", fontWeight: "800", fontSize: 16 },
  row: { flexDirection: "row", justifyContent: "center", marginTop: 25 },
  link: { color: colors.orange, fontWeight: "800" },
});
