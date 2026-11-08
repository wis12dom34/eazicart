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
