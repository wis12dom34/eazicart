"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { paymentsApi } from "../../lib/api/payments";
import type { Payment } from "../../lib/api/types";
import { useAuth } from "../providers/auth-provider";
import { ordersApi } from "../../lib/api/orders";
import { useRequest } from "../hooks/use-request";
import { money } from "../data";
import styles from "./pending.module.css";

export default function PaymentPending() {
  const auth = useAuth();
  const router = useRouter();
  const [reference, setReference] = useState<string | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setReference(params.get("reference") ?? params.get("trxref"));
  }, []);

  const verify = async (value: string) => {
    setChecking(true);
    setError("");
    try {
      const response = await paymentsApi.verify(value);
      setPayment(response.data);
      if (response.data.status === "SUCCESS") {
        router.replace(
          `/payment-success?orderId=${encodeURIComponent(response.data.orderId)}`,
        );
        return;
      }
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : "Could not confirm payment",
      );
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated || !reference) return;
    void verify(reference);
    // verify is intentionally run when the callback reference/auth state becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.loading, auth.isAuthenticated, reference]);

  const order = useRequest(
    () =>
      payment?.orderId
        ? ordersApi.get(payment.orderId)
        : Promise.resolve(undefined),
    [payment?.orderId],
  );

  if (auth.loading || (checking && auth.isAuthenticated && reference))
    return (
      <StatusShell icon="pending" title="Confirming payment">
        <p>
          EaziCart is confirming this transaction directly with Paystack before
          releasing the order to the seller.
        </p>
      </StatusShell>
    );

  if (!auth.isAuthenticated)
    return (
      <StatusShell icon="pending" title="Sign in to confirm payment">
        <p>
          Sign in with the account that placed this order, then return here.
        </p>
        <Link className="dark-button" href="/login">
          Sign in
        </Link>
      </StatusShell>
    );

  if (!reference)
    return (
      <StatusShell icon="pending" title="Payment reference missing">
        <p>We could not find a Paystack reference in this callback.</p>
        <Link className="dark-button" href="/orders">
          View orders
        </Link>
      </StatusShell>
    );

  if (payment?.status === "REVIEW_REQUIRED")
    return (
      <StatusShell icon="pending" title="Payment received — review needed">
        <p>
          Paystack confirmed the payment, but an item became unavailable before
          inventory could be reserved. EaziCart has held the order for support
          review instead of sending it to the seller.
        </p>
        <Link className="dark-button" href={`/orders/${payment.orderId}`}>
          View order
        </Link>
      </StatusShell>
    );

  const data = order.data?.data;
  const failed = payment?.status === "FAILED";
  return (
    <main
      className={`app-shell ${styles.page} ${failed ? styles.failed : ""}`}
      data-figma-node={failed ? "212:122" : "212:104"}
    >
      <h1>Payment status</h1>
      <section className={styles.pending} aria-live="polite">
        <h2>
          {failed ? "Payment wasn’t completed" : "Confirming your payment"}
        </h2>
        <p>
          {failed
            ? "We couldn’t complete this payment. Your items are still in your cart."
            : "Your payment is still being checked. Your order will appear once payment is confirmed."}
        </p>
      </section>
      <section className={styles.summary} aria-label="Payment summary">
        <h2>
          Checkout{data ? ` · #${data.orderNumber ?? data.id.slice(-8)}` : ""}
        </h2>
        <strong>{payment ? money(payment.amount) : "Checking…"}</strong>
        <p>
          {data
            ? `${data.items.reduce((n, item) => n + item.quantity, 0)} items · `
            : ""}
          {payment?.methodLabel ?? "Paystack"}
        </p>
        {data ? (
          <small>
            Subtotal {money(data.subtotal ?? data.total)}
            {data.serviceFee != null
              ? ` · Service fee ${money(data.serviceFee)}`
              : ""}
          </small>
        ) : null}
      </section>
      <section className={styles.recovery}>
        <h2>{failed ? "Already debited?" : "No need to pay again"}</h2>
        <p>
          {failed
            ? "Check your payment status before trying again. Contact support if you need help."
            : "Check the status before starting another payment. You can return to your order later."}
        </p>
      </section>
      <div className={styles.actions}>
        {error ? <p role="alert">{error}</p> : null}
        {failed ? (
          <Link className={styles.returnCheckout} href="/checkout">
            Return to checkout
          </Link>
        ) : null}
        <button
          type="button"
          disabled={checking}
          onClick={() => void verify(reference)}
        >
          {checking ? "Checking…" : "Check payment status"}
        </button>
        {!failed ? <Link href="/checkout">Return to checkout</Link> : null}
        <span className={styles.support}>Need help? Contact support</span>
      </div>
      <hr />
    </main>
  );
}

function StatusShell({
  title,
  children,
}: {
  icon: "pending";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className={`app-shell ${styles.page}`}>
      <h1>Payment status</h1>
      <section className={styles.pending}>
        <h2>{title}</h2>
        {children}
      </section>
    </main>
  );
}
