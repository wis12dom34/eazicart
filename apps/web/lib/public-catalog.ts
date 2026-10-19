import { cache } from "react";
import type { Category, Product, Seller } from "./api/types";

export type PublicResult<T> =
  { status: "ok"; data: T } | { status: "missing" } | { status: "unavailable" };
export type ProductList = {
  data: Product[];
  pagination: { page: number; limit: number; total: number; pages: number; nextCursor: string | null; hasMore: boolean };
};

async function publicFetch<T>(
  path: string,
  revalidate = 0,
): Promise<PublicResult<T>> {
  // No browser tokens, cookies, database credentials or private endpoints.
  const base =
    process.env.EAZICART_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!base) return { status: "unavailable" };
  try {
    const response = await fetch(`${base.replace(/\/$/, "")}${path}`, {
      ...(revalidate > 0
        ? { next: { revalidate } }
        : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) return { status: "missing" };
    if (!response.ok) return { status: "unavailable" };
    return { status: "ok", data: (await response.json()) as T };
  } catch {
    return { status: "unavailable" };
  }
}

// Explicit public DTOs avoid passing extra API/database fields into HTML/RSC.
export function publicSeller(seller: Seller): Seller {
  return {
    id: seller.id,
    userId: seller.userId,
    displayName: seller.displayName,
    bio: seller.bio,
    followerCount: seller.followerCount,
    _count: seller._count ? { products: seller._count.products } : undefined,
  };
}
export function publicProduct(product: Product): Product {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: String(product.price),
    stock: product.stock,
    active: product.active,
    rating: product.rating,
    soldLabel: product.soldLabel,
    viewsLabel: product.viewsLabel,
    images: product.images.map(({ url, altText, position }) => ({
      url,
      altText,
      position,
    })),
    category: {
      id: product.category.id,
      name: product.category.name,
      slug: product.category.slug,
    },
    seller: publicSeller(product.seller),
  };
}

export const getPublicProduct = cache(
  async (id: string): Promise<PublicResult<Product>> => {
    const result = await publicFetch<{ data: Product }>(
      `/products/${encodeURIComponent(id)}`,
    );
    if (result.status !== "ok") return result;
    try {
      if (result.data.data.active === false) return { status: "missing" };
      return { status: "ok", data: publicProduct(result.data.data) };
    } catch {
      return { status: "unavailable" };
    }
  },
);
export const getPublicSeller = cache(
  async (id: string): Promise<PublicResult<Seller>> => {
    const result = await publicFetch<{ data: Seller }>(
      `/sellers/${encodeURIComponent(id)}`,
    );
    if (result.status !== "ok") return result;
    try {
      return { status: "ok", data: publicSeller(result.data.data) };
    } catch {
      return { status: "unavailable" };
    }
  },
);
export const getPublicProducts = cache(
  async (query = "", revalidate = 0): Promise<PublicResult<ProductList>> => {
    const result = await publicFetch<ProductList>(
      `/products${query ? `?${query}` : ""}`,
      revalidate,
    );
    if (result.status !== "ok") return result;
    try {
      return {
        status: "ok",
        data: {
          ...result.data,
          data: result.data.data
            .filter((p) => p.active !== false)
            .map(publicProduct),
        },
      };
    } catch {
      return { status: "unavailable" };
    }
  },
);
export const getPublicFeed = cache(
  async (limit = 40, revalidate = 30): Promise<PublicResult<ProductList>> => {
    const result = await publicFetch<{
      data: Product[];
      pagination?: { nextCursor: string | null; hasMore: boolean };
    }>(`/feed/products?limit=${Math.max(1, Math.min(limit, 100))}`, revalidate);
    if (result.status !== "ok") return result;
    try {
      const data = result.data.data
        .filter((p) => p.active !== false)
        .map(publicProduct);
      return {
        status: "ok",
        data: {
          data,
          pagination: {
            page: 1,
            limit,
            total: data.length,
            pages: 1,
            nextCursor: result.data.pagination?.nextCursor ?? null,
            hasMore: result.data.pagination?.hasMore ?? false,
          },
        },
      };
    } catch {
      return { status: "unavailable" };
    }
  },
);
export const getPublicCategories = cache(
  async (): Promise<PublicResult<Category[]>> => {
    const result = await publicFetch<{ data: Category[] }>("/categories");
    if (result.status !== "ok") return result;
    try {
      return {
        status: "ok",
        data: result.data.data.map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          _count: c._count ? { products: c._count.products } : undefined,
        })),
      };
    } catch {
      return { status: "unavailable" };
    }
  },
);
