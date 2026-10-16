import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
import { CustomerDesktopRail, DesktopCustomerShell } from "../components/desktop-customer-shell";

export const metadata = pageMetadata(
  "Notifications",
  "Notifications on EaziCart.",
  "/notifications",
  { index: false },
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DesktopCustomerShell activeHref="/notifications" rail={<CustomerDesktopRail />}>
      {children}
    </DesktopCustomerShell>
  );
}
