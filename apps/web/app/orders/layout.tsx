import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Your orders",
  "Your orders on EaziCart.",
  "/orders",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
