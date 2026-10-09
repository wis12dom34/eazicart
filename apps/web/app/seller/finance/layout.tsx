import type { ReactNode } from "react";
import { pageMetadata } from "../../../lib/seo";
export const metadata = pageMetadata(
  "Seller Finance",
  "Private seller workspace on EaziCart.",
  "/seller/finance",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
