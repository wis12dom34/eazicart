import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Saved products",
  "Saved products on EaziCart.",
  "/saved",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
