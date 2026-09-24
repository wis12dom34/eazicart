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
  publishedAt: string;
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

export const reelsApi = {
  feed: (params: { cursor?: string; limit?: number; source?: ReelSource } = {}) =>
    apiRequest<ReelsFeedResponse>("/reels/feed", {
      query: {
        cursor: params.cursor,
        limit: params.limit ?? 8,
        source: params.source,
      },
    }),
};
