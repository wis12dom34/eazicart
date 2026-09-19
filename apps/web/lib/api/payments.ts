import { apiRequest } from "./client";
import type { DataResponse, Payment } from "./types";

export const paymentsApi = {
  initialize: (orderId: string) =>
    apiRequest<DataResponse<Payment>>("/payments/initialize", {
      method: "POST",
      auth: true,
      body: { orderId },
    }),
  forOrder: (orderId: string) =>
    apiRequest<DataResponse<Payment | null>>(
      `/payments/order/${encodeURIComponent(orderId)}`,
      { auth: true },
    ),
  verify: (reference: string) =>
    apiRequest<DataResponse<Payment>>(
      `/payments/${encodeURIComponent(reference)}/verify`,
      { auth: true },
    ),
};
