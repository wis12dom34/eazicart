import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Sign in",
  "Sign in on EaziCart.",
  "/login",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
