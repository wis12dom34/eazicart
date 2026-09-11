import { apiRequest } from "./client";
import type { DataResponse, User } from "./types";
export const usersApi = {
  me: () => apiRequest<User>("/users/me", { auth: true }),
  update: (name: string) =>
    apiRequest<DataResponse<User>>("/users/me", {
      method: "PATCH",
      auth: true,
      body: { name },
    }),
};
