import Link from "next/link";
import type { Product } from "../data";
import { money } from "../data";
import { Icon } from "./icon";
export function ProductCard({ product }: { product: Product }) {
  return (
    <article className="product-card">
      <Link
        href={`/product/${product.id}`}
        className="product-image"
        style={{ background: product.color }}
        aria-label={`View ${product.name}`}
      >
        <span>{product.image}</span>
        <button className="heart" aria-label={`Save ${product.name}`}>
          <Icon name="heart" size={19} />
        </button>
      </Link>
      <p className="product-brand">{product.brand}</p>
      <Link href={`/product/${product.id}`} className="product-name">
        {product.name}
      </Link>
      <div className="price">
        <strong>{money(product.price)}</strong>
        {product.oldPrice ? <del>{money(product.oldPrice)}</del> : null}
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
