/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "../../components/header";
import { Icon } from "../../components/icon";
import { money } from "../../data";
import { productsApi } from "../../../lib/api/products";
import { cartApi } from "../../../lib/api/cart";
import { savedApi } from "../../../lib/api/saved";
import { useRequest } from "../../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "../../components/async-state";
import { useAuth } from "../../providers/auth-provider";
import styles from "./product-detail.module.css";

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const auth = useAuth();
  const result = useRequest(() => productsApi.get(id), [id]);
  const [message, setMessage] = useState("");
  const product = result.data?.data;

  const protectedAction = async (
    action: () => Promise<unknown>,
    success: string,
  ) => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=/product/${id}`);
      return;
    }

    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Action failed");
    }
  };

  if (result.loading) {
    return (
      <main className="app-shell">
        <Header title="Product details" back="/" />
        <LoadingState label="Loading product…" />
      </main>
    );
  }

  if (result.error) {
    return (
      <main className="app-shell">
        <Header title="Product details" back="/" />
        <ErrorState message={result.error} retry={() => void result.reload()} />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="app-shell">
        <Header title="Product details" back="/" />
        <EmptyState message="Product not found." />
      </main>
    );
  }

  const inStock = product.stock > 0;
  const primaryImage = product.images[0];

  return (
    <main className={`app-shell detail-page ${styles.page}`}>
      <Header
        title="Product details"
        back="/"
        action={
          <button
            className={`icon-button ${styles.saveButton}`}
            aria-label="Save product"
            onClick={() =>
              void protectedAction(() => savedApi.save(id), "Saved")
            }
          >
            <Icon name="heart" />
          </button>
        }
      />

      <section
        className={`detail-image ${styles.media}`}
        aria-label={`${product.name} image`}
      >
        <span>
          {primaryImage ? (
            <img
              className={styles.mediaImage}
              src={primaryImage.url}
              alt={primaryImage.altText ?? product.name}
            />
          ) : (
            <span className={styles.mediaFallback} aria-hidden="true">
              🛍️
            </span>
          )}
        </span>
        <div className={styles.mediaMeta} aria-hidden="true">
          <span className={styles.categoryBadge}>{product.category.name}</span>
          <span
            className={`${styles.stockBadge} ${!inStock ? styles.outOfStock : ""}`}
          >
            {inStock ? "Available" : "Out of stock"}
          </span>
        </div>
      </section>

      <section className={`product-info ${styles.content}`}>
        <Link
          href={`/seller/${product.seller.id}`}
          className={styles.sellerLink}
        >
          {product.seller.displayName}
        </Link>
        <h2 className={styles.title}>{product.name}</h2>

        <div className={styles.priceRow}>
          <div className={`price large ${styles.price}`}>
            <strong>{money(product.price)}</strong>
          </div>
          <span
            className={`${styles.inventory} ${!inStock ? styles.inventoryOut : ""}`}
          >
            {inStock ? `${product.stock} in stock` : "Currently unavailable"}
          </span>
        </div>

        <hr className={styles.divider} />

        <section aria-labelledby="about-product">
          <h3 id="about-product" className={styles.sectionTitle}>
            About this item
          </h3>
          <p className={styles.description}>
            {product.description || "No description provided."}
          </p>
        </section>

        <Link
          href={`/seller/${product.seller.id}`}
          className={`seller-line ${styles.sellerCard}`}
          aria-label={`View ${product.seller.displayName} seller profile`}
        >
          <span aria-hidden="true">
            {product.seller.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{product.seller.displayName}</strong>
            <small>{product.category.name} seller</small>
          </div>
          <Icon name="chevron" />
        </Link>

        {message && (
          <p className={styles.status} role="status" aria-live="polite">
            {message}
          </p>
        )}
      </section>

      <div
        className={`sticky-actions ${styles.actions}`}
        aria-label="Product actions"
      >
        <button
          disabled={!inStock}
          className={`secondary-button ${styles.actionButton}`}
          onClick={() =>
            void protectedAction(() => cartApi.add(id, 1), "Added to cart")
          }
        >
          Add to cart
        </button>
        <button
          disabled={!inStock}
          className={`dark-button ${styles.actionButton}`}
          onClick={() =>
            void protectedAction(async () => {
              await cartApi.add(id, 1);
              router.push("/checkout");
            }, "")
          }
        >
          Buy now
        </button>
      </div>
    </main>
  );
}
