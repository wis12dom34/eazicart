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
        <p>See how payments work when you place an EaziCart order.</p>
      </header>

      <div className={styles.content}>
        <h2 className={styles.otherTitle}>Available at checkout</h2>
        <section className={styles.checkoutMethod}>
          <span className={styles.checkoutCopy}>
            <strong>Online payment</strong>
            <span>Available payment options appear when you check out</span>
          </span>
        </section>

        <section
          className={styles.cardMethod}
          aria-label="Saved payment methods unavailable"
        >
          <span className={styles.cardIcon} aria-hidden="true">
            ••
          </span>
          <span className={styles.methodCopy}>
            <strong>Saved payment methods</strong>
            <span>Cards and wallet balances are not stored in EaziCart yet</span>
          </span>
        </section>

        <aside className={styles.securityCard}>
          <strong>Secure payments</strong>
          <p>
            Payment details are handled by the payment provider. EaziCart
            verifies transactions server-side and does not store your card
            details.
          </p>
        </aside>

        <div className={styles.scrollClearance} aria-hidden="true" />
      </div>

      <BottomNavigation />
    </main>
  );
}
