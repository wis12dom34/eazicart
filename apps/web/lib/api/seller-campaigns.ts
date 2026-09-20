import { apiRequest } from "./client";
import type {
  DataResponse,
  SellerCampaign,
  SellerCampaignObjective,
} from "./types";

export type SellerCampaignInput = {
  productId: string;
  name?: string;
  objective: SellerCampaignObjective;
  audienceCountry?: string;
  audienceAgeMin?: number;
  audienceAgeMax?: number;
  audienceInterests?: string | null;
  dailyBudget: string;
  durationDays: number;
};

export const sellerCampaignsApi = {
  list: () =>
    apiRequest<{
      data: SellerCampaign[];
      delivery: { enabled: false; reason: string };
    }>("/seller/campaigns", { auth: true }),
  get: (id: string) =>
    apiRequest<DataResponse<SellerCampaign>>(
      `/seller/campaigns/${encodeURIComponent(id)}`,
      { auth: true },
    ),
  create: (input: SellerCampaignInput) =>
    apiRequest<DataResponse<SellerCampaign>>("/seller/campaigns", {
      method: "POST",
      auth: true,
      body: input,
    }),
  update: (id: string, input: Partial<SellerCampaignInput>) =>
    apiRequest<DataResponse<SellerCampaign>>(
      `/seller/campaigns/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        auth: true,
        body: input,
      },
    ),
  remove: (id: string) =>
    apiRequest<void>(`/seller/campaigns/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    }),
};
