"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import styles from "./seller-subscription.module.css";

type Tier = "BASIC" | "PRO" | "BUSINESS";
type Billing = "MONTHLY" | "YEARLY";

const planCopy = {
  BASIC: { title: "Basic", subtitle: "Start selling for free.", benefits: ["Keep the existing Basic feature limits", "No card required", "Start selling for free"] },
  PRO: { title: "Pro", subtitle: "More tools for a growing store.", benefits: ["Unlimited product listings", "Custom storefront & branding", "Priority search placement", "Advanced analytics & insights", "Reels & short video selling", "Bulk order processing", "Verified seller badge", "Dedicated seller support"] },
  BUSINESS: { title: "Business", subtitle: "More scale for larger teams.", benefits: ["Business tools are coming soon", "Purchasing is not available yet"] },
} as const;

export default function SellerSubscriptionPage() {
  const params = useSearchParams();
  const requested = params.get("plan")?.toUpperCase();
  const initial: Tier = requested === "BASIC" || requested === "BUSINESS" ? requested : "PRO";
  const [tier, setTier] = useState<Tier>(initial);
  const [billing, setBilling] = useState<Billing>("MONTHLY");
  const plan = planCopy[tier];
  const reviewHref = useMemo(() => `/seller/subscription/review?plan=${tier}&billing=${billing}`, [tier, billing]);

  return (
    <main className={styles.page} data-figma-node="249:408">
      <Link className={styles.close} href="/profile" aria-label="Close subscription plans">×</Link>
      <div className={styles.brand} aria-hidden="true">⌁</div>
      <header className={styles.hero}>
        <h1>More for your store.<br />One simple plan.</h1>
        <Link href="/seller/subscription/current">View your current plan</Link>
      </header>

      <section className={styles.planPanel} aria-label="Seller plans">
        <div className={styles.tabs} role="tablist" aria-label="Subscription tier">
          {(["BASIC", "PRO", "BUSINESS"] as Tier[]).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tier === item} className={tier === item ? styles.activeTab : ""} onClick={() => setTier(item)}>
              {planCopy[item].title}
            </button>
          ))}
        </div>
        <div className={styles.benefits}>
          <div className={styles.planHeading}><h2>{plan.title}</h2>{tier === "PRO" ? <span>Most popular</span> : tier === "BUSINESS" ? <span>Coming soon</span> : null}</div>
          <p>{plan.subtitle}</p>
          <strong>{tier === "PRO" ? "Your Pro benefits" : tier === "BASIC" ? "Included with Basic" : "Business"}</strong>
          <ul>{plan.benefits.map((benefit) => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}</ul>
        </div>
      </section>

      <footer className={styles.purchase}>
        {tier === "PRO" ? (
          <>
            <div className={styles.billingChoices}>
              <button type="button" className={billing === "MONTHLY" ? styles.selectedBilling : ""} onClick={() => setBilling("MONTHLY")}><b>₦2,999</b><span>monthly</span><small>First 3 months</small></button>
              <button type="button" className={billing === "YEARLY" ? styles.selectedBilling : ""} onClick={() => setBilling("YEARLY")}><b>₦49,900</b><span>yearly</span><small>≈ ₦4,158/month</small></button>
            </div>
            <p className={styles.terms}>{billing === "MONTHLY" ? "₦2,999/month for 3 months, then ₦4,999/month. Cancel anytime." : "₦49,900 billed yearly. The monthly launch offer does not apply."}</p>
            <Link className={styles.primary} href={reviewHref}>Upgrade to Pro</Link>
            <small className={styles.paymentNote}>Choose card or bank transfer at checkout.<br />Card renewals and transfer terms appear before payment.</small>
          </>
        ) : tier === "BASIC" ? (
          <><div className={styles.freePrice}><b>Free</b><span>No card required.</span></div><Link className={styles.primary} href="/seller/dashboard">Start selling for free</Link><small className={styles.paymentNote}>Basic bypasses payment and keeps the existing Basic feature limits.</small></>
        ) : (
          <><div className={styles.freePrice}><b>Coming soon</b><span>Business cannot be purchased yet.</span></div><button className={styles.disabled} type="button" disabled>Business coming soon</button></>
        )}
      </footer>
    </main>
  );
}
