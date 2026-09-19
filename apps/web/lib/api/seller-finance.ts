import { apiRequest } from "./client";
import type { DataResponse, SellerFinanceSummary } from "./types";

export const sellerFinanceApi = {
  summary: () =>
    apiRequest<DataResponse<SellerFinanceSummary>>("/seller/finance", {
      auth: true,
    }),
};
