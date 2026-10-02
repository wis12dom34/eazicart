/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "../providers/auth-provider";
import { useRequest } from "../hooks/use-request";
import { ordersApi } from "../../lib/api/orders";
import styles from "./side-navigation.module.css";
const entries = [
  ["Profile", "/profile", "profile"],
  ["Order History", "/orders", "orders"],
  ["Saved Items", "/saved", "saved"],
  ["Wallet", "", "wallet"],
  ["Payment Methods", "/payment-methods", "payment"],
  ["Delivery Addresses", "/address-book", "address"],
  ["My Store", "/seller/store", "store"],
  ["Business Insights", "/seller/dashboard", "insights"],
  ["Settings", "/settings", "settings"],
  ["Help & Support", "", "help"],
];
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
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled])",
      );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
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
      >
        <button
          className={styles.close}
          aria-label="Close menu"
          onClick={onClose}
        >
          <img src="/figma/drawer-close.svg" alt="" width={22} height={22} />
        </button>
        <div className={styles.identity}>
          <div className={styles.avatar}>{initials}</div>
          <h2>{name}</h2>
          {auth.user?.username ? (
            <p>@{auth.user.username}</p>
          ) : (
            <p className={styles.usernameSpace} aria-hidden="true" />
          )}
          <small>Personal account</small>
        </div>
        <nav aria-label="Account navigation">
          {entries.map(([label, href, icon], index) => {
            const content = (
              <>
                <img
                  src={`/figma/drawer-${icon}.svg`}
                  width={22}
                  height={22}
                  alt=""
                />
                <span>{label}</span>
                {label === "Order History" && !!orders.data?.data.length ? (
                  <b>{orders.data.data.length}</b>
                ) : null}
                <img
                  src="/figma/drawer-chevron.svg"
                  width={16}
                  height={16}
                  alt=""
                />
              </>
            );
            return (
              <div
                className={index === 8 ? styles.afterDivider : undefined}
                key={label}
              >
                {href ? (
                  <Link href={href} onClick={onClose}>
                    {content}
                  </Link>
                ) : (
                  <span
                    className={styles.unavailable}
                    role="link"
                    aria-disabled="true"
                    title={`${label} is not connected yet`}
                  >
                    {content}
                  </span>
                )}
              </div>
            );
          })}
        </nav>
        <small className={styles.version}>v1.0.0</small>
      </div>
    </div>
  );
}
