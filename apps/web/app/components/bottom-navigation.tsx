"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";
import "./bottom-navigation.css";

const tabs = [
  { href: "/", label: "Home", icon: "home", paths: ["/"] },
  {
    href: "/explore",
    label: "Explore",
    icon: "search",
    paths: ["/explore", "/search", "/category"],
  },
  { href: "/reels", label: "Reels", icon: "reels", paths: ["/reels"] },
  {
    href: "/cart",
    label: "Cart",
    icon: "cart",
    paths: ["/cart", "/checkout"],
  },
  {
    href: "/chat",
    label: "Chat",
    icon: "chat",
    paths: ["/chat"],
  },
];

export function BottomNavigation() {
  const path = usePathname();

  return (
    <nav
      className="bottom-nav eazicart-bottom-nav"
      aria-label="Customer navigation"
    >
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
            <Icon name={tab.icon} size={22} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
