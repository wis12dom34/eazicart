import { apiRequest } from "./client";
import type { Address, DataResponse, ListResponse } from "./types";
export type AddressInput = Omit<Address, "id" | "isDefault"> & {
  isDefault?: boolean;
};
export const addressesApi = {
  list: () => apiRequest<ListResponse<Address>>("/addresses", { auth: true }),
  create: (body: AddressInput) =>
    apiRequest<DataResponse<Address>>("/addresses", {
      method: "POST",
      auth: true,
      body,
    }),
  update: (id: string, body: Partial<AddressInput>) =>
    apiRequest<DataResponse<Address>>(`/addresses/${encodeURIComponent(id)}`, {
      method: "PATCH",
      auth: true,
      body,
    }),
  remove: (id: string) =>
    apiRequest<void>(`/addresses/${encodeURIComponent(id)}`, {
      method: "DELETE",
      auth: true,
    }),
};
