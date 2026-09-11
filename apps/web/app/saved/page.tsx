"use client";
import { Header } from "../components/header";
import { ProductGrid } from "../components/product-card";
import { savedApi } from "../../lib/api/saved";
import { useRequest } from "../hooks/use-request";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../components/async-state";
import { useAuth } from "../providers/auth-provider";
export default function Saved() {
  const auth = useAuth();
  const result = useRequest(
    async () =>
      auth.isAuthenticated ? savedApi.list() : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  return (
    <main className="app-shell">
      <Header title="Saved items" back="/profile" />
      <section className="section">
        <p className="page-intro">The pieces you love, all in one place.</p>
        {auth.loading || result.loading ? (
          <LoadingState />
        ) : !auth.isAuthenticated ? (
          <SignInState />
        ) : result.error ? (
          <ErrorState
            message={result.error}
            retry={() => void result.reload()}
          />
        ) : result.data?.data.length ? (
          <ProductGrid products={result.data.data.map((x) => x.product)} />
        ) : (
          <EmptyState message="You have no saved products." />
        )}
      </section>
    </main>
  );
}
