/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import type { Product } from "../../lib/api/types";
import { money } from "../data";
import styles from "../discovery.module.css";
import { Icon } from "./icon";

type DiscoveryProductCardProps = {
  product: Product;
  variant?: "default" | "search";
  searchPosition?: number;
  saved?: boolean;
  saving?: boolean;
  onToggleSaved?: () => void;
};

const searchSizes = [
  styles.searchCard318,
  styles.searchCard356,
  styles.searchCard350,
  styles.searchCard300,
];

export function DiscoveryProductCard({
  product,
  variant = "default",
  searchPosition = 0,
  saved = false,
  saving = false,
  onToggleSaved,
}: DiscoveryProductCardProps) {
  const image = product.images[0];

  if (variant === "search") {
    const sizeClass = searchSizes[searchPosition % searchSizes.length];
    return (
      <article className={`${styles.searchProductCard} ${sizeClass}`}>
        <Link
          className={styles.searchProductOverlay}
          href={`/product/${product.id}`}
          aria-label={`View ${product.name}`}
        />
        <div className={styles.searchProductMedia} aria-hidden="true">
          {image ? <img src={image.url} alt="" /> : null}
        </div>
        {product.viewsLabel ? (
          <span className={styles.searchProductViews}>
            {product.viewsLabel} views
          </span>
        ) : null}
        <Link
          className={styles.searchProductSeller}
          href={`/seller/${product.seller.id}`}
        >
          {product.seller.displayName}
        </Link>
        <Link
          className={styles.searchProductName}
          href={`/product/${product.id}`}
        >
          {product.name}
        </Link>
        <strong className={styles.searchProductPrice}>
          {money(product.price)}
        </strong>
        {onToggleSaved ? (
          <button
            className={styles.searchFavorite}
            type="button"
            aria-label={`${saved ? "Unsave" : "Save"} ${product.name}`}
            aria-pressed={saved}
            disabled={saving}
            onClick={onToggleSaved}
          >
            <img
              src={saved ? "/figma/heart-saved.svg" : "/figma/heart.svg"}
              width={18}
              height={18}
              alt=""
            />
          </button>
        ) : null}
      </article>
    );
  }

  return (
    <article className={styles.productCard}>
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
      <p className={styles.productSeller}>{product.seller.displayName}</p>
      <Link className={styles.productName} href={`/product/${product.id}`}>
        {product.name}
      </Link>
      <strong className={styles.productPrice}>{money(product.price)}</strong>
    </article>
  );
}
