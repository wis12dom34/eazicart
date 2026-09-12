"use client";

import Link from "next/link";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { LoadingState, SignInState } from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import styles from "./reviews.module.css";

export default function ReviewsPage() {
  const auth = useAuth();

  return (
    <main className={`app-shell ${styles.page}`}>
      <Link
        className={styles.back}
        href="/profile"
        aria-label="Back to profile"
      >
        <Icon name="back" size={22} />
      </Link>
      <header className={styles.header}>
        <h1>My Reviews</h1>
        <p>Your ratings and feedback</p>
      </header>

      {auth.loading ? (
        <LoadingState />
      ) : !auth.user ? (
        <SignInState message="Sign in to view your reviews." />
      ) : (
        <>
          <div className={styles.filters} aria-label="Review filters">
            <button className={styles.filterActive} type="button" disabled>
              All
            </button>
            <button className={styles.filter} type="button" disabled>
              Products
            </button>
            <button className={styles.filter} type="button" disabled>
              Sellers
            </button>
          </div>
          <section className={styles.empty} aria-label="Reviews unavailable">
            <span className={styles.emptyIcon}>
              <Icon name="star" size={22} />
            </span>
            <h2>Reviews are not available yet</h2>
            <p>
              Your review history will appear here when customer reviews are
              available in EaziCart.
            </p>
          </section>
        </>
      )}
      <BottomNavigation />
    </main>
  );
}
