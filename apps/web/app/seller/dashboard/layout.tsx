import type { ReactNode } from "react";
import { pageMetadata } from "../../../lib/seo";
export const metadata = pageMetadata(
  "Seller Dashboard",
  "Private seller workspace on EaziCart.",
  "/seller/dashboard",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
