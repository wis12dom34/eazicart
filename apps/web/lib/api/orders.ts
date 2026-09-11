import { apiRequest } from "./client";
import type { DataResponse, ListResponse, Order } from "./types";
export const ordersApi = {
  list: () => apiRequest<ListResponse<Order>>("/orders", { auth: true }),
  get: (id: string) =>
    apiRequest<DataResponse<Order>>(`/orders/${encodeURIComponent(id)}`, {
      auth: true,
    }),
  create: (addressId: string) =>
    apiRequest<DataResponse<Order>>("/orders", {
      method: "POST",
      auth: true,
      body: { addressId },
    }),
};
