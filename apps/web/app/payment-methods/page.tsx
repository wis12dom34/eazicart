import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import styles from "./payment-methods.module.css";

export default function PaymentMethods() {
  return (
    <main className={`app-shell ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Link
            className={styles.back}
            href="/profile"
            aria-label="Back to profile"
          >
            <Icon name="back" size={22} />
          </Link>
          <h1>Payment Methods</h1>
        </div>
        <p>Manage how you pay for orders on EaziCart.</p>
      </header>

      <div className={styles.content}>
        <button
          className={styles.addButton}
          type="button"
          disabled
          title="Payment providers are not connected yet"
        >
          +&nbsp; Add payment method
        </button>

        <h2 className={styles.sectionTitle}>Saved methods</h2>
        <section className={styles.unavailableCard} aria-label="Payment methods unavailable">
          <span className={styles.methodIcon} aria-hidden="true">
            <Icon name="card" size={22} />
          </span>
          <span className={styles.methodCopy}>
            <strong>Payment methods aren&apos;t available yet</strong>
            <span>No payment provider is connected in this MVP.</span>
          </span>
        </section>

        <h2 className={styles.otherTitle}>Other ways to pay</h2>
        <div className={styles.disabledMethod} aria-disabled="true">
          <span className={styles.methodCopy}>
            <strong>Payment providers not connected</strong>
            <span>Checkout does not collect payment details yet.</span>
          </span>
          <Icon className={styles.chevron} name="chevron" size={20} />
        </div>

        <aside className={styles.securityCard}>
          <strong>Payment safety</strong>
          <p>EaziCart is not collecting or storing card information yet.</p>
        </aside>
      </div>
      <BottomNavigation />
    </main>
  );
}
