import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
export const metadata = pageMetadata("Chat", "Chat on EaziCart.", "/chat", {
  index: false,
});
export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
