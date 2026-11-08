import type { Notification } from "./types";

export type NotificationFilter = "ALL" | "ORDER" | "SOCIAL" | "SYSTEM";

export const notificationFilters: ReadonlyArray<{
  key: NotificationFilter;
  label: string;
}> = [
  { key: "ALL", label: "All" },
  { key: "ORDER", label: "Orders" },
  { key: "SOCIAL", label: "Social" },
  { key: "SYSTEM", label: "Updates" },
];

export function filterNotifications(
  notifications: Notification[],
  filter: NotificationFilter,
): Notification[] {
  return filter === "ALL"
    ? notifications
    : notifications.filter((item) => item.type === filter);
}

export function notificationEmptyTitle(filter: NotificationFilter): string {
  switch (filter) {
    case "ORDER":
      return "No order notifications";
    case "SOCIAL":
      return "No social notifications";
    case "SYSTEM":
      return "No update notifications";
    default:
      return "You have no notifications";
  }
}

export function notificationTime(value: string, now = Date.now()): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 60) return "Now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 172800) return "Yesterday";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
