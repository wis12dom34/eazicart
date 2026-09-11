import { Header } from "../components/header";
import { Icon } from "../components/icon";
export default function Payments() {
  return (
    <main className="app-shell">
      <Header title="Payment methods" back="/profile" />
      <section className="settings-list">
        <article className="payment-card">
          <Icon name="card" size={30} />
          <div>
            <strong>•••• •••• •••• 4242</strong>
            <small>Visa · Expires 08/28</small>
          </div>
          <span className="status-badge">Default</span>
        </article>
        <button className="add-card">
          <Icon name="plus" /> Add payment method
        </button>
        <p className="secure-note">
          Your payment information is encrypted and stored securely.
        </p>
      </section>
    </main>
  );
}
