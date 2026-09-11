import { apiRequest } from "./client";
import type { Notification } from "./types";
export const notificationsApi = {
  list: () =>
    apiRequest<{ data: Notification[]; meta: { unreadCount: number } }>(
      "/notifications",
      { auth: true },
    ),
  read: (id: string) =>
    apiRequest(`/notifications/${encodeURIComponent(id)}/read`, {
      method: "PATCH",
      auth: true,
    }),
  readAll: () =>
    apiRequest<{ data: { updated: number } }>("/notifications/read-all", {
      method: "PATCH",
      auth: true,
    }),
};
