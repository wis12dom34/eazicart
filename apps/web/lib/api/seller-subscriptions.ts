import { apiRequest } from "./client";
import type {
  DataResponse,
  ListResponse,
  SellerPlan,
  SellerSubscriptionSummary,
} from "./types";

export const sellerSubscriptionsApi = {
  plans: () =>
    apiRequest<ListResponse<SellerPlan>>("/seller/subscription/plans", {
      auth: true,
    }),
  current: () =>
    apiRequest<DataResponse<SellerSubscriptionSummary>>(
      "/seller/subscription",
      {
        auth: true,
      },
    ),
};
