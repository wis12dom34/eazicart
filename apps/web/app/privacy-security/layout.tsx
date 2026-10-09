import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Privacy and security",
  "Privacy and security on EaziCart.",
  "/privacy-security",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
