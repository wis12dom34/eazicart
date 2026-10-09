"use client";

import Image from "next/image";
import { useState } from "react";
import styles from "./landing.module.css";
import audienceStyles from "./business-audiences.module.css";

export type LandingProduct = {
  name: string;
  seller: string;
  price: string;
  image: string;
};

const audiences = [
  {
    name: "Manufacturers",
    copy: "Reach distributors, retailers and businesses looking for your products.",
    productIndexes: [1, 2],
  },
  {
    name: "Wholesalers",
    copy: "Move stock faster by supplying retailers and resellers from one catalog.",
    productIndexes: [0, 3],
  },
  {
    name: "Distributors",
    copy: "Manage product distribution and connect with sellers across markets.",
    productIndexes: [2, 0],
  },
  {
    name: "Retailers",
    copy: "Discover products, manage your store and reach customers from one place.",
    productIndexes: [3, 1],
  },
  {
    name: "DTC Brands",
    copy: "Showcase your brand, publish products and sell directly to customers.",
    productIndexes: [1, 3],
  },
  {
    name: "SMEs",
    copy: "Run products, orders and customer activity without stitching tools together.",
    productIndexes: [2, 1],
  },
] as const;

export function BusinessAudiences({
  products,
}: {
  products: LandingProduct[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = audiences[activeIndex]!;

  return (
    <>
      <div
        className={styles.businessSelector}
        role="tablist"
        aria-label="Business types"
      >
        {audiences.map((audience, index) => (
          <button
            key={audience.name}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            aria-controls="business-audience-panel"
            className={`${audienceStyles.chip} ${index === activeIndex ? styles.activeTab : ""}`}
            onClick={() => setActiveIndex(index)}
          >
            {audience.name}
          </button>
        ))}
      </div>

      <div
        id="business-audience-panel"
        className={styles.businessPanel}
        role="tabpanel"
      >
        <div>
          <h3>{active.name}</h3>
          <p>{active.copy}</p>
        </div>
        <div className={styles.catalogue}>
          {active.productIndexes.map((productIndex) => {
            const product = products[productIndex];
            if (!product) return null;
            return <AudienceProductCard key={product.name} product={product} />;
          })}
        </div>
      </div>
    </>
  );
}

function AudienceProductCard({ product }: { product: LandingProduct }) {
  return (
    <article className={styles.productCard}>
      <div className={styles.productArt}>
        <Image
          src={product.image}
          width={560}
          height={700}
          sizes="(max-width: 760px) 100vw, 280px"
          alt={product.name}
          loading="lazy"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      </div>
      <strong>{product.name}</strong>
      <span>{product.seller}</span>
      <b>{product.price}</b>
    </article>
  );
}
