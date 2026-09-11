"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../components/header";
import { useAuth } from "../providers/auth-provider";
import { usersApi } from "../../lib/api/users";
import { LoadingState, SignInState } from "../components/async-state";
export default function EditProfile() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    try {
      await usersApi.update(String(data.get("name")));
      await auth.reloadUser();
      router.push("/profile");
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not save profile");
    }
  };
  if (auth.loading) return <LoadingState />;
  if (!auth.user)
    return (
      <main className="app-shell">
        <Header title="Edit profile" back="/profile" />
        <SignInState />
      </main>
    );
  return (
    <main className="app-shell">
      <Header title="Edit profile" back="/profile" />
      <form className="profile-form" onSubmit={(e) => void submit(e)}>
        <div className="profile-avatar large-avatar">
          {auth.user.name.slice(0, 2).toUpperCase()}
        </div>
        <label>
          Full name
          <input
            name="name"
            required
            minLength={2}
            defaultValue={auth.user.name}
          />
        </label>
        <label>
          Email address
          <input type="email" disabled value={auth.user.email} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="dark-button">
          Save changes
        </button>
      </form>
    </main>
  );
}
