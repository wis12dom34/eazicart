"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useState } from "react";

import { savedApi } from "../../lib/api/saved";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { BottomNavigation } from "../components/bottom-navigation";
import { Icon } from "../components/icon";
import { money } from "../data";
import { useRequest } from "../hooks/use-request";
import { useAuth } from "../providers/auth-provider";
import styles from "./saved.module.css";

const cardSizeClasses = [
  styles.card330,
  styles.card372,
  styles.card360,
  styles.card312,
];

export default function SavedPage() {
  const auth = useAuth();
  const [removing, setRemoving] = useState<string>();
  const [actionError, setActionError] = useState("");
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );

  const remove = async (productId: string) => {
    setRemoving(productId);
    setActionError("");
    try {
      await savedApi.remove(productId);
      result.setData((current) =>
        current
          ? {
              data: current.data.filter(
                (saved) => saved.productId !== productId,
              ),
            }
          : current,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to remove product",
      );
    } finally {
      setRemoving(undefined);
    }
  };

  const savedProducts = result.data?.data ?? [];
  const columns = [
    savedProducts.filter((_, index) => index % 2 === 0),
    savedProducts.filter((_, index) => index % 2 === 1),
  ];

  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      <header className={styles.header}>
        <Link
          className={styles.backButton}
          href="/profile"
          aria-label="Back to profile"
        >
          <Icon name="back" size={22} />
        </Link>
        <h1>Saved</h1>
        <p>Products you want to come back to</p>
      </header>

      <nav className={styles.tabs} aria-label="Saved sections">
        <span className={styles.activeTab} aria-current="page">
          Products
        </span>
        <Link href="/following">Sellers</Link>
      </nav>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      {auth.loading || result.loading ? (
        <LoadingState label="Loading saved products…" />
      ) : !auth.isAuthenticated ? (
        <SignInState
          message="Sign in to view your saved products."
          next="/saved"
        />
      ) : result.error ? (
        <ErrorState message={result.error} retry={() => void result.reload()} />
      ) : savedProducts.length ? (
        <section className={styles.viewport} aria-label="Saved products">
          <div className={styles.masonry}>
            {columns.map((column, columnIndex) => (
              <div className={styles.column} key={columnIndex}>
                {column.map(({ product, productId }) => {
                  const originalIndex = savedProducts.findIndex(
                    (saved) => saved.productId === productId,
                  );
                  const image = product.images[0];
                  const isRemoving = removing === productId;
                  const sizeClass =
                    cardSizeClasses[originalIndex % cardSizeClasses.length] ??
                    styles.card330;

                  return (
                    <article
                      className={`${styles.productCard} ${sizeClass}`}
                      key={productId}
                    >
                      <Link
                        className={styles.productOverlay}
                        href={`/product/${product.id}`}
                        aria-label={`View ${product.name}`}
                      />

                      <div className={styles.productMedia} aria-hidden="true">
                        {image ? (
                          <img src={image.url} alt="" />
                        ) : (
                          <Icon name="bag" size={30} />
                        )}
                      </div>

                      {product.viewsLabel ? (
                        <span className={styles.views}>
                          {product.viewsLabel} views
                        </span>
                      ) : null}

                      <Link
                        className={styles.seller}
                        href={`/seller/${product.seller.id}`}
                      >
                        {product.seller.displayName}
                      </Link>

                      <Link
                        className={styles.productName}
                        href={`/product/${product.id}`}
                      >
                        {product.name}
                      </Link>

                      <strong className={styles.price}>
                        {money(product.price)}
                      </strong>

                      <button
                        className={styles.removeButton}
                        type="button"
                        onClick={() => void remove(productId)}
                        disabled={Boolean(removing)}
                        aria-label={`Remove ${product.name} from saved products`}
                        aria-busy={isRemoving}
                        aria-pressed="true"
                      >
                        <img
                          src="/figma/heart-saved.svg"
                          width={18}
                          height={18}
                          alt=""
                        />
                      </button>
                    </article>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <EmptyState
          title="Your wishlist is empty"
          message="Save products you love and find them later."
          icon="heart"
          action={{ href: "/explore", label: "Explore products" }}
        />
      )}

      <BottomNavigation />
    </main>
  );
}
