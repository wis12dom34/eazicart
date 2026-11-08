import { useMutation, useQuery } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
} from "react-native";
import { ScreenState } from "../../components/ScreenState";
import { api } from "../../lib/api";
import { useAuth } from "../../providers/auth";
import { colors } from "../../theme";

type Reason = "SPAM" | "SCAM" | "HARASSMENT" | "OTHER";
const reasons: Array<{ value: Reason; label: string }> = [
  { value: "SPAM", label: "Spam or unwanted messages" },
  { value: "SCAM", label: "Fraud or suspected scam" },
  { value: "HARASSMENT", label: "Harassment or threats" },
  { value: "OTHER", label: "Something else" },
];

export default function ReportConversationScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user, loading } = useAuth();
  const [reason, setReason] = useState<Reason | null>(null);
  const [details, setDetails] = useState("");
  const conversations = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: api.conversations,
    enabled: Boolean(user && conversationId) && !loading,
  });
  const found = conversations.data?.data.some((c) => c.id === conversationId);
  const submit = useMutation({
    mutationFn: () => api.conversationReport(conversationId, reason!, details),
    onSuccess: () => {
      Alert.alert(
        "Report recorded",
        "Your report has been saved. Automated moderator review is not yet enabled.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    },
    onError: (error) => {
      Alert.alert(
        "Unable to record report",
        error instanceof Error ? error.message : "Please try again.",
      );
    },
  });
  if (loading) return <ScreenState loading message="Opening reporting form…" />;
  if (!user) return <ScreenState message="Sign in to report a conversation." />;
  if (!conversationId) return <ScreenState message="Conversation not found." />;
  if (conversations.isPending)
    return <ScreenState loading message="Opening reporting form…" />;
  if (conversations.isError)
    return (
      <ScreenState
        message="Cannot verify this conversation."
        retry={() => void conversations.refetch()}
      />
    );
  if (!found) return <ScreenState message="Conversation not found." />;
  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>
          Why are you reporting this conversation?
        </Text>
        <Text style={styles.caption}>
          Your report is private. The other participant cannot view it.
        </Text>
        {reasons.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === option.value }}
            onPress={() => setReason(option.value)}
            style={[styles.option, reason === option.value && styles.selected]}
          >
            <Text style={styles.label}>{option.label}</Text>
            <Text style={styles.indicator}>
              {reason === option.value ? "●" : "○"}
            </Text>
          </Pressable>
        ))}
        <Text style={styles.fieldLabel}>Additional details (optional)</Text>
        <TextInput
          value={details}
          onChangeText={setDetails}
          maxLength={1000}
          multiline
          numberOfLines={4}
          accessibilityLabel="Additional report details"
          placeholder="Describe what happened"
          placeholderTextColor={colors.muted}
          style={styles.textarea}
        />
        <Text style={styles.note}>
          Reports are stored securely, but active moderation review is not yet
          available.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Submit report"
          disabled={!reason || submit.isPending}
          onPress={() => {
            if (reason) submit.mutate();
          }}
          style={[
            styles.submit,
            (!reason || submit.isPending) && styles.disabled,
          ]}
        >
          <Text style={styles.submitText}>
            {submit.isPending ? "Saving…" : "Submit report"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingBottom: 48, gap: 12 },
  title: { fontSize: 19, fontWeight: "800", color: colors.ink },
  caption: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  option: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  selected: { borderColor: colors.orange, backgroundColor: colors.orangePale },
  label: { color: colors.ink, fontWeight: "600", flex: 1 },
  indicator: { color: colors.orange, fontSize: 22 },
  fieldLabel: { color: colors.ink, fontWeight: "700", marginTop: 12 },
  textarea: {
    minHeight: 100,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    color: colors.ink,
    textAlignVertical: "top",
  },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  submit: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    marginTop: 12,
    backgroundColor: colors.orange,
  },
  disabled: { opacity: 0.45 },
  submitText: { color: "white", fontWeight: "800", fontSize: 14 },
});
