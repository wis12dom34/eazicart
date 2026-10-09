import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Following",
  "Following on EaziCart.",
  "/following",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
