import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ADMIN_AUDIT_PATH,
  AuditPreviewError,
  makeAuditPreviewClient,
  verifiedAuditPreviewBase,
} from "../src/lib/admin-audit-preview";
import { setAccessToken } from "../src/lib/api";

const staging = "https://finance-staging.test/api";
const token = "separate-fixture-admin-token";
const success = (data: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ data }), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });

test("staging audit URL is disabled in production and without explicit configuration", () => {
  assert.equal(verifiedAuditPreviewBase(staging, false), null);
  assert.equal(verifiedAuditPreviewBase(undefined, true), null);
  assert.equal(verifiedAuditPreviewBase(staging, true), staging);
  assert.equal(
    verifiedAuditPreviewBase("http://localhost:3000/api", true),
    "http://localhost:3000/api",
  );
  assert.equal(
    verifiedAuditPreviewBase("http://10.0.2.2:3000/api", true),
    "http://10.0.2.2:3000/api",
  );
});

test("rejects production and provider domains, credentials, insecure transport and spoofed staging hosts", () => {
  for (const unsafe of [
    "https://eazicart.com/api",
    "https://www.eazicart.com/api",
    "https://staging.eazicart.com/api",
    "https://eazicart.com.evil.test/api",
    "https://api.korapay.com/api",
    "http://finance-staging.test/api",
    "https://finance-staging.test/api?token=secret",
    "https://user:password@finance-staging.test/api",
    "javascript:alert(1)",
    "https://finance-staging.test/api#frag",
    "https://finance-staging.test/checkout",
    "https://evil.test/malicious/api?key=foo",
  ])
    assert.equal(verifiedAuditPreviewBase(unsafe, true), null, unsafe);
});

test("requires a separate staging token and never makes a network call without one", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls++;
    return success({});
  };
  assert.throws(
    () => makeAuditPreviewClient(staging, "", fetcher),
    (error: unknown) =>
      error instanceof AuditPreviewError && error.status === 401,
  );
  assert.throws(() =>
    makeAuditPreviewClient("https://eazicart.com/api", token, fetcher),
  );
  assert.equal(calls, 0);
});

test("GET-only preview calls use explicit staging bearer token, never the production auth token", async () => {
  setAccessToken("PRODUCTION-SESSION-MUST-NOT-BE-USED");
  const paths: string[] = [];
  const fetcher: typeof fetch = async (input, options) => {
    const url = new URL(String(input));
    paths.push(url.pathname);
    assert.equal(url.origin, "https://finance-staging.test");
    assert.equal(options?.method, "GET");
    assert.equal(options?.cache, "no-store");
    assert.equal(options?.redirect, "error");
    assert.equal(
      new Headers(options?.headers).get("Authorization"),
      "Bearer " + token,
    );
    assert.equal(options?.body, undefined);
    if (url.pathname.endsWith("/report")) {
      return success({
        generatedAt: "2026-11-06T00:00:00.000Z",
        uncertainTotal: 1,
        counts: { INITIATING: 0, UNKNOWN: 1 },
        action: "MANUAL_REVIEW_REQUIRED",
        automaticReinitializationAllowed: false,
        automaticSettlementAllowed: false,
      });
    }
    if (url.pathname.endsWith("/probe")) {
      return success({
        paymentId: "p-1",
        providerCheck: "UNVERIFIED",
        action: "MANUAL_REVIEW_REQUIRED",
      });
    }
    return success([{ paymentId: "p-1", state: "UNKNOWN" }]);
  };
  const client = makeAuditPreviewClient(staging, token, fetcher);
  assert.equal((await client.report()).uncertainTotal, 1);
  assert.equal((await client.list("UNKNOWN"))[0]?.paymentId, "p-1");
  assert.equal((await client.probe("p-1")).providerCheck, "UNVERIFIED");
  assert.deepEqual(paths, [
    "/api" + ADMIN_AUDIT_PATH + "/report",
    "/api" + ADMIN_AUDIT_PATH,
    "/api" + ADMIN_AUDIT_PATH + "/p-1/probe",
  ]);
  setAccessToken(null);
});

test("server-side auth failures block staging access and never leak server-provided secrets", async () => {
  const denied = makeAuditPreviewClient(
    staging,
    token,
    async () =>
      new Response(JSON.stringify({ error: { message: "secret" } }), {
        status: 403,
      }),
  );
  await assert.rejects(
    denied.report(),
    (error: unknown) =>
      error instanceof AuditPreviewError &&
      error.status === 403 &&
      !error.message.includes("secret"),
  );
  const expired = makeAuditPreviewClient(
    staging,
    token,
    async () => new Response("", { status: 401 }),
  );
  await assert.rejects(
    expired.list(),
    (error: unknown) =>
      error instanceof AuditPreviewError && error.status === 401,
  );
});

test("payment ID validation stops path injection before any request", async () => {
  let called = false;
  const client = makeAuditPreviewClient(staging, token, async () => {
    called = true;
    return success({});
  });
  for (const id of [
    "",
    "../../payments",
    "p-1?method=POST",
    "p/1",
    "a".repeat(200),
  ]) {
    await assert.rejects(client.probe(id), AuditPreviewError);
  }
  assert.equal(called, false);
});

