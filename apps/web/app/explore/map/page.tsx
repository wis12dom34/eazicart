import { Suspense } from "react";
import { ExploreMap } from "./explore-map";

export default function ExploreMapPage() {
  return (
    <Suspense fallback={<main style={{minHeight:"100dvh",display:"grid",placeItems:"center"}}>Loading map…</main>}>
      <ExploreMap />
    </Suspense>
  );
}
