/* eslint-disable @next/next/no-img-element */
"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Product } from "../../lib/api/types";
import { money } from "../data";
import { Icon } from "./icon";
import { savedApi } from "../../lib/api/saved";
import { useAuth } from "../providers/auth-provider";
export function ProductCard({ product }: { product: Product }) {
  const auth = useAuth();
  const router = useRouter();
  const save = async () => {
    if (!auth.isAuthenticated) {
      router.push(`/login?next=/product/${product.id}`);
      return;
    }
    try {
      await savedApi.save(product.id);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("already saved"))
        window.alert(
          error instanceof Error ? error.message : "Unable to save product",
        );
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
        <button
          className="heart"
          aria-label={`Save ${product.name}`}
          onClick={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Icon name="heart" size={19} />
        </button>
      </Link>
      <p className="product-brand">{product.seller.displayName}</p>
      <Link href={`/product/${product.id}`} className="product-name">
        {product.name}
      </Link>
      <div className="price">
        <strong>{money(product.price)}</strong>
      </div>
    </article>
  );
}
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard product={p} key={p.id} />
      ))}
    </div>
  );
}
