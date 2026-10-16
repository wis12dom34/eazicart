import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
import { CustomerDesktopRail, DesktopCustomerShell } from "../components/desktop-customer-shell";

export const metadata = pageMetadata(
  "Saved products",
  "Saved products on EaziCart.",
  "/saved",
  { index: false },
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DesktopCustomerShell activeHref="/saved" rail={<CustomerDesktopRail />}>
      {children}
    </DesktopCustomerShell>
  );
}
