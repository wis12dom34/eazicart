import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata(
  "Edit profile",
  "Edit profile on EaziCart.",
  "/edit-profile",
  { index: false },
);
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
