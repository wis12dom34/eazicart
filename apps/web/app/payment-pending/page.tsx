"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { paymentsApi } from "../../lib/api/payments";
import type { Payment } from "../../lib/api/types";
import { useAuth } from "../providers/auth-provider";
import { Icon } from "../components/icon";

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
        <p>Sign in with the account that placed this order, then return here.</p>
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

  if (payment?.status === "FAILED")
    return (
      <StatusShell icon="pending" title="Payment not completed">
        <p>Your order has not been released to the seller.</p>
        <Link className="dark-button" href={`/orders/${payment.orderId}`}>
          View order
        </Link>
      </StatusShell>
    );

  return (
    <StatusShell icon="pending" title="Payment still processing">
      <p>
        Paystack has not confirmed this transaction yet. You can check again
        without creating another order.
      </p>
      {error ? (
        <p role="alert">{error}</p>
      ) : null}
      <button
        className="dark-button"
        type="button"
        disabled={checking}
        onClick={() => void verify(reference)}
      >
        {checking ? "Checking…" : "Check again"}
      </button>
      {payment ? (
        <Link className="text-button" href={`/orders/${payment.orderId}`}>
          View order
        </Link>
      ) : (
        <Link className="text-button" href="/orders">
          View orders
        </Link>
      )}
    </StatusShell>
  );
}

function StatusShell({
  icon,
  title,
  children,
}: {
  icon: "pending";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="status-page">
      <div className={`status-icon ${icon}`}>
        <span className="spinner" />
        <Icon name="card" />
      </div>
      <h1>{title}</h1>
      {children}
    </main>
  );
}
