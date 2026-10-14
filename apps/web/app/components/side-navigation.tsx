"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useAuth } from "../providers/auth-provider";
import { useRequest } from "../hooks/use-request";
import { ordersApi } from "../../lib/api/orders";
import styles from "./side-navigation.module.css";
import { Icon } from "./icon";
import { ProfileAvatar } from "./profile-avatar";

const primaryEntries = [
  ["Profile", "/profile", "user"],
  ["Order History", "/orders", "box"],
  ["Saved Items", "/saved", "heart"],
  ["Payment Methods", "/payment-methods", "card"],
  ["Delivery Addresses", "/address-book", "location"],
  ["My Store", "/seller/store", "store"],
] as const;

const secondaryEntries = [
  ["Business Insights", "/seller/dashboard", "chart"],
  ["Settings", "/settings", "settings"],
] as const;

type Entry = (typeof primaryEntries)[number] | (typeof secondaryEntries)[number];

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

  const renderEntry = ([label, href, icon]: Entry) => (
    <Link href={href} onClick={onClose} key={label}>
      <span className={styles.entryIcon} aria-hidden="true">
        <Icon name={icon} size={24} weight="medium" />
      </span>
      <span className={styles.entryLabel}>{label}</span>
      {label === "Order History" && !!orders.data?.data.length ? (
        <b className={styles.count}>{orders.data.data.length}</b>
      ) : null}
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
        aria-label="Account navigation"
        tabIndex={-1}
      >
        <div className={styles.topRow}>
          <div className={styles.avatar}>
            {auth.user ? (
              <ProfileAvatar userId={auth.user.id} name={auth.user.name} />
            ) : (
              initials
            )}
          </div>
          <button
            className={styles.close}
            aria-label="Close menu"
            onClick={onClose}
          >
            <Icon name="close" size={21} weight="medium" />
          </button>
        </div>

        <div className={styles.identity}>
          <h2>{name}</h2>
          {auth.user?.username ? (
            <p>@{auth.user.username}</p>
          ) : (
            <p>Personal account</p>
          )}
        </div>

        <div className={styles.rule} aria-hidden="true" />

        <nav aria-label="Account navigation">
          <div className={styles.menuSection}>
            {primaryEntries.map(renderEntry)}
          </div>
          <div className={styles.sectionRule} aria-hidden="true" />
          <div className={styles.menuSection}>
            {secondaryEntries.map(renderEntry)}
          </div>
        </nav>

        <small className={styles.version}>EaziCart · v1.0.0</small>
      </div>
    </div>
  );
}
