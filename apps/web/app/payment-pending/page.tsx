import Link from "next/link";
import { Icon } from "../components/icon";
export default function PaymentPending() {
  return (
    <main className="status-page">
      <div className="status-icon pending">
        <span className="spinner" />
        <Icon name="card" />
      </div>
      <h1>Confirming payment</h1>
      <p>
        Please wait while we confirm your payment. This usually takes a few
        seconds.
      </p>
      <Link className="dark-button" href="/payment-success">
        Continue demo
      </Link>
    </main>
  );
}
