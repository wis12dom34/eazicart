import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Search products",
  "Search products on EaziCart.",
  "/search",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
