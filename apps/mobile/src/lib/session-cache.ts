import type { QueryClient } from "@tanstack/react-query";

/** Stop active account reads and remove cached account data on identity change. */
export async function clearAccountCache(client: QueryClient): Promise<void> {
  await client.cancelQueries();
  client.clear();
}
