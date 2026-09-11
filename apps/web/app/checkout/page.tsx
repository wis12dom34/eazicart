"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../components/header";
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
  const [selected, setSelected] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  if (auth.loading || cart.loading || addresses.loading)
    return (
      <main className="app-shell">
        <Header title="Checkout" back="/cart" />
        <LoadingState label="Loading checkout…" />
      </main>
    );
  if (!auth.isAuthenticated)
    return (
      <main className="app-shell">
        <Header title="Checkout" back="/cart" />
        <SignInState />
      </main>
    );
  if (cart.error || addresses.error)
    return (
      <main className="app-shell">
        <Header title="Checkout" back="/cart" />
        <ErrorState message={cart.error || addresses.error} />
      </main>
    );
  const address =
    addresses.data?.data.find(
      (a) =>
        a.id ===
        (selected || addresses.data?.data.find((x) => x.isDefault)?.id),
    ) ?? addresses.data?.data[0];
  const place = async () => {
    if (!address) {
      setError("Add a delivery address before ordering.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const order = await ordersApi.create(address.id);
      router.push(`/orders/${order.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place order");
      setSubmitting(false);
    }
  };
  const data = cart.data?.data;
  return (
    <main className="app-shell checkout">
      <Header title="Checkout" back="/cart" />
      <section className="checkout-section">
        <div className="section-header">
          <h2>Delivery address</h2>
          <Link href="/address-book">Change</Link>
        </div>
        {address ? (
          <label className="select-card">
            <Icon name="location" />
            <div>
              <strong>{address.label || "Delivery address"}</strong>
              <p>
                {address.line1}
                <br />
                {address.city}, {address.region}, {address.country}
              </p>
            </div>
            <input
              type="radio"
              checked
              onChange={() => setSelected(address.id)}
            />
          </label>
        ) : (
          <p>
            No address saved. <Link href="/address-book">Add one</Link>
          </p>
        )}
      </section>
      <section className="checkout-section">
        <div className="section-header">
          <h2>Payment</h2>
        </div>
        <div className="select-card">
          <Icon name="card" />
          <div>
            <strong>Payment integration deferred</strong>
            <p>
              This MVP creates an unpaid order; no payment provider is
              connected.
            </p>
          </div>
        </div>
      </section>
      <section className="checkout-section">
        <h2>Order summary</h2>
        <div className="summary">
          <div>
            <span>Items</span>
            <strong>{money(data?.subtotal ?? "0")}</strong>
          </div>
          <div className="total">
            <span>Total</span>
            <strong>{money(data?.total ?? "0")}</strong>
          </div>
        </div>
      </section>
      <div className="bottom-cta">
        <button
          disabled={submitting || !data?.items.length}
          className="dark-button"
          onClick={() => void place()}
        >
          {submitting
            ? "Placing order…"
            : `Place order · ${money(data?.total ?? "0")}`}
        </button>
        {error && <small className="form-error">{error}</small>}
      </div>
    </main>
  );
}
