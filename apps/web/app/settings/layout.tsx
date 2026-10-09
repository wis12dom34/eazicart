import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Settings",
  "Settings on EaziCart.",
  "/settings",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
