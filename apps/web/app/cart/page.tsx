/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { Header } from "../components/header";
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
export default function CartPage() {
  const auth = useAuth();
  const cart = useRequest(
    async () =>
      auth.isAuthenticated ? cartApi.get() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const mutate = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await cart.reload();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Unable to update cart");
    }
  };
  if (auth.loading) return <LoadingState />;
  if (!auth.isAuthenticated)
    return (
      <main className="app-shell">
        <Header title="My cart" back="/" />
        <SignInState message="Sign in to view and update your cart." />
      </main>
    );
  if (cart.loading)
    return (
      <main className="app-shell">
        <Header title="My cart" back="/" />
        <LoadingState label="Loading cart…" />
      </main>
    );
  if (cart.error)
    return (
      <main className="app-shell">
        <Header title="My cart" back="/" />
        <ErrorState message={cart.error} retry={() => void cart.reload()} />
      </main>
    );
  const data = cart.data?.data;
  if (!data?.items.length)
    return (
      <main className="app-shell">
        <Header title="My cart" back="/" />
        <EmptyState message="Your cart is empty." />
      </main>
    );
  return (
    <main className="app-shell">
      <Header
        title="My cart"
        back="/"
        action={
          <button
            className="text-link"
            onClick={() => void mutate(() => cartApi.clear())}
          >
            Clear
          </button>
        }
      />
      <section className="cart-list">
        {data.items.map((item) => (
          <article className="cart-item" key={item.id}>
            <div className="cart-thumb" style={{ background: "#eee8e1" }}>
              {item.product.images[0] ? (
                <img src={item.product.images[0].url} alt="" />
              ) : (
                "🛍️"
              )}
            </div>
            <div>
              <small>{item.product.seller.displayName}</small>
              <h2>{item.product.name}</h2>
              <strong>{money(item.lineTotal)}</strong>
              <div className="quantity">
                <button
                  aria-label="Decrease quantity"
                  onClick={() =>
                    void (item.quantity === 1
                      ? mutate(() => cartApi.remove(item.id))
                      : mutate(() =>
                          cartApi.update(item.id, item.quantity - 1),
                        ))
                  }
                >
                  <Icon name="minus" size={16} />
                </button>
                <span>{item.quantity}</span>
                <button
                  aria-label="Increase quantity"
                  onClick={() =>
                    void mutate(() =>
                      cartApi.update(item.id, item.quantity + 1),
                    )
                  }
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
      <section className="summary">
        <div>
          <span>Subtotal</span>
          <strong>{money(data.subtotal)}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <span>Calculated at checkout</span>
        </div>
        <div className="total">
          <span>Total</span>
          <strong>{money(data.total)}</strong>
        </div>
      </section>
      <div className="bottom-cta">
        <Link className="dark-button" href="/checkout">
          Proceed to checkout
        </Link>
      </div>
    </main>
  );
}
