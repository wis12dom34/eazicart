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
import { sellerFinanceApi } from "../../../lib/api/seller-finance";
import type {
  SellerFinanceSale,
  SellerFinanceTotals,
} from "../../../lib/api/types";
import styles from "./seller-finance.module.css";

export default function SellerFinancePage() {
  const auth = useAuth();
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const finance = useRequest(
    async () =>
      profile.data?.data
        ? sellerFinanceApi.summary()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <PageState>
        <LoadingState label="Loading seller finance…" />
      </PageState>
    );
  }

  if (!auth.user) {
    return (
      <PageState>
        <SignInState message="Sign in to view your seller finance data." />
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
          <p>Finance data belongs to your existing EaziCart seller profile.</p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Start selling
          </Link>
        </section>
      </PageState>
    );
  }

  if (finance.loading) {
    return (
      <PageState>
        <LoadingState label="Loading verified sales…" />
      </PageState>
    );
  }

  if (finance.error || !finance.data) {
    return (
      <PageState>
        <ErrorState
          message={finance.error || "Seller finance is unavailable."}
          retry={() => void finance.reload()}
        />
      </PageState>
    );
  }

  const summary = finance.data.data;

  return (
    <main className={`app-shell ${styles.page}`}>
      <Header />
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Seller finance</p>
        <h1>Verified sales only</h1>
        <p>
          These figures come only from successful payments for your own
          products. Unpaid orders are excluded.
        </p>
      </section>

      <section className={styles.overviewCard}>
        <div>
          <p className={styles.eyebrow}>Paid orders</p>
          <strong>{summary.paidOrders.toLocaleString()}</strong>
        </div>
        <Icon name="card" size={24} />
      </section>

      {summary.totals.length ? (
        <section className={styles.totalsSection}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Gross sales</p>
              <h2>By payment currency</h2>
            </div>
          </div>
          <div className={styles.currencyGrid}>
            {summary.totals.map((totals) => (
              <CurrencyCard key={totals.currency} totals={totals} />
            ))}
          </div>
        </section>
      ) : (
        <section className={styles.emptyCard}>
          <h2>No verified paid sales yet</h2>
          <p>
            Successful customer payments will appear here after EaziCart
            verifies them server-side.
          </p>
        </section>
      )}

      <section className={styles.settlementCard}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Settlement</p>
            <h2>Payouts not configured</h2>
          </div>
        </div>
        <p className={styles.note}>
          Platform fees, net earnings and payout availability are intentionally
          unavailable until real settlement rules and a payout provider are
          configured.
        </p>
        <div className={styles.unavailableGrid}>
          <Unavailable label="Platform fees" />
          <Unavailable label="Net earnings" />
          <Unavailable label="Available for payout" />
        </div>
      </section>

      <section className={styles.salesSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Recent verified sales</p>
            <h2>Payment-backed order activity</h2>
          </div>
        </div>
        {summary.recentSales.length ? (
          <div className={styles.salesList}>
            {summary.recentSales.map((sale) => (
              <SaleRow key={sale.orderId} sale={sale} />
            ))}
          </div>
        ) : (
          <p className={styles.note}>No verified sales to show yet.</p>
        )}
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
      <span>Finance</span>
    </header>
  );
}

function CurrencyCard({ totals }: { totals: SellerFinanceTotals }) {
  return (
    <article className={styles.currencyCard}>
      <div className={styles.currencyTopline}>
        <span>{totals.currency}</span>
        <strong>{formatMoney(totals.paidGross, totals.currency)}</strong>
      </div>
      <dl className={styles.breakdown}>
        <MoneyRow
          label="Pending fulfillment"
          value={totals.pendingGross}
          currency={totals.currency}
        />
        <MoneyRow
          label="Confirmed"
          value={totals.confirmedGross}
          currency={totals.currency}
        />
        <MoneyRow
          label="Fulfilled"
          value={totals.fulfilledGross}
          currency={totals.currency}
        />
        <MoneyRow
          label="Cancelled"
          value={totals.cancelledGross}
          currency={totals.currency}
        />
      </dl>
    </article>
  );
}

function MoneyRow({
  label,
  value,
  currency,
}: {
  label: string;
  value: string;
  currency: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{formatMoney(value, currency)}</dd>
    </div>
  );
}

function Unavailable({ label }: { label: string }) {
  return (
    <div className={styles.unavailableItem}>
      <span>{label}</span>
      <strong>Not available yet</strong>
    </div>
  );
}

function SaleRow({ sale }: { sale: SellerFinanceSale }) {
  return (
    <article className={styles.saleRow}>
      <div>
        <strong>{formatMoney(sale.subtotal, sale.currency)}</strong>
        <span>{sale.fulfillmentStatus.toLowerCase()}</span>
      </div>
      <small>
        {sale.paidAt
          ? new Date(sale.paidAt).toLocaleString("en-NG")
          : "Payment date unavailable"}
      </small>
    </article>
  );
}

function formatMoney(value: string, currency: string) {
  const amount = Number(value);
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-NG")}`;
  }
}
