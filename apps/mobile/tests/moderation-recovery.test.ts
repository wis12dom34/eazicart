import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/lib/api";
import {
  moderationFailure,
  moderationQueueFailure,
} from "../src/lib/moderation-recovery";

test("concurrent moderation conflicts demand a fresh server read", () => {
  const failure = moderationFailure(
    new ApiError(409, "REPORT_STATUS_CONFLICT", "Stale"),
  );
  assert.equal(failure.refresh, true);
  assert.match(failure.message, /Refresh/);
});

test("network and timeout errors never claim a moderation action failed or succeeded", () => {
  for (const code of ["NETWORK_ERROR", "TIMEOUT"]) {
    const failure = moderationFailure(new ApiError(0, code, "Network issue"));
    assert.equal(failure.refresh, true);
    assert.match(failure.message, /may have saved/);
  }
});

test("authorization failure is distinct from connectivity failure", () => {
  const denied = moderationFailure(
    new ApiError(403, "ADMIN_ONLY", "Forbidden"),
  );
  assert.equal(denied.title, "Access denied");
  assert.equal(denied.refresh, false);
  assert.match(
    moderationQueueFailure(new ApiError(403, "ADMIN_ONLY", "Forbidden")),
    /Administrator/,
  );
  assert.match(
    moderationQueueFailure(new ApiError(0, "NETWORK_ERROR", "Offline")),
    /connection/,
  );
});

test("invalid queue cursor requires a fresh list", () => {
  assert.match(
    moderationQueueFailure(new ApiError(400, "INVALID_CURSOR", "Stale")),
    /Refresh/,
  );
});
