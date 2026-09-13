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

  return (
    <main className={`app-shell with-nav ${styles.page}`}>
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <Link href="/profile" aria-label="Back to profile">
            <Icon name="back" size={22} />
          </Link>
          <h1>Saved</h1>
        </div>
        <p>Products you want to come back to</p>
      </header>

      <nav className={styles.tabs} aria-label="Saved sections">
        <span className={styles.activeTab} aria-current="page">
          Products
        </span>
        <Link href="/following">Sellers</Link>
        <button
          type="button"
          disabled
          title="Collections are not available yet."
        >
          Collections
        </button>
      </nav>

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      {auth.loading || result.loading ? (
        <LoadingState label="Loading saved products…" />
      ) : !auth.isAuthenticated ? (
        <SignInState message="Sign in to view your saved products." />
      ) : result.error ? (
        <ErrorState message={result.error} retry={() => void result.reload()} />
      ) : result.data?.data.length ? (
        <section className={styles.list} aria-label="Saved products">
          {result.data.data.map(({ product, productId }) => {
            const image = product.images[0];
            const isRemoving = removing === productId;
            return (
              <article className={styles.productCard} key={productId}>
                <Link
                  className={styles.productMedia}
                  href={`/product/${product.id}`}
                  aria-label={`View ${product.name}`}
                >
                  {image ? (
                    <img src={image.url} alt={image.altText ?? product.name} />
                  ) : (
                    <Icon name="bag" size={30} />
                  )}
                </Link>
                <Link
                  className={styles.productCopy}
                  href={`/product/${product.id}`}
                >
                  <strong>{product.name}</strong>
                  <span>{product.seller.displayName}</span>
                  <b>{money(product.price)}</b>
                </Link>
                <button
                  className={styles.removeButton}
                  type="button"
                  onClick={() => void remove(productId)}
                  disabled={Boolean(removing)}
                  aria-label={`Remove ${product.name} from saved products`}
                  aria-busy={isRemoving}
                >
                  <Icon name="heart" size={20} />
                </button>
                <Link
                  className={styles.viewLink}
                  href={`/product/${product.id}`}
                >
                  View
                </Link>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState message="You have no saved products." />
      )}

      <BottomNavigation />
    </main>
  );
}
