"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  PRO_PRICING,
  sellerBillingFromQuery,
  sellerPaymentMethodFromQuery,
  type SellerPaymentMethod,
} from "../../../../lib/seller-subscription-plans";
import { Icon } from "../../../components/icon";
import { SellerBottomNavigation } from "../../../components/seller-bottom-navigation";
import { useAuth } from "../../../providers/auth-provider";
import styles from "./review.module.css";

function SubscriptionReviewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const auth = useAuth();
  const [choosingMethod, setChoosingMethod] = useState(false);
  const requestedPlan = params.get("plan")?.toUpperCase();
  const billing = sellerBillingFromQuery(params.get("billing"));
  const method = sellerPaymentMethodFromQuery(params.get("method"));
  const pricing = PRO_PRICING[billing];

  useEffect(() => {
    if (requestedPlan !== "PRO") {
      router.replace(
        `/seller/subscription?plan=PRO&billing=${billing}&method=${method}`,
      );
      return;
    }
    if (auth.loading || auth.isAuthenticated) return;
    const next = `/seller/subscription/review?plan=PRO&billing=${billing}&method=${method}`;
    router.replace(`/login?next=${encodeURIComponent(next)}`);
  }, [
    auth.isAuthenticated,
    auth.loading,
    billing,
    method,
    requestedPlan,
    router,
  ]);

  const planHref = useMemo(
    () => `/seller/subscription?plan=PRO&billing=${billing}&method=${method}`,
    [billing, method],
  );

  const selectMethod = (nextMethod: SellerPaymentMethod) => {
    setChoosingMethod(false);
    router.replace(
      `/seller/subscription/review?plan=PRO&billing=${billing}&method=${nextMethod}`,
      { scroll: false },
    );
  };

  if (requestedPlan !== "PRO" || auth.loading || !auth.isAuthenticated) {
    return <main className={styles.page} aria-busy="true" />;
  }

  return (
    <main className={styles.page} data-figma-node="249:433">
      <header>
        <Link href={planHref} aria-label="Back to plans">
          <Icon name="back" size={22} />
        </Link>
        <h1>Confirm subscription</h1>
      </header>
      <p className={styles.intro}>
        Review your plan, amount and payment method.
      </p>

      <section className={styles.summary} aria-label="Subscription summary">
        <small>Selected plan</small>
        <h2>Pro</h2>
        <div>
          <b>{pricing.amountLabel}</b>
          <span>{pricing.cycleLabel}</span>
        </div>
      </section>

      <button
        type="button"
        className={`${styles.row} ${styles.methodToggle}`}
        aria-expanded={choosingMethod}
        aria-controls="subscription-payment-methods"
        onClick={() => setChoosingMethod((open) => !open)}
      >
        <b>Payment method</b>
        <span>{method === "CARD" ? "Card" : "Bank transfer"} · Change ›</span>
      </button>
      <fieldset
        id="subscription-payment-methods"
        className={styles.methodGroup}
        hidden={!choosingMethod}
      >
        <legend>Payment method</legend>
        <button
          type="button"
          className={method === "CARD" ? styles.selectedMethod : ""}
          aria-pressed={method === "CARD"}
          onClick={() => selectMethod("CARD")}
        >
          <span>
            <b>Card</b>
            <small>Automatic renewal</small>
          </span>
          <span aria-hidden="true">{method === "CARD" ? "✓" : ""}</span>
        </button>
        <button
          type="button"
          className={method === "TRANSFER" ? styles.selectedMethod : ""}
          aria-pressed={method === "TRANSFER"}
          onClick={() => selectMethod("TRANSFER")}
        >
          <span>
            <b>Bank transfer</b>
            <small>Manual renewal</small>
          </span>
          <span aria-hidden="true">{method === "TRANSFER" ? "✓" : ""}</span>
        </button>
      </fieldset>

      <div className={styles.row}>
        <b>Billing email</b>
        <span>{auth.user?.email ?? "Account email"}</span>
      </div>
      <div className={styles.row}>
        <b>Due today</b>
        <span>{pricing.amountLabel}</span>
      </div>

      <div className={styles.terms}>
        <p>{pricing.terms}</p>
        <p>
          {method === "CARD"
            ? "Card renews automatically. Cancel before the next charge."
            : "Bank transfer renewal is manual. A new verified transfer is required for the next period."}
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          disabled
          aria-describedby="payment-unavailable-note"
        >
          Continue to secure payment
        </button>
        <Link href={planHref}>Back to plans</Link>
        <p id="payment-unavailable-note">
          Payments are not available yet. You have not been charged.
        </p>
      </div>
      <SellerBottomNavigation active="profile" layout="flat" />
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
