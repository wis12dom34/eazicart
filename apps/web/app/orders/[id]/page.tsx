"use client";
import { use } from "react";
import { Header } from "../../components/header";
import { Icon } from "../../components/icon";
import { money } from "../../data";
import { ordersApi } from "../../../lib/api/orders";
import { useRequest } from "../../hooks/use-request";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { useAuth } from "../../providers/auth-provider";
export default function OrderDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const auth = useAuth();
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? ordersApi.get(id) : Promise.resolve(undefined),
    [auth.isAuthenticated, id],
  );
  if (auth.loading || result.loading)
    return (
      <main className="app-shell">
        <Header title="Order details" back="/orders" />
        <LoadingState />
      </main>
    );
  if (!auth.isAuthenticated)
    return (
      <main className="app-shell">
        <Header title="Order details" back="/orders" />
        <SignInState />
      </main>
    );
  if (result.error || !result.data)
    return (
      <main className="app-shell">
        <Header title="Order details" back="/orders" />
        <ErrorState message={result.error || "Order not found"} />
      </main>
    );
  const order = result.data.data;
  return (
    <main className="app-shell">
      <Header title="Order details" back="/orders" />
      <section className="order-status">
        <span className="status-badge">
          {order.status.replaceAll("_", " ")}
        </span>
        <h2>Order status</h2>
        <p>This is the latest status available from EaziCart.</p>
      </section>
      <section className="checkout-section">
        <h2>Items</h2>
        {order.items.map((item) => (
          <div className="order-product" key={item.id}>
            <div style={{ background: "#eee8e1" }}>📦</div>
            <span>
              <strong>{item.productName}</strong>
              <small>
                Qty {item.quantity} · {money(item.unitPrice)} each
              </small>
            </span>
          </div>
        ))}
      </section>
      <section className="checkout-section">
        <h2>Delivery details</h2>
        <div className="info-line">
          <Icon name="location" />
          <p>
            <strong>{order.address.label || "Delivery address"}</strong>
            <br />
            {order.address.line1}
            {order.address.line2 ? `, ${order.address.line2}` : ""},{" "}
            {order.address.city}, {order.address.region},{" "}
            {order.address.country}
          </p>
        </div>
      </section>
      <section className="checkout-section">
        <h2>Payment summary</h2>
        <div className="summary">
          <div className="total">
            <strong>Total</strong>
            <strong>{money(order.total)}</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
