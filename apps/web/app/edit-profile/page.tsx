/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

import { BottomNavigation } from "../components/bottom-navigation";
import { LoadingState, SignInState } from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import { usersApi } from "../../lib/api/users";
import styles from "./edit-profile.module.css";

export default function EditProfile() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get("name");
    try {
      setError("");
      setSaving(true);
      await usersApi.update(typeof name === "string" ? name : "");
      await auth.reloadUser();
      router.push("/profile");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save profile",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={`app-shell ${styles.page}`} data-figma-node="229:136">
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
        <h1>Edit profile</h1>
      </header>
      <p className={styles.intro}>
        Update how your profile appears on EaziCart.
      </p>

      <div className={styles.viewport}>
        <div className={styles.content}>
          {auth.loading ? (
            <LoadingState />
          ) : !auth.user ? (
            <SignInState message="Sign in to edit your profile." />
          ) : (
            <>
              <div className={styles.avatarBlock}>
                <div className={styles.avatar} aria-hidden="true" />
                <span className={styles.photoButton}>
                  Photo uploads unavailable
                </span>
              </div>

              <form
                className={styles.form}
                onSubmit={(event) => void submit(event)}
              >
                <ProfileField label="Full name">
                  <input
                    className={styles.input}
                    name="name"
                    required
                    minLength={2}
                    defaultValue={auth.user.name}
                  />
                </ProfileField>
                <ProfileField label="Username">
                  <input
                    className={styles.input}
                    value={
                      auth.user.username
                        ? `@${auth.user.username}`
                        : "Not available yet"
                    }
                    readOnly
                  />
                </ProfileField>
                <ProfileField label="Phone number">
                  <input
                    className={styles.input}
                    value="Not available yet"
                    readOnly
                  />
                </ProfileField>
                <ProfileField label="Email address">
                  <input
                    className={styles.input}
                    type="email"
                    value={auth.user.email}
                    readOnly
                  />
                </ProfileField>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                <button className={styles.save} type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>

      <BottomNavigation />
    </main>
  );
}

function ProfileField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      {children}
    </label>
  );
}
