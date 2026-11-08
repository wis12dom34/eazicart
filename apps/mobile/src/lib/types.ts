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
export type Category = {
  id: string;
  name: string;
  slug: string;
};
export type SellerProductInput = {
  name: string;
  description: string;
  price: string;
  originalPrice: string | null;
  stock: number;
  categoryId: string;
};
export type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: string;
  originalPrice?: string | null;
  discountPercent?: number | null;
  stock: number;
  active?: boolean;
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

export type StoryMedia = {
  id: string;
  url: string;
  uploadedAt: string;
  contentType?: string;
};
export type StoryPreviewResponse = { data: Record<string, StoryMedia> };
export type StoryListResponse = { data: StoryMedia[] };

export type FollowRecord = {
  followerId: string;
  sellerId: string;
  seller: {
    id: string;
    name: string;
    sellerProfile?: Seller | null;
  };
};
export type FollowingResponse = { data: FollowRecord[] };
export type FollowerCountResponse = { data: { count: number } };

export type CartItem = {
  id: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  product: Product;
  variantLabel?: string | null;
};
export type Cart = {
  id: string;
  items: CartItem[];
  subtotal: string;
  total: string;
  delivery?: string | null;
  serviceFee?: string | null;
};
export type Address = {
  id: string;
  label?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};
export type AddressInput = Omit<Address, "id">;
export type OrderSummary = {
  id: string;
  status: string;
  createdAt: string;
  total: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: string;
  }>;
  address: Address;
};

export type SellerDashboard = {
  seller: { id: string; displayName: string };
  inventory: {
    totalProducts: number;
    activeProducts: number;
    outOfStockProducts: number;
    unitsInStock: number;
  };
  orders: {
    total: number;
    pending: number;
    confirmed: number;
    fulfilled: number;
    cancelled: number;
  };
  customers: { total: number };
  analytics: {
    revenue: Array<{ currency: string; gross: string }>;
  };
};

export type SellerFulfillmentStatus =
  "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";

export type SellerOrder = {
  id: string;
  status: SellerFulfillmentStatus;
  globalStatus: string;
  createdAt: string;
  updatedAt: string;
  customer: { name: string };
  address: Address;
  subtotal: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    product: { id: string; images: ProductImage[] };
  }>;
};

export type Conversation = {
  id: string;
  buyerId: string;
  sellerId: string;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
  buyerReadAt?: string | null;
  sellerReadAt?: string | null;
  buyerBlockedAt?: string | null;
  sellerBlockedAt?: string | null;
  buyer: { id: string; name: string };
  seller: {
    id: string;
    name: string;
    sellerProfile?: { displayName: string } | null;
  };
};
export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  clientMessageId: string;
  productId?: string | null;
  product?: {
    id: string;
    name: string;
    price: string;
    active: boolean;
    images: Array<{ url: string }>;
  } | null;
  createdAt: string;
};
export type ChatPage = {
  data: ChatMessage[];
  pagination: { hasMore: boolean; nextCursor: string | null };
};

export type Notification = {
  id: string;
  type?: string | null;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
};
export type NotificationListResponse = {
  data: Notification[];
  meta: { unreadCount: number };
};
