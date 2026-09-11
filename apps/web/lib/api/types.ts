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
  address: Address;
  items: OrderItem[];
};
export type Notification = {
  id: string;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
  type?: string;
};
export type Tokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};
export type AuthResponse = { user: User; tokens: Tokens };
export type DataResponse<T> = { data: T };
export type ListResponse<T> = { data: T[] };