test("CSV export pages remain bounded, GET-only, and accept only a validated server cursor", async () => {
  const calls: string[] = [];
  const client = makeAuditPreviewClient(
    staging,
    token,
    async (input, options) => {
      const url = new URL(String(input));
      calls.push(url.toString());
      assert.equal(options?.method, "GET");
      return new Response('paymentId,orderId\r\n"p-1","o-1"\r\n', {
        status: 200,
        headers: {
          "content-type": "text/csv",
          "X-Export-Has-More": "true",
          "X-Export-Next-Cursor": "cGFnZS0y",
        },
      });
    },
  );
  const first = await client.csvPage("UNKNOWN");
  assert.equal(first.hasMore, true);
  assert.equal(first.nextCursor, "cGFnZS0y");
  await client.csvPage("UNKNOWN", first.nextCursor ?? undefined);
  assert.equal(calls.length, 2);
  assert.ok(calls[0]?.includes("state=UNKNOWN"));
  assert.ok(calls[1]?.includes("cursor=cGFnZS0y"));
  await assert.rejects(client.csvPage(undefined, "!!!"), AuditPreviewError);
  assert.equal(calls.length, 2);
});

test("a forged oversized or invalid CSV pagination response fails closed", async () => {
  const bogusCursor = makeAuditPreviewClient(
    staging,
    token,
    async () =>
      new Response("text", {
        status: 200,
        headers: { "X-Export-Has-More": "true", "X-Export-Next-Cursor": "!!" },
      }),
  );
  await assert.rejects(bogusCursor.csvPage(), AuditPreviewError);
  const oversized = makeAuditPreviewClient(
    staging,
    token,
    async () => new Response("A".repeat(512001), { status: 200 }),
  );
  await assert.rejects(oversized.csvPage(), AuditPreviewError);
});

test("rejects a fetch implementation that redirects to a different origin", async () => {
  const client = makeAuditPreviewClient(staging, token, async () => {
    const response = success({ data: [] });
    Object.defineProperty(response, "url", {
      value: "https://other-staging.test/api",
    });
    return response;
  });
  await assert.rejects(
    client.list(),
    (error: unknown) =>
      error instanceof AuditPreviewError &&
      error.message === "Unexpected staging redirect.",
  );
});

test("validates disposable staging bearer tokens before opening the native screen", async () => {
  const { isValidAuditStagingToken } =
    await import("../src/lib/admin-audit-preview");
  assert.equal(
    isValidAuditStagingToken("  temporary-staging-admin-token  "),
    true,
  );
  assert.equal(isValidAuditStagingToken("short"), false);
  assert.equal(isValidAuditStagingToken("token with whitespace"), false);
  assert.equal(isValidAuditStagingToken("A".repeat(4097)), false);
  assert.equal(isValidAuditStagingToken("A".repeat(4096)), true);
});

test("stalled staging HTTP times out without creating a payment or hanging the UI", async () => {
  let method: string | undefined;
  let requestSignal: AbortSignal | undefined;
  const client = makeAuditPreviewClient(
    staging,
    token,
    async (_input, options) => {
      method = options?.method;
      requestSignal = options?.signal ?? undefined;
      return await new Promise<Response>(() => undefined);
    },
    35,
  );
  await assert.rejects(
    client.report(),
    (e: unknown) =>
      e instanceof AuditPreviewError &&
      e.status === 408 &&
      !e.message.includes(token),
  );
  assert.equal(method, "GET");
  assert.equal(requestSignal?.aborted, true);
});

test("user cancellation stops a pending staging fetch without leaking credentials", async () => {
  const controller = new AbortController();
  const client = makeAuditPreviewClient(
    staging,
    token,
    async () => await new Promise<Response>(() => undefined),
    5_000,
  );
  const result = client.list(undefined, controller.signal);
  controller.abort();
  await assert.rejects(
    result,
    (e: unknown) => e instanceof AuditPreviewError && e.status === 499,
  );
});

test("already cancelled audit requests never invoke a network fetch", async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  const client = makeAuditPreviewClient(staging, token, async () => {
    calls++;
    return success({});
  });
  await assert.rejects(
    client.report(controller.signal),
    (e: unknown) => e instanceof AuditPreviewError && e.status === 499,
  );
  assert.equal(calls, 0);
});

test("network failures expose only a generic staging error, never raw secrets", async () => {
  const client = makeAuditPreviewClient(staging, token, async () => {
    throw new Error("private network token " + token);
  });
  await assert.rejects(
    client.report(),
    (e: unknown) =>
      e instanceof AuditPreviewError &&
      e.status === 503 &&
      !e.message.includes(token),
  );
});

test("CSV paging never skips a dismissed share sheet or loops after the final page", async () => {
  const { afterAuditCsvShare } = await import("../src/lib/admin-audit-preview");
  assert.deepEqual(afterAuditCsvShare(false, true, "next-page"), {
    advance: false,
    exhausted: false,
    nextCursor: null,
  });
  assert.deepEqual(afterAuditCsvShare(true, true, "next-page"), {
    advance: true,
    exhausted: false,
    nextCursor: "next-page",
  });
  assert.deepEqual(afterAuditCsvShare(true, false, null), {
    advance: true,
    exhausted: true,
    nextCursor: null,
  });
});
