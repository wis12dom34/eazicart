import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
import { CustomerDesktopRail, DesktopCustomerShell } from "../components/desktop-customer-shell";

export const metadata = pageMetadata(
  "Edit profile",
  "Edit profile on EaziCart.",
  "/edit-profile",
  { index: false },
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DesktopCustomerShell activeHref="/profile" rail={<CustomerDesktopRail />}>
      {children}
    </DesktopCustomerShell>
  );
}
