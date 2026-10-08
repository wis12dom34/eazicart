import Link from "next/link";
import type { Product } from "../lib/api/types";

export function HomeSections({ products }: { products: Product[] }) {
  const categories = Array.from(
    new Map(
      products.map((product) => [product.category.id, product.category]),
    ).values(),
  );
  const sellers = Array.from(
    new Map(
      products.map((product) => [product.seller.id, product.seller]),
    ).values(),
  );

  if (!categories.length && !sellers.length) return null;

  return (
    <>
      {categories.length ? (
        <>
          <div className="figma-home-lower-divider" />
          <section
            className="figma-home-brands"
            aria-labelledby="home-categories-title"
          >
            <div className="figma-home-section-header">
              <h2 id="home-categories-title">Shop by category</h2>
              <Link href="/explore?section=categories">Browse</Link>
            </div>
            <div className="figma-home-brand-strip">
              {categories.map((category) => {
                const count = products.filter(
                  (product) => product.category.id === category.id,
                ).length;
                return (
                  <Link
                    className="figma-home-brand"
                    href={`/category/${category.slug}`}
                    key={category.id}
                  >
                    <b aria-hidden="true">
                      {category.name.slice(0, 1).toUpperCase()}
                    </b>
                    <strong>{category.name}</strong>
                    <small>
                      {category._count?.products ?? count}{" "}
                      {count === 1 ? "item" : "items"}
                    </small>
                  </Link>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {sellers.length ? (
        <>
          <div className="figma-home-lower-divider" />
          <section
            className="figma-home-top-sellers"
            aria-labelledby="home-sellers-title"
          >
            <div className="figma-home-section-header">
              <h2 id="home-sellers-title">Sellers to explore</h2>
              <Link href="/explore?section=sellers">Show more</Link>
            </div>
            {sellers.slice(0, 3).map((seller) => (
              <Link
                className="figma-home-top-seller"
                href={`/seller/${seller.id}`}
                key={seller.id}
              >
                <b className="figma-home-seller-initial" aria-hidden="true">
                  {seller.displayName.slice(0, 2).toUpperCase()}
                </b>
                <div>
                  <strong>{seller.displayName}</strong>
                  <p>
                    {seller.bio ||
                      `${products.filter((product) => product.seller.id === seller.id).length} products`}
                  </p>
                </div>
              </Link>
            ))}
          </section>
        </>
      ) : null}
    </>
  );
}
