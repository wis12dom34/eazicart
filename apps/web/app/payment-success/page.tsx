import Link from "next/link";
import { Icon } from "../components/icon";
export default function PaymentSuccess() {
  return (
    <main className="status-page">
      <div className="status-icon success">
        <Icon name="check" size={36} />
      </div>
      <p className="eyebrow">Order confirmed</p>
      <h1>Thank you for your order!</h1>
      <p>
        Your order <strong>#EC-240918</strong> has been placed and the seller is
        getting it ready.
      </p>
      <Link className="dark-button" href="/tracking">
        Track my order
      </Link>
      <Link className="text-button" href="/">
        Continue shopping
      </Link>
    </main>
  );
}
