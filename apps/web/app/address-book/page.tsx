import { Header } from "../components/header";
import { Icon } from "../components/icon";
export default function AddressBook() {
  return (
    <main className="app-shell">
      <Header
        title="Address book"
        back="/profile"
        action={<button className="text-link">Add new</button>}
      />
      <section className="settings-list">
        <article className="address-card">
          <div className="settings-icon">
            <Icon name="location" />
          </div>
          <div>
            <span className="status-badge">Default</span>
            <h2>Home</h2>
            <p>
              14 Admiralty Way, Lekki Phase 1<br />
              Lagos, Nigeria
            </p>
            <small>+234 803 123 4567</small>
          </div>
          <button className="text-link">Edit</button>
        </article>
      </section>
    </main>
  );
}
