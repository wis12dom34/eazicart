"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { DesktopSidebar } from "./desktop-sidebar";
import { DesktopRightPanel } from "./desktop-right-panel";
import styles from "./desktop-navigation.module.css";

const customerRoots = [
  "explore",
  "search",
  "category",
  "product",
  "reels",
  "notifications",
  "chat",
  "cart",
  "checkout",
  "orders",
  "saved",
  "profile",
  "edit-profile",
  "following",
  "settings",
  "payment-methods",
  "address-book",
  "privacy-security",
  "tracking",
  "reviews",
  "payment-success",
  "payment-pending",
];
export function CustomerDesktopShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const root = path.split("/")[1];
  const customer =
    path === "/" ||
    customerRoots.includes(root || "") ||
    (/^\/seller\/[^/]+$/.test(path) &&
      ![
        "store",
        "dashboard",
        "products",
        "orders",
        "finance",
        "customers",
        "reels",
        "subscription",
      ].includes(root === "seller" ? path.split("/")[2]! : ""));
  if (!customer) return children;
  return (
    <div className={styles.shell} data-customer-desktop-shell>
      <DesktopSidebar />
      <div className={styles.content}>{children}</div>
      <DesktopRightPanel />
    </div>
  );
}
