import { apiRequest } from "./client";
import type { AuthResponse, Tokens } from "./types";
export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    }),
  register: (name: string, email: string, password: string) =>
    apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: { name, email, password },
    }),
  refresh: (refreshToken: string) =>
    apiRequest<{ tokens: Tokens }>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
    }),
};
