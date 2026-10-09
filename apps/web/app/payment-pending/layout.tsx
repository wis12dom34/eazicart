import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Payment pending",
  "Payment pending on EaziCart.",
  "/payment-pending",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
