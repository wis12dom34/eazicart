import Link from "next/link";
import { Header } from "../../components/header";
import { Icon } from "../../components/icon";
import { products } from "../../data";
export default function OrderDetail() {
  return (
    <main className="app-shell">
      <Header title="Order details" back="/orders" />
      <section className="order-status">
        <span className="status-badge">In transit</span>
        <h2>Your order is on the way</h2>
        <p>Estimated delivery 19–21 September</p>
        <Link className="secondary-button" href="/tracking">
          Track package
        </Link>
      </section>
      <section className="checkout-section">
        <h2>Items</h2>
        <div className="order-product">
          <div style={{ background: products[0].color }}>
            {products[0].image}
          </div>
          <span>
            <strong>{products[0].name}</strong>
            <small>Qty 1 · ₦48,500</small>
          </span>
        </div>
      </section>
      <section className="checkout-section">
        <h2>Delivery details</h2>
        <div className="info-line">
          <Icon name="location" />
          <p>
            <strong>Home</strong>
            <br />
            14 Admiralty Way, Lekki Phase 1, Lagos
          </p>
        </div>
      </section>
      <section className="checkout-section">
        <h2>Payment summary</h2>
        <div className="summary">
          <div>
            <span>Items</span>
            <b>₦48,500</b>
          </div>
          <div>
            <span>Delivery</span>
            <b>₦2,500</b>
          </div>
          <div className="total">
            <strong>Total</strong>
            <strong>₦51,000</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
