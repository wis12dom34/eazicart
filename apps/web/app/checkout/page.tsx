/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "../components/icon";
import { money } from "../data";
import { cartApi } from "../../lib/api/cart";
import { addressesApi } from "../../lib/api/addresses";
import { ordersApi } from "../../lib/api/orders";
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
      router.push(`/orders/${order.data.id}`);
    } catch (placeError) {
      setError(
        placeError instanceof Error
          ? placeError.message
          : "Could not place order",
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
              <strong>{address.label || "Delivery address"}</strong>
              <p>{formatAddress(address)}</p>
            </div>
            <Link href="/address-book">Change</Link>
          </div>
        ) : (
          <div className={styles.addressCard}>
            <div>
              <strong>No delivery address</strong>
              <p>Add an address before placing your order.</p>
            </div>
            <Link href="/address-book">Add</Link>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Payment method</h2>
        <div className={styles.paymentCard}>
          <span className={styles.paymentIcon} aria-hidden="true">
            <Icon name="card" size={20} />
          </span>
          <div>
            <strong>No payment required yet</strong>
            <p>
              Placing this order will not charge you. Payments are not
              connected.
            </p>
          </div>
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
                <div className={styles.itemThumb}>
                  {item.product.images[0] ? (
                    <img
                      src={item.product.images[0].url}
                      alt={item.product.images[0].altText || item.product.name}
                    />
                  ) : (
                    <Icon name="bag" size={24} />
                  )}
                </div>
                <div className={styles.itemCopy}>
                  <strong>{item.product.name}</strong>
                  <span>{item.product.seller.displayName}</span>
                  {item.quantity > 1 ? (
                    <small>Qty {item.quantity}</small>
                  ) : null}
                </div>
                <strong className={styles.itemPrice}>
                  {money(item.lineTotal)}
                </strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={`summary ${styles.summary}`}>
        <h2>Order summary</h2>
        <div>
          <span>Subtotal</span>
          <strong>{money(data?.subtotal ?? "0")}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <span>Not added</span>
        </div>
        <div className={`total ${styles.total}`}>
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
          {submitting ? "Placing order…" : "Place Order"}
        </button>
      </div>
    </CheckoutShell>
  );
}

function CheckoutShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={`app-shell checkout ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/cart" className={styles.back} aria-label="Back to cart">
          <Icon name="back" size={20} />
        </Link>
        <h1>Checkout</h1>
      </header>
      {children}
    </main>
  );
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
