import { apiRequest } from "./client";
export type ReviewProduct = {
  id: string;
  name: string;
  active: boolean;
  imageUrl: string | null;
};
export type ProductReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string };
  product: ReviewProduct;
  orderItemId?: string;
};
export type ReviewPage<T> = {
  data: T[];
  pagination: { hasMore: boolean; nextCursor: string | null };
};
export type PublicReviewPage = ReviewPage<ProductReview> & {
  summary: { count: number; average: number | null };
};
export type EligibleReview = {
  orderItemId: string;
  orderId: string;
  product: ReviewProduct;
};
export type ReviewInput = { rating: number; body: string };
export const reviewsApi = {
  product: (id: string, cursor?: string) =>
    apiRequest<PublicReviewPage>(
      `/products/${encodeURIComponent(id)}/reviews`,
      { query: { cursor } },
    ),
  seller: (id: string, cursor?: string) =>
    apiRequest<PublicReviewPage>(`/sellers/${encodeURIComponent(id)}/reviews`, {
      query: { cursor },
    }),
  mine: (cursor?: string) =>
    apiRequest<ReviewPage<ProductReview>>("/reviews/mine", {
      auth: true,
      query: { cursor },
    }),
  eligible: (cursor?: string) =>
    apiRequest<ReviewPage<EligibleReview>>("/reviews/eligible", {
      auth: true,
      query: { cursor },
    }),
  create: (orderItemId: string, body: ReviewInput) =>
    apiRequest<{ data: ProductReview }>("/reviews", {
      auth: true,
      method: "POST",
      body: { orderItemId, ...body },
    }),
  update: (id: string, body: ReviewInput) =>
    apiRequest<{ data: ProductReview }>(`/reviews/${encodeURIComponent(id)}`, {
      auth: true,
      method: "PATCH",
      body,
    }),
  remove: (id: string) =>
    apiRequest<void>(`/reviews/${encodeURIComponent(id)}`, {
      auth: true,
      method: "DELETE",
    }),
};