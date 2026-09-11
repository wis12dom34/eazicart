import { apiRequest } from "./client";
import type { ListResponse, Seller } from "./types";
export type Follow = {
  followerId: string;
  sellerId: string;
  seller: { id: string; name: string; sellerProfile?: Seller | null };
};
export const followsApi = {
  list: () => apiRequest<ListResponse<Follow>>("/following", { auth: true }),
  follow: (id: string) =>
    apiRequest(`/sellers/${encodeURIComponent(id)}/follow`, {
      method: "POST",
      auth: true,
    }),
  unfollow: (id: string) =>
    apiRequest<void>(`/sellers/${encodeURIComponent(id)}/follow`, {
      method: "DELETE",
      auth: true,
    }),
  count: (id: string) =>
    apiRequest<{ data: { count: number } }>(
      `/sellers/${encodeURIComponent(id)}/followers/count`,
    ),
};

