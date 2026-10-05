import { apiRequest } from "./client";
import { productsApi } from "./products";
import type { Product, Seller } from "./types";

export type ReelSource = "EAZICART" | "YOUTUBE" | "TIKTOK" | "PARTNER";

export type Reel = {
  id: string;
  source: ReelSource;
  caption?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  externalUrl?: string | null;
  attribution?: string | null;
  publishedAt?: string | null;
  seller?: (Seller & { user?: { id: string; name: string } }) | null;
  product?: Product | null;
  _count: {
    likes: number;
    saves: number;
    views: number;
    comments: number;
  };
};

export type ReelsFeedResponse = {
  data: Reel[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

const legacyProductReels = (products: Product[]): ReelsFeedResponse => ({
  data: products
    .filter((product) => product.reel)
    .map((product) => ({
      id: `legacy-product-${product.id}`,
      source: "EAZICART" as const,
      caption: product.reel?.caption ?? null,
      videoUrl: null,
      thumbnailUrl: product.images[0]?.url ?? null,
      externalUrl: null,
      attribution: product.seller.displayName,
      publishedAt: null,
      seller: product.seller,
      product,
      _count: { likes: 0, saves: 0, views: 0, comments: 0 },
    })),
  pagination: { nextCursor: null, hasMore: false },
});

export const reelsApi = {
  feed: async (
    params: {
      cursor?: string;
      limit?: number;
      source?: ReelSource;
      productId?: string;
    } = {},
  ) => {
    const response = await apiRequest<Partial<ReelsFeedResponse>>(
      "/reels/feed",
      {
        query: {
          cursor: params.cursor,
          limit: params.limit ?? 8,
          source: params.source,
          productId: params.productId,
        },
      },
    );

    const scopedFeedMatches =
      !params.productId ||
      response.data?.some((reel) => reel.product?.id === params.productId);
    if (
      response.pagination &&
      Array.isArray(response.data) &&
      scopedFeedMatches
    ) {
      return response as ReelsFeedResponse;
    }

    const products = params.productId
      ? [await productsApi.get(params.productId).then((result) => result.data)]
      : await productsApi
          .list({ limit: params.limit ?? 8 })
          .then((result) => result.data);
    return legacyProductReels(products);
  },
};
