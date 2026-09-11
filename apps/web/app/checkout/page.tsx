import Link from "next/link";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { money, products } from "../data";

export default function CheckoutPage() {
  const product = products[0];
  const itemTotal = product ? product.price : 0;

  return (
    <main className="app-shell checkout">
      <Header title="Checkout" back="/cart" />
      <section className="checkout-section">
        <div className="section-header">
          <h2>Delivery address</h2>
          <Link href="/address-book">Change</Link>
        </div>
        <div className="select-card">
          <Icon name="location" />
          <div>
            <strong>Home</strong>
            <p>
              14 Admiralty Way, Lekki Phase 1<br />
              Lagos, Nigeria
            </p>
          </div>
          <Icon name="check" />
        </div>
      </section>
      <section className="checkout-section">
        <div className="section-header">
          <h2>Payment method</h2>
          <Link href="/payment-methods">Change</Link>
        </div>
        <div className="select-card">
          <Icon name="card" />
          <div>
            <strong>Pay with card</strong>
            <p>Visa ending in 4242</p>
          </div>
          <Icon name="check" />
        </div>
      </section>
      <section className="checkout-section">
        <h2>Order summary</h2>
        <div className="summary">
          <div>
            <span>Items</span>
            <strong>{money(itemTotal)}</strong>
          </div>
          <div>
            <span>Delivery fee</span>
            <strong>₦2,500</strong>
          </div>
          <div className="total">
            <span>Total</span>
            <strong>₦51,000</strong>
          </div>
        </div>
      </section>
      <div className="bottom-cta">
        <Link href="/payment-pending" className="dark-button">
          Pay ₦51,000
        </Link>
        <small>By paying, you agree to EaziCart&apos;s purchase terms.</small>
      </div>
    </main>
  );
}
