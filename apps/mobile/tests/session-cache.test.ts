import assert from "node:assert/strict";
import { test } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { clearAccountCache } from "../src/lib/session-cache";

test("clearing a session removes cached notifications, conversations and moderation access", async () => {
  const client = new QueryClient();
  client.setQueryData(["notifications", "account-a"], {
    data: [{ id: "private-notification" }],
  });
  client.setQueryData(["conversations", "account-a"], {
    data: [{ id: "private-chat" }],
  });
  client.setQueryData(["admin-chat-reports-access", "account-a"], {
    data: { allowed: true },
  });
  await clearAccountCache(client);
  assert.equal(client.getQueryCache().getAll().length, 0);
  assert.equal(
    client.getQueryData(["admin-chat-reports-access", "account-a"]),
    undefined,
  );
});

test("clearing an account aborts in-flight private queries and drops their cache entries", async () => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  let started!: () => void;
  const queryStarted = new Promise<void>((resolve) => {
    started = resolve;
  });
  let observedAbort = false;
  const pending = client.fetchQuery({
    queryKey: ["private-messages", "account-a"],
    queryFn: ({ signal }) =>
      new Promise<string>((_resolve, reject) => {
        signal.addEventListener(
          "abort",
          () => {
            observedAbort = true;
            reject(new Error("Cancelled private read"));
          },
          { once: true },
        );
        started();
      }),
  });
  // Attach a rejection handler before clearing the cache.
  const outcome = pending.then(
    () => "resolved",
    () => "rejected",
  );
  await queryStarted;
  await clearAccountCache(client);
  assert.equal(await outcome, "rejected");
  assert.equal(observedAbort, true);
  assert.equal(client.getQueryCache().getAll().length, 0);
});

test("account B can cache fresh results without seeing account A data", async () => {
  const client = new QueryClient();
  client.setQueryData(["cart", "account-a"], { account: "a", private: true });
  await clearAccountCache(client);
  client.setQueryData(["cart", "account-b"], { account: "b" });
  assert.equal(client.getQueryData(["cart", "account-a"]), undefined);
  assert.deepEqual(client.getQueryData(["cart", "account-b"]), {
    account: "b",
  });
});
