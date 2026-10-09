"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { safeNextPath } from "../../lib/api/navigation";
import { useAuth } from "../providers/auth-provider";
import styles from "../auth.module.css";

export function LoginContent() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const next = safeNextPath(params.get("next"));
  const sellerFlow = next.startsWith("/seller/");

  useEffect(() => setReady(true), []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = form.get("email");
    const password = form.get("password");
    setBusy(true);
    setError("");

    try {
      await auth.login(
        typeof email === "string" ? email : "",
        typeof password === "string" ? password : "",
      );
      router.replace(next);
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : "Unable to sign in";
      setError(
        message === "Email or password is incorrect"
          ? "Email or password is incorrect. Try again."
          : message,
      );
      setBusy(false);
    }
  };

  return (
    <main className={`app-shell ${styles.page} ${styles.loginPage}`}>
      <h1 className={styles.heading}>Welcome back</h1>
      <p className={styles.subtitle}>
        {sellerFlow
          ? "Sign in to manage your EaziCart business."
          : "Sign in to continue shopping on EaziCart."}
      </p>
      {params.get("passwordChanged") === "1" && (
        <p className={styles.success} role="status">
          Password updated. Sign in with your new password.
        </p>
      )}

      <form
        className={`${styles.form} ${busy ? styles.busyForm : ""}`}
        aria-busy={busy}
        onSubmit={(event) => void submit(event)}
      >
        <div className={styles.field}>
          <label htmlFor="login-email">Email address</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "login-error" : undefined}
            required
          />
          {error && (
            <p className={styles.formError} id="login-error" role="alert">
              {error}
            </p>
          )}
        </div>

        <button className={styles.primaryButton} disabled={!ready || busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        {busy && (
          <p className={styles.busyNote} role="status">
            Checking your details…
          </p>
        )}
      </form>

      <p className={styles.switchLink}>
        Don’t have an account?{" "}
        <Link
          href={
            next === "/"
              ? "/register"
              : `/register?next=${encodeURIComponent(next)}`
          }
        >
          Create one
        </Link>
      </p>
    </main>
  );
}
