"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon, type IconName } from "../components/icon";
import { SignInState } from "../components/async-state";
import { notificationsApi } from "../../lib/api/notifications";
import type { Notification } from "../../lib/api/types";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import styles from "./notifications.module.css";

type Filter = "ALL" | "ORDER" | "SOCIAL" | "SYSTEM";

const filters: Array<{ key: Filter; label: string }> = [
  { key: "ALL", label: "All" },
  { key: "ORDER", label: "Orders" },
  { key: "SOCIAL", label: "Messages" },
  { key: "SYSTEM", label: "Promos" },
];

export default function Notifications() {
  const auth = useAuth();
  return <NotificationScreen key={auth.user?.id ?? "signed-out"} auth={auth} />;
}

function NotificationScreen({ auth }: { auth: ReturnType<typeof useAuth> }) {
  const [filter, setFilter] = useState<Filter>("ALL");
  const [actionError, setActionError] = useState("");
  const [pendingRead, setPendingRead] = useState<string | null>(null);
  const [confirmedReadIds, setConfirmedReadIds] = useState<Set<string>>(() => new Set());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refreshTime = () => {
      if (document.visibilityState !== "hidden") setNow(Date.now());
    };
    const interval = window.setInterval(refreshTime, 60_000);
    document.addEventListener("visibilitychange", refreshTime);
    window.addEventListener("focus", refreshTime);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshTime);
      window.removeEventListener("focus", refreshTime);
    };
  }, []);
  const result = useRequest(
    async () => auth.isAuthenticated ? notificationsApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const notifications = result.data?.data ?? [];
  const unreadCount = result.data?.meta.unreadCount ?? 0;
  const visible = filter === "ALL" ? notifications : notifications.filter((notification) => notification.type === filter);

  const markRead = async (id: string) => {
    if (pendingRead) return;
    setPendingRead(id);
    try {
      setActionError("");
      const response = await notificationsApi.read(id);
      result.setData((current) => current ? {
        ...current,
        data: current.data.map((notification) => notification.id === id ? response.data : notification),
        meta: { unreadCount: Math.max(0, current.meta.unreadCount - 1) },
      } : current);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update notification");
    } finally {
      setPendingRead(null);
    }
  };

  const markAllRead = async () => {
    if (pendingRead) return;
    setPendingRead("all");
    try {
      setActionError("");
      await notificationsApi.readAll();
      setConfirmedReadIds(new Set(notifications.map((notification) => notification.id)));
      result.setData((current) => current ? { ...current, meta: { unreadCount: 0 } } : current);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to update notifications");
    } finally {
      setPendingRead(null);
    }
  };

  const loading = auth.loading || result.loading;
  const failed = !loading && auth.isAuthenticated && Boolean(result.error);
  const empty = !loading && !failed && auth.isAuthenticated && !visible.length;
  const stateNode = loading ? "229:76" : failed ? "229:116" : empty ? "229:50" : "32:2";

  return (
    <main className={`app-shell with-nav ${styles.page} ${loading || empty || failed ? styles.statePage : ""} ${failed ? styles.failedPage : ""}`} data-figma-node={stateNode}>
      <header className={styles.header}>
        <Link className={styles.back} href="/profile" aria-label="Back to profile">
          <Icon name="back" size={22} />
        </Link>
        <h1>Notifications</h1>
        <span className={styles.headerBell} aria-hidden="true">
          <Icon name="bell" size={24} active={unreadCount > 0} />
          {unreadCount > 0 ? <span className={styles.unreadBadge}>{badgeCount(unreadCount)}</span> : null}
        </span>
      </header>

      <div className={styles.filters} aria-label="Notification filters" hidden={failed}>
        {filters.map((item) => (
          <button key={item.key} className={filter === item.key ? styles.filterActive : styles.filter} type="button" aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className={styles.contentViewport}>
        {loading ? (
          <section className={styles.loading} role="status" aria-label="Loading notifications" aria-busy="true">
            {Array.from({ length: 4 }, (_, index) => (
              <div className={styles.skeletonRow} key={index} aria-hidden="true">
                <span className={styles.skeletonAvatar} /><span className={styles.skeletonTitle} /><span className={styles.skeletonBody} /><span className={styles.skeletonDivider} />
              </div>
            ))}
            <p>Loading notifications…</p>
          </section>
        ) : !auth.isAuthenticated ? (
          <div className={styles.stateWrap}><SignInState message="Sign in to view your notifications." /></div>
        ) : result.error ? (
          <section className={styles.failure} role="alert">
            <span aria-hidden="true"><Icon name="error" size={40} /></span>
            <h2>Could not load notifications</h2><p>Check your connection and try again.</p>
            <button type="button" onClick={() => void result.reload()}>Try again</button>
          </section>
        ) : (
          <div className={styles.content}>
            {actionError ? <p className={styles.error} role="alert">{actionError}</p> : null}
            {!visible.length ? (
              <section className={styles.empty} aria-label="No notifications">
                <span className={styles.emptyIcon} aria-hidden="true"><Icon name="bell" size={40} /></span>
                <h2>{emptyTitle(filter)}</h2><p>Order updates, replies and offers will appear here.</p>
              </section>
            ) : (
              <section className={styles.list} aria-label="Notifications">
                {visible.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} read={Boolean(notification.readAt) || confirmedReadIds.has(notification.id)} now={now} pending={Boolean(pendingRead)} onRead={() => void markRead(notification.id)} />
                ))}
              </section>
            )}
            {unreadCount > 0 ? (
              <button className={styles.readAll} type="button" aria-label="Read all" disabled={Boolean(pendingRead)} onClick={() => void markAllRead()}>Mark all as read</button>
            ) : null}
          </div>
        )}
      </div>
      <BottomNavigation />
    </main>
  );
}

function NotificationRow({ notification, onRead, pending, read, now }: { notification: Notification; onRead: () => void; pending: boolean; read: boolean; now: number }) {
  const unread = !read;
  return (
    <button className={`${styles.row} ${unread ? styles.unread : styles.read}`} type="button" disabled={!unread || pending} onClick={onRead} aria-label={unread ? `Mark ${notification.title} as read` : `${notification.title}, read`}>
      <span className={`${styles.rowIcon} ${unread && notification.type === "ORDER" ? styles.rowIconActive : ""}`} aria-hidden="true">
        <Icon name={notificationIcon(notification.type)} size={20} active={unread} />
      </span>
      {unread ? <span className={styles.unreadDot} aria-hidden="true" /> : null}
      <strong className={styles.rowTitle}>{notification.title}</strong>
      <span className={styles.rowBody}>{notification.body}</span>
      <time className={styles.time} dateTime={notification.createdAt}>{relativeTime(notification.createdAt, now)}</time>
      <span className={styles.divider} aria-hidden="true" />
    </button>
  );
}

function notificationIcon(type: Notification["type"]): IconName {
  if (type === "ORDER") return "box";
  if (type === "SOCIAL") return "message";
  return "bell";
}

function emptyTitle(filter: Filter) {
  if (filter === "ORDER") return "No order notifications";
  if (filter === "SOCIAL") return "No message notifications";
  if (filter === "SYSTEM") return "No promo notifications";
  return "No notifications yet";
}

function relativeTime(value: string, now: number) {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 172800) return "Yesterday";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function badgeCount(value: number) { return value > 99 ? "99+" : String(value); }
