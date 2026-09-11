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
            <strong>Payment methods coming soon</strong>
            <small>No payment provider is connected in this MVP.</small>
          </div>
        </article>
        <button className="add-card" disabled>
          <Icon name="plus" /> Add payment method
        </button>
        <p className="secure-note">
          EaziCart is not collecting or storing card information yet.
        </p>
      </section>
    </main>
  );
}
