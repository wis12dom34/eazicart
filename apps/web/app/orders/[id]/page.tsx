/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomNavigation } from "../../components/bottom-navigation";
import { Icon } from "../../components/icon";
import { money } from "../../data";
import { ordersApi } from "../../../lib/api/orders";
import { paymentsApi } from "../../../lib/api/payments";
import { useRequest } from "../../hooks/use-request";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { useAuth } from "../../providers/auth-provider";
import {
  multiplyMoney,
  orderStatusCopy,
  orderStatusLabel,
} from "../order-utils";
import styles from "./order-detail.module.css";

export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auth = useAuth();
  const router = useRouter();
  const [paymentStarting, setPaymentStarting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? ordersApi.get(id) : Promise.resolve(undefined),
    [auth.isAuthenticated, id],
  );
  const paymentResult = useRequest(
    async () =>
      auth.isAuthenticated
        ? paymentsApi.forOrder(id)
        : Promise.resolve(undefined),
    [auth.isAuthenticated, id],
  );

  if (auth.loading || result.loading || paymentResult.loading)
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
        <ErrorState
          message={result.error || "Order not found"}
          retry={() => void result.reload()}
        />
      </OrderShell>
    );

  const order = result.data.data;
  const payment = paymentResult.data?.data ?? null;

  const continuePayment = async () => {
    setPaymentStarting(true);
    setPaymentError("");
    try {
      const response = await paymentsApi.initialize(order.id);
      if (response.data.status === "SUCCESS") {
        router.push(`/payment-success?orderId=${encodeURIComponent(order.id)}`);
        return;
      }
      if (!response.data.authorizationUrl)
        throw new Error("Payment could not be started. Please try again.");
      window.location.assign(response.data.authorizationUrl);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Could not start payment",
      );
      setPaymentStarting(false);
      await paymentResult.reload();
    }
  };

  return (
    <OrderShell>
      <header className={styles.header}>
        <Link
          href="/orders"
          aria-label="Back to orders"
          className={styles.back}
        >
          <Icon name="back" size={20} />
        </Link>
        <h1>Order Details</h1>
      </header>
      <p className={styles.orderMeta}>
        Order #{order.id.slice(-8)} · Placed {formatPlacedDate(order.createdAt)}
      </p>

      <section className={styles.statusPanel} aria-label="Order status">
        <div>
          <strong>{orderStatusLabel(order.status)}</strong>
          <p>{orderStatusCopy(order.status)}</p>
        </div>
        <Link href={`/tracking/${order.id}`}>Track order</Link>
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
                    <img
                      src={image.url}
                      alt={image.altText || item.productName}
                    />
                  ) : (
                    <Icon name="bag" size={24} />
                  )}
                </div>
                <div className={styles.itemCopy}>
                  <strong>{item.productName}</strong>
                  <span>Qty {item.quantity}</span>
                  <span>
                    {money(multiplyMoney(item.unitPrice, item.quantity))}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Delivery</h2>
        <div className={styles.deliveryCard}>
          <strong>{order.address.line1}</strong>
          <p>{formatAddressDetails(order.address)}</p>
        </div>
      </section>

      <section className={`summary ${styles.summary}`}>
        <h2>Payment summary</h2>
        <div className={styles.summaryRow}>
          <span>Subtotal</span>
          <strong>{money(order.total)}</strong>
        </div>
        <div className={`total ${styles.total}`}>
          <strong>Total</strong>
          <strong>{money(order.total)}</strong>
        </div>
        <PaymentState payment={payment} />
        {payment && ["PENDING", "FAILED"].includes(payment.status) ? (
          <button
            className="dark-button"
            type="button"
            disabled={paymentStarting}
            onClick={() => void continuePayment()}
          >
            {paymentStarting
              ? "Starting payment…"
              : payment.status === "FAILED"
                ? "Retry payment"
                : "Continue payment"}
          </button>
        ) : null}
        {paymentError ? (
          <p className={styles.paymentNote} role="alert">
            {paymentError}
          </p>
        ) : null}
        {paymentResult.error ? (
          <p className={styles.paymentNote} role="alert">
            Payment status is temporarily unavailable.
          </p>
        ) : null}
      </section>
    </OrderShell>
  );
}

function PaymentState({
  payment,
}: {
  payment: Awaited<ReturnType<typeof paymentsApi.forOrder>>["data"] | null;
}) {
  if (!payment)
    return (
      <p className={styles.paymentNote}>
        This order does not have a Paystack payment record.
      </p>
    );
  if (payment.status === "SUCCESS")
    return (
      <p className={styles.paymentNote}>
        Payment confirmed by Paystack. Seller processing is enabled.
      </p>
    );
  if (payment.status === "REVIEW_REQUIRED")
    return (
      <p className={styles.paymentNote}>
        Payment was received, but this order needs support review before seller
        processing.
      </p>
    );
  if (payment.status === "FAILED")
    return (
      <p className={styles.paymentNote}>
        Payment was not completed. The order has not been released to the
        seller.
      </p>
    );
  return (
    <p className={styles.paymentNote}>
      Payment is pending. The seller cannot process this order until Paystack
      confirms it.
    </p>
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

function formatAddressDetails(address: {
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
}) {
  return [
    address.line2,
    [address.city, address.region, address.postalCode]
      .filter(Boolean)
      .join(", "),
    address.country,
  ]
    .filter(Boolean)
    .join(" · ");
}
