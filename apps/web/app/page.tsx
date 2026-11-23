import { getPublicProducts } from "../lib/public-catalog";
import { pageMetadata } from "../lib/seo";
import HomeContent from "./home-content";
import { easyuiPreviewCatalog, isEasyuiPreview } from "./easyui-preview-data";

export const dynamic = "force-dynamic";
export const metadata = pageMetadata(
  "Shop products",
  "Discover products and public seller storefronts on EaziCart.",
  "/",
  { index: false },
);
export default async function HomePage() {
  const products = isEasyuiPreview ? null : await getPublicProducts("limit=100");
  return (
    <HomeContent
      visualPreview={isEasyuiPreview}
      initialProducts={isEasyuiPreview ? easyuiPreviewCatalog : products?.status === "ok" ? products.data : undefined}
    />
  );
}
