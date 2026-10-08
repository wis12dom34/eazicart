/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { cartApi } from "../../lib/api/cart";
import { conversationsApi } from "../../lib/api/conversations";
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
  chatCount,
  activeHref,
}: {
  cartCount?: number;
  chatCount?: number;
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
  const conversations = useRequest(
    () =>
      chatCount === undefined && auth.isAuthenticated
        ? conversationsApi.list()
        : Promise.resolve(undefined),
    [chatCount, auth.isAuthenticated],
  );
  const count =
    cartCount ??
    cart.data?.data.items.reduce((total, item) => total + item.quantity, 0);
  const unreadCount =
    chatCount ??
    conversations.data?.data.reduce(
      (total, conversation) =>
        total +
        (conversation.buyer.id === auth.user?.id
          ? conversation.buyerUnreadCount
          : conversation.sellerUnreadCount),
      0,
    );

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
        const badgeCount =
          tab.label === "Cart"
            ? count
            : tab.label === "Chat"
              ? unreadCount
              : undefined;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-label={tab.label}
            className={`${styles.item} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.icon}>
              <img src={`/figma/${icon}.svg`} alt="" />
              {!!badgeCount && (
                <b
                  className={styles.badge}
                  aria-label={`${badgeCount} ${tab.label === "Chat" ? "unread messages" : "items"}`}
                >
                  {(badgeCount ?? 0) > 99 ? "99+" : badgeCount}
                </b>
              )}
            </span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
