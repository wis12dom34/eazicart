/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
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
  const unreadCount = result.data?.meta.unreadCount ?? 0;
  const visible =
    filter === "ALL"
      ? notifications
      : notifications.filter((notification) => notification.type === filter);

  const markRead = async (id: string) => {
    try {
      setActionError("");
      await notificationsApi.read(id);
      await result.reload();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to update notification",
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
    <main
      className={`app-shell with-nav ${styles.page}`}
      data-figma-node="32:2"
    >
      <header className={styles.header}>
        <Link
          className={styles.back}
          href="/profile"
          aria-label="Back to profile"
        >
          <img src="/figma/back.svg" width={20} height={20} alt="" />
        </Link>
        <h1>Notifications</h1>
        <span className={styles.headerBell} aria-hidden="true">
          <img src="/figma/explore-bell.svg" width={22} height={22} alt="" />
          {unreadCount > 0 ? (
            <span className={styles.unreadBadge}>
              {badgeCount(unreadCount)}
            </span>
          ) : null}
        </span>
      </header>

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

      <div className={styles.contentViewport}>
        {auth.loading || result.loading ? (
          <div className={styles.stateWrap}>
            <LoadingState />
          </div>
        ) : !auth.isAuthenticated ? (
          <div className={styles.stateWrap}>
            <SignInState
              message="Sign in to view your notifications."
              next="/notifications"
            />
          </div>
        ) : result.error ? (
          <div className={styles.stateWrap}>
            <ErrorState
              message={result.error}
              retry={() => void result.reload()}
            />
          </div>
        ) : (
          <div className={styles.content}>
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
                <p>
                  New notifications will appear here when they are available.
                </p>
              </section>
            ) : (
              <section className={styles.list} aria-label="Notifications">
                {visible.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    onRead={() => void markRead(notification.id)}
                  />
                ))}
              </section>
            )}

            {unreadCount > 0 ? (
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
      </div>

      <BottomNavigation />
    </main>
  );
}

function NotificationRow({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: () => void;
}) {
  const unread = !notification.readAt;

  return (
    <button
      className={`${styles.row} ${unread ? styles.unread : styles.read}`}
      type="button"
      disabled={!unread}
      onClick={onRead}
      aria-label={
        unread
          ? `Mark ${notification.title} as read`
          : `${notification.title}, read`
      }
    >
      <span
        className={`${styles.rowIcon} ${unread && notification.type === "ORDER" ? styles.rowIconActive : ""}`}
        aria-hidden="true"
      />
      {unread ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
      <strong className={styles.rowTitle}>{notification.title}</strong>
      <span className={styles.rowBody}>{notification.body}</span>
      <time className={styles.time} dateTime={notification.createdAt}>
        {relativeTime(notification.createdAt)}
      </time>
      <span className={styles.divider} aria-hidden="true" />
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
  if (seconds < 60) return "Now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 172800) return "Yesterday";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function badgeCount(value: number) {
  return value > 99 ? "99+" : String(value);
}
