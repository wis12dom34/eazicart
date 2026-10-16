import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
import { CustomerDesktopRail, DesktopCustomerShell } from "../components/desktop-customer-shell";

export const metadata = pageMetadata(
  "Payment methods",
  "Payment methods on EaziCart.",
  "/payment-methods",
  { index: false },
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DesktopCustomerShell activeHref="/profile" rail={<CustomerDesktopRail />}>
      {children}
    </DesktopCustomerShell>
  );
}
