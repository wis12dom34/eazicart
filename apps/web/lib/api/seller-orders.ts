import { apiRequest } from "./client";
import type {
  DataResponse,
  ListResponse,
  SellerFulfillmentStatus,
  SellerOrder,
} from "./types";

export const sellerOrdersApi = {
  list: () =>
    apiRequest<ListResponse<SellerOrder>>("/seller/orders", { auth: true }),
  get: (id: string) =>
    apiRequest<DataResponse<SellerOrder>>(
      `/seller/orders/${encodeURIComponent(id)}`,
      { auth: true },
    ),
  updateFulfillment: (id: string, status: SellerFulfillmentStatus) =>
    apiRequest<DataResponse<SellerOrder>>(
      `/seller/orders/${encodeURIComponent(id)}/fulfillment`,
      {
        method: "PATCH",
        auth: true,
        body: { status },
      },
    ),
};
