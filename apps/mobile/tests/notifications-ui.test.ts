import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterNotifications,
  notificationEmptyTitle,
  notificationTime,
} from "../src/lib/notifications";
import type { Notification } from "../src/lib/types";

const notices: Notification[] = [
  {
    id: "1",
    type: "ORDER",
    title: "Order",
    body: "Update",
    createdAt: "2026-11-08T11:00:00Z",
  },
  {
    id: "2",
    type: "SOCIAL",
    title: "Social",
    body: "Update",
    createdAt: "2026-11-08T11:00:00Z",
  },
  {
    id: "3",
    type: "SYSTEM",
    title: "System",
    body: "Update",
    createdAt: "2026-11-08T11:00:00Z",
  },
  {
    id: "4",
    title: "Uncategorized",
    body: "Update",
    createdAt: "2026-11-08T11:00:00Z",
  },
];

test("all filter includes unknown types, categories show only matching type", () => {
  assert.equal(filterNotifications(notices, "ALL").length, 4);
  assert.deepEqual(
    filterNotifications(notices, "ORDER").map((n) => n.id),
    ["1"],
  );
  assert.deepEqual(
    filterNotifications(notices, "SOCIAL").map((n) => n.id),
    ["2"],
  );
  assert.deepEqual(
    filterNotifications(notices, "SYSTEM").map((n) => n.id),
    ["3"],
  );
});

test("empty-state copy uses the same order/social/updates categories as web", () => {
  assert.equal(notificationEmptyTitle("ORDER"), "No order notifications");
  assert.equal(notificationEmptyTitle("SOCIAL"), "No social notifications");
  assert.equal(notificationEmptyTitle("SYSTEM"), "No update notifications");
});

test("time formatting handles recent, older and malformed timestamps", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  assert.equal(notificationTime("2026-11-08T11:59:59Z", now), "Now");
  assert.equal(notificationTime("2026-11-08T11:58:00Z", now), "2m");
  assert.equal(notificationTime("2026-11-08T10:00:00Z", now), "2h");
  assert.equal(notificationTime("invalid-time", now), "");
});
