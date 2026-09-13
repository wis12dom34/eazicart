/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { money } from "../../data";
import { categoriesApi } from "../../../lib/api/categories";
import { productsApi, type ProductInput } from "../../../lib/api/products";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import type { Category, Product } from "../../../lib/api/types";
import styles from "./seller-products.module.css";

const formString = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const productPayload = (
  form: FormData,
  options: { clearImageWhenBlank?: boolean } = {},
): ProductInput => {
  const name = formString(form, "name");
  const description = formString(form, "description");
  const imageUrl = formString(form, "imageUrl");
  const images = imageUrl
    ? [{ url: imageUrl, altText: name, position: 0 }]
    : options.clearImageWhenBlank
      ? []
      : undefined;

  return {
    name,
    description: description || null,
    price: formString(form, "price"),
    stock: Number(formString(form, "stock")),
    categoryId: formString(form, "categoryId"),
    images,
  };
};

export default function SellerProductsPage() {
  const auth = useAuth();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const inventory = useRequest(
    async () =>
      profile.data?.data
        ? productsApi.sellerList()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );
  const categories = useRequest(
    async () =>
      profile.data?.data ? categoriesApi.list() : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );

  const reloadInventory = async () => {
    await inventory.reload();
  };

  const createProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError("");
    try {
      await productsApi.create(
        productPayload(new FormData(event.currentTarget)),
      );
      setAdding(false);
      await reloadInventory();
    } catch (value) {
      setActionError(
        value instanceof Error ? value.message : "Unable to create product",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const updateProduct = async (
    event: FormEvent<HTMLFormElement>,
    productId: string,
  ) => {
    event.preventDefault();
    setSubmitting(true);
    setActionError("");
    try {
      await productsApi.update(
        productId,
        productPayload(new FormData(event.currentTarget), {
          clearImageWhenBlank: true,
        }),
      );
      setEditingId(null);
      await reloadInventory();
    } catch (value) {
      setActionError(
        value instanceof Error ? value.message : "Unable to update product",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const deactivateProduct = async (product: Product) => {
    if (
      !window.confirm(
        `Deactivate ${product.name}? It will stop appearing in the public store.`,
      )
    )
      return;

    setSubmitting(true);
    setActionError("");
    try {
      await productsApi.deactivate(product.id);
      setEditingId(null);
      await reloadInventory();
    } catch (value) {
      setActionError(
        value instanceof Error ? value.message : "Unable to deactivate product",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerProductsHeader />
        <LoadingState label="Loading your seller products…" />
      </main>
    );
  }

  if (!auth.user) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerProductsHeader />
        <SignInState message="Sign in to manage your seller products." />
      </main>
    );
  }

  if (profile.error) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerProductsHeader />
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </main>
    );
  }

  if (!profile.data?.data) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerProductsHeader />
        <section className={styles.setupPrompt}>
          <div className={styles.setupIcon}>
            <Icon name="bag" size={24} />
          </div>
          <p className={styles.eyebrow}>Seller account required</p>
          <h1>Create your store before adding products</h1>
          <p>
            Your seller profile keeps inventory ownership tied to your account.
          </p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </main>
    );
  }

  if (
    inventory.loading ||
    categories.loading ||
    (!inventory.data && !inventory.error) ||
    (!categories.data && !categories.error)
  ) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerProductsHeader />
        <LoadingState label="Loading inventory…" />
      </main>
    );
  }

  if (
    inventory.error ||
    categories.error ||
    !inventory.data ||
    !categories.data
  ) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <SellerProductsHeader />
        <ErrorState
          message={
            inventory.error ||
            categories.error ||
            "Seller inventory is unavailable."
          }
          retry={() => {
            void inventory.reload();
            void categories.reload();
          }}
        />
      </main>
    );
  }

  const products = inventory.data.data;
  const categoryOptions = categories.data.data;
  const activeProducts = products.filter((product) => product.active !== false);
  const inactiveProducts = products.length - activeProducts.length;

  return (
    <main className={`app-shell ${styles.page}`}>
      <SellerProductsHeader />

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Inventory</p>
          <h1>Products</h1>
          <p>
            Manage real products owned by {profile.data.data.displayName}.
            Changes update the existing EaziCart catalog.
          </p>
        </div>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={() => {
            setAdding((value) => !value);
            setEditingId(null);
            setActionError("");
          }}
        >
          <Icon name="plus" size={18} />
          {adding ? "Close form" : "Add product"}
        </button>
      </section>

      <section className={styles.summaryGrid} aria-label="Inventory summary">
        <SummaryCard label="Total products" value={products.length} />
        <SummaryCard label="Active" value={activeProducts.length} />
        <SummaryCard label="Inactive" value={inactiveProducts} />
        <SummaryCard
          label="Units in stock"
          value={products.reduce((sum, product) => sum + product.stock, 0)}
        />
      </section>

      {adding ? (
        <section
          className={styles.formCard}
          aria-labelledby="add-product-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>New listing</p>
              <h2 id="add-product-title">Add product</h2>
            </div>
          </div>
          <ProductForm
            categories={categoryOptions}
            submitLabel="Create product"
            submitting={submitting}
            onSubmit={(event) => void createProduct(event)}
          />
        </section>
      ) : null}

      {actionError ? (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      ) : null}

      <section
        className={styles.inventorySection}
        aria-labelledby="inventory-title"
      >
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Catalog management</p>
            <h2 id="inventory-title">Your inventory</h2>
          </div>
          <span>{products.length.toLocaleString()} products</span>
        </div>

        {!products.length ? (
          <div className={styles.emptyWrap}>
            <EmptyState message="No seller products yet. Add your first product to start building your store." />
          </div>
        ) : (
          <div className={styles.productList}>
            {products.map((product) => (
              <article className={styles.productCard} key={product.id}>
                <div className={styles.productMain}>
                  <div className={styles.productImage}>
                    {product.images[0] ? (
                      <img
                        src={product.images[0].url}
                        alt={product.images[0].altText || product.name}
                      />
                    ) : (
                      <Icon name="box" size={28} />
                    )}
                  </div>

                  <div className={styles.productInfo}>
                    <div className={styles.productTitleRow}>
                      <div>
                        <h3>{product.name}</h3>
                        <p>{product.category.name}</p>
                      </div>
                      <span
                        className={`${styles.statusBadge} ${
                          product.active === false ? styles.inactiveBadge : ""
                        }`}
                      >
                        {product.active === false ? "Inactive" : "Active"}
                      </span>
                    </div>
                    <div className={styles.productMeta}>
                      <span>{money(product.price)}</span>
                      <span>{product.stock.toLocaleString()} in stock</span>
                    </div>
                  </div>
                </div>

                <div className={styles.productActions}>
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      setEditingId((value) =>
                        value === product.id ? null : product.id,
                      );
                      setAdding(false);
                      setActionError("");
                    }}
                  >
                    {editingId === product.id ? "Close edit" : "Edit"}
                  </button>
                  {product.active !== false ? (
                    <>
                      <Link
                        className={styles.secondaryLink}
                        href={`/product/${product.id}`}
                      >
                        View
                      </Link>
                      <button
                        className={styles.dangerButton}
                        type="button"
                        disabled={submitting}
                        onClick={() => void deactivateProduct(product)}
                      >
                        Deactivate
                      </button>
                    </>
                  ) : null}
                </div>

                {editingId === product.id ? (
                  <div className={styles.editPanel}>
                    <ProductForm
                      product={product}
                      categories={categoryOptions}
                      submitLabel="Save changes"
                      submitting={submitting}
                      onSubmit={(event) =>
                        void updateProduct(event, product.id)
                      }
                    />
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className={styles.note}>
        <strong>About deactivation</strong>
        <p>
          Deactivated products stay visible here for your records but are
          removed from public product listings. This action does not delete
          order history.
        </p>
      </aside>
    </main>
  );
}

function SellerProductsHeader() {
  return (
    <header className={styles.topbar}>
      <Link
        className={styles.back}
        href="/seller/dashboard"
        aria-label="Back to seller dashboard"
      >
        <Icon name="back" size={22} />
      </Link>
      <span>Seller products</span>
      <span aria-hidden="true" />
    </header>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value.toLocaleString()}</strong>
    </article>
  );
}

function ProductForm({
  product,
  categories,
  submitLabel,
  submitting,
  onSubmit,
}: {
  product?: Product;
  categories: Category[];
  submitLabel: string;
  submitting: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className={styles.productForm} onSubmit={onSubmit}>
      <label className={styles.field}>
        <span>Product name</span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={160}
          defaultValue={product?.name || ""}
          placeholder="Product name"
        />
      </label>

      <div className={styles.formGrid}>
        <label className={styles.field}>
          <span>Price (NGN)</span>
          <input
            name="price"
            required
            type="number"
            inputMode="decimal"
            min={0}
            max={9999999999.99}
            step="0.01"
            defaultValue={product?.price || ""}
            placeholder="25000"
          />
        </label>
        <label className={styles.field}>
          <span>Stock</span>
          <input
            name="stock"
            required
            type="number"
            min={0}
            step={1}
            defaultValue={product?.stock ?? 0}
          />
        </label>
      </div>

      <label className={styles.field}>
        <span>Category</span>
        <select
          name="categoryId"
          required
          defaultValue={product?.category.id || categories[0]?.id || ""}
          disabled={!categories.length}
        >
          {!categories.length ? (
            <option value="">No categories available</option>
          ) : null}
          {categories.map((category) => (
            <option value={category.id} key={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>Description</span>
        <textarea
          name="description"
          rows={4}
          maxLength={5000}
          defaultValue={product?.description || ""}
          placeholder="Describe the product"
        />
      </label>

      <label className={styles.field}>
        <span>Image URL</span>
        <input
          name="imageUrl"
          type="url"
          defaultValue={product?.images[0]?.url || ""}
          placeholder="https://example.com/product.jpg"
        />
        <small>
          Optional. Use a real hosted product image URL; no image is fabricated
          by EaziCart.
        </small>
      </label>

      <button
        className={styles.submitButton}
        type="submit"
        disabled={submitting || !categories.length}
      >
        {submitting ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
