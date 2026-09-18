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
          title="Saved payment methods are not supported yet"
        >
          +&nbsp; Add payment method
        </button>

        <h2 className={styles.sectionTitle}>Saved methods</h2>
        <section
          className={styles.unavailableCard}
          aria-label="Saved payment methods unavailable"
        >
          <span className={styles.methodIcon} aria-hidden="true">
            <Icon name="card" size={22} />
          </span>
          <span className={styles.methodCopy}>
            <strong>Saved payment methods aren&apos;t available yet</strong>
            <span>
              EaziCart does not store card or bank details in your account.
            </span>
          </span>
        </section>

        <h2 className={styles.otherTitle}>Checkout payment</h2>
        <div className={styles.disabledMethod}>
          <span className={styles.methodCopy}>
            <strong>Paystack</strong>
            <span>
              Paystack shows the payment options available for your transaction
              when you check out.
            </span>
          </span>
          <Icon className={styles.chevron} name="chevron" size={20} />
        </div>

        <aside className={styles.securityCard}>
          <strong>Payment safety</strong>
          <p>
            Payment is completed with Paystack. EaziCart verifies the
            transaction server-side and does not store your card details.
          </p>
        </aside>
      </div>
      <BottomNavigation />
    </main>
  );
}
