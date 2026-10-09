import Link from "next/link";
import styles from "../landing/landing.module.css";

export function AcquisitionPage({
  title,
  intro,
  sections,
  otherPath,
  otherLabel,
}: {
  title: string;
  intro: string;
  sections: Array<{ title: string; copy: string; items?: string[] }>;
  otherPath: string;
  otherLabel: string;
}) {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <nav className={styles.nav} aria-label="EaziCart navigation">
          <Link href="/landing" className={styles.logo}>
            EaziCart
          </Link>
          <div className={styles.navLinks}>
            <Link href="/social-commerce">Social Commerce</Link>
            <Link href="/online-store">Online Store</Link>
          </div>
          <div className={styles.navActions}>
            <Link className={styles.primaryButton} href="/register">
              Get Started
            </Link>
          </div>
        </nav>
      </header>
      <section className={styles.section}>
        <div className={`${styles.shell} ${styles.featureIntro}`}>
          <span className={styles.eyebrow}>EAZICART FOR BUSINESS</span>
          <h1>{title}</h1>
          <p>{intro}</p>
          <div className={styles.buttonRow}>
            <Link className={styles.primaryButton} href="/register">
              Create your account
            </Link>
            <Link className={styles.secondaryButton} href="/explore">
              Explore marketplace
            </Link>
          </div>
        </div>
      </section>
      <section className={`${styles.section} ${styles.sectionSoft}`}>
        <div className={`${styles.shell} ${styles.featureBody}`}>
          {sections.map((section) => (
            <section key={section.title}>
              <h2>{section.title}</h2>
              <p>{section.copy}</p>
              {section.items ? (
                <ul>
                  {section.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
          <div className={styles.publicLinks}>
            <Link href={otherPath}>{otherLabel}</Link>
            <Link href="/login?next=/seller/store">Manage your storefront</Link>
            <Link href="/register">Get started with EaziCart</Link>
          </div>
        </div>
      </section>
      <footer className={styles.footer}>
        <div className={styles.shell}>
          <Link href="/landing">EaziCart</Link>
          <p>The Operating System for Modern Businesses.</p>
        </div>
      </footer>
    </main>
  );
}
