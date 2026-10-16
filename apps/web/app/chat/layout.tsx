import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
import {
  CustomerDesktopRail,
  DesktopCustomerShell,
} from "../components/desktop-customer-shell";

export const metadata = pageMetadata("Chat", "Chat on EaziCart.", "/chat", {
  index: false,
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DesktopCustomerShell activeHref="/chat" rail={<CustomerDesktopRail />}>
      {children}
    </DesktopCustomerShell>
  );
}
