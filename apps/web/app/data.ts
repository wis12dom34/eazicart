export type Product = {
  id: string;
  name: string;
  brand: string;
  price: number;
  oldPrice?: number;
  rating: number;
  reviews: number;
  image: string;
  color: string;
};

export const products: Product[] = [
  {
    id: "woven-tote",
    name: "Mini Woven Tote",
    brand: "Aria Studio",
    price: 48500,
    oldPrice: 56000,
    rating: 4.9,
    reviews: 128,
    image: "👜",
    color: "#d8c1a8",
  },
  {
    id: "linen-set",
    name: "Relaxed Linen Set",
    brand: "Naya",
    price: 62000,
    rating: 4.8,
    reviews: 84,
    image: "👚",
    color: "#d8ddd5",
  },
  {
    id: "classic-watch",
    name: "Classic Gold Watch",
    brand: "Ora Lagos",
    price: 35500,
    rating: 4.7,
    reviews: 62,
    image: "⌚",
    color: "#eee1cb",
  },
  {
    id: "everyday-sneaker",
    name: "Everyday Sneaker",
    brand: "Form",
    price: 54000,
    rating: 4.9,
    reviews: 211,
    image: "👟",
    color: "#d9dadd",
  },
  {
    id: "silk-scarf",
    name: "Printed Silk Scarf",
    brand: "Naya",
    price: 18500,
    rating: 4.6,
    reviews: 41,
    image: "🧣",
    color: "#d7b0a6",
  },
  {
    id: "ceramic-vase",
    name: "Handmade Ceramic Vase",
    brand: "Modo Living",
    price: 27000,
    rating: 4.8,
    reviews: 73,
    image: "🏺",
    color: "#c7d2ce",
  },
];

export const sellers = [
  {
    id: "aria-studio",
    name: "Aria Studio",
    handle: "@ariastudio",
    initials: "AS",
    followers: "24.8k",
  },
  {
    id: "naya",
    name: "Naya",
    handle: "@shopnaya",
    initials: "NY",
    followers: "18.2k",
  },
  {
    id: "ora-lagos",
    name: "Ora Lagos",
    handle: "@oralagos",
    initials: "OR",
    followers: "9.6k",
  },
];

export const money = (value: number) => `₦${value.toLocaleString("en-NG")}`;
