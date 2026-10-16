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

import { ProfileAvatar } from "../components/profile-avatar";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { LoadingState, SignInState } from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
import { usersApi } from "../../lib/api/users";
import {
  fetchProfilePhoto,
  removeProfilePhoto,
  uploadSocialMedia,
} from "../../lib/social-media";
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

  const removePhoto = async () => {
    if (!auth.user || !photoUrl || photoUploading) return;
    setPhotoUploading(true);
    setPhotoError(false);
    setPhotoStatus("Removing photo…");
    try {
      await removeProfilePhoto(auth.user.id);
      setPhotoUrl(null);
      setPhotoStatus("Profile photo removed");
    } catch (removeError) {
      setPhotoError(true);
      setPhotoStatus(
        removeError instanceof Error
          ? removeError.message
          : "Could not remove profile photo",
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = data.get("name");
    const username = data.get("username");
    const bio = data.get("bio");
    try {
      setError("");
      setSaving(true);
      await usersApi.update({
        name: typeof name === "string" ? name : "",
        username: typeof username === "string" ? username : "",
        bio: typeof bio === "string" ? bio : "",
      });
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
        <Link className={styles.back} href="/profile" aria-label="Back to profile">
          <Icon name="back" size={22} />
        </Link>
        <h1>Edit profile</h1>
      </header>
      <p className={styles.intro}>Update how your profile appears on EaziCart.</p>

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
                  <ProfileAvatar userId={auth.user.id} name={auth.user.name} alt="Your profile" />
                </div>
                <div className={styles.photoActions}>
                  <label className={styles.photoButton}>
                    {photoUploading ? "Working…" : photoUrl ? "Change photo" : "Add photo"}
                    <input
                      className="eazicart-profile-photo-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(event) => void uploadPhoto(event)}
                      disabled={photoUploading}
                      aria-label="Choose profile photo from your gallery"
                    />
                  </label>
                  {photoUrl ? (
                    <button
                      className={styles.removePhoto}
                      type="button"
                      disabled={photoUploading}
                      onClick={() => void removePhoto()}
                    >
                      Remove photo
                    </button>
                  ) : null}
                </div>
                {photoStatus ? (
                  <p
                    className={`eazicart-profile-photo-status ${photoError ? "is-error" : ""}`}
                    role={photoError ? "alert" : "status"}
                  >
                    {photoStatus}
                  </p>
                ) : null}
              </div>

              <form className={styles.form} onSubmit={(event) => void submit(event)}>
                <ProfileField label="Full name">
                  <input
                    className={styles.input}
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={auth.user.name}
                    autoComplete="name"
                  />
                </ProfileField>
                <ProfileField label="Username">
                  <div className={styles.usernameField}>
                    <span aria-hidden="true">@</span>
                    <input
                      className={styles.usernameInput}
                      name="username"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="[A-Za-z0-9_]+"
                      defaultValue={auth.user.username ?? ""}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label="Username"
                    />
                  </div>
                </ProfileField>
                <ProfileField label="Bio">
                  <textarea
                    className={styles.textarea}
                    name="bio"
                    rows={3}
                    maxLength={160}
                    defaultValue={auth.user.bio ?? ""}
                    placeholder="Tell people a little about you"
                  />
                </ProfileField>
                <ProfileField label="Email address">
                  <input
                    className={`${styles.input} ${styles.readOnly}`}
                    type="email"
                    value={auth.user.email}
                    readOnly
                    aria-readonly="true"
                  />
                </ProfileField>
                {error ? <p className={styles.error} role="alert">{error}</p> : null}
                <button className={styles.save} type="submit" disabled={saving || photoUploading}>
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

function ProfileField({ label, children }: { label: string; children: ReactNode }) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
