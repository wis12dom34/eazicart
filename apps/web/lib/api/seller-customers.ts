import { apiRequest } from "./client";
import type {
  DataResponse,
  ListResponse,
  SellerCustomer,
  SellerCustomerDetail,
} from "./types";

export const sellerCustomersApi = {
  list: () =>
    apiRequest<ListResponse<SellerCustomer>>("/seller/customers", {
      auth: true,
    }),
  get: (id: string) =>
    apiRequest<DataResponse<SellerCustomerDetail>>(
      `/seller/customers/${encodeURIComponent(id)}`,
      { auth: true },
    ),
};
