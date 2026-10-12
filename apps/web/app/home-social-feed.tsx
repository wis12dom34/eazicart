/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Product } from "../lib/api/types";
import { money } from "./data";
import { homeDesignProducts } from "./home-design";

function Icon({
  name,
  filled = false,
}: {
  name: "heart" | "play" | "arrow" | "pin" | "sparkle" | "check";
  filled?: boolean;
}) {
  const paths = {
    heart: (
      <path d="M20.8 4.7a5.5 5.5 0 0 0-7.8 0L12 5.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.4 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" />
    ),
    play: <path d="m9 7 8 5-8 5Z" />,
    arrow: <path d="m9 18 6-6-6-6" />,
    pin: (
      <>
        <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
    sparkle: <path d="m12 2 1.6 5.1L19 9l-5.4 1.9L12 16l-1.6-5.1L5 9l5.4-1.9Z" />,
    check: <path d="m5 12 4 4L19 6" />,
  } as const;

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"}>
      <g
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths[name]}
      </g>
    </svg>
  );
}

function productDesign(product: Product) {
  return homeDesignProducts.find(
    (item) =>
      item.name === product.name && item.seller === product.seller.displayName,
  );
}

function productImage(product: Product) {
  const design = productDesign(product);
  return product.images[0]?.url ?? (design ? `/figma/${design.image}` : null);
}

function productBackground(product: Product) {
  return productDesign(product)?.background ?? "#f2f2f7";
}

function SectionHeading({
  title,
  eyebrow,
  href = "/explore",
}: {
  title: string;
  eyebrow?: string;
  href?: string;
}) {
  return (
    <div className="social-home-heading">
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h2>{title}</h2>
      </div>
      <Link href={href} aria-label={`See all ${title}`}>
        See all <Icon name="arrow" />
      </Link>
    </div>
  );
}

function SocialProductCard({
  product,
  saved,
  busy,
  onToggleSaved,
}: {
  product: Product;
  saved: boolean;
  busy: boolean;
  onToggleSaved: (product: Product) => void;
}) {
  const image = productImage(product);
  return (
    <article className="social-home-product-card">
      <div
        className="social-home-product-media"
        style={{ background: productBackground(product) }}
      >
        <Link href={`/product/${product.id}`} aria-label={`View ${product.name}`}>
          {image ? <img src={image} alt={product.images[0]?.altText ?? product.name} /> : null}
        </Link>
        <button
          type="button"
          aria-label={`${saved ? "Unsave" : "Save"} ${product.name}`}
          aria-pressed={saved}
          disabled={busy}
          className={`social-home-save ${saved ? "is-saved" : ""}`}
          onClick={() => onToggleSaved(product)}
        >
          <Icon name="heart" filled={saved} />
        </button>
      </div>
      <Link className="social-home-product-name" href={`/product/${product.id}`}>
        {product.name}
      </Link>
      <strong>{money(product.price)}</strong>
      <Link className="social-home-product-meta" href={`/seller/${product.seller.id}`}>
        {product.seller.displayName}
        {product.rating ? ` · ★ ${product.rating}` : ""}
      </Link>
      <small>
        {product.soldLabel ?? product.viewsLabel ?? (product.stock > 0 ? `${product.stock} in stock` : "Out of stock")}
      </small>
    </article>
  );
}

function ProductRail({
  products,
  title,
  eyebrow,
  isSaved,
  busy,
  onToggleSaved,
}: {
  products: Product[];
  title: string;
  eyebrow?: string;
  isSaved: (id: string) => boolean;
  busy: string | null;
  onToggleSaved: (product: Product) => void;
}) {
  if (!products.length) return null;
  return (
    <section className="social-home-section">
      <SectionHeading title={title} eyebrow={eyebrow} />
      <div className="social-home-product-rail">
        {products.map((product) => (
          <SocialProductCard
            key={product.id}
            product={product}
            saved={isSaved(product.id)}
            busy={busy === product.id}
            onToggleSaved={onToggleSaved}
          />
        ))}
      </div>
    </section>
  );
}

