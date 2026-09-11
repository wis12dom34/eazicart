"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icon";
const tabs = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/explore", label: "Explore", icon: "search" },
  { href: "/reels", label: "Reels", icon: "reels" },
  { href: "/orders", label: "Orders", icon: "bag" },
  { href: "/profile", label: "Profile", icon: "user" },
];
export function BottomNavigation() {
  const path = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Customer navigation">
      {tabs.map((tab) => {
        const active =
          tab.href === "/" ? path === "/" : path.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon name={tab.icon} size={23} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
