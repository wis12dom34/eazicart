import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Order tracking",
  "Order tracking on EaziCart.",
  "/tracking",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
