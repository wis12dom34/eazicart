"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Icon } from "../components/icon";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { notificationsApi } from "../../lib/api/notifications";
import type { Notification } from "../../lib/api/types";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import styles from "./notifications.module.css";

type Filter = "ALL" | "ORDER" | "SOCIAL" | "SYSTEM";

const filters: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ORDER", label: "Orders" },
  { key: "SOCIAL", label: "Social" },
  { key: "SYSTEM", label: "Updates" },
];

export default function Notifications() {
  const auth = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [actionError, setActionError] = useState("");
  const result = useRequest(
    async () =>
      auth.isAuthenticated
        ? notificationsApi.list()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const notifications = result.data?.data ?? [];
  const visible = useMemo(
    () =>
      filter === "ALL"
        ? notifications
        : notifications.filter((notification) => notification.type === filter),
    [filter, notifications],
  );

  const markRead = async (id: string) => {
    try {
      setActionError("");
      await notificationsApi.read(id);
      await result.reload();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update notification",
      );
    }
  };

  const markAllRead = async () => {
    try {
      setActionError("");
      await notificationsApi.readAll();
      await result.reload();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update notifications",
      );
    }
  };

  return (
    <main className={`app-shell ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Link
            className={styles.back}
            href="/profile"
            aria-label="Back to profile"
          >
            <Icon name="back" size={22} />
          </Link>
          <h1>Notifications</h1>
        </div>
        <p>Orders, messages and updates</p>
      </header>

      {auth.loading || result.loading ? (
        <LoadingState />
      ) : !auth.isAuthenticated ? (
        <SignInState message="Sign in to view your notifications." />
      ) : result.error ? (
        <ErrorState message={result.error} retry={() => void result.reload()} />
      ) : (
        <div className={styles.content}>
          <div className={styles.filters} aria-label="Notification filters">
            {filters.map((item) => (
              <button
                key={item.key}
                className={
                  filter === item.key ? styles.filterActive : styles.filter
                }
                type="button"
                aria-pressed={filter === item.key}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {actionError ? (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          ) : null}

          {!visible.length ? (
            <section className={styles.empty} aria-label="No notifications">
              <span className={styles.emptyIcon}>
                <Icon name="bell" size={22} />
              </span>
              <h2>{emptyTitle(filter)}</h2>
              <p>New notifications will appear here when they are available.</p>
            </section>
          ) : (
            <section className={styles.list} aria-label="Notifications">
              {visible.map((notification) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                  onRead={() => void markRead(notification.id)}
                />
              ))}
            </section>
          )}

          {result.data?.meta.unreadCount ? (
            <button
              className={styles.readAll}
              type="button"
              aria-label="Read all"
              onClick={() => void markAllRead()}
            >
              Mark all as read
            </button>
          ) : null}
        </div>
      )}
    </main>
  );
}

function NotificationCard({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const icon =
    notification.type === "ORDER"
      ? "bag"
      : notification.type === "SOCIAL"
        ? "users"
        : "bell";

  return (
    <button
      className={`${styles.card} ${notification.readAt ? styles.read : styles.unread}`}
      type="button"
      disabled={Boolean(notification.readAt)}
      onClick={onRead}
      aria-label={
        notification.readAt
          ? `${notification.title}, read`
          : `Mark ${notification.title} as read`
      }
    >
      <span className={styles.cardIcon} aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.cardCopy}>
        <strong>{notification.title}</strong>
        <span>{notification.body}</span>
      </span>
      <time className={styles.time} dateTime={notification.createdAt}>
        {relativeTime(notification.createdAt)}
      </time>
    </button>
  );
}

function emptyTitle(filter: Filter) {
  if (filter === "ORDER") return "No order notifications";
  if (filter === "SOCIAL") return "No social notifications";
  if (filter === "SYSTEM") return "No update notifications";
  return "You have no notifications";
}

function relativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
