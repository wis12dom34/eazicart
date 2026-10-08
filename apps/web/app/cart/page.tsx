/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { BottomNavigation } from "../components/bottom-navigation";
import { money } from "../data";
import type { CartItem } from "../../lib/api/types";
import { cartApi } from "../../lib/api/cart";
import { useRequest } from "../hooks/use-request";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import styles from "./cart.module.css";

export default function CartPage() {
  const auth = useAuth();
  const [actionError, setActionError] = useState("");
  const failedOperation = useRef<(() => Promise<unknown>) | null>(null);
  const [removing, setRemoving] = useState<CartItem | null>(null);
  const [mutating, setMutating] = useState(false);
  const cart = useRequest(
    async () =>
      auth.isAuthenticated ? cartApi.get() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );

  const mutate = async (operation: () => Promise<unknown>) => {
    setMutating(true);
    failedOperation.current = operation;
    try {
      setActionError("");
      await operation();
      setRemoving(null);
      await cart.reload();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update cart",
      );
    } finally {
      setMutating(false);
    }
  };

  if (auth.loading) return <LoadingState />;
  if (!auth.isAuthenticated)
    return (
      <CartShell>
        <CartHeader />
        <SignInState
          message="Sign in to view and update your cart."
          next="/cart"
        />
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
  const itemCount =
    data?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  if (!data?.items.length)
    return (
      <CartShell cartCount={0} node="228:50">
        <div className={styles.statePage}>
          <h1>Cart</h1>
          <section className={styles.emptyHero}>
            <div className={styles.emptyIcon}>
              <img src="/figma/cart-empty.svg" width={24} height={24} alt="" />
            </div>
            <h2>Your cart is empty</h2>
            <p>Discover products from sellers you follow and trust.</p>
            <Link className={styles.statePrimary} href="/explore">
              Explore products
            </Link>
          </section>
        </div>
      </CartShell>
    );
  if (actionError)
    return (
      <CartShell cartCount={itemCount} node="228:113">
        <div className={styles.statePage}>
          <h1>Cart</h1>
          <section className={styles.errorCard} role="alert">
            <h2>Cart could not be updated</h2>
            <p>Your quantity change was not saved.</p>
            <p>Check your connection and try again.</p>
            <span className={styles.errorDetail}>{actionError}</span>
          </section>
          <div className={styles.errorActions}>
            <button
              className={styles.statePrimary}
              disabled={mutating}
              onClick={() =>
                failedOperation.current && void mutate(failedOperation.current)
              }
            >
              Try again
            </button>
            <button
              className={styles.stateSecondary}
              onClick={() => {
                setActionError("");
                setRemoving(null);
              }}
            >
              Keep previous cart
            </button>
          </div>
        </div>
      </CartShell>
    );
  const unavailable = data.items.find(
    (item) => item.product.stock < item.quantity,
  );
  if (unavailable)
    return (
      <CartShell cartCount={itemCount} node="228:91">
        <div className={styles.statePage}>
          <h1>Cart</h1>
          <section className={styles.unavailableCard}>
            <h2>Item unavailable</h2>
            <strong>
              {unavailable.product.name}
              {unavailable.variantLabel ? ` · ${unavailable.variantLabel}` : ""}
            </strong>
            <p>This option sold out before checkout.</p>
            <p>Choose another size or remove the item to continue.</p>
          </section>
          <div className={styles.unavailableActions}>
            <Link
              className={styles.statePrimary}
              href={`/product/${unavailable.product.id}`}
            >
              View product
            </Link>
            <button
              className={styles.stateSecondary}
              disabled={mutating}
              onClick={() => void mutate(() => cartApi.remove(unavailable.id))}
            >
              Remove item
            </button>
          </div>
        </div>
      </CartShell>
    );
  if (removing)
    return (
      <CartShell cartCount={itemCount} node="228:68">
        <div className={styles.statePage}>
          <h1>Cart</h1>
          <p className={styles.stateCount}>{itemCount} items</p>
          <section className={styles.removeItem}>
            <strong>{removing.product.name}</strong>
            <p>
              {removing.product.seller.displayName}
              {" · "}
              {money(removing.lineTotal)}
            </p>
          </section>
          <section className={styles.removeCard}>
            <h2>Remove this item?</h2>
            <p>{removing.product.name} will be removed from your cart.</p>
            <button
              className={styles.statePrimary}
              disabled={mutating}
              onClick={() => void mutate(() => cartApi.remove(removing.id))}
            >
              Remove item
            </button>
            <button
              className={styles.keepItem}
              onClick={() => setRemoving(null)}
            >
              Keep item
            </button>
          </section>
        </div>
      </CartShell>
    );

  return (
    <CartShell cartCount={itemCount}>
      <CartHeader />

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
            <Link
              className={styles.productLink}
              href={`/product/${item.product.id}`}
              aria-label={`View ${item.product.name}`}
            />
            <div className={styles.cartThumb}>
              {item.product.images[0] ? (
                <img
                  src={item.product.images[0].url}
                  alt={item.product.images[0].altText || item.product.name}
                />
              ) : null}
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
                disabled={mutating}
                onClick={() =>
                  void (item.quantity === 1
                    ? setRemoving(item)
                    : mutate(() => cartApi.update(item.id, item.quantity - 1)))
                }
              >
                −
              </button>
              <span>{item.quantity}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={mutating}
                onClick={() =>
                  void mutate(() => cartApi.update(item.id, item.quantity + 1))
                }
              >
                +
              </button>
            </div>
          </article>
        ))}
      </section>

      <div className={styles.promo} aria-label="Promo code status">
        <span>Promo codes are not available yet.</span>
      </div>

      <section className={`summary ${styles.summary}`}>
        <h2>Order summary</h2>
        <div>
          <span>Subtotal</span>
          <strong>{money(data.subtotal)}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <span>
            {data.delivery === "0"
              ? "Free"
              : data.delivery
                ? money(data.delivery)
                : "Not added"}
          </span>
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

function CartShell({
  children,
  cartCount,
  node = "8:81",
}: {
  children: React.ReactNode;
  cartCount?: number;
  node?: string;
}) {
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node={node}>
      {children}
      <BottomNavigation cartCount={cartCount} />
    </main>
  );
}

function CartHeader() {
  return (
    <header className={styles.header}>
      <Link className={styles.headerButton} href="/" aria-label="Back to home">
        <img src="/figma/back.svg" alt="" />
      </Link>
      <Link
        className={styles.headerAction}
        href="/saved"
        aria-label="Saved products"
      >
        <img src="/figma/cart-heart.svg" alt="" />
      </Link>
    </header>
  );
}
