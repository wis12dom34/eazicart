/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ordersApi } from "../../lib/api/orders";
import { paymentsApi } from "../../lib/api/payments";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import {
  LoadingState,
  ErrorState,
  SignInState,
} from "../components/async-state";
import { money } from "../data";
import { orderStatusLabel, multiplyMoney } from "../orders/order-utils";
import styles from "./success.module.css";

export default function PaymentSuccess() {
  const auth = useAuth();
  const [orderId, setOrderId] = useState<string | null>(null);
  useEffect(() => {
    setOrderId(new URLSearchParams(window.location.search).get("orderId"));
  }, []);
  const result = useRequest(
    async () =>
      auth.isAuthenticated && orderId
        ? Promise.all([ordersApi.get(orderId), paymentsApi.forOrder(orderId)])
        : undefined,
    [auth.isAuthenticated, orderId],
  );
  const data = result.data?.[0].data;
  const payment = result.data?.[1].data;
  let state: React.ReactNode = null;
  if (auth.loading || result.loading)
    state = <LoadingState label="Confirming order…" />;
  else if (!auth.isAuthenticated)
    state = <SignInState message="Sign in to view your order." />;
  else if (!orderId) state = <ErrorState message="Order reference missing." />;
  else if (result.error)
    state = (
      <ErrorState message={result.error} retry={() => void result.reload()} />
    );
  else if (!data || payment?.status !== "SUCCESS")
    state = (
      <>
        <ErrorState message="Payment has not been confirmed." />
        <Link href={orderId ? `/orders/${orderId}` : "/orders"}>
          View order
        </Link>
      </>
    );
  if (state)
    return (
      <main className={`app-shell ${styles.page}`}>
        <div className={styles.island} aria-hidden="true" />
        {state}
      </main>
    );
  if (!data || !payment) return null;
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="156:2">
      <div className={styles.island} aria-hidden="true" />
      <img
        className={styles.illustration}
        src="/figma/success.svg"
        alt=""
        width={72}
        height={72}
      />
      <h1>Order confirmed</h1>
      <p className={styles.subtitle}>
        Your order has been placed successfully.
      </p>
      <section className={styles.order} aria-label="Order summary">
        <header>
          <Link href={`/orders/${data.id}`}>
            Order #{data.orderNumber ?? data.id.slice(-8)}
          </Link>
          <span>{orderStatusLabel(data.status)}</span>
        </header>
        <div className={styles.items}>
          {data.items.map((item) => (
            <div className={styles.item} key={item.id}>
              <strong>{item.productName}</strong>
              <small>
                {item.variantLabel ? `${item.variantLabel} · ` : ""}Qty{" "}
                {item.quantity}
              </small>
              <b>{money(multiplyMoney(item.unitPrice, item.quantity))}</b>
            </div>
          ))}
        </div>
      </section>
      <section className={styles.paid} aria-label="Payment total">
        <small>Total paid</small>
        <div>
          <strong>{money(payment.amount)}</strong>
          <span>{payment.methodLabel ?? "Paystack"}</span>
        </div>
      </section>
      <div className={styles.actions}>
        <Link className={styles.track} href={`/tracking/${data.id}`}>
          Track order
        </Link>
        <Link className={styles.shop} href="/">
          Continue shopping
        </Link>
      </div>
      {data.receiptSent ? (
        <p className={styles.receipt}>A receipt has been sent to your email.</p>
      ) : null}
    </main>
  );
}
