import { getPublicFeed } from "../lib/public-catalog";
import { pageMetadata } from "../lib/seo";
import HomeContent from "./home-content";

export const metadata = pageMetadata(
  "Shop products",
  "Discover products and public seller storefronts on EaziCart.",
  "/",
  { index: false },
);

export default async function HomePage() {
  // Render the cached public FYP directly into the first HTML response.
  // Avoid a Suspense fallback here: on mobile it made the feed visibly swap
  // from a loading shell to the real posts even though the feed is cached.
  const products = await getPublicFeed(40, 30);
  return (
    <HomeContent
      initialProducts={products.status === "ok" ? products.data : undefined}
    />
  );
}