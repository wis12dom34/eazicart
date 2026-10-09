import type { ReactNode } from "react";
import { pageMetadata } from "../../../lib/seo";
export const metadata = pageMetadata(
  "Seller Orders",
  "Private seller workspace on EaziCart.",
  "/seller/orders",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
