/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../../components/async-state";
import { Icon } from "../../../components/icon";
import { useRequest } from "../../../hooks/use-request";
import { useAuth } from "../../../providers/auth-provider";
import {
  sellerCampaignsApi,
  type SellerCampaignInput,
} from "../../../../lib/api/seller-campaigns";
import { productsApi } from "../../../../lib/api/products";
import { sellerDashboardApi } from "../../../../lib/api/seller-dashboard";
import type {
  Product,
  SellerCampaignObjective,
} from "../../../../lib/api/types";
import styles from "../seller-campaigns.module.css";

const objectiveOptions: Array<{
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

export default function CreateSellerCampaignPage() {
  const router = useRouter();
  const auth = useAuth();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [dailyBudget, setDailyBudget] = useState("5000");
  const [durationDays, setDurationDays] = useState("7");
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

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload: SellerCampaignInput = {
      productId: formString(form, "productId"),
      name: formString(form, "name") || undefined,
      objective: formString(form, "objective") as SellerCampaignObjective,
      audienceCountry: formString(form, "audienceCountry"),
      audienceAgeMin: Number(formString(form, "audienceAgeMin")),
      audienceAgeMax: Number(formString(form, "audienceAgeMax")),
      audienceInterests: formString(form, "audienceInterests") || null,
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

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <CreateCampaignHeader />
        <LoadingState label="Loading campaign setup…" />
      </main>
    );
  }

  if (!auth.user) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <CreateCampaignHeader />
        <SignInState message="Sign in to create a seller campaign." />
      </main>
    );
  }

  if (profile.error) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <CreateCampaignHeader />
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
        <CreateCampaignHeader />
        <section className={styles.setupPrompt}>
          <p className={styles.eyebrow}>Seller account required</p>
          <h1>Create your store before creating campaigns</h1>
          <p>Campaigns stay connected to your existing EaziCart seller profile.</p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </main>
    );
  }

  if (inventory.loading || (!inventory.data && !inventory.error)) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <CreateCampaignHeader />
        <LoadingState label="Loading your products…" />
      </main>
    );
  }

  if (inventory.error || !inventory.data) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <CreateCampaignHeader />
        <ErrorState
          message={inventory.error || "Seller products are unavailable."}
          retry={() => void inventory.reload()}
        />
      </main>
    );
  }

  const activeProducts = inventory.data.data.filter(
    (product) => product.active !== false,
  );
  const resolvedProductId = selectedProductId || activeProducts[0]?.id || "";
  const selectedProduct = activeProducts.find(
    (product) => product.id === resolvedProductId,
  );
  const budget = Number(dailyBudget);
  const duration = Number(durationDays);
  const totalBudget =
    Number.isFinite(budget) && Number.isFinite(duration) ? budget * duration : 0;

  if (!activeProducts.length) {
    return (
      <main className={`app-shell ${styles.page}`}>
        <CreateCampaignHeader />
        <section className={styles.setupPrompt}>
          <p className={styles.eyebrow}>Product required</p>
          <h1>Add an active product first</h1>
          <p>
            Campaigns promote products that already belong to your existing
            EaziCart store.
          </p>
          <Link className={styles.primaryLink} href="/seller/products">
            Manage products
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell ${styles.page}`}>
      <CreateCampaignHeader />

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>New campaign draft</p>
          <h1>Create Campaign</h1>
          <p>
            Choose what to promote, define the goal and audience, then set the
            budget. Saving this form creates a draft only and does not charge
            your account.
          </p>
        </div>
      </section>

      <div className={styles.steps} aria-label="Campaign creation steps">
        <div className={styles.step}>
          <span className={styles.stepNumber}>1</span>
          Product
        </div>
        <div className={styles.step}>
          <span className={styles.stepNumber}>2</span>
          Objective
        </div>
        <div className={styles.step}>
          <span className={styles.stepNumber}>3</span>
          Audience & budget
        </div>
      </div>

      <aside className={styles.notice}>
        <div className={styles.noticeIcon}>
          <Icon name="sparkle" size={20} />
        </div>
        <div>
          <strong>Draft planning only</strong>
          <p>
            Campaign delivery and spending are not live yet. EaziCart will not
            fabricate impressions, orders, revenue or ROAS for this draft.
          </p>
        </div>
      </aside>

      <section className={styles.formCard}>
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
          <div className={styles.formSection}>
            <div>
              <p className={styles.eyebrow}>Step 1</p>
              <h2>Choose product</h2>
            </div>

            <label className={styles.field}>
              <span>Product</span>
              <select
                name="productId"
                required
                value={resolvedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
              >
                {activeProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedProduct ? (
              <ProductPreview product={selectedProduct} />
            ) : null}

            <label className={styles.field}>
              <span>Campaign name</span>
              <input
                name="name"
                maxLength={160}
                placeholder={
                  selectedProduct ? `${selectedProduct.name} Campaign` : "Campaign name"
                }
              />
              <small>Optional. EaziCart can name the draft from the product.</small>
            </label>
          </div>

          <div className={styles.formSection}>
            <div>
              <p className={styles.eyebrow}>Step 2</p>
              <h2>Choose objective</h2>
            </div>

            <fieldset className={styles.choiceGroup}>
              <legend>What do you want this campaign to achieve?</legend>
              <div className={styles.objectiveGrid}>
                {objectiveOptions.map((option, index) => (
                  <label className={styles.objectiveOption} key={option.value}>
                    <input
                      type="radio"
                      name="objective"
                      value={option.value}
                      defaultChecked={index === 0}
                      required
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className={styles.formSection}>
            <div>
              <p className={styles.eyebrow}>Step 3</p>
              <h2>Audience</h2>
            </div>

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

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Minimum age</span>
                <input
                  name="audienceAgeMin"
                  type="number"
                  min={13}
                  max={100}
                  defaultValue={18}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Maximum age</span>
                <input
                  name="audienceAgeMax"
                  type="number"
                  min={13}
                  max={100}
                  defaultValue={44}
                  required
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Audience interests</span>
              <textarea
                name="audienceInterests"
                maxLength={500}
                rows={3}
                defaultValue="Shopping interests"
                placeholder="Shopping interests"
              />
              <small>Optional planning note. This does not target anyone yet.</small>
            </label>
          </div>

          <div className={styles.formSection}>
            <div>
              <p className={styles.eyebrow}>Budget</p>
              <h2>Set budget and duration</h2>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                <span>Daily budget (NGN)</span>
                <input
                  name="dailyBudget"
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  max="9999999999.99"
                  step="0.01"
                  value={dailyBudget}
                  onChange={(event) => setDailyBudget(event.target.value)}
                  required
                />
              </label>
              <label className={styles.field}>
                <span>Duration (days)</span>
                <input
                  name="durationDays"
                  type="number"
                  min={1}
                  max={90}
                  step={1}
                  value={durationDays}
                  onChange={(event) => setDurationDays(event.target.value)}
                  required
                />
              </label>
            </div>
          </div>

          <section className={styles.reviewCard} aria-label="Campaign review">
            <p className={styles.eyebrow}>Review</p>
            <div className={styles.sectionHeading}>
              <div>
                <h2>Planned budget</h2>
                <p>
                  {formatMoney(totalBudget)} total at {formatMoney(budget || 0)}
                  /day for {duration || 0} days.
                </p>
              </div>
              <span>Draft only</span>
            </div>
          </section>

          {actionError ? (
            <p className={styles.error} role="alert">
              {actionError}
            </p>
          ) : null}

          <div className={styles.formFooter}>
            <p>
              Saving creates a campaign draft. No ad delivery, wallet debit or
              paid promotion starts from this action.
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

function CreateCampaignHeader() {
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

function ProductPreview({ product }: { product: Product }) {
  return (
    <div className={styles.productPreview}>
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
        <span className={styles.statusBadge}>Selected product</span>
        <h3>{product.name}</h3>
        <p>{formatMoney(Number(product.price))}</p>
      </div>
    </div>
  );
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}
