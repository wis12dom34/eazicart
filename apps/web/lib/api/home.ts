import { apiRequest } from "./client";

export type HomeState = {
  cartCount: number;
  unreadCount: number;
  savedProductIds: string[];
};

export const homeApi = {
  state: () => apiRequest<{ data: HomeState }>("/home/state", { auth: true }),
};

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]