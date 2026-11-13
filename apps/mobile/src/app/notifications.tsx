import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenState } from "../components/ScreenState";
import { api } from "../lib/api";
import { createNotificationActionCoordinator } from "../lib/notification-action-coordinator";
import {
  filterNotifications,
  notificationEmptyTitle,
  notificationFilters,
  notificationTime,
  type NotificationFilter,
} from "../lib/notifications";
import type { Notification } from "../lib/types";
import { useAuth } from "../providers/auth";
import { colors } from "../theme";

export default function NotificationsScreen() {
  const { user, loading } = useAuth();
  const cache = useQueryClient();
  const [filter, setFilter] = useState<NotificationFilter>("ALL");
  const actions = useRef(createNotificationActionCoordinator());
  const currentAccountId = useRef(user?.id);
  currentAccountId.current = user?.id;
  const key = ["notifications", user?.id];
  const list = useQuery({
    queryKey: key,
    queryFn: api.notifications,
    enabled: Boolean(user) && !loading,
    staleTime: 30_000,
  });
  const read = useMutation({ mutationFn: api.notificationRead });
  const readAll = useMutation({ mutationFn: api.notificationsReadAll });
  const markRead = (id: string) => {
    // useMutation pending state alone cannot prevent a rapid duplicate tap.
    void actions.current
      .run(
        user?.id,
        () => currentAccountId.current,
        () => read.mutateAsync(id),
        () => cache.invalidateQueries({ queryKey: key }),
      )
      .catch(() => {
        // The mutation hook exposes the error in the UI below.
      });
  };
  const markAllRead = () => {
    void actions.current
      .run(
        user?.id,
        () => currentAccountId.current,
        () => readAll.mutateAsync(),
        () => cache.invalidateQueries({ queryKey: key }),
      )
      .catch(() => {
        // The mutation hook exposes the error in the UI below.
      });
  };
  const busy = read.isPending || readAll.isPending || actions.current.isBusy;
  const visible = filterNotifications(list.data?.data ?? [], filter);
  const unreadCount = list.data?.meta.unreadCount ?? 0;
  const actionError = read.error ?? readAll.error;

  if (loading) return <ScreenState loading message="Loading your account…" />;
  if (!user)
    return (
      <View style={styles.guest}>
        <ScreenState message="Sign in to view your notifications." />
        <Pressable
          accessibilityRole="button"
          style={styles.signIn}
          onPress={() => router.push("/login")}
        >
          <Text style={styles.signInText}>Sign in</Text>
        </Pressable>
      </View>
    );

  return (
    <View style={styles.screen}>
      <View style={styles.summary}>
        <Text style={styles.subtitle}>Your EaziCart updates</Text>
        <Text style={styles.unreadCount}>
          {unreadCount > 99 ? "99+" : unreadCount} unread
        </Text>
      </View>
      <View style={styles.filters} accessibilityLabel="Notification filters">
        {notificationFilters.map((item) => (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === item.key }}
            onPress={() => setFilter(item.key)}
            style={[styles.filter, filter === item.key && styles.activeFilter]}
          >
            <Text
              style={[
                styles.filterText,
                filter === item.key && styles.activeFilterText,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {list.isError ? (
        <ScreenState
          message={
            list.error instanceof Error
              ? list.error.message
              : "Unable to load notifications"
          }
          retry={() => void list.refetch()}
        />
      ) : (
        <FlatList<Notification>
          data={visible}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              tintColor={colors.orange}
              refreshing={list.isRefetching}
              onRefresh={() => void list.refetch()}
            />
          }
          ListHeaderComponent={
            actionError ? (
              <Text accessibilityRole="alert" style={styles.error}>
                {actionError instanceof Error
                  ? actionError.message
                  : "Unable to mark notification as read"}
              </Text>
            ) : undefined
          }
          ListEmptyComponent={
            <ScreenState
              loading={list.isPending}
              message={
                list.isPending
                  ? "Loading notifications…"
                  : notificationEmptyTitle(filter)
              }
            />
          }
          renderItem={({ item }) => {
            const unread = !item.readAt;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  unread ? `Mark ${item.title} as read` : `${item.title}, read`
                }
                disabled={!unread || busy}
                onPress={() => markRead(item.id)}
                style={[styles.row, unread && styles.unreadRow]}
              >
                <View style={styles.iconWrap}>
                  <Ionicons
                    name={
                      item.type === "ORDER"
                        ? "bag-handle-outline"
                        : item.type === "SOCIAL"
                          ? "heart-outline"
                          : "notifications-outline"
                    }
                    size={20}
                    color={unread ? colors.orange : colors.muted}
                  />
                </View>
                <View style={styles.rowContent}>
                  <View style={styles.titleLine}>
                    <Text style={styles.rowTitle}>{item.title}</Text>
                    {unread ? <View style={styles.dot} /> : null}
                  </View>
                  <Text style={styles.rowBody}>{item.body}</Text>
                  <Text style={styles.timestamp}>
                    {notificationTime(item.createdAt)}
                  </Text>
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            unreadCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                style={[styles.readAll, busy && styles.disabled]}
                onPress={markAllRead}
              >
                <Text style={styles.readAllText}>Mark all as read</Text>
              </Pressable>
            ) : undefined
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  guest: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
    justifyContent: "center",
  },
  signIn: {
    alignSelf: "center",
    paddingHorizontal: 26,
    minHeight: 44,
    borderRadius: 24,
    backgroundColor: colors.orange,
    justifyContent: "center",
  },
  signInText: { color: "white", fontWeight: "800" },
  summary: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  subtitle: { color: colors.muted, fontSize: 13 },
  unreadCount: { color: colors.orange, fontSize: 12, fontWeight: "800" },
  filters: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filter: {
    minHeight: 44,
    borderRadius: 22,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  activeFilter: { backgroundColor: colors.orangePale },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  activeFilterText: { color: colors.orange },
  content: { paddingBottom: 32, flexGrow: 1 },
  row: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  unreadRow: { backgroundColor: colors.orangePale },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  rowContent: { flex: 1, gap: 4 },
  titleLine: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: "800", flex: 1 },
  rowBody: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  timestamp: { color: colors.muted, fontSize: 11, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  error: { color: colors.red, paddingHorizontal: 16, paddingTop: 12 },
  readAll: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    margin: 18,
    borderWidth: 1,
    borderColor: colors.orange,
    borderRadius: 24,
  },
  readAllText: { color: colors.orange, fontWeight: "800" },
  disabled: { opacity: 0.5 },
});
