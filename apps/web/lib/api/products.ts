import { apiRequest } from "./client";
import type { DataResponse, Image, Product } from "./types";

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

export type ProductInput = {
  name: string;
  description?: string | null;
  price: string;
  stock: number;
  categoryId: string;
  images?: Array<Pick<Image, "url" | "altText" | "position">>;
};

const imageContentType = (file: File) => {
  if (file.type) return file.type;
  if (/\.png$/i.test(file.name)) return "image/png";
  if (/\.webp$/i.test(file.name)) return "image/webp";
  return "image/jpeg";
};

export const productsApi = {
  list: (query: ProductQuery = {}) =>
    apiRequest<{
      data: Product[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>("/products", { query }),
  get: (id: string) =>
    apiRequest<DataResponse<Product>>(`/products/${encodeURIComponent(id)}`),
  sellerList: () =>
    apiRequest<{ data: Product[] }>("/seller/products", { auth: true }),
  uploadImage: (file: File) =>
    apiRequest<{ data: { imageUrl: string } }>("/seller/products/media", {
      method: "POST",
      auth: true,
      rawBody: file,
      headers: { "Content-Type": imageContentType(file) },
      timeoutMs: 60_000,
    }),
  create: (input: ProductInput) =>
    apiRequest<DataResponse<Product>>("/products", {
      method: "POST",
      auth: true,
      body: input,
    }),
  update: (id: string, input: Partial<ProductInput>) =>
    apiRequest<DataResponse<Product>>(`/products/${encodeURIComponent(id)}`, {
      method: "PATCH",
      auth: true,
      body: input,
    }),
  deactivate: (id: string) =>
    apiRequest<void>(`/products/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    }),
};
