"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../providers/auth-provider";
import { Icon, type IconName } from "./icon";
import { ProfileAvatar } from "./profile-avatar";
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
  const auth = useAuth();

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

        {auth.user ? (
          <Link className={styles.accountCard} href="/profile">
            <span className={styles.accountAvatar}>
              <ProfileAvatar userId={auth.user.id} name={auth.user.name} />
            </span>
            <span className={styles.accountCopy}>
              <strong>{auth.user.name}</strong>
              <small>
                {auth.user.username ? `@${auth.user.username}` : auth.user.email}
              </small>
            </span>
          </Link>
        ) : !auth.loading ? (
          <Link className={styles.accountCard} href="/login">
            <span className={styles.signedOutAvatar} aria-hidden="true">
              <Icon name="user" size={20} />
            </span>
            <span className={styles.accountCopy}>
              <strong>Sign in</strong>
              <small>Access your account</small>
            </span>
          </Link>
        ) : null}
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

export function CustomerDesktopRail() {
  return (
    <div className={styles.customerRail}>
      <h2>What’s happening</h2>
      <nav className={styles.quickCard} aria-label="EaziCart quick links">
        <Link href="/explore">
          <small>Discover</small>
          <strong>Explore products</strong>
          <span>Find products and sellers across EaziCart.</span>
        </Link>
        <Link href="/saved">
          <small>Your account</small>
          <strong>Saved items</strong>
          <span>Return to products you saved for later.</span>
        </Link>
        <Link href="/orders">
          <small>Purchases</small>
          <strong>Order history</strong>
          <span>Track current orders and review past purchases.</span>
        </Link>
      </nav>
      <section className={styles.supportCard}>
        <h3>Need help?</h3>
        <p>Open support for an account, payment, seller or delivery issue.</p>
        <Link href="/chat">Contact support</Link>
      </section>
      <p className={styles.railLegal}>Terms · Privacy · Help · © EaziCart</p>
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
