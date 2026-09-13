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
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { sellerCustomersApi } from "../../../lib/api/seller-customers";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import styles from "./seller-customers.module.css";

export default function SellerCustomersPage() {
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const result = useRequest(
    async () =>
      profile.data?.data
        ? sellerCustomersApi.list()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <SellerCustomersShell>
        <LoadingState label="Loading seller customers…" />
      </SellerCustomersShell>
    );
  }

  if (!auth.user) {
    return (
      <SellerCustomersShell>
        <SignInState message="Sign in to manage seller customers." />
      </SellerCustomersShell>
    );
  }

  if (profile.error) {
    return (
      <SellerCustomersShell>
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </SellerCustomersShell>
    );
  }

  if (!profile.data?.data) {
    return (
      <SellerCustomersShell>
        <section className={styles.setupPrompt}>
          <h1>Create your seller profile first</h1>
          <p>
            Your seller profile is required before customer activity can be
            shown.
          </p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </SellerCustomersShell>
    );
  }

  if (result.loading || (!result.data && !result.error)) {
    return (
      <SellerCustomersShell>
        <LoadingState label="Loading seller customers…" />
      </SellerCustomersShell>
    );
  }

  if (result.error || !result.data) {
    return (
      <SellerCustomersShell>
        <ErrorState
          message={result.error || "Seller customers are unavailable."}
          retry={() => void result.reload()}
        />
      </SellerCustomersShell>
    );
  }

  const customers = result.data.data;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visible = normalizedQuery
    ? customers.filter((customer) =>
        [
          customer.name,
          customer.location.city,
          customer.location.region,
          customer.location.country,
        ].some((value) =>
          value.toLocaleLowerCase().includes(normalizedQuery),
        ),
      )
    : customers;
  const totalOrders = customers.reduce(
    (sum, customer) => sum + customer.orders,
    0,
  );
  const totalUnits = customers.reduce(
    (sum, customer) => sum + customer.units,
    0,
  );
  const repeatCustomers = customers.filter(
    (customer) => customer.orders > 1,
  ).length;

  return (
    <SellerCustomersShell>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Seller relationships</p>
        <h1>Customers</h1>
        <p>
          Real buyers who have ordered products from {profile.data.data.displayName}.
        </p>
      </section>

      <section
        className={styles.summaryGrid}
        aria-label="Seller customer summary"
      >
        <SummaryCard label="Customers" value={customers.length} />
        <SummaryCard label="Repeat customers" value={repeatCustomers} />
        <SummaryCard label="Orders" value={totalOrders} />
        <SummaryCard label="Units ordered" value={totalUnits} />
      </section>

      <div className={styles.searchWrap}>
        <input
          className={styles.search}
          type="search"
          aria-label="Search customers"
          placeholder="Search by customer or location"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {!customers.length ? (
        <div className={styles.emptyWrap}>
          <EmptyState
            title="No customers yet"
            message="Buyers will appear here after they place an order containing your products."
            icon="bag"
          />
        </div>
      ) : !visible.length ? (
        <div className={styles.filteredEmpty}>
          No customers match “{query.trim()}”.
        </div>
      ) : (
        <section className={styles.customerList} aria-label="Seller customers">
          {visible.map((customer) => (
            <Link
              className={styles.customerCard}
              href={`/seller/customers/${customer.id}`}
              key={customer.id}
            >
              <div className={styles.avatar} aria-hidden="true">
                {initials(customer.name)}
              </div>
              <div className={styles.customerInfo}>
                <h2>{customer.name}</h2>
                <p>{formatLocation(customer.location)}</p>
                <div className={styles.customerMeta}>
                  <span>
                    {customer.orders} {customer.orders === 1 ? "order" : "orders"}
                  </span>
                  <span>
                    {customer.units} {customer.units === 1 ? "unit" : "units"}
                  </span>
                  <span>Latest {formatDate(customer.latestOrderAt)}</span>
                </div>
              </div>
              <Icon name="chevron" size={19} />
            </Link>
          ))}
        </section>
      )}

      <aside className={styles.note}>
        <strong>Privacy-limited customer view</strong>
        <p>
          This workspace uses only your real order relationships. Customer email
          and exact delivery addresses are not exposed here; open a specific
          seller order only when delivery details are operationally required.
        </p>
      </aside>
    </SellerCustomersShell>
  );
}

function SellerCustomersShell({ children }: { children: ReactNode }) {
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
        <span>Seller customers</span>
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

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
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
