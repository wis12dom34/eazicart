"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { cartApi } from "../../lib/api/cart";
import styles from "./bottom-navigation.module.css";
import { Icon, type IconName } from "./icon";

const tabs: Array<{
  href: string;
  label: string;
  icon: IconName;
  paths: string[];
}> = [
  { href: "/", label: "Home", icon: "home", paths: ["/"] },
  {
    href: "/explore",
    label: "Explore",
    icon: "explore",
    paths: ["/explore", "/search", "/category"],
  },
  { href: "/reels", label: "Reels", icon: "reels", paths: ["/reels"] },
  { href: "/cart", label: "Cart", icon: "cart", paths: ["/cart"] },
  { href: "/chat", label: "Chat", icon: "chat", paths: ["/chat"] },
];

export function BottomNavigation({
  cartCount,
  activeHref,
  deferCartFetch = false,
  prefetch = false,
}: {
  cartCount?: number;
  activeHref?: string;
  deferCartFetch?: boolean;
  prefetch?: boolean;
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

  useEffect(() => {
    if (path !== "/reels") return;

    const enableReelSound = () => {
      const soundButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          'button[aria-label="Turn Reel sound on"]',
        ),
      );

      soundButtons.forEach((button) => button.click());
      window.localStorage.setItem("eazicart-reels-sound", "on");
    };

    const restoreSoundPreference = () => {
      if (window.localStorage.getItem("eazicart-reels-sound") !== "on") return;
      enableReelSound();
    };

    restoreSoundPreference();
    document.addEventListener("pointerdown", enableReelSound, {
      once: true,
      capture: true,
    });
    document.addEventListener("touchstart", enableReelSound, {
      once: true,
      capture: true,
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", enableReelSound, true);
      document.removeEventListener("touchstart", enableReelSound, true);
    };
  }, [path]);

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
        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch={prefetch}
            aria-label={tab.label}
            className={`${styles.item} ${active ? styles.active : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <span className={styles.icon}>
              <Icon name={tab.icon} size={24} active={active} />
              {tab.label === "Cart" && !!count && (
                <b className={styles.badge}>
                  {(count ?? 0) > 99 ? "99+" : count}
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
