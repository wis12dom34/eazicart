import Link from "next/link";
import { Header } from "../components/header";
import { Icon } from "../components/icon";
import { money, products } from "../data";
export default function CartPage() {
  const p = products[0];
  return (
    <main className="app-shell">
      <Header title="My cart" back="/product/woven-tote" />
      <section className="cart-list">
        <article className="cart-item">
          <div className="cart-thumb" style={{ background: p.color }}>
            {p.image}
          </div>
          <div>
            <small>{p.brand}</small>
            <h2>{p.name}</h2>
            <strong>{money(p.price)}</strong>
            <div className="quantity">
              <button aria-label="Decrease quantity">
                <Icon name="minus" size={16} />
              </button>
              <span>1</span>
              <button aria-label="Increase quantity">
                <Icon name="plus" size={16} />
              </button>
            </div>
          </div>
        </article>
      </section>
      <section className="summary">
        <div>
          <span>Subtotal</span>
          <strong>{money(p.price)}</strong>
        </div>
        <div>
          <span>Delivery</span>
          <span>Calculated at checkout</span>
        </div>
        <div className="total">
          <span>Total</span>
          <strong>{money(p.price)}</strong>
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
