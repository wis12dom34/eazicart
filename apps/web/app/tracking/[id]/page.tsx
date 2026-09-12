"use client";

import Link from "next/link";
import { use } from "react";
import { BottomNavigation } from "../../components/bottom-navigation";
import { Icon } from "../../components/icon";
import { money } from "../../data";
import { ordersApi } from "../../../lib/api/orders";
import { useRequest } from "../../hooks/use-request";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { useAuth } from "../../providers/auth-provider";
import styles from "./tracking.module.css";

export default function TrackingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auth = useAuth();
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? ordersApi.get(id) : Promise.resolve(undefined),
    [auth.isAuthenticated, id],
  );

  if (auth.loading || result.loading)
    return (
      <TrackingShell>
        <LoadingState label="Loading order status…" />
      </TrackingShell>
    );
  if (!auth.isAuthenticated)
    return (
      <TrackingShell>
        <SignInState message="Sign in to view this order status." />
      </TrackingShell>
    );
  if (result.error || !result.data)
    return (
      <TrackingShell>
        <ErrorState message={result.error || "Order not found"} />
      </TrackingShell>
    );

  const order = result.data.data;
  const quantity = order.items.reduce(
    (total, item) => total + item.quantity,
    0,
  );
  const itemNames = order.items.map((item) => item.productName);

  return (
    <TrackingShell>
      <header className={styles.header}>
        <Link
          href={`/orders/${order.id}`}
          aria-label="Back to order details"
          className={styles.back}
        >
          <Icon name="back" size={20} />
        </Link>
        <h1>Track Order</h1>
      </header>
      <p className={styles.orderId}>#{order.id.slice(-8)}</p>

      <section className={styles.summaryCard}>
        <strong>{summarizeItems(itemNames)}</strong>
        <p>
          {quantity} {quantity === 1 ? "item" : "items"} · {money(order.total)}
        </p>
        <span>Placed {formatPlacedDate(order.createdAt)}</span>
      </section>

      <section className={styles.progressSection}>
        <h2>Current order status</h2>
        <div className={styles.currentStatus}>
          <span className={styles.statusDot} aria-hidden="true" />
          <div>
            <strong>{order.status}</strong>
            <p>{statusCopy(order.status)}</p>
          </div>
        </div>
      </section>

      <section className={styles.unavailable}>
        <Icon name="box" size={28} />
        <div>
          <h2>Detailed delivery tracking isn’t available yet.</h2>
          <p>
            Carrier details, tracking numbers, delivery estimates, and shipment
            event history are not connected in the current MVP.
          </p>
        </div>
      </section>

      <div className={styles.actions}>
        <Link className={styles.secondaryAction} href="/orders">
          All orders
        </Link>
        <Link className={styles.primaryAction} href={`/orders/${order.id}`}>
          View order
        </Link>
      </div>
    </TrackingShell>
  );
}

function TrackingShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      {children}
      <BottomNavigation />
    </main>
  );
}

function summarizeItems(names: string[]) {
  if (!names.length) return "Order";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} + ${names[1]}`;
  return `${names[0]} + ${names.length - 1} more`;
}

function formatPlacedDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusCopy(status: string) {
  if (status === "CONFIRMED") return "Your order has been confirmed.";
  if (status === "FULFILLED") return "This order is marked fulfilled.";
  if (status === "CANCELLED") return "This order has been cancelled.";
  return "Your order has been created and is waiting for the next update.";
}
