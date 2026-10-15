"use client";

import Link from "next/link";
import { Suspense, useCallback, useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon, type IconName } from "../components/icon";
import { ProfileAvatar } from "../components/profile-avatar";
import { SideNavigation } from "../components/side-navigation";
import { LoadingState, SignInState } from "../components/async-state";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { followsApi } from "../../lib/api/follows";
import { ordersApi } from "../../lib/api/orders";
import { savedApi } from "../../lib/api/saved";
import styles from "./profile.module.css";

export default function ProfilePage() {
  return <Suspense fallback={<ProfileLoadingShell />}><ProfileContent /></Suspense>;
}

function ProfileContent() {
  const auth = useAuth();
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const orders = useRequest(() => auth.isAuthenticated ? ordersApi.list() : Promise.resolve({ data: [] }), [auth.isAuthenticated]);
  const saved = useRequest(() => auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }), [auth.isAuthenticated]);
  const following = useRequest(() => auth.isAuthenticated ? followsApi.list() : Promise.resolve({ data: [] }), [auth.isAuthenticated]);

  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="19:120">
      <header className={styles.header}>
        <Link href="/" aria-label="Back to home"><Icon name="back" size={22} /></Link>
        <h1>Profile</h1>
      </header>
      <div className={styles.viewport}>
        {auth.loading ? <LoadingState /> : !auth.user ? <SignInState message="Sign in to manage your EaziCart profile." /> : (
          <div className={styles.content}>
            <section className={styles.identity} aria-label="Customer profile">
              <div className={styles.identityRow}>
                <button className={styles.avatar} onClick={() => setMenu(true)} aria-label="Open account navigation"><ProfileAvatar userId={auth.user.id} name={auth.user.name} /></button>
                <div className={styles.identityCopy}><h2>{auth.user.name}</h2><p>{auth.user.username ? `@${auth.user.username}` : "Personal account"}</p>{auth.user.username ? <small>Personal account</small> : null}</div>
                <Link href="/settings" className={styles.settings} aria-label="Account settings"><Icon name="settings" size={22} /></Link>
              </div>
              <Link className={styles.edit} href="/edit-profile">Edit profile</Link>
            </section>

            <section className={styles.stats} aria-label="Profile activity counts">
              {[
                { label: "Orders", href: "/orders", result: orders },
                { label: "Saved", href: "/saved", result: saved },
                { label: "Following", href: "/following", result: following },
              ].map(({ label, href, result }) => <Link href={href} key={label}><strong className={result.error ? styles.metricError : undefined}>{result.loading ? "…" : result.error ? "—" : (result.data?.data.length ?? 0)}</strong><span>{label}</span></Link>)}
            </section>

            <nav className={styles.tabs} aria-label="Profile sections">
              <span aria-current="page">Activity</span><Link href="/reviews">Reviews</Link><Link href="/seller/dashboard">Sell</Link>
            </nav>

            <section className={styles.activity} aria-label="Your activity">
              <ProfileRow href="/orders" icon="box" label="Orders" detail="Track and manage purchases" />
              <ProfileRow href="/saved" icon="bookmark" label="Saved" detail="Products you want to revisit" />
              <ProfileRow href="/following" icon="users" label="Following" detail="Sellers and stores you follow" />
              <ProfileRow href="/reviews" icon="star" label="Reviews" detail="Your ratings and feedback" />
            </section>

            <section className={styles.account}>
              <h2>Account</h2>
              <ProfileRow href="/address-book" icon="location" label="Address book" detail="Manage delivery addresses" />
              <ProfileRow href="/payment-methods" icon="card" label="Payment methods" detail="Wallet and cards" />
              <ProfileRow href="/notifications" icon="bell" label="Notifications" detail="Orders, offers and activity" />
            </section>
          </div>
        )}
      </div>
      <BottomNavigation />
      {menu ? <SideNavigation onClose={closeMenu} /> : null}
    </main>
  );
}

function ProfileLoadingShell() { return <main className={`app-shell ${styles.page}`}><header className={styles.header}><h1>Profile</h1></header><div className={styles.viewport}><LoadingState /></div></main>; }

function ProfileRow({ href, icon, label, detail }: { href: string; icon: IconName; label: string; detail: string }) {
  return <Link href={href} className={styles.row}><span className={styles.rowIcon}><Icon name={icon} size={22} /></span><span><strong>{label}</strong><small>{detail}</small></span><Icon name="chevron" size={20} /></Link>;
}
