import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Header } from "../components/header";
import { products } from "../data";

export default function OrdersPage() {
  const product = products[0];

  return (
    <main className="app-shell with-nav">
      <Header title="Orders" />
      <div className="filter-tabs">
        <button className="active">Active</button>
        <button>Completed</button>
        <button>Cancelled</button>
      </div>
      <section className="order-list">
        <Link className="order-card" href="/orders/EC-240918">
          <div className="order-top">
            <span className="status-badge">In transit</span>
            <small>Order #EC-240918</small>
          </div>
          {product ? (
            <div className="order-product">
              <div style={{ background: product.color }}>{product.image}</div>
              <span>
                <strong>{product.name}</strong>
                <small>1 item · ₦51,000</small>
              </span>
            </div>
          ) : (
            <p>No order items found.</p>
          )}
          <div className="order-footer">
            <span>Arriving 19–21 Sep</span>
            <strong>View details →</strong>
          </div>
        </Link>
      </section>
      <BottomNavigation />
    </main>
  );
}
