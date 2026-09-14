"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import type { Seller } from "../../../lib/api/types";
import styles from "./seller-store.module.css";

export default function SellerStorePage() {
  const auth = useAuth();
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <StoreHeader />
        <LoadingState label="Loading your storefront…" />
      </main>
    );
  }

  if (!auth.user) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <StoreHeader />
        <SignInState message="Sign in to manage your storefront." />
      </main>
    );
  }

  if (profile.error) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <StoreHeader />
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </main>
    );
  }

  if (!profile.data?.data) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <StoreHeader />
        <section className={styles.emptyCard}>
          <div className={styles.iconWrap} aria-hidden="true">
            <Icon name="bag" size={24} />
          </div>
          <p className={styles.eyebrow}>Seller account required</p>
          <h1>Create your store first</h1>
          <p>
            Your public storefront is created from the seller profile tied to
            your account.
          </p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${styles.page}`}>
      <StoreHeader />
      <StoreEditor
        profile={profile.data.data}
        onSaved={() => profile.reload()}
      />
    </main>
  );
}

function StoreHeader() {
  return (
    <header className={styles.topbar}>
      <Link
        className={styles.back}
        href="/seller/dashboard"
        aria-label="Back to seller workspace"
      >
        <Icon name="back" size={22} />
      </Link>
      <span>Storefront</span>
    </header>
  );
}

function StoreEditor({
  profile,
  onSaved,
}: {
  profile: Seller;
  onSaved: () => Promise<unknown>;
}) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSaved(false);

    try {
      await sellerDashboardApi.updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim() ? bio.trim() : null,
      });
      await onSaved();
      setSaved(true);
    } catch (value) {
      setError(
        value instanceof Error ? value.message : "Unable to update storefront",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Public store identity</p>
          <h1>Manage your storefront</h1>
          <p>
            Update the real store name and bio customers see on your public
            seller page.
          </p>
        </div>
        <Link className={styles.previewLink} href={`/seller/${profile.id}`}>
          View public store
          <Icon name="chevron" size={18} />
        </Link>
      </section>

      <div className={styles.layout}>
        <form
          className={styles.formCard}
          onSubmit={(event) => void submit(event)}
        >
          <div className={styles.cardHeading}>
            <div>
              <p className={styles.eyebrow}>Store details</p>
              <h2>Public profile</h2>
            </div>
          </div>

          <label className={styles.field}>
            <span>Store name</span>
            <input
              required
              minLength={2}
              maxLength={120}
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                setSaved(false);
              }}
              placeholder="Your business name"
            />
            <small>{displayName.length}/120 characters</small>
          </label>

          <label className={styles.field}>
            <span>
              Store bio <em>Optional</em>
            </span>
            <textarea
              maxLength={2000}
              rows={7}
              value={bio}
              onChange={(event) => {
                setBio(event.target.value);
                setSaved(false);
              }}
              placeholder="Tell customers what your store sells."
            />
            <small>{bio.length}/2000 characters</small>
          </label>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}
          {saved ? (
            <p className={styles.success} role="status">
              Storefront updated. Your public seller page now uses these
              details.
            </p>
          ) : null}

          <div className={styles.actions}>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={submitting || displayName.trim().length < 2}
            >
              {submitting ? "Saving changes…" : "Save changes"}
            </button>
            <Link className={styles.secondaryLink} href="/seller/dashboard">
              Cancel
            </Link>
          </div>
        </form>

        <aside className={styles.previewCard} aria-label="Storefront preview">
          <p className={styles.eyebrow}>Preview</p>
          <div className={styles.avatar} aria-hidden="true">
            {initials(displayName)}
          </div>
          <h2>{displayName.trim() || "Your store"}</h2>
          <p className={styles.previewBio}>
            {bio.trim() || "No store bio added yet."}
          </p>
          <p className={styles.previewNote}>
            Products, followers and other public metrics continue to come from
            real EaziCart data and are not edited here.
          </p>
        </aside>
      </div>
    </>
  );
}

function initials(value: string) {
  return (
    value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "S"
  );
}
