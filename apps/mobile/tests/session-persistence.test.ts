import assert from "node:assert/strict";
import { test } from "node:test";
import { createSessionPersistence } from "../src/lib/session-persistence";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

function fixture() {
  let saved: string | null = "previous-refresh";
  let access: string | null = "previous-access";
  const store = {
    async getItemAsync() { return saved; },
    async setItemAsync(_key: string, value: string) { saved = value; },
    async deleteItemAsync() { saved = null; },
  };
  const session = createSessionPersistence("session-token", store, (value) => { access = value; });
  return { session, get saved() { return saved; }, get access() { return access; } };
}

test("restoring a current session updates refresh and access tokens", async () => {
  const f = fixture();
  const stamp = f.session.current();
  assert.equal(await f.session.read(stamp), "previous-refresh");
  assert.equal(await f.session.persist(stamp, { accessToken: "new-access", refreshToken: "new-refresh" }), true);
  assert.equal(f.saved, "new-refresh");
  assert.equal(f.access, "new-access");
});

test("logout invalidates a delayed refresh response before it can restore credentials", async () => {
  const f = fixture();
  const stamp = f.session.current();
  await f.session.clear();
  assert.equal(await f.session.persist(stamp, { accessToken: "stale-access", refreshToken: "stale-refresh" }), false);
  assert.equal(f.saved, null);
  assert.equal(f.access, null);
});

test("logout deletes credentials even when a storage write was already pending", async () => {
  let saved: string | null = "old";
  let access: string | null = "old";
  const gate = deferred();
  const started = deferred();
  const store = {
    async getItemAsync() { return saved; },
    async setItemAsync(_key: string, value: string) { started.resolve(); await gate.promise; saved = value; },
    async deleteItemAsync() { saved = null; },
  };
  const session = createSessionPersistence("session-token", store, (token) => { access = token; });
  const stamp = session.current();
  const write = session.persist(stamp, { accessToken: "stale-access", refreshToken: "stale-refresh" });
  await started.promise;
  const logout = session.clear();
  assert.equal(access, null);
  gate.resolve();
  assert.equal(await write, false);
  assert.equal(await logout, "stale-refresh");
  assert.equal(saved, null);
  assert.equal(access, null);
});

test("a new login after logout succeeds while an older one is ignored", async () => {
  const f = fixture();
  const older = f.session.current();
  const logout = f.session.clear();
  const newer = f.session.current();
  const login = f.session.persist(newer, { accessToken: "fresh-access", refreshToken: "fresh-refresh" });
  await logout;
  assert.equal(await login, true);
  assert.equal(await f.session.persist(older, { accessToken: "old-access", refreshToken: "old-refresh" }), false);
  assert.equal(f.saved, "fresh-refresh");
  assert.equal(f.access, "fresh-access");
});

test("outdated 401 does not clear newer login", async () => {
  const f = fixture();
  const older = f.session.current();
  await f.session.clear();
  await f.session.persist(f.session.current(), { accessToken: "fresh-access", refreshToken: "fresh-refresh" });
  assert.equal(await f.session.clearIfCurrent(older), false);
  assert.equal(f.saved, "fresh-refresh");
  assert.equal(f.access, "fresh-access");
});

test("current 401 clears stored and in-memory credentials", async () => {
  const f = fixture();
  assert.equal(await f.session.clearIfCurrent(f.session.current()), true);
  assert.equal(f.saved, null);
  assert.equal(f.access, null);
});

test("reads finishing after logout cannot return a stale token", async () => {
  let saved: string | null = "old";
  const gate = deferred();
  const started = deferred();
  const store = {
    async getItemAsync() { started.resolve(); await gate.promise; return saved; },
    async setItemAsync(_key: string, token: string) { saved = token; },
    async deleteItemAsync() { saved = null; },
  };
  const session = createSessionPersistence("session-token", store, () => {});
  const read = session.read(session.current());
  await started.promise;
  const logout = session.clear();
  gate.resolve();
  assert.equal(await read, null);
  await logout;
  assert.equal(saved, null);
});

test("a secure-store write failure does not block the logout queue", async () => {
  let saved: string | null = "old";
  const store = {
    async getItemAsync() { return saved; },
    async setItemAsync() { throw Error("write failed"); },
    async deleteItemAsync() { saved = null; },
  };
  const session = createSessionPersistence("session-token", store, () => {});
  await assert.rejects(session.persist(session.current(), { accessToken: "a", refreshToken: "b" }));
  await session.clear();
  assert.equal(saved, null);
});
