"use client";

import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { LoadingState, SignInState } from "../components/async-state";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import { followsApi } from "../../lib/api/follows";
import { ordersApi } from "../../lib/api/orders";
import { savedApi } from "../../lib/api/saved";
import styles from "./profile.module.css";

export default function ProfilePage() {
  const auth = useAuth();
  const orders = useRequest(
    async () => (auth.isAuthenticated ? ordersApi.list() : { data: [] }),
    [auth.isAuthenticated],
  );
  const saved = useRequest(
    async () => (auth.isAuthenticated ? savedApi.list() : { data: [] }),
    [auth.isAuthenticated],
  );
  const following = useRequest(
    async () => (auth.isAuthenticated ? followsApi.list() : { data: [] }),
    [auth.isAuthenticated],
  );

  return (
    <main className={`app-shell ${styles.page}`}>
      {auth.loading ? (
        <LoadingState />
      ) : !auth.user ? (
        <SignInState message="Sign in to manage your EaziCart profile." />
      ) : (
        <>
          <section className={styles.identityRow} aria-label="Customer profile">
            <Link className={styles.identityLink} href="/edit-profile">
              <div className={styles.avatar} aria-hidden="true">
                {initials(auth.user.name)}
              </div>
              <div className={styles.identityCopy}>
                <h1>{auth.user.name}</h1>
                <p>{auth.user.email}</p>
              </div>
            </Link>
            <Link
              className={styles.settingsLink}
              href="/settings"
              aria-label="Account settings"
            >
              <Icon name="settings" size={22} />
            </Link>
          </section>

          <section className={styles.stats} aria-label="Profile activity counts">
            <ProfileStat
              href="/orders"
              label="Orders"
              value={metricValue(orders.loading, orders.error, orders.data?.data.length)}
              hasError={Boolean(orders.error)}
            />
            <ProfileStat
              href="/saved"
              label="Saved"
              value={metricValue(saved.loading, saved.error, saved.data?.data.length)}
              hasError={Boolean(saved.error)}
            />
            <ProfileStat
              href="/following"
              label="Following"
              value={metricValue(
                following.loading,
                following.error,
                following.data?.data.length,
              )}
              hasError={Boolean(following.error)}
            />
          </section>

          <section className={`${styles.section} ${styles.activitySection}`}>
            <h2 className={styles.sectionTitle}>Your activity</h2>
            <div className={styles.activityList}>
              <ActivityLink
                href="/orders"
                icon="bag"
                label="Orders"
                detail="Track and manage purchases"
              />
              <ActivityLink
                href="/saved"
                icon="heart"
                label="Saved"
                detail="Products you want to revisit"
              />
              <ActivityLink
                href="/following"
                icon="users"
                label="Following"
                detail="Sellers and stores you follow"
              />
              <ActivityLink
                href="/reviews"
                icon="star"
                label="Reviews"
                detail="Your ratings and feedback"
              />
            </div>
          </section>

          <section className={`${styles.section} ${styles.accountSection}`}>
            <h2 className={styles.sectionTitle}>Account</h2>
            <div className={styles.accountList}>
              <AccountLink
                href="/address-book"
                label="Address book"
                detail="Manage delivery addresses"
              />
              <AccountLink
                href="/payment-methods"
                label="Payment methods"
                detail="Wallet and cards"
              />
              <AccountLink
                href="/notifications"
                label="Notifications"
                detail="Orders, offers and activity"
              />
            </div>
          </section>
        </>
      )}
      <BottomNavigation />
    </main>
  );
}

function ProfileStat({
  href,
  label,
  value,
  hasError,
}: {
  href: string;
  label: string;
  value: string;
  hasError: boolean;
}) {
  return (
    <Link className={styles.stat} href={href}>
      <strong className={hasError ? styles.metricError : undefined}>{value}</strong>
      <span>{label}</span>
    </Link>
  );
}

function ActivityLink({
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
    <Link className={styles.activityItem} href={href}>
      <span className={styles.activityIcon}>
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.activityCopy}>
        <strong>{label}</strong>
        <span>{detail}</span>
      </span>
      <Icon className={styles.chevron} name="chevron" size={20} />
    </Link>
  );
}

function AccountLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link className={styles.accountItem} href={href}>
      <span className={styles.accountCopy}>
        <strong>{label}</strong>
        <span>{detail}</span>
      </span>
      <Icon className={styles.chevron} name="chevron" size={20} />
    </Link>
  );
}

function metricValue(loading: boolean, error: string, value?: number) {
  if (loading) return "…";
  if (error) return "—";
  return String(value ?? 0);
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}
