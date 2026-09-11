import { apiRequest } from "./client";
import type { DataResponse, ListResponse, Product, Seller } from "./types";
export const sellersApi = {
  list: () => apiRequest<ListResponse<Seller>>("/sellers"),
  get: (id: string) =>
    apiRequest<DataResponse<Seller>>(`/sellers/${encodeURIComponent(id)}`),
  products: (id: string) =>
    apiRequest<ListResponse<Product>>(
      `/sellers/${encodeURIComponent(id)}/products`,
    ),
};
