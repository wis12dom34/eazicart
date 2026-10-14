"use client";

import Link from "next/link";
import { memo, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../providers/auth-provider";
import { cartApi } from "../../lib/api/cart";
import { notificationsApi } from "../../lib/api/notifications";
import { Icon, type IconName } from "./icon";
import { ProfileAvatar } from "./profile-avatar";
import { SideNavigation } from "./side-navigation";
import styles from "./desktop-navigation.module.css";

const entries: {
  href: string;
  label: string;
  icon: IconName;
  paths?: string[];
}[] = [
  { href: "/", label: "Home", icon: "home" },
  {
    href: "/explore",
    label: "Explore",
    icon: "search",
    paths: ["/explore", "/search", "/category"],
  },
  { href: "/reels", label: "Reels", icon: "reels" },
  { href: "/notifications", label: "Notifications", icon: "bell" },
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/cart", label: "Cart", icon: "cart", paths: ["/cart", "/checkout"] },
  {
    href: "/orders",
    label: "Orders",
    icon: "box",
    paths: ["/orders", "/tracking"],
  },
  { href: "/saved", label: "Saved", icon: "bookmark" },
  {
    href: "/profile",
    label: "Profile",
    icon: "user",
    paths: ["/profile", "/edit-profile"],
  },
];

export function NavigationBadge({ count }: { count?: number }) {
  if (!count || count < 1) return null;
  return (
    <span className={styles.badge} aria-label={`${count} unread or items`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarNavItem({
  entry,
  active,
  count,
}: {
  entry: (typeof entries)[number];
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={entry.href}
      aria-label={entry.label}
      aria-current={active ? "page" : undefined}
      className={`${styles.row} ${active ? styles.active : ""}`}
    >
      <span className={styles.icon}>
        <Icon name={entry.icon} size={25} active={active} />
        <NavigationBadge count={count} />
      </span>
      <span className={styles.label}>{entry.label}</span>
      <span className={styles.tooltip} role="tooltip">
        {entry.label}
      </span>
    </Link>
  );
}

function SidebarSellButton({ disabled }: { disabled: boolean }) {
  const auth = useAuth();
  const contents = (
    <>
      <span className={styles.sellIcon}>
        <Icon name="plus" size={24} />
      </span>
      <span className={styles.label}>Sell</span>
    </>
  );
  return disabled ? (
    <button className={styles.sell} disabled aria-label="Sell">
      {contents}
    </button>
  ) : (
    <Link
      className={styles.sell}
      aria-label="Sell"
      href={
        auth.isAuthenticated
          ? "/seller/products"
          : "/login?next=%2Fseller%2Fproducts"
      }
    >
      {contents}
      <span className={styles.tooltip}>Sell</span>
    </Link>
  );
}

function SidebarProfileSwitcher({ desktop }: { desktop: boolean }) {
  const { user } = useAuth();
  return (
    <Link
      href={user ? "/profile" : "/login"}
      className={styles.account}
      aria-label={user ? `Open ${user.name}'s account` : "Sign in"}
    >
      <span className={styles.avatar}>
        {user && desktop ? (
          <ProfileAvatar userId={user.id} name={user.name} />
        ) : (
          <Icon name="user" size={24} />
        )}
      </span>
      <span className={styles.accountCopy}>
        <strong>{user?.name || "Sign in"}</strong>
        {user?.username ? (
          <small>@{user.username}</small>
        ) : (
          <small>{user ? "Your account" : "Welcome to EaziCart"}</small>
        )}
      </span>
      <span className={styles.accountMore}>
        <Icon name="more" size={20} />
      </span>
      <span className={styles.tooltip}>Account</span>
    </Link>
  );
}

export const DesktopSidebar = memo(function DesktopSidebar() {
  const path = usePathname();
  const auth = useAuth();
  const [menu, setMenu] = useState(false);
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => {
      setDesktop(media.matches);
      if (!media.matches) setMenu(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const [counts, setCounts] = useState<{
    userId: string;
    cart?: number;
    notifications?: number;
  }>();
  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId) return;
    const media = window.matchMedia("(min-width: 768px)");
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (!media.matches || document.visibilityState === "hidden" || pending)
        return;
      pending = true;
      const [cart, notifications] = await Promise.allSettled([
        cartApi.get(),
        notificationsApi.list(),
      ]);
      if (active)
        setCounts({
          userId,
          cart:
            cart.status === "fulfilled"
              ? cart.value.data.items.reduce(
                  (sum, item) => sum + item.quantity,
                  0,
                )
              : undefined,
          notifications:
            notifications.status === "fulfilled"
              ? notifications.value.meta.unreadCount
              : undefined,
        });
      pending = false;
    };
    const onRefresh = () => {
      void refresh();
    };
    onRefresh();
    window.addEventListener("focus", onRefresh);
    window.addEventListener("eazicart:navigation-updated", onRefresh);
    media.addEventListener("change", onRefresh);
    return () => {
      active = false;
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("eazicart:navigation-updated", onRefresh);
      media.removeEventListener("change", onRefresh);
    };
  }, [userId, path]);
  const current = counts?.userId === auth.user?.id ? counts : undefined;
  return (
    <>
      <aside
        className={styles.sidebar}
        aria-label="Desktop navigation"
        data-figma-node="2960:16457"
      >
        <Link href="/" className={styles.brand} aria-label="EaziCart home">
          <span>E</span>
        </Link>
        <nav
          className={styles.navigation}
          aria-label="Customer desktop navigation"
        >
          {entries.map((entry) => (
            <SidebarNavItem
              key={entry.href}
              entry={entry}
              active={(entry.paths || [entry.href]).some((route) =>
                route === "/"
                  ? path === "/"
                  : path === route || path.startsWith(`${route}/`),
              )}
              count={
                entry.href === "/cart"
                  ? current?.cart
                  : entry.href === "/notifications"
                    ? current?.notifications
                    : undefined
              }
            />
          ))}
          <button
            className={styles.row}
            aria-label="More"
            aria-haspopup="dialog"
            aria-expanded={menu}
            onClick={() => setMenu(true)}
          >
            <span className={styles.icon}>
              <Icon name="more" size={25} />
            </span>
            <span className={styles.label}>More</span>
            <span className={styles.tooltip}>More</span>
          </button>
        </nav>
        <SidebarSellButton disabled={auth.loading} />
        <SidebarProfileSwitcher desktop={desktop} />
      </aside>
      {menu && <SideNavigation onClose={() => setMenu(false)} />}
    </>
  );
});
