import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import { createExclusiveMutationGate } from "../lib/exclusive-mutation-gate";
import type { Address, AddressInput } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

const blank = (): AddressInput => ({
  line1: "",
  city: "",
  region: "",
  postalCode: "",
  country: "Nigeria",
  label: "Home",
  isDefault: false,
});
export default function AddressesScreen() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const mutationGate = useRef(createExclusiveMutationGate());
  const [form, setForm] = useState<AddressInput>(blank);
  const queryKey = ["addresses", user?.id];
  const addresses = useQuery({
    queryKey,
    queryFn: api.addresses,
    enabled: Boolean(user) && !loading,
  });
  const save = async () => {
    if (!user || mutationGate.current.isBusy) return;
    const normalized = {
      ...form,
      line1: form.line1.trim(),
      city: form.city.trim(),
      region: form.region.trim(),
      postalCode: form.postalCode.trim(),
      country: form.country.trim(),
    };
    if (
      !normalized.line1 ||
      !normalized.city ||
      !normalized.region ||
      !normalized.postalCode ||
      normalized.country.length < 2
    ) {
      Alert.alert(
        "Complete your address",
        "Street address, city, state, postal code, and country are required.",
      );
      return;
    }
    await mutationGate.current.run(async () => {
      setSaving(true);
      try {
        await api.createAddress(normalized);
        void queryClient.invalidateQueries({ queryKey });
        setAdding(false);
        setForm(blank());
      } catch (error) {
        Alert.alert(
          "Couldn't save address",
          error instanceof Error ? error.message : "Try again.",
        );
      } finally {
        setSaving(false);
      }
    });
  };
  const remove = (address: Address) => {
    if (!user || mutationGate.current.isBusy) return;
    Alert.alert("Remove delivery address?", "This action cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => {
          if (!user) return;
          void mutationGate.current.run(async () => {
            try {
              await api.deleteAddress(address.id);
              void queryClient.invalidateQueries({ queryKey });
            } catch (error) {
              Alert.alert(
                "Couldn't remove address",
                error instanceof Error ? error.message : "Try again.",
              );
            }
          });
        },
      },
    ]);
  };
  if (loading) return <ScreenState loading message="Loading your account…" />;
  if (!user)
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>
          Sign in to manage your delivery addresses.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/login")}
          style={styles.primary}
        >
          <Text style={styles.primaryText}>Sign in</Text>
        </Pressable>
      </View>
    );
  if (adding)
    return (
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.form}
        >
          <Text style={styles.title}>Add delivery address</Text>
          {(
            [
              ["label", "Label (optional)", "Home or office"],
              ["line1", "Street and building", "House number and street"],
              ["city", "City", "Your city"],
              ["region", "State or region", "Lagos"],
              ["postalCode", "Postal code", "Postal code"],
              ["country", "Country", "Nigeria"],
            ] as const
          ).map(([key, label, placeholder]) => (
            <View key={key} style={styles.field}>
              <Text style={styles.label}>{label}</Text>
              <TextInput
                style={styles.input}
                value={form[key] ?? ""}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                onChangeText={(text) =>
                  setForm((old) => ({ ...old, [key]: text }))
                }
                maxLength={key === "line1" ? 200 : key === "label" ? 80 : 100}
              />
            </View>
          ))}
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={() => {
              void save();
            }}
            style={styles.primary}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryText}>Save address</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAdding(false)}
            disabled={saving}
            style={styles.cancel}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  return (
    <View style={styles.root}>
      <View style={styles.heading}>
        <Text style={styles.title}>Delivery addresses</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => setAdding(true)}
          style={styles.add}
        >
          <Ionicons name="add" size={18} color="white" />
          <Text style={styles.addText}>Add</Text>
        </Pressable>
      </View>
      {addresses.isError ? (
        <ScreenState
          message={
            addresses.error instanceof Error
              ? addresses.error.message
              : "Addresses unavailable"
          }
          retry={() => {
            void addresses.refetch();
          }}
        />
      ) : (
        <FlatList<Address>
          contentContainerStyle={styles.list}
          data={addresses.data?.data ?? []}
          keyExtractor={(item) => item.id}
          refreshing={addresses.isRefetching}
          onRefresh={() => {
            void addresses.refetch();
          }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.row}>
                <Ionicons
                  name="location-outline"
                  size={21}
                  color={colors.orange}
                />
                <Text style={styles.addressTitle}>
                  {item.label || "Delivery address"}
                </Text>
                {item.isDefault ? (
                  <Text style={styles.default}>Default</Text>
                ) : null}
              </View>
              <Text style={styles.line}>
                {[
                  item.line1,
                  item.line2,
                  item.city,
                  item.region,
                  item.postalCode,
                  item.country,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Remove delivery address"
                onPress={() => remove(item)}
                disabled={saving}
                style={styles.remove}
              >
                <Ionicons name="trash-outline" size={18} color={colors.red} />
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          )}
          ListEmptyComponent={
            <ScreenState
              loading={addresses.isPending}
              message={
                addresses.isPending
                  ? "Loading addresses…"
                  : "No delivery address yet. Add one for checkout review."
              }
            />
          }
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    padding: 25,
  },
  heading: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 22, fontWeight: "800", color: colors.ink },
  add: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 15,
    backgroundColor: colors.orange,
    flexDirection: "row",
    gap: 5,
    alignItems: "center",
  },
  addText: { color: "white", fontWeight: "800" },
  list: { padding: 16, paddingTop: 0, flexGrow: 1, gap: 12 },
  card: {
    padding: 16,
    borderRadius: 14,
    borderColor: colors.border,
    borderWidth: 1,
    gap: 11,
  },
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  addressTitle: { fontWeight: "800", color: colors.ink, flex: 1 },
  default: { color: colors.orange, fontSize: 11, fontWeight: "800" },
  line: { color: colors.muted, fontSize: 13, lineHeight: 21 },
  remove: {
    alignSelf: "flex-start",
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  removeText: { color: colors.red, fontWeight: "700" },
  form: { padding: 20, paddingBottom: 40, gap: 14 },
  field: { gap: 6 },
  label: { color: colors.ink, fontWeight: "700" },
  input: {
    minHeight: 50,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  primary: {
    minHeight: 50,
    borderRadius: 13,
    paddingHorizontal: 30,
    backgroundColor: colors.orange,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontWeight: "800", fontSize: 15, color: "white" },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { fontWeight: "700", color: colors.muted },
  muted: { color: colors.muted },
});
