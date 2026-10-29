"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { sellerSubscriptionsApi } from "../../../lib/api/seller-subscriptions";
import type { SellerPlanCode } from "../../../lib/api/types";
import {
  PRO_PRICING,
  SELLER_SUBSCRIPTION_PLANS,
  sellerBillingFromQuery,
  sellerPaymentMethodFromQuery,
  type SellerBillingCycle,
  type SellerSubscriptionTier,
} from "../../../lib/seller-subscription-plans";
import {
  DesktopCustomerShell,
  SubscriptionDesktopRail,
} from "../../components/desktop-customer-shell";
import { useAuth } from "../../providers/auth-provider";
import styles from "./seller-subscription.module.css";

const desktopProBenefits = [
  "Unlimited product listings",
  "Custom storefront & branding",
  "Priority search placement",
  "Advanced analytics & insights",
  "Reels & short video selling",
  "Verified seller badge",
] as const;

function SubscriptionContent() {
  const params = useSearchParams();
  const auth = useAuth();
  const router = useRouter();
  const requested = params.get("plan")?.toUpperCase();
  const tier: SellerSubscriptionTier =
    requested === "BASIC" || requested === "BUSINESS" ? requested : "PRO";
  const billing = sellerBillingFromQuery(params.get("billing"));
  const method = sellerPaymentMethodFromQuery(params.get("method"));
  const selectPlan = (
    nextTier: SellerSubscriptionTier,
    nextBilling: SellerBillingCycle,
  ) => {
    router.push(
      `/seller/subscription?plan=${nextTier}&billing=${nextBilling}&method=${method}`,
      { scroll: false },
    );
  };
  const [currentPlan, setCurrentPlan] = useState<SellerPlanCode | null>(null);
  const [currentLoading, setCurrentLoading] = useState(false);
  const plan = SELLER_SUBSCRIPTION_PLANS[tier];
  const pricing = PRO_PRICING[billing];
  const reviewHref = useMemo(
    () =>
      `/seller/subscription/review?plan=PRO&billing=${billing}&method=${method}`,
    [billing, method],
  );
  const upgradeHref = auth.isAuthenticated
    ? reviewHref
    : `/login?next=${encodeURIComponent(reviewHref)}`;
  const sellerDashboardHref = auth.isAuthenticated
    ? "/seller/dashboard"
    : `/login?next=${encodeURIComponent("/seller/dashboard")}`;

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
    <DesktopCustomerShell
      activeHref="/profile"
      rail={<SubscriptionDesktopRail />}
    >
      <main className={styles.page} data-figma-node="249:408">
        <div className={styles.mobileLayout}>
          <Link
            className={styles.close}
            href="/profile"
            aria-label="Close subscription plans"
          >
            ×
          </Link>
          <div className={styles.brand} aria-hidden="true">
            <Image src="/figma/logo.svg" alt="" width={32} height={32} priority />
          </div>
          <header className={styles.hero}>
            <h1>
              More for your store.
              <br />
              One simple plan.
            </h1>
            {auth.isAuthenticated ? (
              <span className={styles.currentPlan}>{currentLabel}</span>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(`/seller/subscription?plan=${tier}&billing=${billing}&method=${method}`)}`}
              >
                {currentLabel}
              </Link>
            )}
          </header>

          <section className={styles.planPanel} aria-label="Seller plans">
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Subscription tier"
            >
              {(["BASIC", "PRO", "BUSINESS"] as SellerSubscriptionTier[]).map(
                (item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={tier === item}
                    className={tier === item ? styles.activeTab : ""}
                    onClick={() => selectPlan(item, billing)}
                  >
                    {SELLER_SUBSCRIPTION_PLANS[item].title}
                  </button>
                ),
              )}
            </div>
            <div
              className={styles.benefits}
              role="region"
              aria-label={`${plan.title} plan benefits`}
              tabIndex={0}
            >
              <div className={styles.planHeading}>
                <h2>{plan.title}</h2>
                {tier === "PRO" ? (
                  <span>Most popular</span>
                ) : tier === "BUSINESS" ? (
                  <span>Coming soon</span>
                ) : null}
              </div>
              <p>{plan.subtitle}</p>
              <strong>
                {tier === "PRO"
                  ? "Your Pro benefits"
                  : tier === "BASIC"
                    ? "Included with Basic"
                    : "Business"}
              </strong>
              <ul>
                {plan.benefits.map((benefit) => (
                  <li key={benefit}>
                    <span aria-hidden="true">✓</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <footer className={styles.purchase}>
            {tier === "PRO" ? (
              <>
                <div className={styles.billingChoices}>
                  {(["MONTHLY", "YEARLY"] as SellerBillingCycle[]).map(
                    (cycle) => {
                      const option = PRO_PRICING[cycle];
                      return (
                        <button
                          key={cycle}
                          type="button"
                          aria-pressed={billing === cycle}
                          className={
                            billing === cycle ? styles.selectedBilling : ""
                          }
                          onClick={() => selectPlan(tier, cycle)}
                        >
                          <b>{option.amountLabel}</b>
                          <span>{option.shortLabel}</span>
                          <small>{option.helper}</small>
                        </button>
                      );
                    },
                  )}
                </div>
                <p className={styles.terms}>
                  {pricing.terms}
                  {billing === "MONTHLY" ? " Cancel anytime." : ""}
                </p>
                <Link className={styles.primary} href={upgradeHref}>
                  Upgrade to Pro
                </Link>
                <small className={styles.paymentNote}>
                  Choose card or bank transfer at checkout.
                  <br />
                  Card renewals and transfer terms appear before payment.
                </small>
              </>
            ) : tier === "BASIC" ? (
              <>
                <div className={styles.freePrice}>
                  <b>Free</b>
                  <span>No card required.</span>
                </div>
                <Link className={styles.primary} href={sellerDashboardHref}>
                  Start selling for free
                </Link>
                <small className={styles.paymentNote}>
                  No payment needed to get started.
                </small>
              </>
            ) : (
              <>
                <div className={styles.freePrice}>
                  <b>Coming soon</b>
                  <span>Business cannot be purchased yet.</span>
                </div>
                <button className={styles.disabled} type="button" disabled>
                  Business coming soon
                </button>
              </>
            )}
          </footer>
        </div>

        <div className={styles.desktopLayout} data-figma-node="3405:20491">
          <header className={styles.desktopHeader}>
            <h1>Choose your plan</h1>
            <p>Compare every plan in one place. Pick what fits your store today.</p>
          </header>

          <div className={styles.desktopBilling} aria-label="Billing cycle">
            {(["MONTHLY", "YEARLY"] as SellerBillingCycle[]).map((cycle) => (
              <button
                key={cycle}
                type="button"
                aria-pressed={billing === cycle}
                className={billing === cycle ? styles.desktopBillingActive : ""}
                onClick={() => selectPlan("PRO", cycle)}
              >
                {cycle === "MONTHLY" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          <p className={styles.desktopDescription}>
            Basic is free. Pro offers monthly or yearly billing. Business is coming soon.
          </p>

          <div className={styles.desktopPlanGrid}>
            <div className={styles.desktopPlanColumn}>
              <section className={styles.desktopPlanCard} aria-label="Basic plan">
                <span className={styles.desktopBadge}>Free plan</span>
                <h2>Basic</h2>
                <p>{SELLER_SUBSCRIPTION_PLANS.BASIC.subtitle}</p>
                <div className={styles.desktopPrice}>Free</div>
                <ul className={styles.desktopBenefits}>
                  {SELLER_SUBSCRIPTION_PLANS.BASIC.benefits.map((benefit) => (
                    <li key={benefit}>
                      <span aria-hidden="true">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
                <div className={styles.desktopPlanAction}>
                  {currentPlan === "BASIC" ? (
                    <button type="button" disabled>
                      Current plan
                    </button>
                  ) : (
                    <Link href={sellerDashboardHref}>Start free</Link>
                  )}
                </div>
              </section>
            </div>

            <div className={styles.desktopPlanColumn}>
              <section
                className={`${styles.desktopPlanCard} ${styles.desktopPlanCardPro}`}
                aria-label="Pro plan"
              >
                <span className={`${styles.desktopBadge} ${styles.desktopBadgePro}`}>
                  Most popular
                </span>
                <h2>Pro</h2>
                <p>{SELLER_SUBSCRIPTION_PLANS.PRO.subtitle}</p>
                <div className={styles.desktopPriceLine}>
                  <strong>
                    {billing === "MONTHLY" ? "₦4,999" : pricing.amountLabel}
                  </strong>
                  <span>{billing === "MONTHLY" ? "/ month" : "/ year"}</span>
                </div>
                <ul
                  className={styles.desktopBenefits}
                  role="region"
                  aria-label="Pro plan benefits"
                  tabIndex={0}
                >
                  {desktopProBenefits.map((benefit) => (
                    <li key={benefit}>
                      <span aria-hidden="true">✓</span>
                      {benefit}
                    </li>
                  ))}
                  {SELLER_SUBSCRIPTION_PLANS.PRO.benefits
                    .filter((benefit) => !desktopProBenefits.includes(benefit as (typeof desktopProBenefits)[number]))
                    .map((benefit) => (
                      <li key={benefit} className={styles.desktopExtraBenefit}>
                        <span aria-hidden="true">✓</span>
                        {benefit}
                      </li>
                    ))}
                </ul>
                <div className={styles.desktopPlanAction}>
                  {currentPlan === "PRO" ? (
                    <button type="button" disabled>
                      Current plan
                    </button>
                  ) : (
                    <Link href={upgradeHref} aria-label="Upgrade to Pro">
                      Choose Pro
                    </Link>
                  )}
                </div>
              </section>
              <div className={styles.desktopOffer}>
                {billing === "MONTHLY" ? (
                  <>
                    <strong>₦2,999/month for your first 3 months</strong>
                    <span>Then ₦4,999/month. Cancel anytime.</span>
                  </>
                ) : (
                  <span>{pricing.terms}</span>
                )}
              </div>
            </div>

            <div className={styles.desktopPlanColumn}>
              <section className={styles.desktopPlanCard} aria-label="Business plan">
                <span className={styles.desktopBadge}>Coming soon</span>
                <h2>Business</h2>
                <p>{SELLER_SUBSCRIPTION_PLANS.BUSINESS.subtitle}</p>
                <div className={styles.desktopPrice}>Coming soon</div>
                <ul className={styles.desktopBenefits}>
                  {SELLER_SUBSCRIPTION_PLANS.BUSINESS.benefits.map((benefit) => (
                    <li key={benefit}>
                      <span aria-hidden="true">✓</span>
                      {benefit}
                    </li>
                  ))}
                </ul>
                <div className={styles.desktopPlanAction}>
                  <button type="button" disabled>
                    Business coming soon
                  </button>
                </div>
              </section>
            </div>
          </div>

          <footer className={styles.desktopFooter}>Cancel anytime. No hidden fees.</footer>
        </div>
      </main>
    </DesktopCustomerShell>
  );
}

export default function SellerSubscriptionPage() {
  return (
    <Suspense fallback={<main className={styles.page} aria-busy="true" />}>
      <SubscriptionContent />
    </Suspense>
  );
}
