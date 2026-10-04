/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { cartApi } from "../../lib/api/cart";
import styles from "./bottom-navigation.module.css";

const tabs = [
  { href: "/", label: "Home", icon: "nav-home", paths: ["/"] },
  {
    href: "/explore",
    label: "Explore",
    icon: "nav-explore",
    paths: ["/explore", "/search", "/category"],
  },
  { href: "/reels", label: "Reels", icon: "nav-reels", paths: ["/reels"] },
  { href: "/cart", label: "Cart", icon: "cart-icon", paths: ["/cart"] },
  { href: "/chat", label: "Chat", icon: "nav-chat", paths: ["/chat"] },
];

export function BottomNavigation({
  cartCount,
  activeHref,
}: {
  cartCount?: number;
  activeHref?: string;
}) {
  const path = usePathname();
  const auth = useAuth();
  const cart = useRequest(
    () =>
      cartCount === undefined && auth.isAuthenticated
        ? cartApi.get()
        : Promise.resolve(undefined),
    [cartCount, auth.isAuthenticated],
  );
  const count =
    cartCount ??
    cart.data?.data.items.reduce((total, item) => total + item.quantity, 0);
  return (
    <nav className={styles.nav} aria-label="Customer navigation">
      {tabs.map((tab) => {
        const active = activeHref
          ? tab.href === activeHref
          : tab.paths.some((candidate) =>
              candidate === "/"
                ? path === "/"
                : path === candidate || path.startsWith(`${candidate}/`),
            );
        const icon =
          tab.label === "Home" && !active
            ? "nav-home-inactive"
            : tab.label === "Cart" && active
              ? "cart-icon-active"
              : active && ["Explore", "Reels"].includes(tab.label)
                ? `${tab.icon}-active`
                : tab.icon;
        const content = (
          <>
            <span className={styles.icon}>
              <img src={`/figma/${icon}.svg`} alt="" />
              {tab.label === "Cart" && !!count && (
                <b className={styles.badge}>
                  {(count ?? 0) > 99 ? "99+" : count}
                </b>
              )}
            </span>
            <span>{tab.label}</span>
          </>
        );
        // Chat has a validated design, but no existing route/service yet.
        return tab.label === "Chat" ? (
          <span
            key={tab.href}
            className={styles.item}
            role="link"
            aria-label={tab.label}
            aria-disabled="true"
            title="Chat is not available yet"
          >
            {content}
          </span>
        ) : (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            className={`${styles.item} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
