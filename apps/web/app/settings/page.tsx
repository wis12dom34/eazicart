/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BottomNavigation } from "../components/bottom-navigation";
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
    <main className={`app-shell ${styles.page}`} data-figma-node="32:35">
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
        <h1>Account Settings</h1>
      </header>
      <p className={styles.intro}>Manage your profile and preferences</p>
      <div className={styles.viewport}>
        <div className={styles.content}>
          {auth.loading ? (
            <LoadingState />
          ) : !auth.user ? (
            <SignInState
              message="Sign in to manage your account settings."
              next="/settings"
            />
          ) : (
            <>
              <section
                className={styles.identityCard}
                aria-label="Account identity"
              >
                <div className={styles.avatar} aria-hidden="true" />
                <div className={styles.identityCopy}>
                  <strong>{auth.user.name}</strong>
                  <span>
                    {auth.user.username
                      ? `@${auth.user.username}`
                      : auth.user.email}
                  </span>
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
                  detail="Name and account email"
                />
                <SettingLink
                  href="/address-book"
                  label="Addresses"
                  detail="Delivery locations"
                />
                <SettingLink
                  href="/payment-methods"
                  label="Payment methods"
                  detail="Paystack checkout information"
                />
                <SettingLink
                  href="/privacy-security"
                  label="Privacy & security"
                  detail="Password and account protection"
                />
              </section>

              <h2 className={styles.preferencesTitle}>Preferences</h2>
              <section
                className={styles.preferencesCard}
                aria-label="Preferences"
              >
                <Link className={styles.preferenceRow} href="/notifications">
                  <strong>Notifications</strong>
                  <span>Manage</span>
                </Link>
              </section>

              <button className={styles.logout} type="button" onClick={logout}>
                Log out
              </button>
            </>
          )}
        </div>
      </div>

      <BottomNavigation />
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
      <img src="/figma/profile-chevron.svg" width={24} height={44} alt="" />
    </Link>
  );
}
