"use client";

import Link from "next/link";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import type {
  SellerDashboard,
  SellerDashboardRevenue,
} from "../../../lib/api/types";
import styles from "./seller-dashboard.module.css";

export default function SellerDashboardPage() {
  const auth = useAuth();
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const dashboard = useRequest(
    async () =>
      profile.data?.data
        ? sellerDashboardApi.dashboard()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <DashboardHeader />
        <LoadingState label="Loading your seller workspace…" />
      </main>
    );
  }

  if (!auth.user) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <DashboardHeader />
        <SignInState message="Sign in to open your seller workspace." />
      </main>
    );
  }

  if (profile.error) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <DashboardHeader />
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </main>
    );
  }

  if (!profile.data?.data) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <DashboardHeader />
        <SellerSetup
          defaultName={auth.user.name}
          onCreated={() => profile.reload()}
        />
      </main>
    );
  }

  if (dashboard.loading) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <DashboardHeader />
        <LoadingState label="Loading seller metrics…" />
      </main>
    );
  }

  if (dashboard.error || !dashboard.data) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <DashboardHeader />
        <ErrorState
          message={dashboard.error || "Seller dashboard is unavailable."}
          retry={() => void dashboard.reload()}
        />
      </main>
    );
  }

  return (
    <main
      className={`app-shell ${styles.page} ${styles.dashboardPage}`}
      data-figma-node="247:320"
    >
      <DashboardContent dashboard={dashboard.data.data} />
    </main>
  );
}

function DashboardHeader() {
  return (
    <header className={styles.topbar}>
      <Link
        className={styles.back}
        href="/profile"
        aria-label="Back to profile"
      >
        <Icon name="back" size={22} />
      </Link>
      <span>Seller workspace</span>
    </header>
  );
}

function SellerSetup({
  defaultName,
  onCreated,
}: {
  defaultName: string;
  onCreated: () => Promise<unknown>;
}) {
  const [displayName, setDisplayName] = useState(defaultName);
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await sellerDashboardApi.createProfile({
        displayName,
        bio: bio.trim() ? bio.trim() : null,
      });
      await onCreated();
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to start selling",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className={styles.setupCard} aria-labelledby="seller-setup-title">
      <div className={styles.setupIcon} aria-hidden="true">
        <Icon name="bag" size={24} />
      </div>
      <div className={styles.setupIntro}>
        <p className={styles.eyebrow}>Seller account</p>
        <h1 id="seller-setup-title">Start selling on EaziCart</h1>
        <p>
          Create your store profile to unlock inventory, order and customer
          management.
        </p>
      </div>

      <form
        className={styles.setupForm}
        onSubmit={(event) => void submit(event)}
      >
        <label>
          Store name
          <input
            required
            minLength={2}
            maxLength={120}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your business name"
          />
        </label>
        <label>
          Store bio <span>Optional</span>
          <textarea
            maxLength={2000}
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            placeholder="What do you sell?"
            rows={4}
          />
        </label>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <button
          className={styles.primaryButton}
          disabled={submitting}
          type="submit"
        >
          {submitting ? "Creating store…" : "Create seller profile"}
        </button>
      </form>
    </section>
  );
}

