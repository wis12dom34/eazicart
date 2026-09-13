/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { money } from "../data";
import { ordersApi } from "../../lib/api/orders";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import { orderStatusLabel } from "./order-utils";
import styles from "./orders.module.css";

const filters = ["ALL", "PROCESSING", "FULFILLED", "CANCELLED"] as const;
type OrderFilter = (typeof filters)[number];

const filterLabels: Record<OrderFilter, string> = {
  ALL: "All",
  PROCESSING: "Processing",
  FULFILLED: "Delivered",
  CANCELLED: "Cancelled",
};

export default function OrdersPage() {
  const auth = useAuth();
  const [filter, setFilter] = useState<OrderFilter>("ALL");
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? ordersApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );

  const orders = result.data?.data ?? [];
  const visibleOrders =
    filter === "ALL"
      ? orders
      : orders.filter((order) =>
          filter === "PROCESSING"
            ? order.status === "PENDING" || order.status === "CONFIRMED"
            : order.status === filter,
        );

  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      <header className={styles.heading}>
        <h1>My Orders</h1>
        <p>Track purchases and delivery</p>
      </header>

      <div className={styles.filters} role="group" aria-label="Filter orders">
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

      {auth.loading || result.loading ? (
        <LoadingState label="Loading orders…" />
      ) : !auth.isAuthenticated ? (
        <SignInState message="Sign in to see your orders." />
      ) : result.error ? (
        <ErrorState message={result.error} retry={() => void result.reload()} />
      ) : !orders.length ? (
        <EmptyState
          title="No orders yet"
          message="Your purchases will appear here."
          icon="bag"
          action={{ href: "/explore", label: "Start shopping" }}
        />
      ) : !visibleOrders.length ? (
        <section className={styles.filteredEmpty}>
          <p>No {filterLabels[filter].toLowerCase()} orders.</p>
        </section>
      ) : (
        <section className={styles.orderList} aria-label="Orders">
          {visibleOrders.map((order) => {
            const firstItem = order.items[0];
            const image = firstItem?.product?.images?.[0];
            const quantity = order.items.reduce(
              (total, item) => total + item.quantity,
              0,
            );
            return (
              <Link
                className={styles.orderCard}
                href={`/orders/${order.id}`}
                key={order.id}
              >
                <div className={styles.cardHeader}>
                  <div>
                    <strong>{firstItem?.productName ?? "Order"}</strong>
                    <span>
                      Order #{order.id.slice(-8)} ·{" "}
                      {formatOrderDate(order.createdAt)}
                    </span>
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
                        alt={image.altText || firstItem?.productName || ""}
                      />
                    ) : (
                      <Icon name="bag" size={24} />
                    )}
                  </div>
                  <div className={styles.orderMeta}>
                    <strong>{money(order.total)}</strong>
                    <span>
                      {quantity} {quantity === 1 ? "item" : "items"}
                      {order.items.length > 1
                        ? ` · ${order.items.length} products`
                        : ""}
                    </span>
                  </div>
                  <span className={styles.viewOrder}>View order →</span>
                </div>
              </Link>
            );
          })}
        </section>
      )}

      <BottomNavigation />
    </main>
  );
}

function formatOrderDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
  }).format(new Date(value));
}

function statusClass(status: string) {
  if (status === "FULFILLED") return styles.success;
  if (status === "CANCELLED") return styles.cancelled;
  if (status === "CONFIRMED") return styles.confirmed;
  return styles.pending;
}
