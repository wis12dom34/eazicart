/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

import type { Product } from "../../lib/api/types";
import { money } from "../data";
import styles from "../discovery.module.css";
import { Icon } from "./icon";

export function DiscoveryProductCard({ product }: { product: Product }) {
  const image = product.images[0];

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
