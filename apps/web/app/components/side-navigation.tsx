"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "../providers/auth-provider";
import { useRequest } from "../hooks/use-request";
import { ordersApi } from "../../lib/api/orders";
import styles from "./side-navigation.module.css";
import { Icon } from "./icon";
import { ProfileAvatar } from "./profile-avatar";

const entries = [
  ["Profile", "/profile", "user"],
  ["Order History", "/orders", "box"],
  ["Saved Items", "/saved", "heart"],
  ["Payment Methods", "/payment-methods", "card"],
  ["Delivery Addresses", "/address-book", "location"],
  ["My Store", "/seller/store", "store"],
  ["Business Insights", "/seller/dashboard", "chart"],
  ["Settings", "/settings", "settings"],
] as const;

export function SideNavigation({ onClose }: { onClose: () => void }) {
  const auth = useAuth();
  const panel = useRef<HTMLDivElement>(null);
  const orders = useRequest(
    () =>
      auth.isAuthenticated ? ordersApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    panel.current?.focus({ preventScroll: true });

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const nodes = panel.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!nodes?.length) return;

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [onClose]);

  const name = auth.user?.name ?? "Guest";
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const renderEntry = ([label, href, icon]: (typeof entries)[number]) => (
    <Link href={href} onClick={onClose} key={label}>
      <Icon name={icon} size={22} />
      <span>{label}</span>
      {label === "Order History" && !!orders.data?.data.length ? (
        <b>{orders.data.data.length}</b>
      ) : null}
      <Icon name="chevron" size={15} />
    </Link>
  );

  return (
    <div className={styles.overlay} data-figma-node="560:3187">
      <button
        className={styles.backdrop}
        aria-label="Close side navigation"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        className={styles.panel}
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Side navigation"
        tabIndex={-1}
      >
        <button
          className={styles.close}
          aria-label="Close menu"
          onClick={onClose}
        >
          <Icon name="close" size={20} />
        </button>

        <div className={styles.identity}>
          <div className={styles.avatar}>
            {auth.user ? (
              <ProfileAvatar userId={auth.user.id} name={auth.user.name} />
            ) : (
              initials
            )}
          </div>
          <div className={styles.identityCopy}>
            <h2>{name}</h2>
            {auth.user?.username ? <p>@{auth.user.username}</p> : null}
            <small>Personal account</small>
          </div>
        </div>

        <nav aria-label="Account navigation">
          <div className={styles.menuGroup}>{entries.slice(0, 6).map(renderEntry)}</div>
          <div className={styles.menuGroup}>{entries.slice(6).map(renderEntry)}</div>
        </nav>

        <small className={styles.version}>EaziCart · v1.0.0</small>
      </div>
    </div>
  );
}
