"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "../components/icon";

export default function PaymentSuccess() {
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get("orderId"));
  }, []);

  return (
    <main className="status-page">
      <div className="status-icon success">
        <Icon name="check" size={36} />
      </div>
      <p className="eyebrow">Payment confirmed</p>
      <h1>Thank you for your order!</h1>
      <p>
        EaziCart verified your payment with Paystack. Your order is now available
        to the seller for processing.
      </p>
      {orderId ? (
        <>
          <Link className="dark-button" href={`/tracking/${orderId}`}>
            Track my order
          </Link>
          <Link className="text-button" href={`/orders/${orderId}`}>
            View order details
          </Link>
        </>
      ) : (
        <Link className="dark-button" href="/orders">
          View my orders
        </Link>
      )}
      <Link className="text-button" href="/">
        Continue shopping
      </Link>
    </main>
  );
}
