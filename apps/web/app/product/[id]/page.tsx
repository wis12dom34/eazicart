import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "../../components/header";
import { Icon } from "../../components/icon";
import { money, products } from "../../data";
export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = products.find((p) => p.id === id);
  if (!product) notFound();
  return (
    <main className="app-shell detail-page">
      <Header
        title="Product details"
        back="/"
        action={
          <button className="icon-button" aria-label="Save product">
            <Icon name="heart" />
          </button>
        }
      />
      <div className="detail-image" style={{ background: product.color }}>
        <span>{product.image}</span>
        <div className="dots">
          <i />
          <i />
          <i />
        </div>
      </div>
      <section className="product-info">
        <p className="product-brand">{product.brand}</p>
        <h2>{product.name}</h2>
        <div className="price large">
          <strong>{money(product.price)}</strong>
          {product.oldPrice && <del>{money(product.oldPrice)}</del>}
        </div>
        <p className="rating">
          <Icon name="star" size={16} /> {product.rating}{" "}
          <span>({product.reviews} reviews)</span>
        </p>
        <div className="divider" />
        <h3>About this item</h3>
        <p className="description">
          Thoughtfully made with premium materials, this versatile piece is
          designed for everyday use and effortless style.
        </p>
        <Link href="/seller/aria-studio" className="seller-line">
          <span>AS</span>
          <div>
            <strong>{product.brand}</strong>
            <small>Verified seller</small>
          </div>
          <Icon name="chevron" />
        </Link>
      </section>
      <div className="sticky-actions">
        <Link href="/cart" className="secondary-button">
          Add to cart
        </Link>
        <Link href="/checkout" className="dark-button">
          Buy now
        </Link>
      </div>
    </main>
  );
}
