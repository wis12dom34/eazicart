import Link from "next/link";
import { pageMetadata } from "../lib/seo";
import styles from "./welcome.module.css";

export const metadata = pageMetadata(
  "Get started",
  "Discover products, sellers and shoppable reels on EaziCart.",
  "/welcome",
  { index: false },
);

export default function WelcomePage() {
  return (
    <main className={styles.page} data-figma-node="34:2">
      <div className={styles.content}>
        <Link className={styles.brand} href="/" aria-label="EaziCart home">
          EaziCart
        </Link>

        <section className={styles.hero}>
          <h1>Everything you need, from trusted sellers.</h1>
          <p>
            Discover products, follow stores, watch shoppable reels and buy
            securely.
          </p>
        </section>

        <div className={styles.illustration} aria-hidden="true">
          <div className={styles.illustrationInner}>
            <div className={`${styles.tile} ${styles.storeTile}`}>
              <span className={styles.awning} />
              <span className={styles.storeBody} />
            </div>

            <div className={styles.phone}>
              <span className={styles.phoneSpeaker} />
              <div className={styles.phoneTopCard}>
                <span className={styles.bag} />
                <span className={styles.playSmall}>▶</span>
                <i />
                <b />
              </div>
              <div className={styles.phoneInfoCard}>
                <span />
                <i />
                <b />
              </div>
              <div className={styles.phoneActions}>
                <span>−</span>
                <span>—</span>
              </div>
            </div>

            <div className={`${styles.circleTile} ${styles.checkTile}`}>✓</div>
            <div className={`${styles.circleTile} ${styles.reelTile}`}>
              <span>▶</span>
            </div>
            <div className={`${styles.tile} ${styles.boxTile}`}>
              <span />
            </div>
          </div>
        </div>

        <section className={styles.intro}>
          <h2>Shop. Discover. Connect.</h2>
          <p>A social commerce experience built around real sellers and products.</p>
        </section>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/register">
            Get Started
          </Link>
          <p>
            Already have an account? <Link href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </main>
  );
}
