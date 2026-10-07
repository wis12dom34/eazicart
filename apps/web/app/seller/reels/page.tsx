"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { productsApi } from "../../../lib/api/products";
import { reelsApi } from "../../../lib/api/reels";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import styles from "./publish.module.css";

export default function PublishReelPage() {
  const auth = useAuth();
  const profile = useRequest(
    () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const products = useRequest(
    () =>
      profile.data?.data
        ? productsApi.sellerList()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [productId, setProductId] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<"idle" | "uploading" | "publishing">(
    "idle",
  );
  const [publishedId, setPublishedId] = useState("");
  const locked = useRef(false);
  useEffect(() => {
    if (!file) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function publish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || locked.current) return;
    locked.current = true;
    setError("");
    try {
      let uploaded = videoUrl;
      if (!uploaded) {
        setPhase("uploading");
        uploaded = (await reelsApi.upload(file)).data.videoUrl;
        setVideoUrl(uploaded);
      }
      setPhase("publishing");
      const response = await reelsApi.publish({
        videoUrl: uploaded,
        caption: caption.trim() || undefined,
        productId: productId || undefined,
      });
      setPublishedId(response.data.id);
    } catch (value) {
      setError(
        value instanceof Error
          ? value.message
          : "Unable to publish your Reel. Please try again.",
      );
    } finally {
      locked.current = false;
      setPhase("idle");
    }
  }
  const header = (
    <header className={styles.header}>
      <Link href="/seller/dashboard">← Seller dashboard</Link>
      <h1>Publish a Reel</h1>
    </header>
  );
  if (auth.loading || (auth.isAuthenticated && profile.loading))
    return (
      <main className={`app-shell ${styles.page}`}>
        {header}
        <LoadingState label="Loading your seller profile…" />
      </main>
    );
  if (!auth.isAuthenticated)
    return (
      <main className={`app-shell ${styles.page}`}>
        {header}
        <SignInState message="Sign in to publish a Reel." />
      </main>
    );
  if (profile.error)
    return (
      <main className={`app-shell ${styles.page}`}>
        {header}
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </main>
    );
  if (!profile.data?.data)
    return (
      <main className={`app-shell ${styles.page}`}>
        {header}
        <EmptyState
          title="Start selling on EaziCart"
          message="Create your seller profile before publishing a Reel."
          action={{ href: "/seller/dashboard", label: "Create seller profile" }}
        />
      </main>
    );
  if (publishedId)
    return (
      <main className={`app-shell ${styles.page}`}>
        {header}
        <section className={styles.success}>
          <h2>Your Reel is live</h2>
          <p>Customers can now watch it in the Reels feed.</p>
          <Link
            className={styles.primary}
            href={`/reels?reel=${encodeURIComponent(publishedId)}`}
          >
            View your Reel
          </Link>
          <Link
            href="/seller/reels"
            onClick={() => {
              setPublishedId("");
              setFile(null);
              setVideoUrl("");
              setCaption("");
              setProductId("");
            }}
          >
            Post another Reel
          </Link>
        </section>
      </main>
    );
  const busy = phase !== "idle";
  return (
    <main className={`app-shell ${styles.page}`}>
      {header}
      <p className={styles.intro}>
        Show your products, share your story, and connect with customers.
      </p>
      <form className={styles.form} onSubmit={(event) => void publish(event)}>
        <fieldset disabled={busy}>
          <label className={styles.upload}>
            Choose a video
            <input
              aria-label="Choose a video"
              type="file"
              accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
              onChange={(event) => {
                const next = event.target.files?.[0];
                setError("");
                setVideoUrl("");
                setFile(null);
                if (!next) return;
                if (next.size === 0 || next.size > 50 * 1024 * 1024) {
                  setError("Choose a video smaller than 50 MB.");
                  event.target.value = "";
                  return;
                }
                if (!/\.(mp4|mov|webm)$/i.test(next.name)) {
                  setError("Choose an MP4, MOV or WebM video.");
                  event.target.value = "";
                  return;
                }
                setFile(next);
              }}
            />
          </label>
          <p className={styles.help}>MP4, MOV or WebM · Up to 50 MB</p>
          {preview ? (
            <video
              className={styles.preview}
              src={preview}
              controls
              playsInline
              preload="metadata"
            />
          ) : null}
          <label>
            Caption
            <textarea
              maxLength={2200}
              rows={4}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Tell customers about your Reel…"
            />
          </label>
          <label>
            Link a product (optional)
            <select
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              disabled={products.loading || Boolean(products.error)}
            >
              <option value="">No product</option>
              {products.data?.data
                .filter((product) => product.active !== false)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
            </select>
          </label>
          {products.loading ? (
            <p role="status">Loading your products…</p>
          ) : null}
          {products.error ? (
            <ErrorState
              message={products.error}
              retry={() => void products.reload()}
            />
          ) : null}
          {products.data?.data.length === 0 ? (
            <p className={styles.help}>
              You can publish without a product, or{" "}
              <Link href="/seller/products">add your first product</Link>.
            </p>
          ) : null}
        </fieldset>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {busy ? (
          <p role="status">
            {phase === "uploading"
              ? "Uploading video… Keep this page open."
              : "Publishing your Reel…"}
          </p>
        ) : null}
        <button
          className={styles.primary}
          type="submit"
          disabled={!file || busy}
        >
          {phase === "uploading"
            ? "Uploading…"
            : phase === "publishing"
              ? "Publishing…"
              : "Publish Reel"}
        </button>
        <p className={styles.help}>
          Publishing makes your video visible to everyone on EaziCart.
        </p>
      </form>
    </main>
  );
}
