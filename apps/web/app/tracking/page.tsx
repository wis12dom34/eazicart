import { Header } from "../components/header";
import { Icon } from "../components/icon";
const steps = [
  { t: "Order placed", d: "18 Sep, 10:42 AM", done: true },
  { t: "Payment confirmed", d: "18 Sep, 10:43 AM", done: true },
  { t: "Shipped by seller", d: "18 Sep, 4:15 PM", done: true },
  { t: "Out for delivery", d: "Expected 19–21 Sep", done: false },
  { t: "Delivered", d: "", done: false },
];
export default function Tracking() {
  return (
    <main className="app-shell">
      <Header title="Track order" back="/orders/EC-240918" />
      <section className="tracking-hero">
        <Icon name="box" size={42} />
        <h2>Package in transit</h2>
        <p>Swift Dispatch · TRK82910461</p>
      </section>
      <ol className="timeline">
        {steps.map((s) => (
          <li className={s.done ? "done" : ""} key={s.t}>
            <i>{s.done && <Icon name="check" size={14} />}</i>
            <div>
              <strong>{s.t}</strong>
              <small>{s.d}</small>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}
