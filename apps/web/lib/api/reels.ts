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

export type ReelComment = {
  id: string;
  body: string;
  reelId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
};

export type ReelsFeedResponse = {
  data: Reel[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export type ReelCommentsResponse = {
  data: ReelComment[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

const legacyProductReel = (product: Product): Reel => ({
  id: `legacy-product-${product.id}`,
  source: "EAZICART",
  caption: product.reel?.caption ?? null,
  videoUrl: null,
  thumbnailUrl: product.images[0]?.url ?? null,
  externalUrl: null,
  attribution: product.seller.displayName,
  publishedAt: null,
  seller: product.seller,
  product,
  _count: { likes: 0, saves: 0, views: 0, comments: 0 },
});

const legacyProductReels = (products: Product[]): ReelsFeedResponse => ({
  data: products.filter((product) => product.reel).map(legacyProductReel),
  pagination: { nextCursor: null, hasMore: false },
});

export const reelsApi = {
  upload: (file: File) =>
    apiRequest<{ data: { videoUrl: string } }>("/seller/reels/media", {
      method: "POST",
      auth: true,
      rawBody: file,
      headers: {
        "Content-Type":
          file.type ||
          (/\.mov$/i.test(file.name)
            ? "video/quicktime"
            : /\.webm$/i.test(file.name)
              ? "video/webm"
              : "video/mp4"),
      },
      timeoutMs: 120_000,
    }),
  publish: (input: {
    idempotencyKey?: string;
    videoUrl: string;
    caption?: string;
    productId?: string;
  }) =>
    apiRequest<{ data: Reel }>("/reels", {
      method: "POST",
      auth: true,
      body: input,
      timeoutMs: 60_000,
    }),
  feed: async (
    params: {
      cursor?: string;
      limit?: number;
      source?: ReelSource;
      productId?: string;
      reelId?: string;
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
          reelId: params.reelId,
        },
      },
    );

    const productScopeMatches =
      !params.productId ||
      response.data?.some((reel) => reel.product?.id === params.productId);
    const reelScopeMatches =
      !params.reelId ||
      response.data?.some((reel) => reel.id === params.reelId);
    const scopedFeedMatches =
      response.data?.length === 0 || (productScopeMatches && reelScopeMatches);
    if (
      response.pagination &&
      Array.isArray(response.data) &&
      scopedFeedMatches
    ) {
      return response as ReelsFeedResponse;
    }

    if (params.reelId) {
      return {
        data: [],
        pagination: { nextCursor: null, hasMore: false },
      };
    }

    if (params.productId) {
      const product = await productsApi
        .get(params.productId)
        .then((result) => result.data);
      return {
        data: product.reel ? [legacyProductReel(product)] : [],
        pagination: { nextCursor: null, hasMore: false },
      };
    }

    const products = await productsApi
      .list({ limit: params.limit ?? 8 })
      .then((result) => result.data);
    return legacyProductReels(products);
  },
  interactions: (reelId: string) =>
    apiRequest<{ data: { liked: boolean; saved: boolean } }>(
      `/reels/${reelId}/interactions`,
      { auth: true },
    ),
  like: (reelId: string) =>
    apiRequest<{ data: { liked: true; count: number } }>(
      `/reels/${reelId}/like`,
      { method: "POST", auth: true },
    ),
  unlike: (reelId: string) =>
    apiRequest<{ data: { liked: false; count: number } }>(
      `/reels/${reelId}/like`,
      { method: "DELETE", auth: true },
    ),
  save: (reelId: string) =>
    apiRequest<{ data: { saved: true; count: number } }>(
      `/reels/${reelId}/save`,
      { method: "POST", auth: true },
    ),
  unsave: (reelId: string) =>
    apiRequest<{ data: { saved: false; count: number } }>(
      `/reels/${reelId}/save`,
      { method: "DELETE", auth: true },
    ),
  comments: async (
    reelId: string,
    params: { cursor?: string; limit?: number } = {},
  ): Promise<ReelCommentsResponse> => {
    const response = await apiRequest<Partial<ReelCommentsResponse>>(
      `/reels/${reelId}/comments`,
      {
        query: { cursor: params.cursor, limit: params.limit ?? 30 },
      },
    );
    return {
      data: response.data ?? [],
      pagination: response.pagination ?? { nextCursor: null, hasMore: false },
    };
  },
  comment: (reelId: string, body: string) =>
    apiRequest<{ data: ReelComment }>(`/reels/${reelId}/comments`, {
      method: "POST",
      auth: true,
      body: { body },
    }),
  view: (reelId: string, watchMs = 0, completed = false) =>
    apiRequest<{
      data: {
        id: string;
        watchMs: number;
        completed: boolean;
        createdAt: string;
      };
    }>(`/reels/${reelId}/views`, {
      method: "POST",
      auth: true,
      body: { watchMs, completed },
    }),
};
