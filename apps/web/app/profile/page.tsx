"use client";

import Link from "next/link";
import { Suspense, useCallback, useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import {
  CustomerDesktopRail,
  DesktopCustomerShell,
} from "../components/desktop-customer-shell";
import { Icon, type IconName } from "../components/icon";
import { ProfileAvatar } from "../components/profile-avatar";
import { SideNavigation } from "../components/side-navigation";
import { LoadingState, SignInState } from "../components/async-state";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { followsApi } from "../../lib/api/follows";
import { ordersApi } from "../../lib/api/orders";
import { savedApi } from "../../lib/api/saved";
import { sellerSubscriptionsApi } from "../../lib/api/seller-subscriptions";
import styles from "./profile.module.css";

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileLoadingShell />}>
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const auth = useAuth();
  const [menu, setMenu] = useState(false);
  const closeMenu = useCallback(() => setMenu(false), []);
  const orders = useRequest(
    () =>
      auth.isAuthenticated
        ? ordersApi.list()
        : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const saved = useRequest(
    () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const following = useRequest(
    () =>
      auth.isAuthenticated
        ? followsApi.list()
        : Promise.resolve({ data: [] }),
    [auth.isAuthenticated],
  );
  const subscription = useRequest(
    async () => {
      if (!auth.isAuthenticated) return undefined;
      try {
        return await sellerSubscriptionsApi.current();
      } catch {
        return undefined;
      }
    },
    [auth.isAuthenticated],
  );

  const planCode = subscription.data?.data.subscription?.plan.code ?? "BASIC";
  const planName =
    planCode === "PRO" ? "EaziCart Pro" : planCode === "BUSINESS" ? "EaziCart Business" : "EaziCart Basic";

  return (
    <DesktopCustomerShell activeHref="/profile" rail={<CustomerDesktopRail />}>
      <main className={styles.page}>
        <div className={`app-shell ${styles.mobileLayout}`} data-figma-node="19:120">
          <header className={styles.header}>
            <Link href="/" aria-label="Back to home">
              <Icon name="back" size={22} />
            </Link>
            <h1>Profile</h1>
          </header>
          <div className={styles.viewport}>
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
                      aria-label="Open account navigation"
                    >
                      <ProfileAvatar userId={auth.user.id} name={auth.user.name} />
                    </button>
                    <div className={styles.identityCopy}>
                      <h2>{auth.user.name}</h2>
                      <p>
                        {auth.user.username
                          ? `@${auth.user.username}`
                          : "Personal account"}
                      </p>
                      {auth.user.username ? <small>Personal account</small> : null}
                    </div>
                    <Link
                      href="/settings"
                      className={styles.settings}
                      aria-label="Account settings"
                    >
                      <Icon name="settings" size={22} />
                    </Link>
                  </div>
                  <Link className={styles.edit} href="/edit-profile">
                    Edit profile
                  </Link>
                </section>

                <section className={styles.stats} aria-label="Profile activity counts">
                  {[
                    { label: "Orders", href: "/orders", result: orders },
                    { label: "Saved", href: "/saved", result: saved },
                    { label: "Following", href: "/following", result: following },
                  ].map(({ label, href, result }) => (
                    <Link href={href} key={label}>
                      <strong className={result.error ? styles.metricError : undefined}>
                        {result.loading
                          ? "…"
                          : result.error
                            ? "—"
                            : (result.data?.data.length ?? 0)}
                      </strong>
                      <span>{label}</span>
                    </Link>
                  ))}
                </section>

                <nav className={styles.tabs} aria-label="Profile sections">
                  <span aria-current="page">Activity</span>
                  <Link href="/reviews">Reviews</Link>
                  <Link href="/seller/dashboard">Sell</Link>
                </nav>

                <section className={styles.activity} aria-label="Your activity">
                  <ProfileRow
                    href="/orders"
                    icon="box"
                    label="Orders"
                    detail="Track and manage purchases"
                  />
                  <ProfileRow
                    href="/saved"
                    icon="bookmark"
                    label="Saved"
                    detail="Products you want to revisit"
                  />
                  <ProfileRow
                    href="/following"
                    icon="users"
                    label="Following"
                    detail="Sellers and stores you follow"
                  />
                  <ProfileRow
                    href="/reviews"
                    icon="star"
                    label="Reviews"
                    detail="Your ratings and feedback"
                  />
                </section>

                <section className={styles.account}>
                  <h2>Account</h2>
                  <ProfileRow
                    href="/address-book"
                    icon="location"
                    label="Address book"
                    detail="Manage delivery addresses"
                  />
                  <ProfileRow
                    href="/payment-methods"
                    icon="card"
                    label="Payment methods"
                    detail="Wallet and cards"
                  />
                  <ProfileRow
                    href="/notifications"
                    icon="bell"
                    label="Notifications"
                    detail="Orders, offers and activity"
                  />
                </section>
              </div>
            )}
          </div>
          <BottomNavigation />
          {menu ? <SideNavigation onClose={closeMenu} /> : null}
        </div>

        <section className={styles.desktopLayout} data-figma-node="3401:20491">
          <header className={styles.desktopHeader}>
            <h1>Profile</h1>
            <p>Manage your account, preferences and membership.</p>
          </header>

          {auth.loading ? (
            <div className={styles.desktopState}>
              <LoadingState />
            </div>
          ) : !auth.user ? (
            <div className={styles.desktopState}>
              <SignInState message="Sign in to manage your EaziCart profile." />
            </div>
          ) : (
            <>
              <section className={styles.desktopIdentity} aria-label="Customer profile">
                <div className={styles.desktopAvatar}>
                  <ProfileAvatar userId={auth.user.id} name={auth.user.name} />
                </div>
                <div className={styles.desktopIdentityCopy}>
                  <h2>{auth.user.name}</h2>
                  <p>
                    {auth.user.username ? `@${auth.user.username}` : auth.user.email} · Customer
                  </p>
                  <div className={styles.desktopIdentityActions}>
                    <Link className={styles.upgrade} href="/seller/subscription?plan=PRO">
                      Upgrade account
                    </Link>
                    <span className={styles.planPill}>
                      {planCode === "BASIC" ? "Basic · Free" : planCode === "PRO" ? "Pro" : "Business"}
                    </span>
                  </div>
                </div>
                <Link className={styles.desktopEdit} href="/edit-profile">
                  Edit profile
                </Link>
              </section>

              <section className={styles.desktopAccount} aria-labelledby="profile-account-heading">
                <h2 id="profile-account-heading">Account</h2>
                <DesktopAccountRow
                  href="/edit-profile"
                  label="Personal information"
                  detail="Name, username and account details"
                />
                <DesktopAccountRow
                  href="/address-book"
                  label="Addresses"
                  detail="Delivery locations and saved addresses"
                />
                <DesktopAccountRow
                  href="/payment-methods"
                  label="Payment methods"
                  detail="Cards and payment preferences"
                />
                <DesktopAccountRow
                  href="/privacy-security"
                  label="Security"
                  detail="Password, sessions and two-factor authentication"
                />
                <DesktopAccountRow
                  href="/privacy-security"
                  label="Privacy & safety"
                  detail="Blocked accounts and privacy controls"
                />
                <DesktopAccountRow
                  href="/settings"
                  label="Appearance"
                  detail="Theme and display preferences"
                />
                <DesktopAccountRow
                  href="/chat"
                  label="Help & support"
                  detail="Support requests and help center"
                />
              </section>

              <section className={styles.membership} aria-labelledby="membership-heading">
                <h2 id="membership-heading">Membership</h2>
                <div className={styles.membershipCard}>
                  <div>
                    <strong>{planName}</strong>
                    <p>
                      {planCode === "BASIC"
                        ? "Free plan · Upgrade anytime for seller and premium benefits."
                        : "Manage your EaziCart seller membership and billing preferences."}
                    </p>
                  </div>
                  <Link href="/seller/subscription?plan=PRO">
                    {planCode === "BASIC" ? "Upgrade" : "Manage"}
                  </Link>
                </div>
              </section>
            </>
          )}
        </section>
      </main>
    </DesktopCustomerShell>
  );
}

function ProfileLoadingShell() {
  return (
    <DesktopCustomerShell activeHref="/profile" rail={<CustomerDesktopRail />}>
      <main className={styles.page}>
        <div className={`app-shell ${styles.mobileLayout}`}>
          <header className={styles.header}>
            <h1>Profile</h1>
          </header>
          <div className={styles.viewport}>
            <LoadingState />
          </div>
        </div>
        <section className={styles.desktopLayout}>
          <div className={styles.desktopState}>
            <LoadingState />
          </div>
        </section>
      </main>
    </DesktopCustomerShell>
  );
}

function ProfileRow({
  href,
  icon,
  label,
  detail,
}: {
  href: string;
  icon: IconName;
  label: string;
  detail: string;
}) {
  return (
    <Link href={href} className={styles.row}>
      <span className={styles.rowIcon}>
        <Icon name={icon} size={22} />
      </span>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <Icon name="chevron" size={20} />
    </Link>
  );
}

function DesktopAccountRow({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link className={styles.desktopAccountRow} href={href}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <Icon name="chevron" size={18} />
    </Link>
  );
}
