import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Payment complete",
  "Payment complete on EaziCart.",
  "/payment-success",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
