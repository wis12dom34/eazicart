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
  const [selectedImage, setSelectedImage] = useState(0);
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
        <Header title="Product" back="/" />
        <LoadingState label="Loading product…" />
      </main>
    );
  }

  if (result.error) {
    return (
      <main className="app-shell">
        <Header title="Product" back="/" />
        <ErrorState message={result.error} retry={() => void result.reload()} />
      </main>
    );
  }

  if (!product) {
    return (
      <main className="app-shell">
        <Header title="Product" back="/" />
        <EmptyState message="Product not found." />
      </main>
    );
  }

  const inStock = product.stock > 0;
  const imageIndex = Math.min(
    selectedImage,
    Math.max(product.images.length - 1, 0),
  );
  const activeImage = product.images[imageIndex];

  const shareProduct = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        setMessage("Product link copied");
        return;
      }

      setMessage("Share this page from your browser");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setMessage("Unable to share product");
    }
  };

  return (
    <main className={`app-shell detail-page ${styles.page}`}>
      <Header
        title="Product"
        back="/"
        action={
          <div className={styles.headerActions}>
            <button
              className={`icon-button ${styles.headerIconButton}`}
              aria-label="Save product"
              onClick={() =>
                void protectedAction(() => savedApi.save(id), "Saved")
              }
            >
              <Icon name="heart" />
            </button>
            <button
              className={`icon-button ${styles.headerIconButton}`}
              aria-label="Share product"
              onClick={() => void shareProduct()}
            >
              <Icon name="share" />
            </button>
          </div>
        }
      />

      <section
        className={`detail-image ${styles.media}`}
        aria-label={`${product.name} product images`}
      >
        {activeImage ? (
          <img
            className={styles.mediaImage}
            src={activeImage.url}
            alt={activeImage.altText ?? product.name}
          />
        ) : (
          <span className={styles.mediaFallback} aria-hidden="true">
            <Icon name="bag" size={56} />
          </span>
        )}

        {product.images.length > 0 ? (
          <div className={styles.galleryMeta}>
            <div className={styles.galleryDots} aria-label="Product images">
              {product.images.map((image, index) => (
                <button
                  key={image.id ?? `${image.url}-${index}`}
                  type="button"
                  className={`${styles.galleryDot} ${
                    imageIndex === index ? styles.galleryDotActive : ""
                  }`}
                  aria-label={`Show product image ${index + 1}`}
                  aria-pressed={imageIndex === index}
                  onClick={() => setSelectedImage(index)}
                />
              ))}
            </div>
            <span className={styles.galleryCount} aria-live="polite">
              {imageIndex + 1} / {product.images.length}
            </span>
          </div>
        ) : null}
      </section>

      <section className={`product-info ${styles.content}`}>
        <h2 className={styles.title}>{product.name}</h2>

        <div className={`price large ${styles.price}`}>
          <strong>{money(product.price)}</strong>
        </div>
        <p
          className={`${styles.inventory} ${!inStock ? styles.inventoryOut : ""}`}
        >
          {inStock ? `${product.stock} in stock` : "Out of stock"}
        </p>

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
            <small>{product.category.name}</small>
          </div>
          <Icon name="chevron" />
        </Link>

        <hr className={styles.divider} />

        <section aria-labelledby="about-product">
          <h3 id="about-product" className={styles.sectionTitle}>
            About this item
          </h3>
          <p className={styles.description}>
            {product.description || "No description provided."}
          </p>
        </section>

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
          Add to Cart
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
          Buy Now
        </button>
      </div>
    </main>
  );
}
