import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Payment methods",
  "Payment methods on EaziCart.",
  "/payment-methods",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
