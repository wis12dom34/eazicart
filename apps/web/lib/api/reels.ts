import { apiRequest } from "./client";
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
      sellerId?: string;
      authenticated?: boolean;
    } = {},
  ) => {
    const response = await apiRequest<Partial<ReelsFeedResponse>>(
      "/reels/feed",
      {
        auth: params.authenticated === true,
        query: {
          cursor: params.cursor,
          limit: params.limit ?? 8,
          source: params.source,
          productId: params.productId,
          reelId: params.reelId,
          sellerId: params.sellerId,
        },
      },
    );

    if (!response.pagination || !Array.isArray(response.data)) {
      throw new Error("Could not load Reels. Please try again.");
    }
    if (
      response.data.some(
        (reel) =>
          (params.productId && reel.product?.id !== params.productId) ||
          (params.reelId && reel.id !== params.reelId),
      )
    ) {
      throw new Error("Could not load the requested Reel. Please try again.");
    }
    return response as ReelsFeedResponse;
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
    try {
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
    } catch {
      // Do not block the composer just because comment history failed to load.
      // Posting still uses the authenticated POST endpoint and will surface its own error.
      return {
        data: [],
        pagination: { nextCursor: null, hasMore: false },
      };
    }
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

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]