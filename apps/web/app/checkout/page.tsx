/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { money } from "../data";
import { cartApi } from "../../lib/api/cart";
import { addressesApi } from "../../lib/api/addresses";
import { ordersApi } from "../../lib/api/orders";
import { paymentsApi } from "../../lib/api/payments";
import { useRequest } from "../hooks/use-request";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import styles from "./checkout.module.css";

export default function CheckoutPage() {
  const auth = useAuth();
  const router = useRouter();
  const cart = useRequest(
    async () =>
      auth.isAuthenticated ? cartApi.get() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const addresses = useRequest(
    async () =>
      auth.isAuthenticated ? addressesApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  useEffect(() => {
    setSelectedAddressId(
      new URLSearchParams(window.location.search).get("addressId"),
    );
  }, []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (auth.loading || cart.loading || addresses.loading)
    return (
      <CheckoutShell>
        <LoadingState label="Loading checkout…" />
      </CheckoutShell>
    );
  if (!auth.isAuthenticated)
    return (
      <CheckoutShell>
        <SignInState message="Sign in to continue to checkout." />
      </CheckoutShell>
    );
  if (cart.error || addresses.error)
    return (
      <CheckoutShell>
        <ErrorState message={cart.error || addresses.error} />
      </CheckoutShell>
    );

  const address =
    addresses.data?.data.find(
      (candidate) => candidate.id === selectedAddressId,
    ) ??
    addresses.data?.data.find((candidate) => candidate.isDefault) ??
    addresses.data?.data[0];
  const data = cart.data?.data;

  const place = async () => {
    if (!address) {
      setError("Add a delivery address before ordering.");
      return;
    }
    if (!data?.items.length) {
      setError("Your cart is empty.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const order = await ordersApi.create(address.id);
      const payment = await paymentsApi.initialize(order.data.id);
      if (payment.data.status === "SUCCESS") {
        router.push(
          `/payment-success?orderId=${encodeURIComponent(order.data.id)}`,
        );
        return;
      }
      if (!payment.data.authorizationUrl)
        throw new Error("Payment could not be started. Please try again.");
      window.location.assign(payment.data.authorizationUrl);
    } catch (placeError) {
      setError(
        placeError instanceof Error
          ? placeError.message
          : "Could not start payment",
      );
      setSubmitting(false);
    }
  };

  return (
    <CheckoutShell>
      <section className={styles.section}>
        <h2>Delivery address</h2>
        {address ? (
          <div className={styles.addressCard}>
            <div>
              <strong>
                {auth.user?.name || address.label || "Delivery address"}
              </strong>
              <p>{[address.line1, address.line2].filter(Boolean).join(", ")}</p>
            </div>
            <Link
              href={`/address-book?checkout=1&selectedId=${encodeURIComponent(address.id)}`}
            >
              Change
            </Link>
          </div>
        ) : (
          <div className={styles.addressCard}>
            <div>
              <strong>No delivery address</strong>
              <p>Add an address before placing your order.</p>
            </div>
            <Link href="/address-book?checkout=1">Add</Link>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Payment method</h2>
        <div className={styles.paymentCard}>
          <div>
            <strong>Paystack</strong>
            <p>Secure payment</p>
          </div>
          <span className={styles.selected} aria-label="Selected">
            ✓
          </span>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Items</h2>
        {!data?.items.length ? (
          <p className={styles.emptyCopy}>Your cart is empty.</p>
        ) : (
          <div className={styles.items}>
            {data.items.map((item) => (
              <article className={styles.item} key={item.id}>
                <div className={styles.itemThumb}></div>
                <div className={styles.itemCopy}>
                  <strong>{item.product.name}</strong>
                  <span>
                    {item.product.seller.displayName}
                    {item.product.seller.displayName === "Nike Official"
                      ? " ✓"
                      : ""}{" "}
                    · Qty {item.quantity}
                  </span>
                </div>
                <strong className={styles.itemPrice}>
                  {money(item.lineTotal)}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.summary}>
        <h2>Order summary</h2>
        <div>
          <span>Subtotal</span>
          <strong>{money(data?.subtotal ?? "0")}</strong>
        </div>
        <div>
          <span>Delivery slot</span>
          <span>
            {data?.delivery === "0"
              ? "Free"
              : data?.delivery
                ? money(data.delivery)
                : "Not added"}
          </span>
        </div>
        <div>
          <span>Service fee</span>
          <span>
            {data?.serviceFee != null ? money(data.serviceFee) : "Not added"}
          </span>
        </div>
        <div className={styles.total}>
          <span>Total</span>
          <strong>{money(data?.total ?? "0")}</strong>
        </div>
      </section>

      <div className={styles.placeArea}>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <button
          aria-label="Place order"
          disabled={submitting || !data?.items.length}
          className={styles.placeButton}
          type="button"
          onClick={() => void place()}
        >
          {submitting ? "Starting payment…" : "Place Order"}
        </button>
      </div>
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className={`app-shell checkout ${styles.page}`}
      data-figma-node="154:2"
    >
      <header className={styles.header}>
        <Link href="/cart" className={styles.back} aria-label="Back to cart">
          <img src="/figma/back.svg" alt="" width={20} height={20} />
        </Link>
        <h1>Checkout</h1>
      </header>
      {children}
    </main>
  );
}
