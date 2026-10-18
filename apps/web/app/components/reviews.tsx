"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  reviewsApi,
  type ProductReview,
  type PublicReviewPage,
  type ReviewInput,
} from "../../lib/api/reviews";
import { ContentImage } from "./content-image";
import styles from "../reviews/reviews.module.css";

export function ReviewCard({
  review,
  children,
}: {
  review: ProductReview;
  children?: React.ReactNode;
}) {
  return (
    <article className={styles.card}>
      <header>
        <strong>{review.user.name}</strong>
        <time dateTime={review.createdAt}>
          {new Date(review.createdAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </time>
      </header>
      <p
        className={styles.rating}
        aria-label={`${review.rating} out of 5 stars`}
      >
        {"★".repeat(review.rating)}
        {"☆".repeat(5 - review.rating)} <small>Verified purchase</small>
      </p>
      <p className={styles.reviewBody}>{review.body}</p>
      <div className={styles.reviewProduct}>
        {review.product.imageUrl ? (
          <ContentImage
            src={review.product.imageUrl}
            alt=""
            width={40}
            height={40}
          />
        ) : null}
        {review.product.active ? (
          <Link href={`/product/${review.product.id}`}>
            {review.product.name}
          </Link>
        ) : (
          <span>{review.product.name} · No longer listed</span>
        )}
      </div>
      {children}
    </article>
  );
}
export function ReviewEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ReviewInput;
  onSave: (input: ReviewInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [rating, setRating] = useState(initial?.rating ?? 0),
    [body, setBody] = useState(initial?.body ?? ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const guard = useRef(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (guard.current || !body.trim()) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      await onSave({ rating, body: body.trim() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save review");
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  return (
    <form className={styles.form} onSubmit={(event) => void submit(event)}>
      <label>
        Rating
        <select
          value={rating}
          required
          onChange={(event) => setRating(Number(event.target.value))}
          disabled={busy}
        >
          <option value={0} disabled>
            Choose a rating
          </option>
          {[5, 4, 3, 2, 1].map((value) => (
            <option key={value} value={value}>
              {value} {value === 1 ? "star" : "stars"}
            </option>
          ))}
        </select>
      </label>
      <label>
        Your review
        <textarea
          rows={3}
          maxLength={2000}
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={busy}
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      <div className={styles.actions}>
        {onCancel ? (
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          className="dark-button"
          disabled={busy || rating < 1 || !body.trim()}
        >
          {busy ? "Saving…" : "Save review"}
        </button>
      </div>
    </form>
  );
}
export function PublicReviews(
  props:
    | { productId: string; sellerId?: never }
    | { sellerId: string; productId?: never },
) {
  const [result, setResult] = useState<PublicReviewPage | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const busy = useRef(false),
    productId = props.productId,
    sellerId = props.sellerId;
  const read = (cursor?: string) =>
    productId
      ? reviewsApi.product(productId, cursor)
      : reviewsApi.seller(sellerId!, cursor);
  useEffect(() => {
    let active = true;
    setResult(null);
    setLoading(true);
    setError("");
    const request = productId
      ? reviewsApi.product(productId)
      : reviewsApi.seller(sellerId!);
    void request
      .then((page) => {
        if (active) setResult(page);
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load reviews");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId, sellerId]);
  const more = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError("");
    try {
      const cursor = result?.pagination.nextCursor ?? undefined,
        page = await read(cursor);
      setResult((current) => ({
        ...page,
        data:
          cursor && current
            ? [
                ...current.data,
                ...page.data.filter(
                  (row) => !current.data.some((old) => old.id === row.id),
                ),
              ]
            : page.data,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load reviews");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return (
    <section className={styles.publicSection} aria-label="Customer reviews">
      <h2>Reviews</h2>
      {result?.summary.count ? (
        <p>
          {result.summary.average?.toFixed(1)} out of 5 · {result.summary.count}{" "}
          {result.summary.count === 1 ? "review" : "reviews"}
        </p>
      ) : null}
      <p className={styles.note}>
        Reviews are from fulfilled purchases with confirmed payment.
      </p>
      {result && !result.data.length ? <p>No reviews yet.</p> : null}
      {result?.data.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
      {loading ? <p role="status">Loading reviews…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {result?.pagination.hasMore || error ? (
        <button
          className="secondary-button"
          type="button"
          disabled={loading}
          onClick={() => void more()}
        >
          {error ? "Retry reviews" : "Load more reviews"}
        </button>
      ) : null}
      <p>
        <Link href="/reviews">Manage your purchase reviews</Link>
      </p>
    </section>
  );
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]