import { apiRequest } from "./client";
import type { Cart, DataResponse } from "./types";
export const cartApi = {
  get: () => apiRequest<DataResponse<Cart>>("/cart", { auth: true }),
  add: (productId: string, quantity: number) =>
    apiRequest<DataResponse<Cart>>("/cart/items", {
      method: "POST",
      auth: true,
      body: { productId, quantity },
    }),
  update: (itemId: string, quantity: number) =>
    apiRequest<DataResponse<Cart>>(
      `/cart/items/${encodeURIComponent(itemId)}`,
      { method: "PATCH", auth: true, body: { quantity } },
    ),
  remove: (itemId: string) =>
    apiRequest<void>(`/cart/items/${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      auth: true,
    }),
  clear: () => apiRequest<void>("/cart", { method: "DELETE", auth: true }),
};
