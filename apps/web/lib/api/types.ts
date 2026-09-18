export type Money = string;
export type User = { id: string; email: string; name: string };
export type Image = {
  id?: string;
  url: string;
  altText?: string | null;
  position?: number;
};
export type Category = {
  id: string;
  name: string;
  slug: string;
  _count?: { products: number };
};
export type Seller = {
  id: string;
  userId: string;
  displayName: string;
  bio?: string | null;
  user?: { id: string; name: string };
  followerCount?: number;
  _count?: { products: number };
};
export type Product = {
  id: string;
  name: string;
  description?: string | null;
  price: Money;
  stock: number;
  active?: boolean;
  images: Image[];
  category: Category;
  seller: Seller & { user?: { id: string; name: string } };
};
export type CartItem = {
  id: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
  product: Product;
};
export type Cart = {
  id: string;
  items: CartItem[];
  subtotal: Money;
  total: Money;
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
export type OrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  product?: Product;
};
export type Order = {
  id: string;
  status: string;
  total: Money;
  createdAt: string;
  updatedAt: string;
  address: Address;
  items: OrderItem[];
};
export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "REVIEW_REQUIRED";
export type Payment = {
  id: string;
  orderId: string;
  reference: string;
  status: PaymentStatus;
  amount: Money;
  currency: string;
  authorizationUrl?: string | null;
  paidAt?: string | null;
  failureReason?: string | null;
};
export type SellerFulfillmentStatus =
  "PENDING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";
export type SellerOrderItem = {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: Money;
  product: { id: string; images: Image[] };
};
export type SellerOrder = {
  id: string;
  status: SellerFulfillmentStatus;
  globalStatus: string;
  subtotal: Money;
  createdAt: string;
  updatedAt: string;
  customer: { name: string };
  address: Address;
  items: SellerOrderItem[];
};
export type SellerCustomerLocation = {
  city: string;
  region: string;
  country: string;
};
export type SellerCustomer = {
  id: string;
  name: string;
  orders: number;
  units: number;
  firstOrderAt: string;
  latestOrderAt: string;
  location: SellerCustomerLocation;
};
export type SellerCustomerOrder = {
  id: string;
  status: string;
  createdAt: string;
  units: number;
  items: Array<{ productName: string; quantity: number }>;
};
export type SellerCustomerDetail = {
  customer: SellerCustomer;
  orders: SellerCustomerOrder[];
};
export type Notification = {
  id: string;
  title: string;
  body: string;
  readAt?: string | null;
  createdAt: string;
  type?: string;
};
export type SellerDashboard = {
  seller: Pick<Seller, "id" | "displayName">;
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
    revenue: null;
    productViews: null;
    impressions: null;
    profileVisits: null;
    clicks: null;
    conversionRate: null;
  };
};
export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};
export type AuthResponse = { user: User; tokens: Tokens };
export type DataResponse<T> = { data: T };
export type ListResponse<T> = { data: T[] };