function DashboardContent({ dashboard }: { dashboard: SellerDashboard }) {
  const revenue = primaryRevenue(dashboard.analytics.revenue);
  const attention = [
    dashboard.orders.pending > 0
      ? {
          label: `${dashboard.orders.pending.toLocaleString()} ${dashboard.orders.pending === 1 ? "order" : "orders"} awaiting confirmation`,
          action: "View orders",
          href: "/seller/orders",
        }
      : null,
    dashboard.orders.confirmed > 0
      ? {
          label: `${dashboard.orders.confirmed.toLocaleString()} confirmed ${dashboard.orders.confirmed === 1 ? "order" : "orders"} to fulfill`,
          action: "Fulfill orders",
          href: "/seller/orders",
        }
      : null,
    dashboard.inventory.outOfStockProducts > 0
      ? {
          label: `${dashboard.inventory.outOfStockProducts.toLocaleString()} out-of-stock ${dashboard.inventory.outOfStockProducts === 1 ? "product" : "products"}`,
          action: "Manage stock",
          href: "/seller/products",
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => Boolean(item));

  const quickActions = [
    { label: "Products", href: "/seller/products" },
    { label: "Orders", href: "/seller/orders" },
    { label: "Finance", href: "/seller/finance" },
    { label: "Content", href: "/seller/reels" },
    { label: "Customers", href: "/seller/customers" },
    { label: "Storefront", href: "/seller/store" },
    { label: "Public store", href: `/seller/${dashboard.seller.id}` },
    { label: "Subscription", href: "/seller/subscription" },
    { label: "Profile", href: "/profile" },
  ];

  return (
    <>
      <header className={styles.mobileHeader}>
        <div>
          <p>Welcome back</p>
          <h1>{dashboard.seller.displayName}</h1>
        </div>
        <div className={styles.headerActions}>
          <Link className={styles.customerSwitch} href="/">
            Customer
            <Icon name="back" size={16} />
          </Link>
          <Link className={styles.profileButton} href="/profile" aria-label="Profile">
            <Icon name="user" size={19} />
          </Link>
        </div>
      </header>

      <section className={styles.mobileMetricGrid} aria-label="Seller summary">
        <MetricCard
          label="Verified sales"
          value={revenue.value}
          detail={revenue.detail}
        />
        <MetricCard
          label="Orders"
          value={dashboard.orders.total.toLocaleString()}
          detail={`${dashboard.orders.pending.toLocaleString()} pending`}
        />
        <MetricCard
          label="Products"
          value={dashboard.inventory.totalProducts.toLocaleString()}
          detail={`${dashboard.inventory.activeProducts.toLocaleString()} active`}
        />
        <MetricCard
          label="Customers"
          value={dashboard.customers.total.toLocaleString()}
          detail="Unique buyers"
        />
      </section>

      <section className={styles.attentionSection}>
        <h2>Needs attention</h2>
        <div className={styles.attentionList}>
          {attention.length ? (
            attention.map((item) => (
              <Link className={styles.attentionRow} href={item.href} key={`${item.href}-${item.label}`}>
                <strong>{item.label}</strong>
                <span>
                  {item.action} <b aria-hidden="true">›</b>
                </span>
              </Link>
            ))
          ) : (
            <div className={`${styles.attentionRow} ${styles.attentionEmpty}`}>
              <strong>No urgent store tasks</strong>
              <span>You’re all caught up</span>
            </div>
          )}
        </div>
      </section>

      <section className={styles.quickSection}>
        <h2>Quick actions</h2>
        <div className={styles.quickGrid}>
          {quickActions.map((item) => (
            <Link href={item.href} key={item.label}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>

      <SellerBottomNavigation />
    </>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
}) {
  return (
    <article className={styles.mobileMetricCard}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function SellerBottomNavigation() {
  const items = [
    { label: "Home", href: "/seller/dashboard", icon: "home", active: true },
    { label: "Products", href: "/seller/products", icon: "box" },
    { label: "Orders", href: "/seller/orders", icon: "bag" },
    { label: "Storefront", href: "/seller/store", icon: "shirt" },
    { label: "Profile", href: "/profile", icon: "user" },
  ];

  return (
    <nav className={styles.sellerNav} aria-label="Seller navigation">
      {items.map((item) => (
        <Link
          className={item.active ? styles.sellerNavActive : undefined}
          href={item.href}
          key={item.label}
          aria-current={item.active ? "page" : undefined}
        >
          <span className={styles.sellerNavIcon}>
            <Icon name={item.icon} size={20} />
          </span>
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

function primaryRevenue(revenue: SellerDashboardRevenue[]) {
  if (!revenue.length) return { value: "—", detail: "No verified sales yet" };
  const primary = revenue.find((item) => item.currency === "NGN") ?? revenue[0];
  return {
    value: formatMoney(primary.gross, primary.currency),
    detail:
      revenue.length > 1
        ? `${revenue.length.toLocaleString()} currencies tracked`
        : "Successful payments",
  };
}

function formatMoney(value: string, currency: string) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG")}`;
  }
}
