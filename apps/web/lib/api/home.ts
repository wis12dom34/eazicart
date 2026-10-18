import { apiRequest } from "./client";

export type HomeState = {
  cartCount: number;
  unreadCount: number;
  savedProductIds: string[];
};

export const homeApi = {
  state: () => apiRequest<{ data: HomeState }>("/home/state", { auth: true }),
};