import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Your reviews",
  "Your reviews on EaziCart.",
  "/reviews",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
