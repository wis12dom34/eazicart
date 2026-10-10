/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { SellerBottomNavigation } from "../components/seller-bottom-navigation";
import { SideNavigation } from "../components/side-navigation";
import { LoadingState, SignInState } from "../components/async-state";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { followsApi } from "../../lib/api/follows";
import { ordersApi } from "../../lib/api/orders";
import { savedApi } from "../../lib/api/saved";
import styles from "./profile.module.css";

const sellerTools = [
  { href: "/seller/dashboard", icon: "home", label: "Dashboard", detail: "Store overview" },
  { href: "/seller/products", icon: "box", label: "Products", detail: "Catalog and stock" },
  { href: "/seller/orders", icon: "bag", label: "Orders", detail: "Customer orders" },
  { href: "/seller/store", icon: "shirt", label: "Storefront", detail: "Public store and map" },
  { href: "/seller/customers", icon: "users", label: "Customers", detail: "Buyer history" },
  { href: "/seller/finance", icon: "card", label: "Finance", detail: "Verified sales history" },
  { href: "/seller/reels", icon: "reels", label: "Content", detail: "Publish product reels" },
  { href: "/seller/subscription", icon: "sparkle", label: "Subscription", detail: "Seller plans" },
] as const;

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoadingShell />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const auth = useAuth();
  const searchParams = useSearchParams();
  const sellerMode = searchParams.get("mode") === "seller";
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const orders = useRequest(
    () => auth.isAuthenticated && !sellerMode ? ordersApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated, sellerMode],
  );
  const saved = useRequest(
    () => auth.isAuthenticated && !sellerMode ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated, sellerMode],
  );
  const following = useRequest(
    () => auth.isAuthenticated && !sellerMode ? followsApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated, sellerMode],
  );
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="19:120">
      <header className={styles.header}>
        <Link href={sellerMode ? "/seller/dashboard" : "/"} aria-label={sellerMode ? "Back to seller dashboard" : "Back to home"}>
          ‹
        </Link>
        <h1>{sellerMode ? "Seller profile" : "Profile"}</h1>
      </header>
      <div className={styles.viewport} data-figma-scroll="profile">
        {auth.loading ? (
          <LoadingState />
        ) : !auth.user ? (
          <SignInState message="Sign in to manage your EaziCart profile." />
        ) : (
          <div className={styles.content}>
            <section className={styles.identity} aria-label={sellerMode ? "Seller profile" : "Customer profile"}>
              <div className={styles.identityRow}>
                <button className={styles.avatar} onClick={() => setMenu(true)} aria-label="Open side navigation">
                  {auth.user.name[0]?.toUpperCase() || "W"}
                </button>
                <div className={styles.identityCopy}>
                  <h2>{auth.user.name}</h2>
                  <p>{auth.user.username ? `@${auth.user.username}` : "\u00a0"}</p>
                  <small>{sellerMode ? "Seller account" : "Personal account"}</small>
                </div>
                <Link href="/settings" className={styles.settings} aria-label="Account settings">
                  <img src="/figma/profile-settings.svg" alt="" width={24} height={24} />
                </Link>
              </div>
              <Link className={styles.edit} href="/edit-profile">Edit profile</Link>
            </section>

            {!sellerMode ? (
              <section className={styles.stats} aria-label="Profile activity counts">
                {[
                  { label: "Orders", href: "/orders", result: orders },
                  { label: "Saved", href: "/saved", result: saved },
                  { label: "Following", href: "/following", result: following },
                ].map(({ label, href, result }) => (
                  <Link href={href} key={label}>
                    <strong className={result.error ? styles.metricError : undefined}>
                      {result.loading ? "…" : result.error ? "—" : (result.data?.data.length ?? 0)}
                    </strong>
                    <span>{label}</span>
                  </Link>
                ))}
              </section>
            ) : null}

            <nav className={styles.tabs} aria-label="Profile sections">
              {sellerMode ? <Link href="/profile">Activity</Link> : <span aria-current="page">Activity</span>}
              {sellerMode ? <span aria-current="page">Sell</span> : <Link href="/seller/dashboard">Sell</Link>}
            </nav>

            {sellerMode ? (
              <section className={styles.sellerWorkspace} aria-label="Seller workspace">
                <div className={styles.sellerIntro}>
                  <p>Seller workspace</p>
                  <h2>Manage your store</h2>
                  <span>Open the real seller tools already connected to your EaziCart account.</span>
                </div>
                <div className={styles.sellerGrid}>
                  {sellerTools.map((tool) => (
                    <Link className={styles.sellerTool} href={tool.href} key={tool.href}>
                      <span className={styles.sellerToolIcon}><Icon name={tool.icon} size={21} /></span>
                      <strong>{tool.label}</strong>
                      <small>{tool.detail}</small>
                    </Link>
                  ))}
                </div>
              </section>
            ) : (
              <section className={styles.activity} aria-label="Your activity">
                <ProfileRow href="/orders" icon="orders" label="Orders" detail="Track and manage purchases" />
                <ProfileRow href="/saved" icon="saved" label="Saved" detail="Products you want to revisit" />
                <ProfileRow href="/following" icon="following" label="Following" detail="Sellers and stores you follow" />
              </section>
            )}

            <section className={styles.account}>
              <h2>Account</h2>
              {sellerMode ? (
                <>
                  <ProfileRow href="/notifications" icon="notifications" label="Notifications" detail="Orders and account activity" />
                  <ProfileRow href="/settings" icon="settings" label="Account settings" detail="Security and preferences" />
                </>
              ) : (
                <>
                  <ProfileRow href="/address-book" icon="address" label="Address book" detail="Manage delivery addresses" />
                  <ProfileRow href="/payment-methods" icon="payment" label="Payment methods" detail="Secure online checkout" />
                  <ProfileRow href="/notifications" icon="notifications" label="Notifications" detail="Orders and account activity" />
                </>
              )}
            </section>
          </div>
        )}
      </div>
      {sellerMode ? <SellerBottomNavigation active="profile" /> : <BottomNavigation />}
      {menu ? <SideNavigation onClose={closeMenu} /> : null}
    </main>
  );
}

function ProfileLoadingShell() {
  return (
    <main className={`app-shell ${styles.page}`}>
      <header className={styles.header}><h1>Profile</h1></header>
      <div className={styles.viewport}><LoadingState /></div>
    </main>
  );
}

function ProfileRow({ href, icon, label, detail }: { href: string; icon: string; label: string; detail: string }) {
  return (
    <Link href={href} className={styles.row}>
      <img src={`/figma/profile-${icon}.svg`} width={32} height={32} alt="" />
      <span><strong>{label}</strong><small>{detail}</small></span>
      <img src="/figma/profile-chevron.svg" width={24} height={44} alt="" />
    </Link>
  );
}
