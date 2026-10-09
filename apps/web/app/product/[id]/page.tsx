import { notFound } from "next/navigation";
import { getPublicProduct } from "../../../lib/public-catalog";
import { pageMetadata } from "../../../lib/seo";
import { productSchema, breadcrumbs } from "../../../lib/catalog-schema";
import { StructuredData } from "../../components/structured-data";
import ProductContent from "./product-content";

type Props = { params: Promise<{ id: string }> };
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const result = await getPublicProduct(id);
  if (result.status === "missing") notFound();
  const product = result.status === "ok" ? result.data : undefined;
  return pageMetadata(
    product?.name ?? "Product unavailable",
    product?.description?.slice(0, 160) ||
      (product
        ? `${product.name} from ${product.seller.displayName}. View current availability on EaziCart.`
        : "Product details are temporarily unavailable. Explore the EaziCart marketplace."),
    `/product/${encodeURIComponent(id)}`,
    { index: Boolean(product), catalog: true, image: product?.images[0]?.url },
  );
}
export default async function ProductPage({ params }: Props) {
  const { id } = await params;
  const result = await getPublicProduct(id);
  if (result.status === "missing") notFound();
  const product = result.status === "ok" ? result.data : undefined;
  const schema = product ? productSchema(product) : undefined;
  const trail = product
    ? breadcrumbs([
        { name: "EaziCart", path: "/landing" },
        {
          name: product.category.name,
          path: `/category/${encodeURIComponent(product.category.slug)}`,
        },
        { name: product.name, path: `/product/${encodeURIComponent(id)}` },
      ])
    : undefined;
  return (
    <>
      {schema ? <StructuredData data={schema} /> : null}
      {trail ? <StructuredData data={trail} /> : null}
      <ProductContent
        key={id}
        id={id}
        initialProduct={product}
        initialError={
          product
            ? ""
            : "The catalog is temporarily unavailable. Please try again."
        }
      />
    </>
  );
}
