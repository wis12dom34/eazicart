"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { sellerSubscriptionsApi } from "../../../lib/api/seller-subscriptions";
import type { SellerPlanCode } from "../../../lib/api/types";
import {
  PRO_PRICING,
  SELLER_SUBSCRIPTION_PLANS,
  sellerBillingFromQuery,
  type SellerBillingCycle,
  type SellerSubscriptionTier,
} from "../../../lib/seller-subscription-plans";
import { useAuth } from "../../providers/auth-provider";
import styles from "./seller-subscription.module.css";

function SubscriptionContent() {
  const params = useSearchParams();
  const auth = useAuth();
  const requested = params.get("plan")?.toUpperCase();
  const initialTier: SellerSubscriptionTier =
    requested === "BASIC" || requested === "BUSINESS" ? requested : "PRO";
  const [tier, setTier] = useState<SellerSubscriptionTier>(initialTier);
  const [billing, setBilling] = useState<SellerBillingCycle>(() =>
    sellerBillingFromQuery(params.get("billing")),
  );
  const [currentPlan, setCurrentPlan] = useState<SellerPlanCode | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const plan = SELLER_SUBSCRIPTION_PLANS[tier];
  const pricing = PRO_PRICING[billing];
  const reviewHref = useMemo(
    () => `/seller/subscription/review?plan=PRO&billing=${billing}`,
    [billing],
  );

  useEffect(() => {
    if (auth.loading || !auth.isAuthenticated) return;
    let cancelled = false;
    setCurrentLoading(true);
    sellerSubscriptionsApi
      .current()
      .then((response) => {
        if (!cancelled) {
          setCurrentPlan(response.data.subscription?.plan.code ?? "BASIC");
        }
      })
      .catch(() => {
        if (!cancelled) setCurrentPlan(null);
      })
      .finally(() => {
        if (!cancelled) setCurrentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.isAuthenticated, auth.loading]);

  const currentLabel = auth.loading
    ? "Checking your plan…"
    : !auth.isAuthenticated
      ? "Sign in to view your current plan"
      : currentLoading
        ? "Checking your plan…"
        : currentPlan
          ? `Current plan: ${SELLER_SUBSCRIPTION_PLANS[currentPlan].title}`
          : "Current plan unavailable";

  return (
    <main className={styles.page} data-figma-node="249:408">
      <Link className={styles.close} href="/profile" aria-label="Close subscription plans">
        ×
      </Link>
      <div className={styles.brand} aria-hidden="true">
        <Image src="/figma/logo.svg" alt="" width={32} height={32} priority />
      </div>
      <header className={styles.hero}>
        <h1>More for your store.<br />One simple plan.</h1>
        {auth.isAuthenticated ? (
          <span className={styles.currentPlan}>{currentLabel}</span>
        ) : (
          <Link href={`/login?next=${encodeURIComponent(`/seller/subscription?plan=PRO&billing=${billing}`)}`}>
            {currentLabel}
          </Link>
        )}
      </header>

      <section className={styles.planPanel} aria-label="Seller plans">
        <div className={styles.tabs} role="tablist" aria-label="Subscription tier">
          {(["BASIC", "PRO", "BUSINESS"] as SellerSubscriptionTier[]).map((item) => (
            <button
              key={item}
              type="button"
              role="tab"
              aria-selected={tier === item}
              className={tier === item ? styles.activeTab : ""}
              onClick={() => setTier(item)}
            >
              {SELLER_SUBSCRIPTION_PLANS[item].title}
            </button>
          ))}
        </div>
        <div className={styles.benefits}>
          <div className={styles.planHeading}>
            <h2>{plan.title}</h2>
            {tier === "PRO" ? <span>Most popular</span> : tier === "BUSINESS" ? <span>Coming soon</span> : null}
          </div>
          <p>{plan.subtitle}</p>
          <strong>{tier === "PRO" ? "Your Pro benefits" : tier === "BASIC" ? "Included with Basic" : "Business"}</strong>
          <ul>
            {plan.benefits.map((benefit) => <li key={benefit}><span aria-hidden="true">✓</span>{benefit}</li>)}
          </ul>
        </div>
      </section>

      <footer className={styles.purchase}>
        {tier === "PRO" ? (
          <>
            <div className={styles.billingChoices}>
              {(["MONTHLY", "YEARLY"] as SellerBillingCycle[]).map((cycle) => {
                const option = PRO_PRICING[cycle];
                return (
                  <button
                    key={cycle}
                    type="button"
                    aria-pressed={billing === cycle}
                    className={billing === cycle ? styles.selectedBilling : ""}
                    onClick={() => setBilling(cycle)}
                  >
                    <b>{option.amountLabel}</b>
                    <span>{option.shortLabel}</span>
                    <small>{option.helper}</small>
                  </button>
                );
              })}
            </div>
            <p className={styles.terms}>{pricing.terms}{billing === "MONTHLY" ? " Cancel anytime." : ""}</p>
            <Link className={styles.primary} href={auth.isAuthenticated ? reviewHref : `/login?next=${encodeURIComponent(reviewHref)}`}>
              Upgrade to Pro
            </Link>
            <small className={styles.paymentNote}>Choose card or bank transfer at checkout.<br />Card renewals and transfer terms appear before payment.</small>
          </>
        ) : tier === "BASIC" ? (
          <>
            <div className={styles.freePrice}><b>Free</b><span>No card required.</span></div>
            <Link className={styles.primary} href={auth.isAuthenticated ? "/seller/dashboard" : `/login?next=${encodeURIComponent("/seller/dashboard")}`}>
              Start selling for free
            </Link>
            <small className={styles.paymentNote}>Basic bypasses payment and keeps the existing Basic feature limits.</small>
          </>
        ) : (
          <>
            <div className={styles.freePrice}><b>Coming soon</b><span>Business cannot be purchased yet.</span></div>
            <button className={styles.disabled} type="button" disabled>Business coming soon</button>
          </>
        )}
      </footer>
    </main>
  );
}

export default function SellerSubscriptionPage() {
  return <Suspense fallback={<main className={styles.page} aria-busy="true" />}><SubscriptionContent /></Suspense>;
}
