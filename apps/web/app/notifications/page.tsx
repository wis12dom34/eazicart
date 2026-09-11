import { Header } from "../components/header";
import { Icon } from "../components/icon";
const notes = [
  {
    t: "Your order has shipped",
    d: "Mini Woven Tote is on its way to you.",
    time: "2h",
    icon: "box",
  },
  {
    t: "Price drop on a saved item",
    d: "The Everyday Sneaker is now ₦49,000.",
    time: "1d",
    icon: "heart",
  },
  {
    t: "New from Naya",
    d: "Explore their latest linen collection.",
    time: "3d",
    icon: "sparkle",
  },
];
export default function Notifications() {
  return (
    <main className="app-shell">
      <Header title="Notifications" back="/profile" />
      <section className="notification-list">
        {notes.map((n) => (
          <article key={n.t}>
            <span>
              <Icon name={n.icon} />
            </span>
            <div>
              <strong>{n.t}</strong>
              <p>{n.d}</p>
            </div>
            <small>{n.time}</small>
          </article>
        ))}
      </section>
    </main>
  );
}
