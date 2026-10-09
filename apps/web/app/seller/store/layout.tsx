import type { ReactNode } from "react";
import { pageMetadata } from "../../../lib/seo";
export const metadata = pageMetadata(
  "Seller Store",
  "Private seller workspace on EaziCart.",
  "/seller/store",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
