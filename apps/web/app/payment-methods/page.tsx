/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import { BottomNavigation } from "../components/bottom-navigation";
import styles from "./payment-methods.module.css";

export default function PaymentMethods() {
  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="30:38">
      <header className={styles.header}>
        <Link
          className={styles.back}
          href="/profile"
          aria-label="Back to profile"
        >
          <img
            src="/figma/address-select-back.svg"
            width={10}
            height={18}
            alt=""
          />
        </Link>
        <h1>Payment Methods</h1>
        <p>Manage how you pay for orders on EaziCart.</p>
      </header>

      <div className={styles.content}>
        <h2 className={styles.savedTitle}>Saved methods</h2>

        <section
          className={styles.walletCard}
          aria-label="EaziCart Wallet unavailable"
        >
          <span className={styles.walletIcon} aria-hidden="true">
            ₦
          </span>
          <span className={styles.methodCopy}>
            <strong>EaziCart Wallet</strong>
            <span>Not available yet</span>
          </span>
          <span className={styles.unavailableBadge}>Unavailable</span>
        </section>

        <section
          className={styles.cardMethod}
          aria-label="Saved cards unavailable"
        >
          <span className={styles.cardIcon} aria-hidden="true">
            ••
          </span>
          <span className={styles.methodCopy}>
            <strong>Saved cards</strong>
            <span>Card storage is not available yet</span>
          </span>
        </section>

        <h2 className={styles.otherTitle}>Checkout payment</h2>
        <section className={styles.checkoutMethod}>
          <span className={styles.checkoutCopy}>
            <strong>Paystack</strong>
            <span>Payment options appear when you check out</span>
          </span>
        </section>

        <aside className={styles.securityCard}>
          <strong>Secure payments</strong>
          <p>
            Paystack handles payment details. EaziCart verifies transactions
            server-side and does not store your card details.
          </p>
        </aside>

        <div className={styles.scrollClearance} aria-hidden="true" />
      </div>

      <BottomNavigation />
    </main>
  );
}
