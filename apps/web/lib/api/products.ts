import { apiRequest } from "./client";
import type { DataResponse, Product } from "./types";
export type ProductQuery = {
  category?: string;
  seller?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc";
  page?: number;
  limit?: number;
};
export const productsApi = {
  list: (query: ProductQuery = {}) =>
    apiRequest<{
      data: Product[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>("/products", { query }),
  get: (id: string) =>
    apiRequest<DataResponse<Product>>(`/products/${encodeURIComponent(id)}`),
};
