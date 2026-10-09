import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Address book",
  "Address book on EaziCart.",
  "/address-book",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
