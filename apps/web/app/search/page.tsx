import { Suspense } from "react";

import { LoadingState } from "../components/async-state";
import { SearchContent } from "./search-content";

export default function SearchPage() {
  return (
    <Suspense fallback={<LoadingState label="Loading search…" />}>
      <SearchContent />
    </Suspense>
  );
}
