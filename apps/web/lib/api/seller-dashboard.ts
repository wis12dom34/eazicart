import { apiRequest } from "./client";
import type {
  DataResponse,
  Seller,
  SellerDashboard,
  SellerMapLocation,
} from "./types";

export type SellerProfileInput = {
  displayName?: string;
  bio?: string | null;
};

export const sellerDashboardApi = {
  profile: () =>
    apiRequest<DataResponse<Seller | null>>("/seller-profile", { auth: true }),
  createProfile: (input: { displayName: string; bio?: string | null }) =>
    apiRequest<DataResponse<Seller>>("/seller-profile", {
      method: "POST",
      auth: true,
      body: input,
    }),
  updateProfile: (input: SellerProfileInput) =>
    apiRequest<DataResponse<Seller>>("/seller-profile", {
      method: "PATCH",
      auth: true,
      body: input,
    }),
  mapLocation: () =>
    apiRequest<DataResponse<SellerMapLocation | null>>("/seller/map-location", {
      auth: true,
    }),
  updateMapLocation: (input: {
    latitude: number;
    longitude: number;
    label?: string | null;
    visible?: boolean;
  }) =>
    apiRequest<DataResponse<SellerMapLocation>>("/seller/map-location", {
      method: "PUT",
      auth: true,
      body: input,
    }),
  deleteMapLocation: () =>
    apiRequest<void>("/seller/map-location", {
      method: "DELETE",
      auth: true,
    }),
  dashboard: () =>
    apiRequest<DataResponse<SellerDashboard>>("/seller/dashboard", {
      auth: true,
    }),
};
