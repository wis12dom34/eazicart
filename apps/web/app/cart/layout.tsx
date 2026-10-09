import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Your cart",
  "Your cart on EaziCart.",
  "/cart",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
