"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productsApi } from "../../lib/api/products";
import type { Product } from "../../lib/api/types";
import { Icon } from "../components/icon";

const formatNaira = (value: string) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(value));

export default function ReelsPage() {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    productsApi
      .list({ sort: "newest", limit: 1 })
      .then((response) => {
        if (!active) return;
        setProduct(response.data[0] ?? null);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (!active) return;
        setError(requestError instanceof Error ? requestError.message : "Unable to load reels");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const shareProduct = async () => {
    if (!product) return;
    const url = `${window.location.origin}/product/${product.id}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus("Product link copied");
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setShareStatus("Unable to share product");
    }
  };

  if (loading) {
    return (
      <main className="reels-page reel-state">
        <div className="reel-top">
          <strong>Reels</strong>
          <Icon name="search" />
        </div>
        <p>Loading products…</p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="reels-page reel-state">
        <div className="reel-top">
          <strong>Reels</strong>
          <Icon name="search" />
        </div>
        <p>{error ?? "No products are available for Reels yet."}</p>
      </main>
    );
  }

  const image = product.images[0];
  const sellerName = product.seller.displayName || product.seller.user?.name || "Seller";
  const description = product.description?.trim();

  return (
    <main className="reels-page">
      {image ? (
        <img className="reel-media" src={image.url} alt={image.altText || product.name} />
      ) : (
        <div className="reel-media-fallback" aria-label="Product media unavailable">
          <Icon name="bag" size={64} />
        </div>
      )}
      <div className="reel-shade" />

      <div className="reel-top">
        <strong>Reels</strong>
        <Link href="/explore" aria-label="Search products">
          <Icon name="search" />
        </Link>
      </div>

      <div className="reel-details">
        <div className="reel-seller-row">
          <Link className="reel-avatar" href={`/seller/${product.seller.id}`} aria-label={`View ${sellerName} seller profile`}>
            {sellerName.slice(0, 1).toUpperCase()}
          </Link>
          <Link className="reel-seller-name" href={`/seller/${product.seller.id}`}>
            {sellerName}
          </Link>
        </div>
        {description ? <p className="reel-caption">{description}</p> : null}
        <strong className="reel-product-name">{product.name}</strong>
        <strong className="reel-price">{formatNaira(product.price)}</strong>
      </div>

      <button className="reel-share" type="button" onClick={shareProduct} aria-label={`Share ${product.name}`}>
        <Icon name="share" />
        <span>Share</span>
      </button>
      {shareStatus ? <span className="reel-share-status" role="status">{shareStatus}</span> : null}

      <Link className="reel-view-product" href={`/product/${product.id}`}>
        <span>View Product</span>
        <strong>{formatNaira(product.price)}</strong>
      </Link>
    </main>
  );
}
