"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SellerBottomNavigation } from "../../../components/seller-bottom-navigation";
import styles from "./review.module.css";

type Method = "CARD" | "TRANSFER";

function SubscriptionReviewContent() {
  const params = useSearchParams();
  const billing = params.get("billing") === "YEARLY" ? "YEARLY" : "MONTHLY";
  const plan = params.get("plan") === "PRO" ? "Pro" : "Pro";
  const [method, setMethod] = useState<Method>("CARD");
  const amount = billing === "YEARLY" ? "₦49,900" : "₦2,999";
  const cycle = billing === "YEARLY" ? "Yearly" : "Monthly";

  return (
    <main className={styles.page} data-figma-node="249:433">
      <header><Link href="/seller/subscription?plan=PRO" aria-label="Back to plans">‹</Link><h1>Confirm subscription</h1></header>
      <p className={styles.intro}>Review your plan, amount and payment method.</p>
      <section className={styles.summary}><small>Selected plan</small><h2>{plan}</h2><div><b>{amount}</b><span>{cycle}</span></div></section>
      <button className={styles.row} type="button" onClick={() => setMethod(method === "CARD" ? "TRANSFER" : "CARD")}><b>Payment method</b><span>{method === "CARD" ? "Card" : "Bank transfer"} · Change ›</span></button>
      <div className={styles.row}><b>Billing email</b><span>Use account email</span></div>
      <div className={styles.row}><b>Due today</b><span>{amount}</span></div>
      <div className={styles.terms}>{billing === "MONTHLY" ? <p>₦2,999/month for 3 months, then ₦4,999/month.</p> : <p>₦49,900 billed yearly. Monthly launch offer does not apply.</p>}<p>{method === "CARD" ? "Card: renews automatically. Cancel before the next charge." : "Bank transfer: renewal is manual. A new verified transfer is required for the next period."}</p></div>
      <div className={styles.actions}><button type="button" disabled>Continue to secure payment</button><Link href="/seller/subscription?plan=PRO">Back to plans</Link><p>Secure payment is unavailable until the existing backend exposes a verified seller-subscription payment flow. No plan is activated from this screen.</p></div>
      <SellerBottomNavigation />
    </main>
  );
}

export default function SubscriptionReviewPage() {
  return (
    <Suspense fallback={<main className={styles.page} aria-busy="true" />}>
      <SubscriptionReviewContent />
    </Suspense>
  );
}
