import { apiRequest } from "./client";
import type { DataResponse, User } from "./types";

export type UpdateProfileInput = {
  name: string;
  username: string;
  bio: string;
};

export const usersApi = {
  me: () => apiRequest<User>("/users/me", { auth: true }),
  update: (input: UpdateProfileInput) =>
    apiRequest<DataResponse<User>>("/users/me", {
      method: "PATCH",
      auth: true,
      body: input,
    }),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiRequest<void>("/users/me/password", {
      method: "POST",
      auth: true,
      body: { currentPassword, newPassword },
    }),
};
