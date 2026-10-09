import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Explore products",
  "Explore products on EaziCart.",
  "/explore",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
