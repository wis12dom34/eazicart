/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { usersApi } from "../../lib/api/users";
import { LoadingState, SignInState } from "../components/async-state";
import { BottomNavigation } from "../components/bottom-navigation";
import { useAuth } from "../providers/auth-provider";
import styles from "./privacy-security.module.css";

export default function PrivacySecurityPage() {
  const auth = useAuth();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = value(form, "currentPassword");
    const newPassword = value(form, "newPassword");
    const confirmation = value(form, "confirmation");
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmation) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choose a password different from your current password.");
      return;
    }

    setBusy(true);
    try {
      await usersApi.changePassword(currentPassword, newPassword);
      auth.logout();
      router.replace("/login?passwordChanged=1");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update password",
      );
      setBusy(false);
    }
  };

  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="36:112">
      {showPassword ? (
        <button
          className={styles.back}
          type="button"
          aria-label="Back to privacy and security"
          onClick={() => {
            setShowPassword(false);
            setError("");
          }}
        >
          <img
            src="/figma/address-select-back.svg"
            width={10}
            height={18}
            alt=""
          />
        </button>
      ) : (
        <Link
          className={styles.back}
          href="/settings"
          aria-label="Back to account settings"
        >
          <img
            src="/figma/address-select-back.svg"
            width={10}
            height={18}
            alt=""
          />
        </Link>
      )}

      {auth.loading ? (
        <div className={styles.stateWrap}>
          <LoadingState />
        </div>
      ) : !auth.user ? (
        <div className={styles.stateWrap}>
          <SignInState message="Sign in to manage your privacy and security." />
        </div>
      ) : showPassword ? (
        <PasswordPanel
          busy={busy}
          error={error}
          onSubmit={(event) => void submit(event)}
        />
      ) : (
        <PrivacyMenu onChangePassword={() => setShowPassword(true)} />
      )}

      <BottomNavigation />
    </main>
  );
}

function PrivacyMenu({ onChangePassword }: { onChangePassword: () => void }) {
  return (
    <div className={styles.menu}>
      <h1>Privacy &amp; Security</h1>
      <p className={styles.subtitle}>Control your account protection</p>

      <h2 className={styles.securityTitle}>Security</h2>
      <button
        className={`${styles.securityRow} ${styles.passwordRow}`}
        type="button"
        onClick={onChangePassword}
      >
        <span>
          <strong>Change password</strong>
          <small>Update your account password</small>
        </span>
        <img src="/figma/profile-chevron.svg" width={24} height={44} alt="" />
      </button>
      <DisabledSecurityRow
        className={styles.twoStepRow}
        label="Two-step verification"
      />
      <DisabledSecurityRow
        className={styles.activityRow}
        label="Login activity"
      />

      <h2 className={styles.privacyTitle}>Privacy</h2>
      <DisabledPrivacyRow
        className={styles.visibilityRow}
        label="Profile visibility"
      />
      <DisabledPrivacyRow
        className={styles.recommendationsRow}
        label="Personalized recommendations"
      />
      <DisabledPrivacyRow
        className={styles.blockedRow}
        label="Blocked accounts"
      />
      <DisabledPrivacyRow
        className={styles.downloadRow}
        label="Download my data"
      />

      <h2 className={styles.dangerTitle}>Danger zone</h2>
      <div
        className={styles.deleteAccount}
        aria-disabled="true"
        title="Account deletion is not available yet"
      >
        Delete account
      </div>
    </div>
  );
}

function DisabledSecurityRow({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <div
      className={`${styles.securityRow} ${className ?? ""} ${styles.disabledRow}`}
      aria-disabled="true"
      title={`${label} is not available yet`}
    >
      <span>
        <strong>{label}</strong>
        <small>Not available yet</small>
      </span>
    </div>
  );
}

function DisabledPrivacyRow({
  className,
  label,
}: {
  className?: string;
  label: string;
}) {
  return (
    <div
      className={`${styles.privacyRow} ${className ?? ""} ${styles.disabledRow}`}
      aria-disabled="true"
      title={`${label} is not available yet`}
    >
      <strong>{label}</strong>
      <small>Unavailable</small>
    </div>
  );
}

function PasswordPanel({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <section
      className={styles.passwordPanel}
      aria-labelledby="password-heading"
    >
      <h1 id="password-heading">Change password</h1>
      <p>Update your password to keep your EaziCart account secure.</p>
      <form onSubmit={onSubmit}>
        <PasswordField
          name="currentPassword"
          label="Current password"
          autoComplete="current-password"
        />
        <PasswordField
          name="newPassword"
          label="New password"
          autoComplete="new-password"
        />
        <PasswordField
          name="confirmation"
          label="Confirm new password"
          autoComplete="new-password"
        />
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <button className={styles.updateButton} type="submit" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}

function PasswordField({
  name,
  label,
  autoComplete,
}: {
  name: string;
  label: string;
  autoComplete: string;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        name={name}
        type="password"
        minLength={8}
        maxLength={128}
        autoComplete={autoComplete}
        required
      />
    </label>
  );
}

function value(form: FormData, name: string) {
  const field = form.get(name);
  return typeof field === "string" ? field : "";
}
