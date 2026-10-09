import type { ReactNode } from "react";
import { pageMetadata } from "../../../lib/seo";
export const metadata = pageMetadata(
  "Seller Products",
  "Private seller workspace on EaziCart.",
  "/seller/products",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
