/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { money } from "../../data";
import { useRequest } from "../../hooks/use-request";
import { orderStatusLabel } from "../../orders/order-utils";
import { useAuth } from "../../providers/auth-provider";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import { sellerOrdersApi } from "../../../lib/api/seller-orders";
import styles from "./seller-orders.module.css";

const filters = [
  "ALL",
  "PENDING",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
] as const;
type Filter = (typeof filters)[number];

const filterLabels: Record<Filter, string> = {
  ALL: "All",
  PENDING: "Processing",
  CONFIRMED: "Confirmed",
  FULFILLED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function SellerOrdersPage() {
  const auth = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const result = useRequest(
    async () =>
      profile.data?.data ? sellerOrdersApi.list() : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <SellerOrdersShell>
        <LoadingState label="Loading seller orders…" />
      </SellerOrdersShell>
    );
  }

  if (!auth.user) {
    return (
      <SellerOrdersShell>
        <SignInState message="Sign in to manage seller orders." />
      </SellerOrdersShell>
    );
  }

  if (profile.error) {
    return (
      <SellerOrdersShell>
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </SellerOrdersShell>
    );
  }

  if (!profile.data?.data) {
    return (
      <SellerOrdersShell>
        <section className={styles.setupPrompt}>
          <Icon name="bag" size={26} />
          <h1>Create your seller profile first</h1>
          <p>
            Your seller profile is required before order activity can be shown.
          </p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </SellerOrdersShell>
    );
  }

  if (result.loading || (!result.data && !result.error)) {
    return (
      <SellerOrdersShell>
        <LoadingState label="Loading seller orders…" />
      </SellerOrdersShell>
    );
  }

  if (result.error || !result.data) {
    return (
      <SellerOrdersShell>
        <ErrorState
          message={result.error || "Seller orders are unavailable."}
          retry={() => void result.reload()}
        />
      </SellerOrdersShell>
    );
  }

  const orders = result.data.data;
  const visible =
    filter === "ALL"
      ? orders
      : orders.filter((order) => order.status === filter);
  const pending = orders.filter((order) => order.status === "PENDING").length;
  const confirmed = orders.filter(
    (order) => order.status === "CONFIRMED",
  ).length;

  return (
    <SellerOrdersShell>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Seller operations</p>
          <h1>Orders</h1>
          <p>
            Only products sold by {profile.data.data.displayName} appear in
            these order views.
          </p>
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Seller order summary">
        <SummaryCard label="Total orders" value={orders.length} />
        <SummaryCard label="Processing" value={pending} />
        <SummaryCard label="Confirmed" value={confirmed} />
        <SummaryCard
          label="Delivered"
          value={orders.filter((order) => order.status === "FULFILLED").length}
        />
      </section>

      <div
        className={styles.filters}
        role="group"
        aria-label="Filter seller orders"
      >
        {filters.map((value) => (
          <button
            key={value}
            type="button"
            className={filter === value ? styles.activeFilter : styles.filter}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {filterLabels[value]}
          </button>
        ))}
      </div>

      {!orders.length ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            title="No seller orders yet"
            message="Orders containing your products will appear here."
            icon="bag"
          />
        </div>
      ) : !visible.length ? (
        <div className={styles.filteredEmpty}>
          No {filterLabels[filter].toLowerCase()} seller orders.
        </div>
      ) : (
        <section className={styles.orderList} aria-label="Seller orders">
          {visible.map((order) => {
            const first = order.items[0];
            const image = first?.product.images[0];
            const units = order.items.reduce(
              (sum, item) => sum + item.quantity,
              0,
            );
            return (
              <Link
                className={styles.orderCard}
                href={`/seller/orders/${order.id}`}
                key={order.id}
              >
                <div className={styles.cardTop}>
                  <div>
                    <p>Order #{order.id.slice(-8)}</p>
                    <h2>{order.customer.name}</h2>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <span
                    className={`${styles.status} ${statusClass(order.status)}`}
                  >
                    {orderStatusLabel(order.status)}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.thumb}>
                    {image ? (
                      <img
                        src={image.url}
                        alt={image.altText || first?.productName || ""}
                      />
                    ) : (
                      <Icon name="bag" size={24} />
                    )}
                  </div>
                  <div className={styles.cardMeta}>
                    <strong>{money(order.subtotal)}</strong>
                    <span>
                      Your subtotal · {units} {units === 1 ? "unit" : "units"} ·{" "}
                      {order.items.length}{" "}
                      {order.items.length === 1 ? "product" : "products"}
                    </span>
                  </div>
                  <Icon name="chevron" size={19} />
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <aside className={styles.note}>
        <strong>Seller-safe order view</strong>
        <p>
          Only your line items and subtotal are shown. Order status is read-only
          until EaziCart supports seller-specific fulfillment state.
        </p>
      </aside>
    </SellerOrdersShell>
  );
}

function SellerOrdersShell({ children }: { children: ReactNode }) {
  return (
    <main className={`app-shell ${styles.page}`}>
      <header className={styles.topbar}>
        <Link
          className={styles.back}
          href="/seller/dashboard"
          aria-label="Back to seller dashboard"
        >
          <Icon name="back" size={22} />
        </Link>
        <span>Seller orders</span>
        <span aria-hidden="true" />
      </header>
      {children}
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "FULFILLED") return styles.success;
  if (status === "CANCELLED") return styles.cancelled;
  if (status === "CONFIRMED") return styles.confirmed;
  return styles.pending;
}
