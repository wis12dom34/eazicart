import { Suspense } from "react";
import { connection } from "next/server";
import { getPublicProducts } from "../lib/public-catalog";
import { pageMetadata } from "../lib/seo";
import HomeContent from "./home-content";
import { LoadingState } from "./components/async-state";
import { BottomNavigation } from "./components/bottom-navigation";

export const metadata = pageMetadata(
  "Shop products",
  "Discover products and public seller storefronts on EaziCart.",
  "/",
  { index: false },
);
async function HomeFeed() {
  await connection();
  // Only the public catalog is cached. Home still refreshes it in the browser.
  const products = await getPublicProducts("limit=100", 15);
  return (
    <HomeContent
      initialProducts={products.status === "ok" ? products.data : undefined}
    />
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <main className="app-shell with-nav figma-home social-home">
          <div className="social-home-state">
            <LoadingState label="Loading your feed…" />
          </div>
          <BottomNavigation />
        </main>
      }
    >
      <HomeFeed />
    </Suspense>
  );
}
