"use client";
import { useEffect, useState } from "react";
import { productSocialApi, type ProductComment } from "../../../lib/api/product-social";
import { Icon } from "../../components/icon";
import styles from "./top-comments.module.css";

function relativeTime(value: string) {
  const ms = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.floor(ms / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(value).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export function TopProductComments({ productId }: { productId: string }) {
  const [comments, setComments] = useState<ProductComment[]>([]);
  useEffect(() => {
    let active = true;
    void productSocialApi.comments(productId).then((result) => {
      if (active) setComments(result.data.slice(0, 2));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [productId]);
  if (!comments.length) return null;
  return (
    <section className={styles.wrap} aria-label="Top comments">
      <div className={styles.heading}><strong>Top comments</strong><span><Icon name="message" size={14} /> From the community</span></div>
      <div className={styles.list}>
        {comments.map((comment) => (
          <article key={comment.id} className={styles.comment}>
            <span className={styles.avatar} aria-hidden="true">{(comment.user.name || "U").trim().charAt(0).toUpperCase()}</span>
            <div>
              <p className={styles.meta}><strong>{comment.user.name}</strong><time dateTime={comment.createdAt}>· {relativeTime(comment.createdAt)}</time></p>
              {comment.body ? <p className={styles.body}>{comment.body}</p> : null}
              {comment.mediaUrl ? <img className={`${styles.media} ${comment.mediaType === "gif" ? styles.gif : ""}`} src={comment.mediaUrl} alt={comment.mediaType === "gif" ? "Comment GIF" : "Comment image"} loading="lazy" /> : null}
              <div className={styles.actions}>{comment.likeCount ? <span>{comment.likeCount} {comment.likeCount === 1 ? "like" : "likes"}</span> : null}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}