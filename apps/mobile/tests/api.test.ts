import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  api,
  ApiError,
  request,
  setAccessToken,
  setRefreshHandler,
} from "../src/lib/api";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  setAccessToken(null);
  setRefreshHandler(null);
});
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("loads cursor-paginated real API contract without any authorization header", async () => {
  const requests: Array<{ url: string; headers: Headers }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), headers: new Headers(init?.headers) });
    return json({ data: [], pagination: { hasMore: false, nextCursor: null } });
  };
  const result = await api.feed("cursor-page-2", false);
  assert.deepEqual(result.data, []);
  assert.ok(
    requests[0]?.url.includes(
      "/api/feed/products?limit=18&cursor=cursor-page-2",
    ),
  );
  assert.equal(requests[0]?.headers.has("Authorization"), false);
});

test("uses the existing EaziCart login contract", async () => {
  let body: unknown;
  globalThis.fetch = async (_input, init) => {
    assert.equal(init?.method, "POST");
    body = JSON.parse(String(init?.body));
    return json({
      user: { id: "user1", name: "Test", email: "test@example.com" },
      tokens: {
        accessToken: "token",
        refreshToken: "refresh",
        expiresAt: "2099-01-01",
      },
    });
  };
  const response = await api.login("test@example.com", "password123");
  assert.deepEqual(body, {
    email: "test@example.com",
    password: "password123",
  });
  assert.equal(response.user.id, "user1");
});

test("does not issue a protected Like when signed out", async () => {
  let called = false;
  globalThis.fetch = async () => {
    called = true;
    return json({});
  };
  await assert.rejects(
    api.like("product1"),
    (e: unknown) =>
      e instanceof ApiError && e.status === 401 && e.code === "LOGIN_REQUIRED",
  );
  assert.equal(called, false);
});

test("refreshes the bearer token once and retries a protected request", async () => {
  const headers: string[] = [];
  setAccessToken("expired");
  setRefreshHandler(async () => {
    setAccessToken("renewed", { refresh: true });
    return true;
  });
  globalThis.fetch = async (_input, init) => {
    const token = new Headers(init?.headers).get("Authorization");
    headers.push(String(token));
    return token === "Bearer expired"
      ? json({ error: { code: "UNAUTHORIZED", message: "Expired" } }, 401)
      : json({ data: { likes: 1, comments: 0, liked: true } });
  };
  const result = await api.like("product1");
  assert.deepEqual(headers, ["Bearer expired", "Bearer renewed"]);
  assert.equal(result.data.liked, true);
});

test("displays upstream validation errors without leaking secret data", async () => {
  globalThis.fetch = async () =>
    json(
      {
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Incorrect credentials",
        },
      },
      401,
    );
  await assert.rejects(
    api.login("test@example.com", "badpass"),
    (e: unknown) =>
      e instanceof ApiError &&
      e.code === "INVALID_CREDENTIALS" &&
      e.message === "Incorrect credentials",
  );
});

test("a late authenticated success cannot deliver previous account data", async () => {
  let resolveFetch!: (value: Response) => void;
  setAccessToken("account-a");
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  const pending = api.cart();
  setAccessToken(null);
  setAccessToken("account-b");
  resolveFetch(json({ data: { id: "private-account-a" } }));
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof ApiError && e.code === "SESSION_CHANGED",
  );
});

test("a late unauthorized response cannot refresh or retry under a different account", async () => {
  let resolveFetch!: (value: Response) => void;
  let refreshed = 0;
  let fetched = 0;
  setAccessToken("account-a");
  setRefreshHandler(async () => {
    refreshed += 1;
    setAccessToken("unrelated-token", { refresh: true });
    return true;
  });
  globalThis.fetch = () => {
    fetched += 1;
    return new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  };
  const pending = api.cart();
  setAccessToken(null);
  setAccessToken("account-b");
  resolveFetch(json({ error: { code: "UNAUTHORIZED" } }, 401));
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof ApiError && e.code === "SESSION_CHANGED",
  );
  assert.equal(refreshed, 0);
  assert.equal(fetched, 1);
});