function FeaturePost({
  product,
  saved,
  busy,
  onToggleSaved,
}: {
  product: Product;
  saved: boolean;
  busy: boolean;
  onToggleSaved: (product: Product) => void;
}) {
  const image = productImage(product);
  const caption =
    product.reel?.caption ??
    product.description ??
    `Fresh from ${product.seller.displayName}. Tap the product to see the full details.`;

  return (
    <article className="social-home-feature">
      {image ? <img className="social-home-feature-image" src={image} alt={product.name} /> : null}
      <div className="social-home-feature-shade" />
      <div className="social-home-feature-top">
        <Link href={`/seller/${product.seller.id}`} className="social-home-feature-seller">
          <span aria-hidden="true">
            {product.seller.displayName.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <strong>{product.seller.displayName}</strong>
            <small>{product.reel ? "Seller reel" : "Seller spotlight"}</small>
          </div>
        </Link>
        <button
          type="button"
          className={`social-home-feature-save ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${product.name}`}
          aria-pressed={saved}
          disabled={busy}
          onClick={() => onToggleSaved(product)}
        >
          <Icon name="heart" filled={saved} />
        </button>
      </div>
      <div className="social-home-feature-copy">
        <p>{caption}</p>
        <Link className="social-home-product-pill" href={`/product/${product.id}`}>
          <span
            className="social-home-pill-image"
            style={{ background: productBackground(product) }}
          >
            {image ? <img src={image} alt="" /> : null}
          </span>
          <span className="social-home-pill-copy">
            <strong>{product.name}</strong>
            <small>{money(product.price)}</small>
          </span>
          <span className="social-home-pill-action">
            View <Icon name="arrow" />
          </span>
        </Link>
      </div>
      <Link className="social-home-watch" href="/reels" aria-label="Open EaziCart Reels">
        <Icon name="play" />
        Reels
      </Link>
    </article>
  );
}

function NearbyRail({ products }: { products: Product[] }) {
  if (!products.length) return null;
  const hasLocation = products.some((product) => product.seller.location?.visible !== false && product.seller.location?.label);
  return (
    <section className="social-home-section social-home-nearby">
      <SectionHeading
        title="Trending near you"
        eyebrow={hasLocation ? "Local sellers" : "Popular right now"}
        href="/explore?section=trending"
      />
      <div className="social-home-nearby-rail">
        {products.map((product) => {
          const image = productImage(product);
          const location =
            product.seller.location?.visible === false
              ? null
              : product.seller.location?.label;
          return (
            <Link className="social-home-nearby-card" href={`/product/${product.id}`} key={product.id}>
              <div style={{ background: productBackground(product) }}>
                {image ? <img src={image} alt={product.name} /> : null}
              </div>
              <strong>{product.name}</strong>
              <b>{money(product.price)}</b>
              <small>
                {location ? (
                  <>
                    <Icon name="pin" /> {location}
                  </>
                ) : (
                  product.soldLabel ?? product.viewsLabel ?? "Popular now"
                )}
              </small>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function SellerPost({ product }: { product: Product }) {
  const image = productImage(product);
  const copy =
    product.description ??
    `${product.seller.displayName} shared a closer look at ${product.name}.`;
  return (
    <article className="social-home-editorial">
      <div className="social-home-editorial-header">
        <span aria-hidden="true">
          {product.seller.displayName.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <Link href={`/seller/${product.seller.id}`}>{product.seller.displayName}</Link>
          <small>Seller post</small>
        </div>
      </div>
      <p>{copy}</p>
      {image ? (
        <Link className="social-home-editorial-media" href={`/product/${product.id}`}>
          <img src={image} alt={product.name} />
          <span>
            <small>Featured product</small>
            <strong>{product.name}</strong>
            <b>{money(product.price)}</b>
          </span>
        </Link>
      ) : null}
    </article>
  );
}

function QuickPick({ products }: { products: Product[] }) {
  const choices = products.slice(0, 2);
  const [vote, setVote] = useState<string | null>(null);
  if (choices.length < 2) return null;

  return (
    <section className="social-home-poll">
      <p>Quick pick</p>
      <h2>Which one are you choosing?</h2>
      <div className="social-home-poll-products">
        {choices.map((product) => {
          const image = productImage(product);
          const selected = vote === product.id;
          return (
            <button
              key={product.id}
              type="button"
              className={selected ? "is-selected" : ""}
              aria-pressed={selected}
              onClick={() => setVote(product.id)}
            >
              <span style={{ background: productBackground(product) }}>
                {image ? <img src={image} alt="" /> : null}
              </span>
              <strong>{product.name}</strong>
              <small>{selected ? "Your pick" : money(product.price)}</small>
              {selected ? <i><Icon name="check" /></i> : null}
            </button>
          );
        })}
      </div>
      <small className="social-home-poll-note">Your choice stays on this device session only.</small>
    </section>
  );
}

function SellerRail({ products }: { products: Product[] }) {
  const sellers = useMemo(
    () =>
      Array.from(
        new Map(products.map((product) => [product.seller.id, product.seller])).values(),
      ).slice(0, 4),
    [products],
  );
  if (!sellers.length) return null;

  return (
    <section className="social-home-section">
      <SectionHeading
        title="Shops to explore"
        eyebrow="Discover sellers"
        href="/explore?section=sellers"
      />
      <div className="social-home-seller-list">
        {sellers.map((seller) => {
          const count = products.filter((product) => product.seller.id === seller.id).length;
          return (
            <Link href={`/seller/${seller.id}`} className="social-home-seller" key={seller.id}>
              <span aria-hidden="true">{seller.displayName.slice(0, 2).toUpperCase()}</span>
              <div>
                <strong>{seller.displayName}</strong>
                <small>{seller.bio || `${seller._count?.products ?? count} products`}</small>
              </div>
              <b>View store <Icon name="arrow" /></b>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function HomeSocialFeed({
  products,
  isSaved,
  busy,
  onToggleSaved,
}: {
  products: Product[];
  isSaved: (id: string) => boolean;
  busy: string | null;
  onToggleSaved: (product: Product) => void;
}) {
  if (!products.length) return null;

  const feature = products.find((product) => product.reel) ?? products[0];
  const fresh = products.filter((product) => product.id !== feature.id).slice(0, 4);
  const trending = [...products]
    .sort((a, b) => (b.stock ?? 0) - (a.stock ?? 0))
    .slice(0, 4);
  const budget = [...products]
    .filter((product) => Number(product.price) <= 20_000)
    .sort((a, b) => Number(a.price) - Number(b.price))
    .slice(0, 4);
  const budgetFallback = budget.length >= 2
    ? budget
    : [...products].sort((a, b) => Number(a.price) - Number(b.price)).slice(0, 4);
  const editorial = products.find(
    (product) => product.id !== feature.id && (product.description || product.reel?.caption),
  ) ?? fresh[0] ?? feature;

  return (
    <div className="social-home-feed">
      <FeaturePost
        product={feature}
        saved={isSaved(feature.id)}
        busy={busy === feature.id}
        onToggleSaved={onToggleSaved}
      />
      <ProductRail
        products={fresh}
        title="Fresh picks for you"
        eyebrow="Picked from the latest catalog"
        isSaved={isSaved}
        busy={busy}
        onToggleSaved={onToggleSaved}
      />
      <NearbyRail products={trending} />
      <SellerPost product={editorial} />
      <ProductRail
        products={budgetFallback}
        title={budget.length >= 2 ? "Under ₦20k for you" : "Easy picks for your budget"}
        eyebrow="Simple, useful finds"
        isSaved={isSaved}
        busy={busy}
        onToggleSaved={onToggleSaved}
      />
      <QuickPick products={fresh.length >= 2 ? fresh : products} />
      <SellerRail products={products} />
      <Link className="social-home-reels-cta" href="/reels">
        <span><Icon name="play" /></span>
        <div>
          <small>Keep discovering</small>
          <strong>Watch products in action</strong>
        </div>
        <b><Icon name="arrow" /></b>
      </Link>
    </div>
  );
}
