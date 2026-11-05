export type User = {
  id: string;
  email: string;
  name: string;
  username?: string | null;
  bio?: string | null;
};
export type SessionTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};
export type AuthResponse = { user: User; tokens: SessionTokens };
export type ProductImage = {
  id?: string;
  url: string;
  altText?: string | null;
  position?: number;
};
export type Seller = {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  user?: { id: string; name: string; username?: string | null };
  username?: string | null;
  joinedAt?: string;
  followerCount?: number;
  followingCount?: number;
  rating?: number | null;
  reviewCount?: number;
  soldCount?: number;
};
export type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  originalPrice?: string | null;
  discountPercent?: number | null;
  stock: number;
  images: ProductImage[];
  imageCount?: number;
  viewsLabel?: string;
  category?: { id: string; name: string; slug: string };
  seller: Seller;
  social?: { likes: number; comments: number; liked: boolean };
};
export type FeedPage = {
  data: Product[];
  pagination: { nextCursor: string | null; hasMore: boolean };
};
export type ProductPage = { data: Product };
export type ProductSearchPage = {
  data: Product[];
  pagination: { page: number; limit: number; total: number; pages: number };
};
export type ProductComment = {
  id: string;
  body: string;
  mediaUrl?: string | null;
  user: { id: string; name: string };
  createdAt: string;
  likeCount?: number;
  replyCount?: number;
};
export type CommentPage = {
  data: ProductComment[];
  pagination: { nextCursor: string | null; hasMore: boolean };
};
export type SavedItem = { productId: string };

export type ReelSource = "EAZICART" | "YOUTUBE" | "TIKTOK" | "PARTNER";
export type Reel = {
  id: string;
  source: ReelSource;
  caption?: string | null;
  videoUrl?: string | null;
  thumbnailUrl?: string | null;
  externalUrl?: string | null;
  seller?: Seller | null;
  product?: Product | null;
  _count: { likes: number; saves: number; views: number; comments: number };
};
export type ReelsPage = {
  data: Reel[];
  pagination: { nextCursor: string | null; hasMore: boolean };
};
export type ReelComment = {
  id: string;
  reelId: string;
  body: string;
  createdAt: string;
  user: { id: string; name: string };
};
export type ReelCommentsPage = {
  data: ReelComment[];
  pagination: { nextCursor: string | null; hasMore: boolean };
};
