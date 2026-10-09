import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Checkout",
  "Checkout on EaziCart.",
  "/checkout",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
