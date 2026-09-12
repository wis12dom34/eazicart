"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../providers/auth-provider";
import styles from "../auth.module.css";

type FieldErrors = Partial<
  Record<"name" | "email" | "password" | "confirmPassword", string>
>;

export default function Register() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    const nextErrors: FieldErrors = {};

    if (name.length < 2) nextErrors.name = "Enter your full name.";
    if (!/^\S+@\S+\.\S+$/.test(email))
      nextErrors.email = "Enter a valid email address.";
    if (password.length < 8)
      nextErrors.password = "Use at least 8 characters.";
    if (confirmPassword !== password)
      nextErrors.confirmPassword = "Passwords do not match.";

    setFieldErrors(nextErrors);
    setError("");
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    try {
      await auth.register(name, email, password);
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to register");
      setBusy(false);
    }
  };

  return (
    <main className={`app-shell ${styles.page} ${styles.registerPage}`}>
      <h1 className={styles.heading}>Create account</h1>
      <p className={styles.subtitle}>
        Join EaziCart and start discovering trusted sellers.
      </p>

      <form
        className={`${styles.form} ${styles.registerForm}`}
        onSubmit={(event) => void submit(event)}
        noValidate
      >
        <AuthField
          id="register-name"
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Your name"
          error={fieldErrors.name}
        />
        <AuthField
          id="register-email"
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          error={fieldErrors.email}
        />
        <AuthField
          id="register-password"
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.password}
        />
        <AuthField
          id="register-confirm-password"
          label="Confirm password"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          error={fieldErrors.confirmPassword}
        />

        {error && (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        )}

        <button className={styles.primaryButton} disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className={styles.terms}>
          By continuing, you agree to the Terms of Service and Privacy Policy.
        </p>
      </form>

      <p className={styles.switchLink}>
        Already have an account? <Link href="/login">Sign in</Link>
      </p>
    </main>
  );
}

function AuthField({
  id,
  label,
  error,
  ...inputProps
}: {
  id: string;
  label: string;
  error?: string;
  name: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const errorId = `${id}-error`;
  return (
    <div className={styles.field}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        {...inputProps}
      />
      {error && (
        <p className={styles.fieldError} id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}
