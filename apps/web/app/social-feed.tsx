/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "../lib/api/types";
import { money } from "./data";
import { homeDesignProducts } from "./home-design";

export function SocialFeed({ products }: { products: Product[] }) {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [shared, setShared] = useState<string | null>(null);
  const feedProducts = products.slice(0, 6);

  if (!feedProducts.length) return null;

  async function shareProduct(product: Product) {
    const url = `${window.location.origin}/product/${product.id}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: product.name,
          text: `Check out ${product.name} on EaziCart`,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShared(product.id);
        window.setTimeout(() => setShared(null), 2200);
      } else {
        window.prompt("Copy this product link", url);
      }
    } catch {
      // Sharing can be cancelled by the user; no error state is needed.
    }
  }

  return (
    <section className="social-feed" aria-labelledby="social-feed-title">
      <div className="social-feed-heading">
        <div>
          <p className="social-feed-eyebrow">DISCOVER TOGETHER</p>
          <h2 id="social-feed-title">Community feed</h2>
          <p>Discover products, meet sellers, and find your next favourite.</p>
        </div>
        <div className="social-feed-heading-links">
          <Link href="/reels">Watch Reels <span aria-hidden="true">▶</span></Link>
          <Link href="/explore">Explore</Link>
        </div>
      </div>

      <div className="social-feed-posts">
        {feedProducts.map((product, index) => {
          const design = homeDesignProducts.find(
            (item) =>
              item.name === product.name &&
              item.seller === product.seller.displayName,
          );
          const isLiked = Boolean(liked[product.id]);
          const caption =
            product.reel?.caption?.trim() ||
            product.description?.trim() ||
            `Discover ${product.name} from ${product.seller.displayName} on EaziCart.`;

          return (
            <article className="social-feed-post" key={product.id}>
              <div className="social-feed-post-author">
                <span className="social-feed-avatar" aria-hidden="true">
                  {product.seller.displayName.slice(0, 2).toUpperCase()}
                </span>
                <div className="social-feed-author-copy">
                  <Link href={`/seller/${product.seller.id}`}>
                    {product.seller.displayName}
                  </Link>
                  <span>Seller storefront · Product spotlight</span>
                </div>
                <span className="social-feed-post-menu" aria-hidden="true">•••</span>
              </div>

              <p className="social-feed-caption">{caption}</p>

              <Link
                className="social-feed-product"
                href={`/product/${product.id}`}
                aria-label={`View ${product.name}`}
              >
                <div
                  className="social-feed-product-image"
                  style={{ background: design?.background ?? "#f4f5f7" }}
                >
                  {product.images[0] ? (
                    <img
                      src={product.images[0].url}
                      alt={product.images[0].altText ?? product.name}
                    />
                  ) : design ? (
                    <img src={`/figma/${design.image}`} alt={product.name} />
                  ) : (
                    <span>{product.name}</span>
                  )}
                </div>
                <div className="social-feed-product-details">
                  <div>
                    <span>FEATURED PRODUCT</span>
                    <strong>{product.name}</strong>
                    <small>{product.seller.displayName}</small>
                  </div>
                  <div className="social-feed-product-buy">
                    <strong>{money(product.price)}</strong>
                    <span>View <b aria-hidden="true">↗</b></span>
                  </div>
                </div>
              </Link>

              <div className="social-feed-actions">
                <button
                  type="button"
                  className={isLiked ? "is-liked" : ""}
                  aria-pressed={isLiked}
                  onClick={() =>
                    setLiked((previous) => ({
                      ...previous,
                      [product.id]: !previous[product.id],
                    }))
                  }
                >
                  <span aria-hidden="true">{isLiked ? "♥" : "♡"}</span>
                  {isLiked ? "Liked" : "Like"}
                </button>
                <Link href={`/product/${product.id}`}>
                  <span aria-hidden="true">▢</span> Discuss
                </Link>
                <button type="button" onClick={() => void shareProduct(product)}>
                  <span aria-hidden="true">↗</span>
                  {shared === product.id ? "Link copied" : "Share"}
                </button>

              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
