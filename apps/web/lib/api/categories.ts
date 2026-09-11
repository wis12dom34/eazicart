import { apiRequest } from "./client";
import type { Category, ListResponse } from "./types";
export const categoriesApi = {
  list: () => apiRequest<ListResponse<Category>>("/categories"),
};
