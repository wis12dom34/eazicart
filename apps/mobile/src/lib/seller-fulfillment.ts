import type { SellerFulfillmentStatus } from "./types";

export type NextFulfillmentAction = {
  status: Exclude<SellerFulfillmentStatus, "PENDING">;
  title: string;
  message: string;
  destructive?: boolean;
};

export function allowedSellerFulfillmentActions(
  current: SellerFulfillmentStatus,
): NextFulfillmentAction[] {
  if (current === "PENDING")
    return [
      {
        status: "CONFIRMED",
        title: "Confirm order",
        message: "Confirm that you can fulfill this seller order?",
      },
      {
        status: "CANCELLED",
        title: "Cancel seller order",
        message:
          "Cancel this seller fulfillment? This may affect the buyer's order.",
        destructive: true,
      },
    ];
  if (current === "CONFIRMED")
    return [
      {
        status: "FULFILLED",
        title: "Mark as fulfilled",
        message: "Have you completed the fulfillment of this seller order?",
      },
      {
        status: "CANCELLED",
        title: "Cancel seller order",
        message:
          "Cancel this seller fulfillment? This may affect the buyer's order.",
        destructive: true,
      },
    ];
  return [];
}
