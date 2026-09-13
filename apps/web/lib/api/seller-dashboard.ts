import { apiRequest } from "./client";
import type { DataResponse, Seller, SellerDashboard } from "./types";

export const sellerDashboardApi = {
  profile: () =>
    apiRequest<DataResponse<Seller | null>>("/seller-profile", { auth: true }),
  createProfile: (input: { displayName: string; bio?: string | null }) =>
    apiRequest<DataResponse<Seller>>("/seller-profile", {
      method: "POST",
      auth: true,
      body: input,
    }),
  dashboard: () =>
    apiRequest<DataResponse<SellerDashboard>>("/seller/dashboard", {
      auth: true,
    }),
};
