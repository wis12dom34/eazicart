import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata("Reels", "Reels on EaziCart.", "/reels", {
  index: false,
});
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
