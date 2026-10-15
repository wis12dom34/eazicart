export type SellerSubscriptionTier = "BASIC" | "PRO" | "BUSINESS";
export type SellerBillingCycle = "MONTHLY" | "YEARLY";
export type SellerPaymentMethod = "CARD" | "TRANSFER";

export const SELLER_SUBSCRIPTION_PLANS = {
  BASIC: {
    title: "Basic",
    subtitle: "Start selling for free.",
    benefits: [
      "Keep the existing Basic feature limits",
      "No card required",
      "Start selling for free",
    ],
  },
  PRO: {
    title: "Pro",
    subtitle: "More tools for a growing store.",
    benefits: [
      "Unlimited product listings",
      "Custom storefront & branding",
      "Priority search placement",
      "Advanced analytics & insights",
      "Reels & short video selling",
      "Bulk order processing",
      "Verified seller badge",
      "Dedicated seller support",
    ],
  },
  BUSINESS: {
    title: "Business",
    subtitle: "More scale for larger teams.",
    benefits: [
      "Business tools are coming soon",
      "Purchasing is not available yet",
    ],
  },
} as const;

export const PRO_PRICING = {
  MONTHLY: {
    amountKobo: 299_900,
    amountLabel: "₦2,999",
    cycleLabel: "Monthly",
    shortLabel: "monthly",
    helper: "First 3 months",
    terms: "₦2,999/month for 3 months, then ₦4,999/month.",
  },
  YEARLY: {
    amountKobo: 4_990_000,
    amountLabel: "₦49,900",
    cycleLabel: "Yearly",
    shortLabel: "yearly",
    helper: "≈ ₦4,158/month",
    terms: "₦49,900 billed yearly. The monthly launch offer does not apply.",
  },
} as const;

export function sellerBillingFromQuery(value: string | null): SellerBillingCycle {
  return value?.toUpperCase() === "YEARLY" ? "YEARLY" : "MONTHLY";
}

export function sellerPaymentMethodFromQuery(value: string | null): SellerPaymentMethod {
  return value?.toUpperCase() === "TRANSFER" ? "TRANSFER" : "CARD";
}
