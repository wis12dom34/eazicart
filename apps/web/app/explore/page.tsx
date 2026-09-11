import { Suspense } from "react";
import { LoadingState } from "../components/async-state";
import { ExploreContent } from "./explore-content";

export default function ExplorePage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <ExploreContent />
    </Suspense>
  );
}
