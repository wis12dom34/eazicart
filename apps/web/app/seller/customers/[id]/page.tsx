"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../../components/async-state";
import { Icon } from "../../../components/icon";
import { useRequest } from "../../../hooks/use-request";
import { orderStatusLabel } from "../../../orders/order-utils";
import { useAuth } from "../../../providers/auth-provider";
import { sellerCustomersApi } from "../../../../lib/api/seller-customers";
import { sellerDashboardApi } from "../../../../lib/api/seller-dashboard";
import styles from "../seller-customers.module.css";

export default function SellerCustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const result = useRequest(
    async () =>
      profile.data?.data && params.id
        ? sellerCustomersApi.get(params.id)
        : Promise.resolve(undefined),
    [profile.data?.data?.id, params.id],
  );

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <DetailShell>
        <LoadingState label="Loading customer…" />
      </DetailShell>
    );
  }

  if (!auth.user) {
    return (
      <DetailShell>
        <SignInState message="Sign in to view seller customers." />
      </DetailShell>
    );
  }

  if (profile.error) {
    return (
      <DetailShell>
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </DetailShell>
    );
  }

  if (!profile.data?.data) {
    return (
      <DetailShell>
        <section className={styles.setupPrompt}>
          <h1>Seller profile required</h1>
          <p>
            Create your seller profile before viewing seller customer activity.
          </p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </DetailShell>
    );
  }

  if (result.loading || (!result.data && !result.error)) {
    return (
      <DetailShell>
        <LoadingState label="Loading customer…" />
      </DetailShell>
    );
  }

  if (result.error || !result.data) {
    return (
      <DetailShell>
        <ErrorState
          message={result.error || "Seller customer is unavailable."}
          retry={() => void result.reload()}
        />
      </DetailShell>
    );
  }

  const { customer, orders } = result.data.data;

  return (
    <DetailShell>
      <section className={styles.detailHero}>
        <div>
          <p className={styles.eyebrow}>Seller customer</p>
          <h1>{customer.name}</h1>
          <div className={styles.detailLocation}>
            {formatLocation(customer.location)}
          </div>
        </div>
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.panel} aria-labelledby="customer-orders">
          <div className={styles.panelHeading}>
            <p>Order history</p>
            <h2 id="customer-orders">Orders from your store</h2>
          </div>
          <div className={styles.orderList}>
            {orders.map((order) => (
              <Link
                className={styles.orderRow}
                href={`/seller/orders/${order.id}`}
                key={order.id}
              >
                <div>
                  <h3>Order #{order.id.slice(-8)}</h3>
                  <p>
                    {formatDate(order.createdAt)} · {order.units}{" "}
                    {order.units === 1 ? "unit" : "units"}
                  </p>
                  <p>
                    {order.items
                      .map((item) => `${item.productName} × ${item.quantity}`)
                      .join(" · ")}
                  </p>
                </div>
                <div className={styles.orderAside}>
                  <span className={styles.status}>
                    {orderStatusLabel(order.status)}
                  </span>
                  <Icon name="chevron" size={18} />
                </div>
              </Link>
            ))}
          </div>
        </section>

        <div>
          <section className={styles.panel} aria-labelledby="customer-summary">
            <div className={styles.panelHeading}>
              <p>Relationship</p>
              <h2 id="customer-summary">Customer summary</h2>
            </div>
            <div className={styles.statList}>
              <StatRow label="Orders" value={customer.orders.toLocaleString()} />
              <StatRow label="Units ordered" value={customer.units.toLocaleString()} />
              <StatRow label="First order" value={formatDate(customer.firstOrderAt)} />
              <StatRow label="Latest order" value={formatDate(customer.latestOrderAt)} />
            </div>
          </section>

          <aside className={styles.note}>
            <strong>Privacy-limited profile</strong>
            <p>
              Email and exact delivery address are intentionally omitted. Open
              an individual seller order when delivery information is required.
            </p>
          </aside>
        </div>
      </div>
    </DetailShell>
  );
}

function DetailShell({ children }: { children: ReactNode }) {
  return (
    <main className={`app-shell ${styles.page}`}>
      <header className={styles.topbar}>
        <Link
          className={styles.back}
          href="/seller/customers"
          aria-label="Back to seller customers"
        >
          <Icon name="back" size={22} />
        </Link>
        <span>Customer details</span>
        <span aria-hidden="true" />
      </header>
      {children}
    </main>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statRow}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatLocation(location: {
  city: string;
  region: string;
  country: string;
}) {
  return [location.city, location.region, location.country]
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .join(", ");
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}
