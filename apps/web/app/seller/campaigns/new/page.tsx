/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../../components/async-state";
import { Icon } from "../../../components/icon";
import { useRequest } from "../../../hooks/use-request";
import { useAuth } from "../../../providers/auth-provider";
import { money } from "../../../data";
import {
  sellerCampaignsApi,
  type SellerCampaignInput,
} from "../../../../lib/api/seller-campaigns";
import { sellerDashboardApi } from "../../../../lib/api/seller-dashboard";
import { productsApi } from "../../../../lib/api/products";
import type {
  Product,
  SellerCampaignObjective,
} from "../../../../lib/api/types";
import styles from "../seller-campaigns.module.css";

const objectives: Array<{
  value: SellerCampaignObjective;
  label: string;
}> = [
  { value: "PRODUCT_VIEWS", label: "More product views" },
  { value: "STORE_VISITS", label: "More store visits" },
  { value: "ORDERS", label: "More orders" },
  { value: "FOLLOWERS", label: "More followers" },
];

const formString = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

export default function NewSellerCampaignPage() {
  const auth = useAuth();
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

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

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <PageShell>
        <LoadingState label="Preparing campaign builder…" />
      </PageShell>
    );
  }

  if (!auth.user) {
    return (
      <PageShell>
        <SignInState message="Sign in to create a seller campaign." />
      </PageShell>
    );
  }

  if (profile.error) {
    return (
      <PageShell>
        <ErrorState
          message={profile.error}
          retry={() => void profile.reload()}
        />
      </PageShell>
    );
  }

  if (!profile.data?.data) {
    return (
      <PageShell>
        <section className={styles.setupPrompt}>
          <p className={styles.eyebrow}>Seller account required</p>
          <h1>Create your store first</h1>
          <p>
            Campaign drafts can only promote products owned by your existing
            EaziCart seller profile.
          </p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </PageShell>
    );
  }

  if (inventory.loading || (!inventory.data && !inventory.error)) {
    return (
      <PageShell>
        <LoadingState label="Loading your active products…" />
      </PageShell>
    );
  }

  if (inventory.error || !inventory.data) {
    return (
      <PageShell>
        <ErrorState
          message={inventory.error || "Seller products are unavailable."}
          retry={() => void inventory.reload()}
        />
      </PageShell>
    );
  }

  const activeProducts = inventory.data.data.filter(
    (product) => product.active !== false,
  );

  if (!activeProducts.length) {
    return (
      <PageShell>
        <section className={styles.setupPrompt}>
          <p className={styles.eyebrow}>Active product required</p>
          <h1>Add a product before creating a campaign</h1>
          <p>
            Campaigns must point to a real active product from your EaziCart
            store.
          </p>
          <Link className={styles.primaryLink} href="/seller/products">
            Manage products
          </Link>
        </section>
      </PageShell>
    );
  }

  const effectiveProductId = selectedProductId || activeProducts[0].id;
  const selectedProduct = activeProducts.find(
    (product) => product.id === effectiveProductId,
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = formString(form, "name");
    const audienceInterests = formString(form, "audienceInterests");
    const payload: SellerCampaignInput = {
      productId: formString(form, "productId"),
      name: name || undefined,
      objective: formString(form, "objective") as SellerCampaignObjective,
      audienceCountry: formString(form, "audienceCountry"),
      audienceAgeMin: Number(formString(form, "audienceAgeMin")),
      audienceAgeMax: Number(formString(form, "audienceAgeMax")),
      audienceInterests: audienceInterests || null,
      dailyBudget: formString(form, "dailyBudget"),
      durationDays: Number(formString(form, "durationDays")),
    };

    setSubmitting(true);
    setActionError("");
    try {
      await sellerCampaignsApi.create(payload);
      router.push("/seller/campaigns");
      router.refresh();
    } catch (value) {
      setActionError(
        value instanceof Error ? value.message : "Unable to save campaign draft",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className={`app-shell ${styles.page}`}>
      <BuilderHeader />

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Campaign builder</p>
          <h1>Create campaign</h1>
          <p>Promote a product to the right audience with a saved campaign plan.</p>
        </div>
      </section>

      <div className={styles.steps} aria-label="Campaign creation steps">
        <Step number="1" label="Product" />
        <Step number="2" label="Objective" />
        <Step number="3" label="Audience" />
      </div>

      <section className={styles.formCard}>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <section className={styles.formSection}>
            <h2>Choose product</h2>
            <label className={styles.field}>
              <span>Product</span>
              <select
                name="productId"
                required
                value={effectiveProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} · {money(product.price)}
                  </option>
                ))}
              </select>
            </label>
            {selectedProduct ? <ProductPreview product={selectedProduct} /> : null}
            <label className={styles.field}>
              <span>Campaign name</span>
              <input
                name="name"
                maxLength={160}
                placeholder={`${selectedProduct?.name || "Product"} Campaign`}
              />
              <small>Optional. EaziCart creates a product-based name if blank.</small>
            </label>
          </section>

          <section className={styles.formSection}>
            <h2>Objective</h2>
            <div className={styles.choiceGroup}>
              <span>What do you want this campaign to achieve?</span>
              <div className={styles.objectiveGrid}>
                {objectives.map((objective) => (
                  <label className={styles.objectiveOption} key={objective.value}>
                    <input
                      type="radio"
                      name="objective"
                      value={objective.value}
                      defaultChecked={objective.value === "PRODUCT_VIEWS"}
                    />
                    <span>{objective.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>Audience</h2>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Country</span>
                <input
                  name="audienceCountry"
                  required
                  minLength={2}
                  maxLength={100}
                  defaultValue="Nigeria"
                />
              </label>
              <label className={styles.field}>
                <span>Interests</span>
                <input
                  name="audienceInterests"
                  maxLength={500}
                  defaultValue="Shopping interests"
                  placeholder="Shopping interests"
                />
              </label>
            </div>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Minimum age</span>
                <input
                  name="audienceAgeMin"
                  type="number"
                  required
                  min={13}
                  max={100}
                  defaultValue={18}
                />
              </label>
              <label className={styles.field}>
                <span>Maximum age</span>
                <input
                  name="audienceAgeMax"
                  type="number"
                  required
                  min={13}
                  max={100}
                  defaultValue={44}
                />
              </label>
            </div>
          </section>

          <section className={styles.formSection}>
            <h2>Budget &amp; duration</h2>
            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Daily budget (NGN)</span>
                <input
                  name="dailyBudget"
                  type="number"
                  inputMode="decimal"
                  required
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  defaultValue="5000"
                />
              </label>
              <label className={styles.field}>
                <span>Duration</span>
                <input
                  name="durationDays"
                  type="number"
                  required
                  min={1}
                  max={90}
                  step={1}
                  defaultValue={7}
                />
                <small>1–90 days</small>
              </label>
            </div>
          </section>

          {actionError ? (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          ) : null}

          <div className={styles.formFooter}>
            <p>
              Saving this campaign creates a draft only. It does not charge your
              budget or start campaign delivery.
            </p>
            <button
              className={styles.submitButton}
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Saving draft…" : "Save campaign draft"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className={`app-shell ${styles.page}`}>
      <BuilderHeader />
      {children}
    </main>
  );
}

function BuilderHeader() {
  return (
    <header className={styles.topbar}>
      <Link
        className={styles.back}
        href="/seller/campaigns"
        aria-label="Back to campaigns"
      >
        <Icon name="back" size={22} />
      </Link>
      <span>Create campaign</span>
      <span aria-hidden="true" />
    </header>
  );
}

function Step({ number, label }: { number: string; label: string }) {
  return (
    <div className={styles.step}>
      <span className={styles.stepNumber}>{number}</span>
      <span>{label}</span>
    </div>
  );
}

function ProductPreview({ product }: { product: Product }) {
  return (
    <article className={styles.productPreview}>
      <div className={styles.productImage}>
        {product.images[0] ? (
          <img
            src={product.images[0].url}
            alt={product.images[0].altText || product.name}
          />
        ) : (
          <Icon name="box" size={24} />
        )}
      </div>
      <div>
        <p className={styles.eyebrow}>Selected product</p>
        <h3>{product.name}</h3>
        <p>
          {money(product.price)} · {product.stock.toLocaleString()} in stock
        </p>
      </div>
    </article>
  );
}
