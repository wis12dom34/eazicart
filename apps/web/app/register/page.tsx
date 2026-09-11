"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../components/header";
import { useAuth } from "../providers/auth-provider";
export default function Register() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = f.get("name");
    const email = f.get("email");
    const password = f.get("password");
    setBusy(true);
    setError("");
    try {
      await auth.register(
        typeof name === "string" ? name : "",
        typeof email === "string" ? email : "",
        typeof password === "string" ? password : "",
      );
      router.replace("/");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Unable to register");
      setBusy(false);
    }
  };
  return (
    <main className="app-shell">
      <Header title="Create account" back="/login" />
      <form className="profile-form" onSubmit={(e) => void submit(e)}>
        <label>
          Full name
          <input name="name" autoComplete="name" minLength={2} required />
        </label>
        <label>
          Email address
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete="new-password"
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
          {busy ? "Creating account…" : "Create account"}
        </button>
        <p className="auth-links">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </form>
    </main>
  );
}
