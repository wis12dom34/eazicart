import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
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
 * Read-only moderation preview. Authorization is enforced by the API using
 * the authenticated user's database role, never by this screen.
 */
export default function AdminChatReportsScreen() {
  const { user } = useAuth();
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
        Read-only review. No enforcement actions are enabled.
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
  more: { padding: 14, alignItems: "center" },
  moreText: { color: colors.orange, fontWeight: "800" },
});
