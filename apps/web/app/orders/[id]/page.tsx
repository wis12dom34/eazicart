/* eslint-disable @next/next/no-img-element */
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
import styles from "./order-detail.module.css";

export default function OrderDetail({
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
      <OrderShell>
        <LoadingState label="Loading order…" />
      </OrderShell>
    );
  if (!auth.isAuthenticated)
    return (
      <OrderShell>
        <SignInState message="Sign in to view this order." />
      </OrderShell>
    );
  if (result.error || !result.data)
    return (
      <OrderShell>
        <ErrorState message={result.error || "Order not found"} />
      </OrderShell>
    );

  const order = result.data.data;

  return (
    <OrderShell>
      <header className={styles.header}>
        <Link href="/orders" aria-label="Back to orders" className={styles.back}>
          <Icon name="back" size={20} />
        </Link>
        <h1>Order Details</h1>
      </header>
      <p className={styles.orderMeta}>
        Order #{order.id.slice(-8)} · Placed {formatPlacedDate(order.createdAt)}
      </p>

      <section className={styles.statusPanel} aria-label="Order status">
        <div>
          <strong>{order.status}</strong>
          <p>{statusCopy(order.status)}</p>
        </div>
        <Link href={`/tracking/${order.id}`}>Track status</Link>
      </section>

      <section className={styles.section}>
        <h2>Items</h2>
        <div className={styles.items}>
          {order.items.map((item) => {
            const image = item.product?.images?.[0];
            return (
              <article className={styles.item} key={item.id}>
                <div className={styles.thumb}>
                  {image ? (
                    <img src={image.url} alt={image.altText || item.productName} />
                  ) : (
                    <Icon name="bag" size={24} />
                  )}
                </div>
                <div className={styles.itemCopy}>
                  <strong>{item.productName}</strong>
                  <span>Qty {item.quantity}</span>
                  <span>{money(item.unitPrice)} each</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Delivery</h2>
        <div className={styles.deliveryCard}>
          <strong>{order.address.label || "Delivery address"}</strong>
          <p>{formatAddress(order.address)}</p>
        </div>
      </section>

      <section className={`summary ${styles.summary}`}>
        <h2>Order summary</h2>
        <div className={`total ${styles.total}`}>
          <strong>Total</strong>
          <strong>{money(order.total)}</strong>
        </div>
        <p className={styles.paymentNote}>No payment has been taken for this MVP order.</p>
      </section>
    </OrderShell>
  );
}

function OrderShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      {children}
      <BottomNavigation />
    </main>
  );
}

function formatPlacedDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatAddress(address: {
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}) {
  return [
    address.line1,
    address.line2,
    [address.city, address.region, address.postalCode]
      .filter(Boolean)
      .join(", "),
    address.country,
  ]
    .filter(Boolean)
    .join(" · ");
}

function statusCopy(status: string) {
  if (status === "CONFIRMED") return "Your order has been confirmed.";
  if (status === "FULFILLED") return "This order is marked fulfilled.";
  if (status === "CANCELLED") return "This order has been cancelled.";
  return "Your order has been created and is waiting for the next update.";
}
