/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";

import { BottomNavigation } from "../components/bottom-navigation";
import { LoadingState, SignInState } from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import { usersApi } from "../../lib/api/users";
import { fetchProfilePhoto, uploadSocialMedia } from "../../lib/social-media";
import styles from "./edit-profile.module.css";
import "./profile-photo-upload.css";

export default function EditProfile() {
  const auth = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState("");
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    if (!auth.user?.id) return;
    let active = true;
    void fetchProfilePhoto(auth.user.id).then((photo) => {
      if (active) setPhotoUrl(photo?.url ?? null);
    });
    return () => {
      active = false;
    };
  }, [auth.user?.id]);

  const uploadPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !auth.user) return;

    setPhotoUploading(true);
    setPhotoError(false);
    setPhotoStatus("Uploading…");
    try {
      const photo = await uploadSocialMedia(
        "profile",
        auth.user.id,
        file,
        (percentage) =>
          setPhotoStatus(`Uploading · ${Math.round(percentage)}%`),
      );
      setPhotoUrl(photo.url);
      setPhotoStatus("Profile photo updated");
    } catch (uploadError) {
      setPhotoError(true);
      setPhotoStatus(
        uploadError instanceof Error
          ? uploadError.message
          : "Could not upload profile photo",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

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
                <div className={`${styles.avatar} eazicart-profile-avatar`}>
                  {photoUrl ? (
                    <img src={photoUrl} alt="Your profile" />
                  ) : (
                    <span>{auth.user.name[0]?.toUpperCase() || "W"}</span>
                  )}
                </div>
                <label className={styles.photoButton}>
                  {photoUploading
                    ? "Uploading…"
                    : photoUrl
                      ? "Change photo"
                      : "Add photo"}
                  <input
                    className="eazicart-profile-photo-input"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => void uploadPhoto(event)}
                    disabled={photoUploading}
                    aria-label="Choose profile photo from your gallery"
                  />
                </label>
                {photoStatus ? (
                  <p
                    className={`eazicart-profile-photo-status ${photoError ? "is-error" : ""}`}
                    role={photoError ? "alert" : "status"}
                  >
                    {photoStatus}
                  </p>
                ) : null}
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
                {auth.user.username ? (
                  <ProfileField label="Username">
                    <input
                      className={styles.input}
                      value={`@${auth.user.username}`}
                      readOnly
                      aria-readonly="true"
                    />
                  </ProfileField>
                ) : null}
                <ProfileField label="Email address">
                  <input
                    className={styles.input}
                    type="email"
                    value={auth.user.email}
                    readOnly
                    aria-readonly="true"
                  />
                </ProfileField>
                {error ? (
                  <p className={styles.error} role="alert">
                    {error}
                  </p>
                ) : null}
                <button
                  className={styles.save}
                  type="submit"
                  disabled={saving || photoUploading}
                >
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
