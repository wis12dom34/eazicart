import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Your profile",
  "Your profile on EaziCart.",
  "/profile",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
