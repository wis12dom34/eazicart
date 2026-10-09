import type { ReactNode } from "react";
import { pageMetadata } from "../../../lib/seo";
export const metadata = pageMetadata(
  "Seller Subscription",
  "Private seller workspace on EaziCart.",
  "/seller/subscription",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
