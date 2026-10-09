import type { ReactNode } from "react";
import { pageMetadata } from "../../../lib/seo";
export const metadata = pageMetadata(
  "Seller Customers",
  "Private seller workspace on EaziCart.",
  "/seller/customers",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
