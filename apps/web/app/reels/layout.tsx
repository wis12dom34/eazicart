import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
import { CustomerDesktopRail, DesktopCustomerShell } from "../components/desktop-customer-shell";

export const metadata = pageMetadata("Reels", "Reels on EaziCart.", "/reels", {
  index: false,
});

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DesktopCustomerShell activeHref="/reels" rail={<CustomerDesktopRail />}>
      {children}
    </DesktopCustomerShell>
  );
}
