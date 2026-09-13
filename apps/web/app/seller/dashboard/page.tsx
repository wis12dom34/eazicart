"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import type { SellerDashboard } from "../../../lib/api/types";
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
    <main className={`app-shell ${styles.page}`}>
      <DashboardHeader />
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
          management. No payment setup is required yet.
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
  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Seller dashboard</p>
          <h1>{dashboard.seller.displayName}</h1>
          <p>Real operational data from your EaziCart store.</p>
        </div>
        <Link
          className={styles.storeLink}
          href={`/seller/${dashboard.seller.id}`}
        >
          View store
          <Icon name="chevron" size={18} />
        </Link>
      </section>

      <section className={styles.metricGrid} aria-label="Seller summary">
        <MetricCard
          label="Products"
          value={dashboard.inventory.totalProducts}
          detail={`${dashboard.inventory.activeProducts} active`}
        />
        <MetricCard
          label="Orders"
          value={dashboard.orders.total}
          detail={`${dashboard.orders.pending} pending`}
        />
        <MetricCard
          label="Customers"
          value={dashboard.customers.total}
          detail="Unique buyers"
        />
        <MetricCard
          label="Units in stock"
          value={dashboard.inventory.unitsInStock}
          detail={`${dashboard.inventory.outOfStockProducts} out of stock`}
        />
      </section>

      <div className={styles.columns}>
        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Inventory</p>
              <h2>Stock overview</h2>
            </div>
            <Icon name="box" size={22} />
          </div>
          <DataRow
            label="Total products"
            value={dashboard.inventory.totalProducts}
          />
          <DataRow
            label="Active products"
            value={dashboard.inventory.activeProducts}
          />
          <DataRow
            label="Units available"
            value={dashboard.inventory.unitsInStock}
          />
          <DataRow
            label="Out of stock"
            value={dashboard.inventory.outOfStockProducts}
          />
          <Link className={styles.panelLink} href="/seller/products">
            Manage products
            <Icon name="chevron" size={17} />
          </Link>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Orders</p>
              <h2>Order status</h2>
            </div>
            <Icon name="bag" size={22} />
          </div>
          <DataRow label="Pending" value={dashboard.orders.pending} />
          <DataRow label="Confirmed" value={dashboard.orders.confirmed} />
          <DataRow label="Fulfilled" value={dashboard.orders.fulfilled} />
          <DataRow label="Cancelled" value={dashboard.orders.cancelled} />
          <Link className={styles.panelLink} href="/seller/orders">
            Manage orders
            <Icon name="chevron" size={17} />
          </Link>
        </section>

        <section className={`${styles.panel} ${styles.customerPanel}`}>
          <div className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Customers</p>
              <h2>Buyer relationships</h2>
            </div>
          </div>
          <DataRow label="Unique buyers" value={dashboard.customers.total} />
          <Link className={styles.panelLink} href="/seller/customers">
            Manage customers
            <Icon name="chevron" size={17} />
          </Link>
        </section>
      </div>

      <section className={styles.analyticsPanel}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>Analytics</p>
            <h2>Performance</h2>
          </div>
          <Icon name="sparkle" size={22} />
        </div>
        <p className={styles.analyticsNote}>
          Revenue and engagement analytics will appear after EaziCart has real
          payment and event data. Nothing is estimated or fabricated here.
        </p>
        <div className={styles.analyticsGrid}>
          <UnavailableMetric label="Revenue" />
          <UnavailableMetric label="Product views" />
          <UnavailableMetric label="Impressions" />
          <UnavailableMetric label="Profile visits" />
          <UnavailableMetric label="Clicks" />
          <UnavailableMetric label="Conversion rate" />
        </div>
      </section>
    </>
  );
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail: string;
}) {
  return (
    <article className={styles.metricCard}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
      <small>{detail}</small>
    </article>
  );
}

function DataRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.dataRow}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </div>
  );
}

function UnavailableMetric({ label }: { label: string }) {
  return (
    <div className={styles.unavailableMetric}>
      <span>{label}</span>
      <strong>Not available yet</strong>
    </div>
  );
}
