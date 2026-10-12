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
import { SellerBottomNavigation } from "../../components/seller-bottom-navigation";
import { money } from "../../data";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import { sellerOrdersApi } from "../../../lib/api/seller-orders";
import styles from "./seller-orders.module.css";

const filters = ["ALL", "PENDING", "CONFIRMED", "FULFILLED", "CANCELLED"] as const;
type Filter = (typeof filters)[number];

const filterLabels: Record<Filter, string> = {
  ALL: "All",
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  FULFILLED: "Fulfilled",
  CANCELLED: "Cancelled",
};

export default function SellerOrdersPage() {
  const auth = useAuth();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");

  const profile = useRequest(
    async () =>
      auth.isAuthenticated ? sellerDashboardApi.profile() : Promise.resolve(undefined),
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
        <ErrorState message={profile.error} retry={() => void profile.reload()} />
      </SellerOrdersShell>
    );
  }
  if (!profile.data?.data) {
    return (
      <SellerOrdersShell>
        <section className={styles.setupPrompt}>
          <div className={styles.setupIcon}>
            <Icon name="bag" size={24} />
          </div>
          <p className={styles.eyebrow}>Seller account required</p>
          <h1>Create your store before managing orders</h1>
          <p>Your seller profile is required before order activity can be shown.</p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </SellerOrdersShell>
    );
  }
  if (result.loading || (!result.data && !result.error)) {
    return (
      <SellerOrdersShell storeName={profile.data.data.displayName}>
        <LoadingState label="Loading seller orders…" />
      </SellerOrdersShell>
    );
  }
  if (result.error || !result.data) {
    return (
      <SellerOrdersShell storeName={profile.data.data.displayName}>
        <ErrorState
          message={result.error || "Seller orders are unavailable."}
          retry={() => void result.reload()}
        />
      </SellerOrdersShell>
    );
  }

  const orders = result.data.data;
  const normalizedQuery = query.trim().toLowerCase();
  const visible = orders.filter((order) => {
    const matchesFilter = filter === "ALL" || order.status === filter;
    if (!matchesFilter) return false;
    if (!normalizedQuery) return true;

    return (
      order.id.toLowerCase().includes(normalizedQuery) ||
      order.customer.name.toLowerCase().includes(normalizedQuery) ||
      order.items.some((item) => item.productName.toLowerCase().includes(normalizedQuery))
    );
  });

  const pending = orders.filter((order) => order.status === "PENDING").length;
  const confirmed = orders.filter((order) => order.status === "CONFIRMED").length;
  const fulfilled = orders.filter((order) => order.status === "FULFILLED").length;

  return (
    <SellerOrdersShell storeName={profile.data.data.displayName}>
      <section className={styles.orderControls} aria-label="Order search and filters">
        <label className={styles.searchField}>
          <Icon name="search" size={17} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search orders or customers"
            aria-label="Search orders or customers"
          />
        </label>

        <div className={styles.filterRow} role="group" aria-label="Filter seller orders">
          {filters.map((value) => (
            <button
              key={value}
              type="button"
              className={filter === value ? styles.activeFilter : styles.filterButton}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {filterLabels[value]}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.summaryGrid} aria-label="Seller order summary">
        <SummaryCard label="Total orders" value={orders.length} />
        <SummaryCard label="Pending" value={pending} />
        <SummaryCard label="Confirmed" value={confirmed} />
        <SummaryCard label="Fulfilled" value={fulfilled} />
      </section>

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
          No orders match your current search and filter.
        </div>
      ) : (
        <section className={styles.orderList} aria-label="Seller orders">
          {visible.map((order) => {
            const first = order.items[0];
            const image = first?.product.images[0];
            const units = order.items.reduce((sum, item) => sum + item.quantity, 0);

            return (
              <Link
                className={styles.orderCard}
                href={`/seller/orders/${order.id}`}
                key={order.id}
              >
                <div className={styles.cardTop}>
                  <div className={styles.orderIdentity}>
                    <p>Order #{order.id.slice(-8)}</p>
                    <h2>{order.customer.name}</h2>
                    <span>{formatDate(order.createdAt)}</span>
                  </div>
                  <span className={`${styles.status} ${statusClass(order.status)}`}>
                    {fulfillmentLabel(order.status)}
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
                      {order.items.length} {order.items.length === 1 ? "product" : "products"}
                    </span>
                  </div>
                  <Icon name="chevron" size={18} />
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <aside className={styles.note}>
        <strong>Seller-safe fulfillment</strong>
        <p>
          Only your line items, subtotal and fulfillment status are shown. Your status
          changes do not alter another seller&apos;s fulfillment state or the buyer/global
          order status.
        </p>
      </aside>
    </SellerOrdersShell>
  );
}

function SellerOrdersShell({
  children,
  storeName,
}: {
  children: ReactNode;
  storeName?: string;
}) {
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
        <div className={styles.headerCopy}>
          <strong>Orders</strong>
          <span>
            {storeName ? `Manage orders for ${storeName}` : "Manage your seller orders"}
          </span>
        </div>
      </header>
      {children}
      <SellerBottomNavigation active="orders" />
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

function fulfillmentLabel(status: string) {
  if (status === "FULFILLED") return "Fulfilled";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "CONFIRMED") return "Confirmed";
  return "Pending";
}

function statusClass(status: string) {
  if (status === "FULFILLED") return styles.success;
  if (status === "CANCELLED") return styles.cancelled;
  if (status === "CONFIRMED") return styles.confirmed;
  return styles.pending;
}
