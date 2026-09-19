"use client";

import Link from "next/link";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import { sellerSubscriptionsApi } from "../../../lib/api/seller-subscriptions";
import type { SellerPlan } from "../../../lib/api/types";
import styles from "./seller-subscription.module.css";

export default function SellerSubscriptionPage() {
  const auth = useAuth();
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const plans = useRequest(
    async () =>
      profile.data?.data
        ? sellerSubscriptionsApi.plans()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );
  const current = useRequest(
    async () =>
      profile.data?.data
        ? sellerSubscriptionsApi.current()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <PageState>
        <LoadingState label="Loading subscription settings…" />
      </PageState>
    );
  }

  if (!auth.user) {
    return (
      <PageState>
        <SignInState message="Sign in to manage your seller subscription." />
      </PageState>
    );
  }

  if (profile.error) {
    return (
      <PageState>
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </PageState>
    );
  }

  if (!profile.data?.data) {
    return (
      <PageState>
        <section className={styles.emptyCard}>
          <h1>Create your seller profile first</h1>
          <p>
            Subscriptions are attached to your existing EaziCart seller profile.
          </p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Start selling
          </Link>
        </section>
      </PageState>
    );
  }

  if (plans.loading || current.loading) {
    return (
      <PageState>
        <LoadingState label="Loading plans…" />
      </PageState>
    );
  }

  if (plans.error || current.error || !plans.data || !current.data) {
    return (
      <PageState>
        <ErrorState
          message={
            plans.error ||
            current.error ||
            "Subscription settings are unavailable."
          }
          retry={() => {
            void plans.reload();
            void current.reload();
          }}
        />
      </PageState>
    );
  }

  const subscription = current.data.data.subscription;

  return (
    <main className={`app-shell ${styles.page}`}>
      <Header />

      <section className={styles.hero}>
        <p className={styles.eyebrow}>Seller subscription</p>
        <h1>Plans built for your store</h1>
        <p>
          Basic, Pro and Business are stored in EaziCart&apos;s live plan
          catalog. Pricing and limits remain unavailable until real values are
          configured.
        </p>
      </section>

      <section
        className={styles.currentCard}
        aria-labelledby="current-plan-title"
      >
        <div>
          <p className={styles.eyebrow}>Current plan</p>
          <h2 id="current-plan-title">
            {subscription ? subscription.plan.name : "No active subscription"}
          </h2>
        </div>
        <span className={styles.statusBadge}>
          {subscription
            ? subscription.status.replaceAll("_", " ")
            : "NOT SUBSCRIBED"}
        </span>
      </section>

      <section
        className={styles.planSection}
        aria-labelledby="available-plans-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Available plans</p>
            <h2 id="available-plans-title">Choose when pricing is published</h2>
          </div>
          <span>{plans.data.data.length} plans</span>
        </div>
        <div className={styles.planGrid}>
          {plans.data.data.map((plan) => (
            <PlanCard key={plan.code} plan={plan} />
          ))}
        </div>
      </section>

      <section className={styles.notice}>
        <Icon name="info" size={19} />
        <p>
          Subscription checkout is intentionally disabled until plan pricing,
          limits and billing rules are approved and published.
        </p>
      </section>
    </main>
  );
}

function PageState({ children }: { children: React.ReactNode }) {
  return (
    <main className={`app-shell ${styles.page}`}>
      <Header />
      {children}
    </main>
  );
}

function Header() {
  return (
    <header className={styles.topbar}>
      <Link
        className={styles.back}
        href="/seller/dashboard"
        aria-label="Back to seller dashboard"
      >
        <Icon name="back" size={22} />
      </Link>
      <span>Subscription</span>
    </header>
  );
}

function PlanCard({ plan }: { plan: SellerPlan }) {
  return (
    <article className={styles.planCard}>
      <div className={styles.planTopline}>
        <div>
          <p className={styles.planCode}>{plan.code}</p>
          <h3>{plan.name}</h3>
        </div>
        <span className={plan.published ? styles.liveBadge : styles.draftBadge}>
          {plan.published ? "Published" : "Not published"}
        </span>
      </div>

      <div className={styles.price}>
        {plan.monthlyPrice ? (
          <>
            <strong>
              ₦{Number(plan.monthlyPrice).toLocaleString("en-NG")}
            </strong>
            <span>/ month</span>
          </>
        ) : (
          <strong>Pricing not configured</strong>
        )}
      </div>

      <dl className={styles.planDetails}>
        <PlanDetail label="Products" value={formatLimit(plan.productLimit)} />
        <PlanDetail label="Campaigns" value={formatLimit(plan.campaignLimit)} />
        <PlanDetail
          label="Advanced analytics"
          value={
            plan.advancedAnalytics === null
              ? "Not configured"
              : plan.advancedAnalytics
                ? "Included"
                : "Not included"
          }
        />
      </dl>

      <button className={styles.disabledButton} type="button" disabled>
        {plan.purchasable ? "Checkout not enabled yet" : "Not available yet"}
      </button>
    </article>
  );
}

function PlanDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function formatLimit(limit: number | null) {
  return limit === null ? "Not configured" : limit.toLocaleString("en-NG");
}
