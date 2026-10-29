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
import {
  DesktopCustomerShell,
  SubscriptionDesktopRail,
} from "../../../components/desktop-customer-shell";
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

  const methodLabel = method === "CARD" ? "Card" : "Bank transfer";
  const renewalText =
    method === "CARD"
      ? "Card renews automatically. Cancel before the next charge."
      : "Bank transfer renewal is manual. A new verified transfer is required for the next period.";

  return (
    <DesktopCustomerShell
      activeHref="/profile"
      rail={<SubscriptionDesktopRail />}
    >
      <main className={styles.page} data-figma-node="249:433">
        <div className={styles.mobileLayout}>
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
            aria-controls="subscription-payment-methods-mobile"
            onClick={() => setChoosingMethod((open) => !open)}
          >
            <b>Payment method</b>
            <span>{methodLabel} · Change ›</span>
          </button>
          <fieldset
            id="subscription-payment-methods-mobile"
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
            <p>{renewalText}</p>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              disabled
              aria-describedby="payment-unavailable-note-mobile"
            >
              Continue to secure payment
            </button>
            <Link href={planHref}>Back to plans</Link>
            <p id="payment-unavailable-note-mobile">
              Payments are not available yet. You have not been charged.
            </p>
          </div>
          <SellerBottomNavigation active="profile" layout="flat" />
        </div>

        <div className={styles.desktopLayout} data-figma-node="3405:20606">
          <header className={styles.desktopHeader}>
            <h1>Confirm subscription</h1>
            <p>Review your plan, amount and payment method.</p>
          </header>

          <section className={styles.desktopSummary} aria-label="Subscription summary">
            <div>
              <small>Selected plan</small>
              <h2>Pro</h2>
            </div>
            <div className={styles.desktopSummaryPrice}>
              <b>{pricing.amountLabel}</b>
              <span>
                {pricing.cycleLabel}
                {billing === "MONTHLY" ? " · first 3 months" : ""}
              </span>
            </div>
          </section>

          <button
            type="button"
            className={styles.desktopRow}
            aria-expanded={choosingMethod}
            aria-controls="subscription-payment-methods-desktop"
            onClick={() => setChoosingMethod((open) => !open)}
          >
            <span>
              <small>Payment method</small>
              <b>{methodLabel}</b>
            </span>
            <strong>Change ›</strong>
          </button>
          <fieldset
            id="subscription-payment-methods-desktop"
            className={styles.desktopMethodGroup}
            hidden={!choosingMethod}
          >
            <legend>Payment method</legend>
            <button
              type="button"
              className={method === "CARD" ? styles.desktopSelectedMethod : ""}
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
              className={method === "TRANSFER" ? styles.desktopSelectedMethod : ""}
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

          <div className={styles.desktopRowStatic}>
            <small>Billing email</small>
            <span>{auth.user?.email ?? "Account email"}</span>
          </div>

          <section className={styles.desktopDue} aria-label="Amount due today">
            <div>
              <small>Due today</small>
              <b>{pricing.amountLabel}</b>
            </div>
            <p>{pricing.terms}</p>
          </section>

          <div className={styles.desktopActions}>
            <button
              type="button"
              disabled
              aria-describedby="payment-unavailable-note-desktop"
            >
              Continue to secure payment
            </button>
            <p className={styles.desktopRenewal}>{renewalText}</p>
            <Link href={planHref}>‹&nbsp; Back to plans</Link>
            <p id="payment-unavailable-note-desktop" className={styles.desktopUnavailable}>
              Payments are not available yet. You have not been charged.
            </p>
          </div>
        </div>
      </main>
    </DesktopCustomerShell>
  );
}

export default function SubscriptionReviewPage() {
  return (
    <Suspense fallback={<main className={styles.page} aria-busy="true" />}>
      <SubscriptionReviewContent />
    </Suspense>
  );
}
