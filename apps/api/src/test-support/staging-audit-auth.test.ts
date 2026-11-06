import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "vitest";
import Fastify from "fastify";
import { AppError } from "../errors.js";
import { createDisposableAuditAuth } from "./staging-audit-auth.js";

const previous = {
  NODE_ENV: process.env.NODE_ENV,
  EAZICART_IDEM_DISPOSABLE: process.env.EAZICART_IDEM_DISPOSABLE,
  EAZICART_KORA_FIXTURE_ONLY: process.env.EAZICART_KORA_FIXTURE_ONLY,
};
beforeEach(() => {
  process.env.NODE_ENV = "test";
  process.env.EAZICART_IDEM_DISPOSABLE = "1";
  process.env.EAZICART_KORA_FIXTURE_ONLY = "1";
});
afterEach(() => {
  for (const [key, value] of Object.entries(previous)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test("disposable-only flags refuse token creation and token verification", () => {
  const signer = createDisposableAuditAuth();
  const token = signer.issueForTest("staging-admin");
  assert.equal(signer.verify(token), "staging-admin");
  process.env.EAZICART_KORA_FIXTURE_ONLY = "0";
  assert.equal(signer.verify(token), null);
  assert.throws(() => createDisposableAuditAuth(), /test-only/);
});

test("random signature is tied to one isolated process; altered tokens never authenticate", () => {
  let now = Date.UTC(2026, 10, 6, 12);
  const auth = createDisposableAuditAuth(() => now);
  const freshInstance = createDisposableAuditAuth(() => now);
  const token = auth.issueForTest("staging-finance-admin");
  assert.equal(auth.verify(token), "staging-finance-admin");
  assert.equal(freshInstance.verify(token), null);
  const [payload, signature] = token.split(".");
  assert.ok(payload && signature);
  assert.equal(
    auth.verify(
      payload +
        "." +
        signature.slice(0, -1) +
        (signature.endsWith("A") ? "B" : "A"),
    ),
    null,
  );
  assert.equal(auth.verify("malformed"), null);
  assert.equal(auth.verify(""), null);
  assert.equal(auth.verify(token + "=="), null);
  now += 121_000;
  assert.equal(auth.verify(token), null);
});

test("no tokens may have excessive TTL or unsafe fixture identities", () => {
  const auth = createDisposableAuditAuth();
  for (const ttl of [0, -1, 301, Number.NaN, 1.5]) {
    assert.throws(() => auth.issueForTest("staging-admin", ttl));
  }
  for (const principal of [
    "",
    "root@example.test",
    "../admin",
    "a",
    "a".repeat(129),
  ]) {
    assert.throws(() => auth.issueForTest(principal));
  }
});

test("signed bearer authentication accepts only valid disposable tokens", async () => {
  const auth = createDisposableAuditAuth();
  const app = Fastify();
  app.decorate("authenticate", (request) => auth.authenticate(request));
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send({ error: { code: error.code } });
    }
    return reply.code(500).send({ error: { code: "UNEXPECTED" } });
  });
  app.get(
    "/audit",
    {
      preHandler: [(request) => auth.authenticate(request)],
    },
    (request) => ({ actor: request.userId }),
  );
  try {
    await app.ready();
    const legit = auth.issueForTest("test-admin");
    const valid = await app.inject({
      method: "GET",
      url: "/audit",
      headers: { authorization: "Bearer " + legit },
    });
    assert.equal(valid.statusCode, 200);
    assert.equal(valid.json<{ actor: string }>().actor, "test-admin");
    for (const invalid of [
      undefined,
      "Bearer test-admin",
      "Bearer " + createDisposableAuditAuth().issueForTest("test-admin"),
      "Basic " + legit,
      "Bearer " + legit + " extra",
    ]) {
      const response = await app.inject({
        method: "GET",
        url: "/audit",
        headers: invalid ? { authorization: invalid } : {},
      });
      assert.equal(response.statusCode, 401);
      assert.equal(
        response.json<{ error: { code: string } }>().error.code,
        "UNAUTHORIZED",
      );
    }
  } finally {
    await app.close();
  }
});
