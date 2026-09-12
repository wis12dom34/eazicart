"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";

const tabs = [
  { href: "/", label: "Home", icon: "home", paths: ["/"] },
  { href: "/explore", label: "Explore", icon: "search", paths: ["/explore"] },
  { href: "/reels", label: "Reels", icon: "reels", paths: ["/reels"] },
  { href: "/orders", label: "Orders", icon: "bag", paths: ["/orders"] },
  {
    href: "/profile",
    label: "Profile",
    icon: "user",
    paths: [
      "/profile",
      "/saved",
      "/following",
      "/address-book",
      "/payment-methods",
      "/notifications",
      "/edit-profile",
      "/settings",
      "/reviews",
    ],
  },
];

export function BottomNavigation() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Customer navigation">
      {tabs.map((tab) => {
        const active = tab.paths.some((candidate) =>
          candidate === "/"
            ? path === "/"
            : path === candidate || path.startsWith(`${candidate}/`),
        );
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} size={24} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
