"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "../components/icon";
import { LoadingState, SignInState } from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import styles from "./settings.module.css";

export default function SettingsPage() {
  const auth = useAuth();
  const router = useRouter();

  const logout = () => {
    auth.logout();
    router.replace("/login");
  };

  return (
    <main className={`app-shell ${styles.page}`}>
      <div className={styles.titleRow}>
        <Link
          className={styles.back}
          href="/profile"
          aria-label="Back to profile"
        >
          <Icon name="back" size={22} />
        </Link>
        <h1>Account Settings</h1>
      </div>
      <p className={styles.intro}>Manage your profile and preferences</p>

      {auth.loading ? (
        <LoadingState />
      ) : !auth.user ? (
        <SignInState message="Sign in to manage your account settings." />
      ) : (
        <>
          <section
            className={styles.identityCard}
            aria-label="Account identity"
          >
            <div className={styles.avatar} aria-hidden="true">
              {initials(auth.user.name)}
            </div>
            <div className={styles.identityCopy}>
              <strong>{auth.user.name}</strong>
              <span>{auth.user.email}</span>
            </div>
            <Link className={styles.editLink} href="/edit-profile">
              Edit profile
            </Link>
          </section>

          <section
            className={styles.settingsList}
            aria-label="Account settings"
          >
            <SettingLink
              href="/edit-profile"
              label="Personal information"
              detail="Name and email"
            />
            <SettingLink
              href="/address-book"
              label="Addresses"
              detail="Delivery locations"
            />
            <SettingLink
              href="/payment-methods"
              label="Payment methods"
              detail="Cards and wallet"
            />
            <div className={styles.disabledCard} aria-disabled="true">
              <span className={styles.settingCopy}>
                <strong>Privacy &amp; security</strong>
                <span>Password and account protection</span>
              </span>
              <Icon className={styles.chevron} name="chevron" size={20} />
            </div>
          </section>

          <h2 className={styles.preferencesTitle}>Preferences</h2>
          <section className={styles.preferencesCard} aria-label="Preferences">
            <Link className={styles.preferenceLink} href="/notifications">
              <span className={styles.preferenceCopy}>
                <strong>Push notifications</strong>
                <span>Manage notification activity</span>
              </span>
              <span className={styles.manage}>Manage</span>
            </Link>
            <div className={styles.preferenceDisabled} aria-disabled="true">
              <span className={styles.preferenceCopy}>
                <strong>Personalized recommendations</strong>
                <span>Recommendation preferences</span>
              </span>
              <span className={styles.unavailable}>Not available yet</span>
            </div>
          </section>

          <button className={styles.logout} type="button" onClick={logout}>
            Log out
          </button>
        </>
      )}
    </main>
  );
}

function SettingLink({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <Link className={styles.settingCard} href={href}>
      <span className={styles.settingCopy}>
        <strong>{label}</strong>
        <span>{detail}</span>
      </span>
      <Icon className={styles.chevron} name="chevron" size={20} />
    </Link>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "U"
  );
}
