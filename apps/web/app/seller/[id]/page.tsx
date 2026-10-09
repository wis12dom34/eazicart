import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import {
  getPublicSeller,
  getPublicProducts,
} from "../../../lib/public-catalog";
import { pageMetadata, canonicalUrl } from "../../../lib/seo";
import { StructuredData } from "../../components/structured-data";
import SellerContent from "./seller-content";

type Props = { params: Promise<{ id: string }> };
const getStore = cache(async (id: string) => {
  const seller = await getPublicSeller(id);
  const products =
    seller.status === "ok"
      ? await getPublicProducts(
          `seller=${encodeURIComponent(seller.data.id)}&limit=100`,
        )
      : undefined;
  return { seller, products };
});
export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const { seller, products } = await getStore(id);
  if (seller.status === "missing") notFound();
  const store = seller.status === "ok" ? seller.data : undefined;
  const rows = products?.status === "ok" ? products.data.data : [];
  return pageMetadata(
    store?.displayName ?? "Store unavailable",
    store?.bio?.slice(0, 160) ||
      (store
        ? `Browse products from ${store.displayName} on EaziCart.`
        : "Store details are temporarily unavailable."),
    `/seller/${encodeURIComponent(store?.id ?? id)}`,
    {
      catalog: true,
      index: Boolean(store && rows.length),
      image: rows[0]?.images[0]?.url,
    },
  );
}
export default async function SellerPage({ params }: Props) {
  const { id } = await params;
  const { seller, products } = await getStore(id);
  if (seller.status === "missing") notFound();
  const store = seller.status === "ok" ? seller.data : undefined;
  // The API accepts user ID aliases. Consolidate on the seller profile ID.
  if (store && store.id !== id)
    redirect(`/seller/${encodeURIComponent(store.id)}`);
  const rows = products?.status === "ok" ? products.data.data : undefined;
  const url = canonicalUrl(`/seller/${encodeURIComponent(id)}`);
  return (
    <>
      {store && url && rows?.length ? (
        <StructuredData
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: store.displayName,
            description: store.bio || undefined,
            url,
            mainEntity: {
              "@type": "ItemList",
              itemListElement: rows.map((p, index) => ({
                "@type": "ListItem",
                position: index + 1,
                name: p.name,
                url: canonicalUrl(`/product/${encodeURIComponent(p.id)}`),
              })),
            },
          }}
        />
      ) : null}
      <SellerContent
        key={id}
        id={id}
        initialSeller={store}
        initialProducts={rows}
        initialError={
          store
            ? ""
            : "The storefront is temporarily unavailable. Please try again."
        }
      />
    </>
  );
}
