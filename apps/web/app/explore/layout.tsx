import type { ReactNode } from "react";
import { pageMetadata } from "../../lib/seo";
import {
  CustomerDesktopRail,
  DesktopCustomerShell,
} from "../components/desktop-customer-shell";

export const metadata = pageMetadata(
  "Explore products",
  "Explore products on EaziCart.",
  "/explore",
  { index: false },
);

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <DesktopCustomerShell activeHref="/explore" rail={<CustomerDesktopRail />}>
      {children}
    </DesktopCustomerShell>
  );
}
