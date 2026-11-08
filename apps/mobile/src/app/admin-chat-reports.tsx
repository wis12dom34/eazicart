import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api } from "../lib/api";
import { useAuth } from "../providers/auth";
import { ScreenState } from "../components/ScreenState";
import { colors } from "../theme";

type Report = {
  id: string;
  conversationId: string;
  reporterId: string;
  reason: string;
  details: string | null;
  status: string;
  createdAt: string;
};
const statuses = ["ALL", "PENDING", "REVIEWED", "CLOSED"] as const;
type Status = (typeof statuses)[number];

/**
 * Manual moderation workflow. The API enforces the administrator role,
 * allowed status transitions and atomic audit history.
 */
export default function AdminChatReportsScreen() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const historyQuery = useQuery({
    queryKey: ["admin-chat-report-history", user?.id, selectedReportId],
    enabled: Boolean(user && selectedReportId),
    queryFn: () => api.adminChatReportHistory(selectedReportId!),
    retry: false,
  });
  const transition = useMutation({
    mutationFn: (args: {
      id: string;
      status: "REVIEWED" | "CLOSED";
      expectedStatus: "PENDING" | "REVIEWED";
    }) => api.adminChatReportStatus(args.id, args.status, args.expectedStatus),
    onSuccess: async () => {
      setHistory([]);
      setCursor(null);
      await queryClient.invalidateQueries({
        queryKey: ["admin-chat-reports", user?.id],
      });
      await queryClient.invalidateQueries({
        queryKey: ["admin-chat-report-history", user?.id],
      });
    },
    onError: (error: Error) => Alert.alert("Review not saved", error.message),
  });
  const confirmTransition = (report: Report) => {
    const next =
      report.status === "PENDING"
        ? "REVIEWED"
        : report.status === "REVIEWED"
          ? "CLOSED"
          : null;
    if (!next || transition.isPending) return;
    Alert.alert(
      next === "CLOSED" ? "Close this report?" : "Mark this report reviewed?",
      "This action is recorded in the administrator audit history. It does not automatically restrict the reported account.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: next === "CLOSED" ? "Close report" : "Confirm review",
          onPress: () =>
            transition.mutate({
              id: report.id,
              status: next,
              expectedStatus: report.status as "PENDING" | "REVIEWED",
            }),
        },
      ],
    );
  };
  const [status, setStatus] = useState<Status>("PENDING");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Report[]>([]);
  const reports = useQuery({
    queryKey: ["admin-chat-reports", user?.id, status, cursor],
    enabled: Boolean(user),
    queryFn: () =>
      api.adminChatReports(
        status === "ALL" ? undefined : status,
        cursor ?? undefined,
      ),
    retry: false,
  });
  if (!user) return <ScreenState message="Sign in to access moderation." />;
  if (reports.isPending)
    return <ScreenState loading message="Loading reports…" />;
  if (reports.isError)
    return (
      <ScreenState
        message="Moderation reports are available to authorized administrators only."
        retry={() => void reports.refetch()}
      />
    );
  const response = reports.data;
  const items = [...history, ...response.data].filter(
    (item, index, all) =>
      all.findIndex((candidate) => candidate.id === item.id) === index,
  );
  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Chat reports</Text>
      <Text style={styles.note}>
        Manual review only. Every status change is audited; no automatic bans.
      </Text>
      <View style={styles.filters}>
        {statuses.map((item) => (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: status === item }}
            onPress={() => {
              setHistory([]);
              setCursor(null);
              setStatus(item);
            }}
            style={[styles.filter, status === item && styles.active]}
          >
            <Text
              style={[styles.filterText, status === item && styles.activeText]}
            >
              {item}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.note}>No reports in this category.</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.report}>
            <Text style={styles.reason}>
              {item.reason} · {item.status}
            </Text>
            <Text style={styles.date}>
              {new Date(item.createdAt).toLocaleString()}
            </Text>
            <Text style={styles.detail}>
              {item.details || "No additional details provided."}
            </Text>
            <Text style={styles.identifier}>Report: {item.id}</Text>
            <Text style={styles.identifier}>
              Conversation: {item.conversationId}
            </Text>
            <View style={styles.actions}>
              {item.status !== "CLOSED" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    item.status === "PENDING"
                      ? "Mark report reviewed"
                      : "Close report"
                  }
                  disabled={transition.isPending}
                  style={[
                    styles.actionButton,
                    transition.isPending && styles.disabled,
                  ]}
                  onPress={() => confirmTransition(item)}
                >
                  <Text style={styles.actionText}>
                    {item.status === "PENDING"
                      ? "Mark reviewed"
                      : "Close report"}
                  </Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  setSelectedReportId((current) =>
                    current === item.id ? null : item.id,
                  )
                }
                style={styles.historyButton}
              >
                <Text style={styles.historyText}>
                  {selectedReportId === item.id
                    ? "Hide history"
                    : "Audit history"}
                </Text>
              </Pressable>
            </View>
            {selectedReportId === item.id && (
              <View style={styles.history}>
                {historyQuery.isPending ? (
                  <Text style={styles.identifier}>Loading history…</Text>
                ) : historyQuery.isError ? (
                  <Text style={styles.identifier}>Could not load history.</Text>
                ) : historyQuery.data.data.length === 0 ? (
                  <Text style={styles.identifier}>No review actions yet.</Text>
                ) : (
                  historyQuery.data.data.map((action) => (
                    <Text key={action.id} style={styles.identifier}>
                      {action.fromStatus} → {action.toStatus} ·{" "}
                      {new Date(action.createdAt).toLocaleString()}
                    </Text>
                  ))
                )}
              </View>
            )}
          </View>
        )}
        ListFooterComponent={
          response.pagination.hasMore ? (
            <Pressable
              accessibilityRole="button"
              style={styles.more}
              onPress={() => {
                setHistory(items);
                setCursor(response.pagination.nextCursor);
              }}
            >
              <Text style={styles.moreText}>Load more reports</Text>
            </Pressable>
          ) : undefined
        }
      />
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  heading: { fontSize: 24, fontWeight: "800", color: colors.ink, margin: 16 },
  note: { color: colors.muted, marginHorizontal: 16, marginBottom: 12 },
  filters: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  filter: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  active: { backgroundColor: colors.orange },
  filterText: { color: colors.ink, fontWeight: "700", fontSize: 11 },
  activeText: { color: "white" },
  list: { padding: 16, gap: 12 },
  report: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.surface,
    gap: 8,
  },
  reason: { color: colors.ink, fontWeight: "800" },
  date: { color: colors.muted, fontSize: 12 },
  detail: { color: colors.ink },
  identifier: { color: colors.muted, fontSize: 11 },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  actionButton: {
    backgroundColor: colors.orange,
    padding: 12,
    borderRadius: 10,
  },
  actionText: { color: "white", fontWeight: "800" },
  disabled: { opacity: 0.5 },
  historyButton: {
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  historyText: { color: colors.ink, fontWeight: "700" },
  history: {
    padding: 12,
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 8,
  },
  more: { padding: 14, alignItems: "center" },
  moreText: { color: colors.orange, fontWeight: "800" },
});
