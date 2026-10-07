/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Product } from "../../lib/api/types";
import { money } from "../data";
import { Icon } from "./icon";
import { savedApi } from "../../lib/api/saved";
import { useAuth } from "../providers/auth-provider";

export function ProductCard({ product }: { product: Product }) {
  const auth = useAuth();
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");

  const toggleSaved = async () => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=/product/${product.id}`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setFeedback("");
    try {
      if (saved) {
        await savedApi.remove(product.id);
        setSaved(false);
        setFeedback("Removed from saved items");
      } else {
        try {
          await savedApi.save(product.id);
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !error.message.includes("already saved")
          ) {
            throw error;
          }
        }
        setSaved(true);
        setFeedback("Saved");
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Unable to update saved items",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="product-card">
      <Link
        href={`/product/${product.id}`}
        className="product-image"
        style={{ background: "#eee8e1" }}
        aria-label={`View ${product.name}`}
      >
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
      </Link>
      <button
        className="heart"
        type="button"
        aria-label={`${saved ? "Unsave" : "Save"} ${product.name}`}
        aria-pressed={saved}
        disabled={busy}
        onClick={() => void toggleSaved()}
      >
        <Icon name="heart" size={19} />
      </button>
      <Link className="product-brand" href={`/seller/${product.seller.id}`}>
        {product.seller.displayName}
      </Link>
      <Link href={`/product/${product.id}`} className="product-name">
        {product.name}
      </Link>
      <div className="price">
        <strong>{money(product.price)}</strong>
      </div>
      {feedback ? (
        <span className="product-action-status" role="status">
          {feedback}
        </span>
      ) : null}
    </article>
  );
}

export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard product={product} key={product.id} />
      ))}
    </div>
  );
}
