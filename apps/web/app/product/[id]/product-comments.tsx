"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  productSocialApi,
  type ProductComment,
} from "../../../lib/api/product-social";
import { useAuth } from "../../providers/auth-provider";
import {
  notifyProductSocial,
  useProductSocial,
} from "../../hooks/use-product-social";
import { Icon } from "../../components/icon";
import styles from "./product-comments.module.css";

export function ProductComments({ productId }: { productId: string }) {
  const auth = useAuth(),
    social = useProductSocial(productId);
  const [comments, setComments] = useState<ProductComment[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [body, setBody] = useState(""),
    [busy, setBusy] = useState(false),
    [removing, setRemoving] = useState<string | null>(null);
  const submission = useRef<{ body: string; key: string } | null>(null),
    guard = useRef(false);
  useEffect(() => {
    let active = true;
    void productSocialApi
      .comments(productId)
      .then((result) => {
        if (active) {
          setComments(result.data);
          setCursor(result.pagination.nextCursor);
        }
      })
      .catch((e: unknown) => {
        if (active)
          setError(e instanceof Error ? e.message : "Could not load comments");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);
  const loadMore = async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await productSocialApi.comments(
        productId,
        cursor ?? undefined,
      );
      setComments((current) =>
        cursor
          ? [
              ...current,
              ...result.data.filter(
                (row) => !current.some((old) => old.id === row.id),
              ),
            ]
          : result.data,
      );
      setCursor(result.pagination.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load comments");
    } finally {
      setLoading(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = body.trim();
    if (!text || guard.current || !auth.user) return;
    guard.current = true;
    setBusy(true);
    setError("");
    if (submission.current?.body !== text)
      submission.current = { body: text, key: crypto.randomUUID() };
    try {
      const result = await productSocialApi.comment(
        productId,
        text,
        submission.current.key,
      );
      setComments((current) => [
        result.data,
        ...current.filter((row) => row.id !== result.data.id),
      ]);
      setBody("");
      submission.current = null;
      notifyProductSocial(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post comment");
    } finally {
      guard.current = false;
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (removing) return;
    setRemoving(id);
    setError("");
    try {
      await productSocialApi.removeComment(productId, id);
      setComments((current) => current.filter((row) => row.id !== id));
      notifyProductSocial(productId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove comment");
    } finally {
      setRemoving(null);
    }
  };
  return (
    <section
      id="comments"
      className={styles.section}
      aria-labelledby="product-comments-title"
    >
      <div className={styles.heading}>
        <div>
          <h2 id="product-comments-title">Comments</h2>
          <span className={styles.count}>{social.data?.comments ?? comments.length} comments</span>
        </div>
        <button
          type="button"
          className={styles.like}
          aria-label={social.data?.liked ? "Unlike product" : "Like product"}
          aria-pressed={social.data?.liked ?? false}
          disabled={social.loading || social.busy}
          onClick={() => void social.toggleLike()}
        >
          <Icon name="heart" size={20} active={social.data?.liked} />
          <span>{social.data?.likes ?? "Like"}</span>
        </button>
      </div>
      {auth.loading ? null : auth.user ? (
        <form onSubmit={(event) => void submit(event)} className={styles.form}>
          <div className={styles.composerAvatar} aria-hidden="true">{(auth.user.name || "U").trim().charAt(0).toUpperCase()}</div>
          <div className={styles.composerBody}>
          <textarea
            id="product-comment-body"
            maxLength={1000}
            rows={3}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            disabled={busy || loading}
            placeholder="Add a comment…"
          />
          <button
            className={styles.postButton}
            type="submit"
            disabled={busy || loading || !body.trim()}
          >
            {busy ? "Posting…" : "Post"}
          </button>
          </div>
        </form>
      ) : (
        <p>
          <Link
            href={
              "/login?next=" +
              encodeURIComponent(`/product/${productId}#comments`)
            }
          >
            Sign in to comment
          </Link>
        </p>
      )}
      {error || social.error ? (
        <p role="alert">{error || social.error}</p>
      ) : null}
      {loading && !comments.length ? (
        <p role="status">Loading comments…</p>
      ) : !comments.length && !error ? (
        <div className={styles.empty}><Icon name="message" size={24} /><strong>No comments yet</strong><span>Be the first to join the conversation.</span></div>
      ) : null}
      <div className={styles.list}>
        {comments.map((comment) => (
          <article className={styles.comment} key={comment.id}>
            <div className={styles.avatar} aria-hidden="true">{(comment.user.name || "U").trim().charAt(0).toUpperCase()}</div>
            <div className={styles.commentBody}>
              <header>
                <strong>{comment.user.name}</strong>
                <time dateTime={comment.createdAt}>
                  {new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
                    Math.max(-365, Math.min(0, Math.round((new Date(comment.createdAt).getTime() - Date.now()) / 86400000))),
                    "day",
                  )}
                </time>
              </header>
              <p>{comment.body}</p>
              <div className={styles.commentActions}>
                <button type="button">Like</button>
                <button type="button">Reply</button>
                {auth.user?.id === comment.userId ? (
                  <button type="button" className={styles.remove} disabled={removing !== null} onClick={() => void remove(comment.id)}>
                    {removing === comment.id ? "Removing…" : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
      {cursor || error ? (
        <button
          type="button"
          className="secondary-button"
          disabled={loading}
          onClick={() => void loadMore()}
        >
          {loading
            ? "Loading…"
            : cursor
              ? "Load more comments"
              : "Retry comments"}
        </button>
      ) : null}
    </section>
  );
}

[executed on device: vmi3669743 (56b0f049-b731-45a8-b548-6a3c5f84f286)]