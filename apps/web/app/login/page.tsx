"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "../components/header";
import { useAuth } from "../providers/auth-provider";
export default function Login() {
  const auth = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = f.get("email");
    const password = f.get("password");
    setBusy(true);
    setError("");
    try {
      await auth.login(
        typeof email === "string" ? email : "",
        typeof password === "string" ? password : "",
      );
      router.replace(params.get("next") || "/");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to sign in");
      setBusy(false);
    }
  };
  return (
    <main className="app-shell">
      <Header title="Sign in" back="/" />
      <form className="profile-form" onSubmit={(e) => void submit(e)}>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            minLength={8}
            required
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="dark-button" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <p className="auth-links">
          New to EaziCart? <Link href="/register">Create an account</Link>
        </p>
      </form>
    </main>
  );
}
