"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
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
    } catch (x) {
      setError(x instanceof Error ? x.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className={`app-shell ${styles.page}`}>
      <div className={styles.titleRow}>
        <Link className={styles.back} href="/profile" aria-label="Back to profile">
          <Icon name="back" size={22} />
        </Link>
        <h1>Edit profile</h1>
      </div>
      <p className={styles.intro}>Update how your profile appears on EaziCart.</p>

      {auth.loading ? (
        <LoadingState />
      ) : !auth.user ? (
        <SignInState message="Sign in to edit your profile." />
      ) : (
        <>
          <div className={styles.avatarBlock}>
            <div className={styles.avatar} aria-hidden="true">
              {initials(auth.user.name)}
            </div>
            <button
              className={styles.photoButton}
              type="button"
              disabled
              title="Profile photo uploads are not available yet"
            >
              Change photo
            </button>
          </div>

          <form className={styles.form} onSubmit={(event) => void submit(event)}>
            <label className={styles.field}>
              <span>Full name</span>
              <input
                className={styles.input}
                name="name"
                required
                minLength={2}
                defaultValue={auth.user.name}
              />
            </label>
            <label className={styles.field}>
              <span>Username</span>
              <input
                className={styles.input}
                value="Not available yet"
                disabled
                readOnly
              />
              <small className={styles.unsupportedNote}>
                Usernames are not supported by the current account API.
              </small>
            </label>
            <label className={styles.field}>
              <span>Phone number</span>
              <input
                className={styles.input}
                value="Not available yet"
                disabled
                readOnly
              />
              <small className={styles.unsupportedNote}>
                Phone numbers are not stored on customer profiles yet.
              </small>
            </label>
            <label className={styles.field}>
              <span>Email address</span>
              <input
                className={styles.input}
                type="email"
                disabled
                value={auth.user.email}
                readOnly
              />
            </label>
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
      <BottomNavigation />
    </main>
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
