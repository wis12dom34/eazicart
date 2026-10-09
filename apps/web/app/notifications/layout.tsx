import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Notifications",
  "Notifications on EaziCart.",
  "/notifications",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
