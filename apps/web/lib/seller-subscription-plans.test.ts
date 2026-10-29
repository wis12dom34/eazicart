import { describe, expect, it } from "vitest";
import {
  PRO_PRICING,
  SELLER_SUBSCRIPTION_PLANS,
  sellerBillingFromQuery,
  sellerPaymentMethodFromQuery,
} from "./seller-subscription-plans";

describe("shared seller subscription rules", () => {
  it("keeps monthly launch pricing distinct from annual billing", () => {
    expect(PRO_PRICING.MONTHLY).toMatchObject({
      amountKobo: 299_900,
      amountLabel: "₦2,999",
      terms: "₦2,999/month for 3 months, then ₦4,999/month.",
    });
    expect(PRO_PRICING.YEARLY).toMatchObject({
      amountKobo: 4_990_000,
      amountLabel: "₦49,900",
      terms: "₦49,900 billed yearly. The monthly launch offer does not apply.",
    });
  });

  it("keeps Basic card-free and Business unavailable", () => {
    expect(SELLER_SUBSCRIPTION_PLANS.BASIC.benefits).toContain(
      "No card required",
    );
    expect(SELLER_SUBSCRIPTION_PLANS.BUSINESS.benefits).toContain(
      "Purchasing is not available yet",
    );
  });

  it.each([null, "", "invalid", "MONTHLY", "monthly"])(
    "defaults unsupported billing to monthly (%s)",
    (query) => expect(sellerBillingFromQuery(query)).toBe("MONTHLY"),
  );
  it("accepts yearly billing case-insensitively", () => {
    expect(sellerBillingFromQuery("YEARLY")).toBe("YEARLY");
    expect(sellerBillingFromQuery("yearly")).toBe("YEARLY");
  });
  it.each([null, "", "invalid", "CARD", "card"])(
    "defaults unsupported methods to card (%s)",
    (query) => expect(sellerPaymentMethodFromQuery(query)).toBe("CARD"),
  );
  it("accepts bank transfer case-insensitively", () => {
    expect(sellerPaymentMethodFromQuery("TRANSFER")).toBe("TRANSFER");
    expect(sellerPaymentMethodFromQuery("transfer")).toBe("TRANSFER");
  });
});
