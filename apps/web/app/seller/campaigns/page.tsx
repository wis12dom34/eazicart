/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  ErrorState,
  LoadingState,
  SignInState,
} from "../../components/async-state";
import { Icon } from "../../components/icon";
import { useRequest } from "../../hooks/use-request";
import { useAuth } from "../../providers/auth-provider";
import { money } from "../../data";
import { sellerCampaignsApi } from "../../../lib/api/seller-campaigns";
import { sellerDashboardApi } from "../../../lib/api/seller-dashboard";
import type {
  SellerCampaign,
  SellerCampaignObjective,
} from "../../../lib/api/types";
import styles from "./seller-campaigns.module.css";

const objectiveLabels: Record<SellerCampaignObjective, string> = {
  PRODUCT_VIEWS: "More product views",
  STORE_VISITS: "More store visits",
  ORDERS: "More orders",
  FOLLOWERS: "More followers",
};

export default function SellerCampaignsPage() {
  const auth = useAuth();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const profile = useRequest(
    async () =>
      auth.isAuthenticated
        ? sellerDashboardApi.profile()
        : Promise.resolve(undefined),
    [auth.isAuthenticated],
  );
  const campaigns = useRequest(
    async () =>
      profile.data?.data
        ? sellerCampaignsApi.list()
        : Promise.resolve(undefined),
    [profile.data?.data?.id],
  );

  const removeDraft = async (campaign: SellerCampaign) => {
    if (!window.confirm(`Delete the draft campaign “${campaign.name}”?`)) return;
    setDeletingId(campaign.id);
    setActionError("");
    try {
      await sellerCampaignsApi.remove(campaign.id);
      await campaigns.reload();
    } catch (value) {
      setActionError(
        value instanceof Error ? value.message : "Unable to delete campaign",
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (auth.loading || (auth.isAuthenticated && profile.loading)) {
    return (
      <PageShell>
        <LoadingState label="Loading campaigns…" />
      </PageShell>
    );
  }

  if (!auth.user) {
    return (
      <PageShell>
        <SignInState message="Sign in to manage seller campaigns." />
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
          <h1>Create your store before creating campaigns</h1>
          <p>Campaign ownership stays tied to your existing seller profile.</p>
          <Link className={styles.primaryLink} href="/seller/dashboard">
            Open seller workspace
          </Link>
        </section>
      </PageShell>
    );
  }

  if (campaigns.loading || (!campaigns.data && !campaigns.error)) {
    return (
      <PageShell>
        <LoadingState label="Loading campaign workspace…" />
      </PageShell>
    );
  }

  if (campaigns.error || !campaigns.data) {
    return (
      <PageShell>
        <ErrorState
          message={campaigns.error || "Campaigns are unavailable."}
          retry={() => void campaigns.reload()}
        />
      </PageShell>
    );
  }

  const items = campaigns.data.data;
  const draftCount = items.filter((campaign) => campaign.status === "DRAFT").length;
  const uniqueProducts = new Set(items.map((campaign) => campaign.productId)).size;

  return (
    <main className={`app-shell ${styles.page}`}>
      <CampaignHeader />

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Promote products inside EaziCart</p>
          <h1>Campaigns</h1>
          <p>
            Plan product campaigns with a clear objective, audience and budget.
            Delivery stays off until EaziCart has a real campaign delivery
            engine.
          </p>
        </div>
        <Link className={styles.primaryLink} href="/seller/campaigns/new">
          <Icon name="plus" size={18} />
          Create campaign
        </Link>
      </section>

      <aside className={styles.notice}>
        <div className={styles.noticeIcon}>
          <Icon name="sparkle" size={20} />
        </div>
        <div>
          <strong>Campaign delivery is not configured yet</strong>
          <p>
            Drafts are saved safely. No money is charged and no spend, revenue,
            impressions, orders or ROAS is invented while delivery is disabled.
          </p>
        </div>
      </aside>

      <section className={styles.summaryGrid} aria-label="Campaign summary">
        <SummaryCard label="Campaign drafts" value={draftCount} />
        <SummaryCard label="Products planned" value={uniqueProducts} />
        <SummaryCard label="Delivery" value="Off" />
      </section>

      {actionError ? (
        <p className={styles.error} role="alert">
          {actionError}
        </p>
      ) : null}

      <section className={styles.listSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Saved campaigns</p>
            <h2>Drafts</h2>
          </div>
          <span>{items.length.toLocaleString()} total</span>
        </div>

        {!items.length ? (
          <div className={styles.emptyState}>
            <h3>No campaign drafts yet</h3>
            <p>
              Choose one of your active products, set an objective and audience,
              then save the plan as a draft.
            </p>
            <Link className={styles.primaryLink} href="/seller/campaigns/new">
              Create campaign
            </Link>
          </div>
        ) : (
          <div className={styles.campaignList}>
            {items.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                deleting={deletingId === campaign.id}
                onDelete={() => void removeDraft(campaign)}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className={`app-shell ${styles.page}`}>
      <CampaignHeader />
      {children}
    </main>
  );
}

function CampaignHeader() {
  return (
    <header className={styles.topbar}>
      <Link
        className={styles.back}
        href="/seller/dashboard"
        aria-label="Back to seller dashboard"
      >
        <Icon name="back" size={22} />
      </Link>
      <span>Seller campaigns</span>
      <span aria-hidden="true" />
    </header>
  );
}

function SummaryCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <article className={styles.summaryCard}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CampaignCard({
  campaign,
  deleting,
  onDelete,
}: {
  campaign: SellerCampaign;
  deleting: boolean;
  onDelete: () => void;
}) {
  return (
    <article className={styles.campaignCard}>
      <div className={styles.campaignMain}>
        <div className={styles.productImage}>
          {campaign.product.images[0] ? (
            <img
              src={campaign.product.images[0].url}
              alt={campaign.product.images[0].altText || campaign.product.name}
            />
          ) : (
            <Icon name="box" size={28} />
          )}
        </div>

        <div className={styles.campaignInfo}>
          <div className={styles.titleRow}>
            <div>
              <h3>{campaign.name}</h3>
              <p>
                {campaign.product.name} · {campaign.audienceCountry} · Ages {campaign.audienceAgeMin}–{campaign.audienceAgeMax}
              </p>
            </div>
            <span className={styles.statusBadge}>{statusLabel(campaign.status)}</span>
          </div>

          <div className={styles.metaGrid}>
            <CampaignMeta
              label="Objective"
              value={objectiveLabels[campaign.objective]}
            />
            <CampaignMeta label="Daily budget" value={money(campaign.dailyBudget)} />
            <CampaignMeta
              label="Duration"
              value={`${campaign.durationDays} ${campaign.durationDays === 1 ? "day" : "days"}`}
            />
            <CampaignMeta label="Total budget" value={money(campaign.totalBudget)} />
          </div>
        </div>
      </div>

      <div className={styles.campaignActions}>
        <Link
          className={styles.secondaryLink}
          href={`/product/${campaign.product.id}`}
        >
          View product
        </Link>
        <span className={styles.secondaryLink}>Performance not available yet</span>
        {campaign.status === "DRAFT" ? (
          <button
            type="button"
            className={styles.deleteButton}
            disabled={deleting}
            onClick={onDelete}
          >
            {deleting ? "Deleting…" : "Delete draft"}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function CampaignMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metaItem}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function statusLabel(status: SellerCampaign["status"]) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
