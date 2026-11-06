import assert from "node:assert/strict";
import { test } from "node:test";
import { checkAndroidRunnerReadiness } from "./android-runner-readiness.mjs";

const GiB = 1024 ** 3;
const ready = Object.freeze({
  platform: "linux",
  uid: 1001,
  operatorApproved: true,
  productionServicesRunning: false,
  productionSourcePresent: false,
  otherProductionWorkloadsPresent: false,
  freeDisk: 32 * GiB,
  availableRam: 12 * GiB,
  freeSwap: 4 * GiB,
  javaMajor: 21,
  sdkReady: true,
  gradleIsolated: true,
  githubActions: true,
  commit: "a".repeat(40),
  approvedCommit: "a".repeat(40),
  ref: "refs/heads/feat/eazicart-test",
  refType: "branch",
});
test("accepts isolated authorized runner with pinned SHA", () => {
  assert.deepEqual(checkAndroidRunnerReadiness(ready), {
    ready: true,
    errors: [],
  });
});
test("rejects production services, production source, root and missing authorization", () => {
  for (const change of [
    { uid: 0 },
    { operatorApproved: false },
    { productionServicesRunning: true },
    { productionSourcePresent: true },
    { otherProductionWorkloadsPresent: true },
    { platform: "darwin" },
  ])
    assert.equal(
      checkAndroidRunnerReadiness({ ...ready, ...change }).ready,
      false,
    );
});
test("rejects low memory, disk, swap, toolchain or shared Gradle cache", () => {
  for (const change of [
    { freeDisk: 15 * GiB },
    { availableRam: 5 * GiB },
    { freeSwap: GiB },
    { javaMajor: 17 },
    { sdkReady: false },
    { gradleIsolated: false },
    { freeDisk: NaN },
    { availableRam: undefined },
  ])
    assert.equal(
      checkAndroidRunnerReadiness({ ...ready, ...change }).ready,
      false,
    );
});
test("rejects unreviewed SHA, main, tags and forged branch refs", () => {
  for (const change of [
    { approvedCommit: "b".repeat(40) },
    { approvedCommit: "" },
    { commit: "not-a-SHA" },
    { ref: "refs/heads/main" },
    { refType: "tag" },
    { ref: "refs/tags/feat/something" },
  ])
    assert.equal(
      checkAndroidRunnerReadiness({ ...ready, ...change }).ready,
      false,
    );
});
test("local isolated runner needs approval, resources and toolchain but no GitHub SHA", () => {
  const { githubActions, commit, approvedCommit, ...local } = ready;
  assert.equal(
    checkAndroidRunnerReadiness({ ...local, githubActions: false }).ready,
    true,
  );
});
