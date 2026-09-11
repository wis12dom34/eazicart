"use client";
import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Header } from "../components/header";
import { money } from "../data";
import { ordersApi } from "../../lib/api/orders";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
export default function OrdersPage() {
  const auth = useAuth();
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? ordersApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  return (
    <main className="app-shell with-nav">
      <Header title="Orders" />
      <div className="filter-tabs">
        <button className="active">All</button>
        <button>Completed</button>
        <button>Cancelled</button>
      </div>
      {auth.loading || result.loading ? (
        <LoadingState label="Loading orders…" />
      ) : !auth.isAuthenticated ? (
        <SignInState message="Sign in to see your orders." />
      ) : result.error ? (
        <ErrorState message={result.error} retry={result.reload} />
      ) : !result.data?.data.length ? (
        <EmptyState message="You have no orders yet." />
      ) : (
        <section className="order-list">
          {result.data.data.map((order) => (
            <Link
              className="order-card"
              href={`/orders/${order.id}`}
              key={order.id}
            >
              <div className="order-top">
                <span className="status-badge">
                  {order.status.replaceAll("_", " ")}
                </span>
                <small>Order #{order.id.slice(-8)}</small>
              </div>
              <div className="order-product">
                <div style={{ background: "#eee8e1" }}>📦</div>
                <span>
                  <strong>{order.items[0]?.productName ?? "Order"}</strong>
                  <small>
                    {order.items.length} item(s) · {money(order.total)}
                  </small>
                </span>
              </div>
              <div className="order-footer">
                <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                <strong>View details →</strong>
              </div>
            </Link>
          ))}
        </section>
      )}
      <BottomNavigation />
    </main>
  );
}
