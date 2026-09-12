/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { money } from "../data";
import { cartApi } from "../../lib/api/cart";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import styles from "./cart.module.css";

export default function CartPage() {
  const auth = useAuth();
  const [actionError, setActionError] = useState("");
  const cart = useRequest(
    async () =>
      auth.isAuthenticated ? cartApi.get() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );

  const mutate = async (operation: () => Promise<unknown>) => {
    try {
      setActionError("");
      await operation();
      await cart.reload();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update cart",
      );
    }
  };

  if (auth.loading) return <LoadingState />;
  if (!auth.isAuthenticated)
    return (
      <CartShell>
        <CartHeader />
        <SignInState message="Sign in to view and update your cart." />
      </CartShell>
    );
  if (cart.loading)
    return (
      <CartShell>
        <CartHeader />
        <LoadingState label="Loading cart…" />
      </CartShell>
    );
  if (cart.error)
    return (
      <CartShell>
        <CartHeader />
        <ErrorState message={cart.error} retry={() => void cart.reload()} />
      </CartShell>
    );

  const data = cart.data?.data;
  if (!data?.items.length)
    return (
      <CartShell>
        <CartHeader />
        <section className={styles.emptyState}>
          <EmptyState message="Your cart is empty." />
          <Link className={styles.secondaryLink} href="/explore">
            Browse products
          </Link>
        </section>
      </CartShell>
    );

  const itemCount = data.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartShell>
      <CartHeader
        action={
          <button
            className={styles.clearButton}
            type="button"
            onClick={() => void mutate(() => cartApi.clear())}
          >
            Clear
          </button>
        }
      />

      <section className={styles.intro}>
        <h1>Cart</h1>
        <p>
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </p>
      </section>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      <section className={styles.cartList} aria-label="Cart items">
        {data.items.map((item) => (
          <article className={styles.cartItem} key={item.id}>
            <div className={styles.cartThumb}>
              {item.product.images[0] ? (
                <img
                  src={item.product.images[0].url}
                  alt={item.product.images[0].altText || item.product.name}
                />
              ) : (
                <Icon name="bag" size={28} />
              )}
            </div>
            <div className={styles.itemCopy}>
              <h2>{item.product.name}</h2>
              <p>{item.product.seller.displayName}</p>
              <strong>{money(item.lineTotal)}</strong>
            </div>
            <div className={`quantity ${styles.quantity}`}>
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() =>
                  void (item.quantity === 1
                    ? mutate(() => cartApi.remove(item.id))
                    : mutate(() => cartApi.update(item.id, item.quantity - 1)))
                }
              >
                <Icon name="minus" size={14} />
              </button>
              <span>{item.quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() =>
                  void mutate(() => cartApi.update(item.id, item.quantity + 1))
                }
              >
                <Icon name="plus" size={14} />
              </button>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.promo} aria-label="Promo codes unavailable">
        <span>Promo code</span>
        <button type="button" disabled>
          Apply
        </button>
      </div>

      <section className={`summary ${styles.summary}`}>
        <h2>Order summary</h2>
        <div>
          <span>Subtotal</span>
          <strong>{money(data.subtotal)}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <span>Not added</span>
        </div>
        <div className={`total ${styles.total}`}>
          <span>Total</span>
          <strong>{money(data.total)}</strong>
        </div>
      </section>

      <div className={styles.checkoutArea}>
        <Link className={styles.checkoutButton} href="/checkout">
          Proceed to Checkout
        </Link>
      </div>
    </CartShell>
  );
}

function CartShell({ children }: { children: React.ReactNode }) {
  return (
    <main className={`app-shell ${styles.page}`}>
      {children}
      <BottomNavigation />
    </main>
  );
}

function CartHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className={styles.header}>
      <Link className={styles.headerButton} href="/" aria-label="Back to home">
        <Icon name="back" size={20} />
      </Link>
      <Link className={styles.brandMark} href="/" aria-label="EaziCart home">
        ↗
      </Link>
      <div className={styles.headerAction}>{action}</div>
    </header>
  );
}
