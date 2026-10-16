"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icon";
import styles from "./desktop-customer-shell.module.css";

type NavigationEntry = {
  href: string;
  label: string;
  icon: IconName;
  paths: string[];
};

const navigation: NavigationEntry[] = [
  { href: "/", label: "Home", icon: "home", paths: ["/"] },
  {
    href: "/explore",
    label: "Explore",
    icon: "explore",
    paths: ["/explore", "/search", "/category"],
  },
  { href: "/reels", label: "Reels", icon: "reels", paths: ["/reels"] },
  { href: "/cart", label: "Cart", icon: "cart", paths: ["/cart"] },
  { href: "/orders", label: "Orders", icon: "box", paths: ["/orders"] },
  { href: "/chat", label: "Messages", icon: "message", paths: ["/chat"] },
  {
    href: "/notifications",
    label: "Notifications",
    icon: "bell",
    paths: ["/notifications"],
  },
  { href: "/saved", label: "Saved", icon: "bookmark", paths: ["/saved"] },
  { href: "/profile", label: "Profile", icon: "user", paths: ["/profile"] },
];

function matchesPath(pathname: string, paths: string[]) {
  return paths.some((candidate) =>
    candidate === "/"
      ? pathname === "/"
      : pathname === candidate || pathname.startsWith(`${candidate}/`),
  );
}

export function DesktopCustomerShell({
  children,
  activeHref,
  rail,
}: {
  children: ReactNode;
  activeHref?: string;
  rail?: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link className={styles.brand} href="/" aria-label="EaziCart home">
          <span>eazi</span>
          <b>cart</b>
        </Link>
        <nav className={styles.navigation} aria-label="Customer navigation">
          {navigation.map((entry) => {
            const active = activeHref
              ? entry.href === activeHref
              : matchesPath(pathname, entry.paths);
            return (
              <Link
                key={entry.href}
                href={entry.href}
                className={`${styles.navigationItem} ${active ? styles.active : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon name={entry.icon} size={24} active={active} />
                <span>{entry.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className={styles.content}>{children}</div>

      <aside className={styles.rightRail} aria-label="EaziCart discovery rail">
        <Link className={styles.search} href="/search">
          <Icon name="search" size={20} />
          <span>Search EaziCart</span>
        </Link>
        {rail}
      </aside>
    </div>
  );
}

export function SubscriptionDesktopRail() {
  return (
    <div className={styles.subscriptionRail}>
      <h2>What’s happening</h2>
      <section className={styles.railCard} aria-label="Seller tools">
        <small>Seller tools</small>
        <h3>Grow with Pro</h3>
        <p>Unlimited listings, analytics, Reels selling, and a verified seller badge.</p>
        <Link href="/seller/subscription?plan=PRO">Learn more</Link>
      </section>
      <p className={styles.railFootnote}>
        EaziCart subscriptions are flexible.
        <br />
        Cancel anytime. No hidden fees.
      </p>
    </div>
  );
}
