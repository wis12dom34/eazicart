"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { usersApi } from "../../lib/api/users";
import { LoadingState, SignInState } from "../components/async-state";
import { Icon } from "../components/icon";
import { useAuth } from "../providers/auth-provider";
import styles from "./privacy-security.module.css";

export default function PrivacySecurityPage() {
  const auth = useAuth();
  const router = useRouter();
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
    <main className={`app-shell ${styles.page}`}>
      <header className={styles.header}>
        <Link href="/settings" aria-label="Back to account settings">
          <Icon name="back" size={22} />
        </Link>
        <h1>Privacy &amp; Security</h1>
      </header>
      {auth.loading ? (
        <LoadingState />
      ) : !auth.user ? (
        <SignInState message="Sign in to manage your privacy and security." />
      ) : (
        <>
          <section className={styles.account} aria-labelledby="account-heading">
            <h2 id="account-heading">Account</h2>
            <span>Signed in as</span>
            <strong>{auth.user.email}</strong>
          </section>
          <section
            className={styles.section}
            aria-labelledby="password-heading"
          >
            <h2 id="password-heading">Change password</h2>
            <p>
              Updating your password ends refresh sessions on all devices and
              signs you out here.
            </p>
            <form onSubmit={(event) => void submit(event)}>
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
              {error && (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          </section>
        </>
      )}
    </main>
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
