/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../../components/async-state";
import { Icon } from "../../../components/icon";
import { money } from "../../../data";
import { useRequest } from "../../../hooks/use-request";
import { multiplyMoney, orderStatusLabel } from "../../../orders/order-utils";
import { useAuth } from "../../../providers/auth-provider";
import { sellerDashboardApi } from "../../../../lib/api/seller-dashboard";
import { sellerOrdersApi } from "../../../../lib/api/seller-orders";
import type { SellerFulfillmentStatus } from "../../../../lib/api/types";
import controls from "./fulfillment-controls.module.css";
import styles from "../seller-orders.module.css";

export default function SellerOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
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
        ? sellerOrdersApi.get(params.id)
        : Promise.resolve(undefined),
    [profile.data?.data?.id, params.id],
  );

  const updateFulfillment = async (status: SellerFulfillmentStatus) => {
    if (!params.id) return;
    setUpdating(true);
    setActionError("");
    setActionSuccess("");
    try {
      await sellerOrdersApi.updateFulfillment(params.id, status);
      await result.reload();
      setActionSuccess(`Fulfillment updated to ${fulfillmentLabel(status)}.`);
    } catch (value) {
      setActionError(
        value instanceof Error ? value.message : "Unable to update fulfillment",
      );
    } finally {
      setUpdating(false);
    }
  };

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <DetailShell>
        <LoadingState label="Loading seller order…" />
      </DetailShell>
    );
  }

  if (!auth.user) {
    return (
      <DetailShell>
        <SignInState message="Sign in to view seller orders." />
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
            Create your seller profile before viewing seller order activity.
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
        <LoadingState label="Loading seller order…" />
      </DetailShell>
    );
  }

  if (result.error || !result.data) {
    return (
      <DetailShell>
        <ErrorState
          message={result.error || "Seller order is unavailable."}
          retry={() => void result.reload()}
        />
      </DetailShell>
    );
  }

  const order = result.data.data;

  return (
    <DetailShell>
      <section className={styles.detailHero}>
        <div>
          <p className={styles.eyebrow}>Seller fulfillment</p>
          <h1>Order #{order.id.slice(-8)}</h1>
          <div className={styles.detailMeta}>
            <span>{formatDate(order.createdAt)}</span>
            <span>
              {order.items.length}{" "}
              {order.items.length === 1 ? "product" : "products"}
            </span>
            <span>
              {order.items.reduce((sum, item) => sum + item.quantity, 0)} units
            </span>
          </div>
        </div>
        <span className={`${styles.status} ${statusClass(order.status)}`}>
          {fulfillmentLabel(order.status)}
        </span>
      </section>

      <div className={styles.detailGrid}>
        <section className={styles.panel} aria-labelledby="seller-order-items">
          <div className={styles.panelHeading}>
            <p>Your line items</p>
            <h2 id="seller-order-items">Products in this order</h2>
          </div>
          <div className={styles.itemList}>
            {order.items.map((item) => {
              const image = item.product.images[0];
              return (
                <div className={styles.itemRow} key={item.id}>
                  <div className={styles.itemThumb}>
                    {image ? (
                      <img
                        src={image.url}
                        alt={image.altText || item.productName}
                      />
                    ) : (
                      <Icon name="box" size={24} />
                    )}
                  </div>
                  <div className={styles.itemInfo}>
                    <h3>{item.productName}</h3>
                    <p>
                      {item.quantity} × {money(item.unitPrice)}
                    </p>
                  </div>
                  <span className={styles.itemTotal}>
                    {money(multiplyMoney(item.unitPrice, item.quantity))}
                  </span>
                </div>
              );
            })}
          </div>
          <div className={styles.subtotalRow}>
            <span>Your subtotal</span>
            <strong>{money(order.subtotal)}</strong>
          </div>
        </section>

        <div>
          <section
            className={styles.panel}
            aria-labelledby="seller-order-customer"
          >
            <div className={styles.panelHeading}>
              <p>Customer</p>
              <h2 id="seller-order-customer">Delivery details</h2>
            </div>
            <p className={styles.customerName}>{order.customer.name}</p>
            <div className={styles.address}>
              {order.address.label ? (
                <strong>{order.address.label}</strong>
              ) : null}
              <div>{order.address.line1}</div>
              {order.address.line2 ? <div>{order.address.line2}</div> : null}
              <div>
                {order.address.city}, {order.address.region}{" "}
                {order.address.postalCode}
              </div>
              <div>{order.address.country}</div>
            </div>
          </section>

          <section className={controls.panel}>
            <div className={styles.panelHeading}>
              <p>Your fulfillment</p>
              <h2>Update seller status</h2>
            </div>
            <p className={controls.note}>
              This only updates your part of the order. Buyer/global order
              status remains{" "}
              {orderStatusLabel(order.globalStatus).toLowerCase()}.
            </p>
            <strong className={controls.readOnly}>
              Status is read-only for the buyer order.
            </strong>
            {actionError ? (
              <p className={controls.error} role="alert">
                {actionError}
              </p>
            ) : null}
            {actionSuccess ? (
              <p className={controls.success} role="status">
                {actionSuccess}
              </p>
            ) : null}
            <div className={controls.actions}>
              {order.status === "PENDING" ? (
                <>
                  <button
                    type="button"
                    className={controls.primary}
                    disabled={updating}
                    onClick={() => void updateFulfillment("CONFIRMED")}
                  >
                    {updating ? "Updating…" : "Confirm fulfillment"}
                  </button>
                  <button
                    type="button"
                    className={controls.danger}
                    disabled={updating}
                    onClick={() => void updateFulfillment("CANCELLED")}
                  >
                    Cancel fulfillment
                  </button>
                </>
              ) : null}
              {order.status === "CONFIRMED" ? (
                <>
                  <button
                    type="button"
                    className={controls.primary}
                    disabled={updating}
                    onClick={() => void updateFulfillment("FULFILLED")}
                  >
                    {updating ? "Updating…" : "Mark fulfilled"}
                  </button>
                  <button
                    type="button"
                    className={controls.danger}
                    disabled={updating}
                    onClick={() => void updateFulfillment("CANCELLED")}
                  >
                    Cancel fulfillment
                  </button>
                </>
              ) : null}
              {order.status === "FULFILLED" ? (
                <p className={controls.terminal}>
                  Your fulfillment is complete and cannot be moved backward.
                </p>
              ) : null}
              {order.status === "CANCELLED" ? (
                <p className={controls.terminal}>
                  Your fulfillment is cancelled and cannot be reopened.
                </p>
              ) : null}
            </div>
          </section>
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
          href="/seller/orders"
          aria-label="Back to seller orders"
        >
          <Icon name="back" size={22} />
        </Link>
        <span>Order details</span>
        <span aria-hidden="true" />
      </header>
      {children}
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
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
