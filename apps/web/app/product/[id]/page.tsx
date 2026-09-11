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
  if (result.loading)
    return (
      <main className="app-shell">
        <Header title="Product details" back="/" />
        <LoadingState label="Loading product…" />
      </main>
    );
  if (result.error)
    return (
      <main className="app-shell">
        <Header title="Product details" back="/" />
        <ErrorState message={result.error} retry={() => void result.reload()} />
      </main>
    );
  if (!product)
    return (
      <main className="app-shell">
        <Header title="Product details" back="/" />
        <EmptyState message="Product not found." />
      </main>
    );
  return (
    <main className="app-shell detail-page">
      <Header
        title="Product details"
        back="/"
        action={
          <button
            className="icon-button"
            aria-label="Save product"
            onClick={() =>
              void protectedAction(() => savedApi.save(id), "Saved")
            }
          >
            <Icon name="heart" />
          </button>
        }
      />
      <div className="detail-image" style={{ background: "#eee8e1" }}>
        <span>
          {product.images[0] ? (
            <img
              src={product.images[0].url}
              alt={product.images[0].altText ?? product.name}
            />
          ) : (
            "🛍️"
          )}
        </span>
      </div>
      <section className="product-info">
        <p className="product-brand">{product.seller.displayName}</p>
        <h2>{product.name}</h2>
        <div className="price large">
          <strong>{money(product.price)}</strong>
        </div>
        <p className="rating">
          {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
        </p>
        <div className="divider" />
        <h3>About this item</h3>
        <p className="description">
          {product.description || "No description provided."}
        </p>
        <Link href={`/seller/${product.seller.id}`} className="seller-line">
          <span>{product.seller.displayName.slice(0, 2).toUpperCase()}</span>
          <div>
            <strong>{product.seller.displayName}</strong>
            <small>{product.category.name}</small>
          </div>
          <Icon name="chevron" />
        </Link>
        {message && <p role="status">{message}</p>}
      </section>
      <div className="sticky-actions">
        <button
          disabled={product.stock < 1}
          className="secondary-button"
          onClick={() =>
            void protectedAction(() => cartApi.add(id, 1), "Added to cart")
          }
        >
          Add to cart
        </button>
        <button
          disabled={product.stock < 1}
          className="dark-button"
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