test("sign-out while refresh is pending prevents a 401 replay", async () => {
  let releaseRefresh!: () => void;
  let refreshStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    refreshStarted = resolve;
  });
  const holdRefresh = new Promise<boolean>((resolve) => {
    releaseRefresh = () => resolve(true);
  });
  setAccessToken("account-a");
  setRefreshHandler(async () => {
    refreshStarted();
    return holdRefresh;
  });
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    return json({ error: { code: "UNAUTHORIZED" } }, 401);
  };
  const pending = api.cart();
  await started;
  setAccessToken(null);
  setAccessToken("account-b");
  releaseRefresh();
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof ApiError && e.code === "SESSION_CHANGED",
  );
  assert.equal(requests, 1);
});

test("optional anonymous 401 never invokes another account's refresh handler", async () => {
  let refreshes = 0;
  setRefreshHandler(async () => {
    refreshes += 1;
    return true;
  });
  globalThis.fetch = async () => json({ error: { code: "UNAUTHORIZED" } }, 401);
  await assert.rejects(
    api.feed(),
    (e: unknown) => e instanceof ApiError && e.status === 401,
  );
  assert.equal(refreshes, 0);
});

test("explicit new account token invalidates previous request without a null transition", async () => {
  let resolveFetch!: (value: Response) => void;
  setAccessToken("account-a");
  globalThis.fetch = () =>
    new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
  const pending = api.cart();
  setAccessToken("account-b");
  resolveFetch(json({ data: { id: "private-account-a" } }));
  await assert.rejects(
    pending,
    (e: unknown) => e instanceof ApiError && e.code === "SESSION_CHANGED",
  );
});

test("external abort remains connected until a slow JSON body stops streaming", async () => {
  const caller = new AbortController();
  setAccessToken("account-a");
  let bodyController!: ReadableStreamDefaultController<Uint8Array>;
  let internalSignal!: AbortSignal;
  let internalAbortObserved = false;
  globalThis.fetch = async (_input, init) => {
    internalSignal = init?.signal as AbortSignal;
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          bodyController = controller;
          controller.enqueue(new TextEncoder().encode('{"data":'));
          internalSignal.addEventListener(
            "abort",
            () => {
              internalAbortObserved = true;
              controller.error(
                new DOMException("Stream aborted", "AbortError"),
              );
            },
            { once: true },
          );
        },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const pending = request<unknown>("/cart", {
    auth: "required",
    signal: caller.signal,
  });
  // Give the fetch continuation time to start reading the response body.
  await new Promise<void>((resolve) => setImmediate(resolve));
  caller.abort();
  const outcome = await Promise.race([
    pending.then(
      () => "resolved",
      (error: unknown) =>
        error instanceof Error ? error.name : "unknown-error",
    ),
    new Promise<string>((resolve) => setTimeout(() => resolve("hung"), 180)),
  ]);
  if (outcome === "hung") {
    // Ensure an unpatched implementation does not leave a hanging stream.
    bodyController.error(new Error("Test cleanup: unread body"));
  }
  assert.equal(internalAbortObserved, true);
  assert.equal(outcome, "AbortError");
});

test("a stale network error after logout reports a changed session", async () => {
  let rejectFetch!: (reason?: unknown) => void;
  setAccessToken("account-a");
  globalThis.fetch = () =>
    new Promise<Response>((_resolve, reject) => {
      rejectFetch = reject;
    });
  const pending = request<unknown>("/cart", { auth: "required" });
  setAccessToken(null);
  setAccessToken("account-b");
  rejectFetch(new TypeError("Network offline"));
  await assert.rejects(
    pending,
    (error: unknown) =>
      error instanceof ApiError && error.code === "SESSION_CHANGED",
  );
});
