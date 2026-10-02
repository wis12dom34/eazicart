/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { SideNavigation } from "../components/side-navigation";
import { LoadingState, SignInState } from "../components/async-state";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { followsApi } from "../../lib/api/follows";
import { ordersApi } from "../../lib/api/orders";
import { savedApi } from "../../lib/api/saved";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const auth = useAuth();
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const orders = useRequest(
    () =>
      auth.isAuthenticated ? ordersApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const saved = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const following = useRequest(
    () =>
      auth.isAuthenticated ? followsApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="19:120">
      <header className={styles.header}>
        <Link href="/" aria-label="Back to home">
          ‹
        </Link>
        <h1>Profile</h1>
      </header>
      <div className={styles.viewport} data-figma-scroll="profile">
        {auth.loading ? (
          <LoadingState />
        ) : !auth.user ? (
          <SignInState message="Sign in to manage your EaziCart profile." />
        ) : (
          <div className={styles.content}>
            <section className={styles.identity} aria-label="Customer profile">
              <div className={styles.identityRow}>
                <button
                  className={styles.avatar}
                  onClick={() => setMenu(true)}
                  aria-label="Open side navigation"
                >
                  {auth.user.name[0]?.toUpperCase() || "W"}
                </button>
                <div className={styles.identityCopy}>
                  <h2>{auth.user.name}</h2>
                  <p>
                    {auth.user.username ? `@${auth.user.username}` : "\u00a0"}
                  </p>
                  <small>Personal account</small>
                </div>
                <Link
                  href="/settings"
                  className={styles.settings}
                  aria-label="Account settings"
                >
                  <img
                    src="/figma/profile-settings.svg"
                    alt=""
                    width={24}
                    height={24}
                  />
                </Link>
              </div>
              <Link className={styles.edit} href="/edit-profile">
                Edit profile
              </Link>
            </section>
            <section
              className={styles.stats}
              aria-label="Profile activity counts"
            >
              {[
                { label: "Orders", href: "/orders", result: orders },
                { label: "Saved", href: "/saved", result: saved },
                { label: "Following", href: "/following", result: following },
              ].map(({ label, href, result }) => {
                return (
                  <Link href={href} key={label}>
                    <strong
                      className={result.error ? styles.metricError : undefined}
                    >
                      {result.loading
                        ? "…"
                        : result.error
                          ? "—"
                          : (result.data?.data.length ?? 0)}
                    </strong>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </section>
            <nav className={styles.tabs} aria-label="Profile sections">
              <span aria-current="page">Activity</span>
              <Link href="/reviews">Reviews</Link>
              <Link href="/seller/dashboard">Sell</Link>
            </nav>
            <section className={styles.activity} aria-label="Your activity">
              <ProfileRow
                href="/orders"
                icon="orders"
                label="Orders"
                detail="Track and manage purchases"
              />
              <ProfileRow
                href="/saved"
                icon="saved"
                label="Saved"
                detail="Products you want to revisit"
              />
              <ProfileRow
                href="/following"
                icon="following"
                label="Following"
                detail="Sellers and stores you follow"
              />
              <ProfileRow
                href="/reviews"
                icon="reviews"
                label="Reviews"
                detail="Your ratings and feedback"
              />
            </section>
            <section className={styles.account}>
              <h2>Account</h2>
              <ProfileRow
                href="/address-book"
                icon="address"
                label="Address book"
                detail="Manage delivery addresses"
              />
              <ProfileRow
                href="/payment-methods"
                icon="payment"
                label="Payment methods"
                detail="Wallet and cards"
              />
              <ProfileRow
                href="/notifications"
                icon="notifications"
                label="Notifications"
                detail="Orders, offers and activity"
              />
            </section>
          </div>
        )}
      </div>
      <BottomNavigation />
      {menu ? <SideNavigation onClose={closeMenu} /> : null}
    </main>
  );
}
function ProfileRow({
  href,
  icon,
  label,
  detail,
}: {
  href: string;
  icon: string;
  label: string;
  detail: string;
}) {
  return (
    <Link href={href} className={styles.row}>
      <img src={`/figma/profile-${icon}.svg`} width={32} height={32} alt="" />
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <img src="/figma/profile-chevron.svg" width={24} height={44} alt="" />
    </Link>
  );
}
