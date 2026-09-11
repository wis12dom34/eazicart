import { apiRequest } from "./client";
import type { ListResponse, Product } from "./types";
export type SavedProduct = { userId: string; productId: string; product: Product };
export const savedApi = {
  list: () =>
    apiRequest<ListResponse<SavedProduct>>("/saved-products", { auth: true }),
  save: (id: string) =>
    apiRequest(`/saved-products/${encodeURIComponent(id)}`, {
      method: "POST",
      auth: true,
    }),
  remove: (id: string) =>
    apiRequest<void>(`/saved-products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    }),
};

