import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkIosRunnerReadiness } from "./ios-runner-readiness.mjs";

const GIB = 1024 ** 3;
const valid = Object.freeze({
  platform: "darwin",
  arch: "arm64",
  uid: 501,
  operatorApproved: true,
  productionSourcePresent: false,
  productionServicesRunning: false,
  freeDisk: 40 * GIB,
  freeRam: 12 * GIB,
  xcodeVersion: "Xcode 26.4\nBuild version 17F42",
  simulatorSdkReady: true,
  githubActions: true,
  commit: "a".repeat(40),
  approvedCommit: "a".repeat(40),
  ref: "refs/heads/feat/eazicart-ios-qa",
  refType: "branch",
});

test("accepts only an approved dedicated macOS Apple Silicon simulator runner", () => {
  assert.deepEqual(checkIosRunnerReadiness(valid), { ready: true, errors: [] });
});

test("refuses Linux, Intel Mac, root, absent approval, production source and workloads", () => {
  for (const change of [
    { platform: "linux" },
    { arch: "x64" },
    { uid: 0 },
    { uid: undefined },
    { operatorApproved: false },
    { productionSourcePresent: true },
    { productionServicesRunning: true },
  ])
    assert.equal(checkIosRunnerReadiness({ ...valid, ...change }).ready, false);
});

test("refuses low disk, low RAM, missing iOS simulator SDK and tools", () => {
  for (const change of [
    { freeDisk: 19 * GIB },
    { freeDisk: NaN },
    { freeRam: 5 * GIB },
    { freeRam: undefined },
    { simulatorSdkReady: false },
  ])
    assert.equal(checkIosRunnerReadiness({ ...valid, ...change }).ready, false);
});

test("requires Xcode 26.4 or newer for Expo 58", () => {
  for (const version of ["Xcode 16.4", "Xcode 26.3", "", "Xcode unknown"]) {
    assert.equal(
      checkIosRunnerReadiness({ ...valid, xcodeVersion: version }).ready,
      false,
    );
  }
  for (const version of ["Xcode 26.4", "Xcode 26.5", "Xcode 27.0"]) {
    assert.equal(
      checkIosRunnerReadiness({ ...valid, xcodeVersion: version }).ready,
      true,
    );
  }
});

test("rejects unreviewed commits, main, tags and fake branch refs", () => {
  for (const change of [
    { commit: "notsha" },
    { approvedCommit: "b".repeat(40) },
    { approvedCommit: undefined },
    { refType: "tag" },
    { ref: "refs/heads/main" },
    { ref: "refs/tags/feat/release" },
    { ref: "refs/heads/feat/../../main" },
  ])
    assert.equal(checkIosRunnerReadiness({ ...valid, ...change }).ready, false);
});

test("dedicated local macOS runner still requires approval but not GitHub SHA", () => {
  const local = {
    ...valid,
    githubActions: false,
    approvedCommit: undefined,
    commit: undefined,
  };
  assert.equal(checkIosRunnerReadiness(local).ready, true);
  assert.equal(
    checkIosRunnerReadiness({ ...local, operatorApproved: false }).ready,
    false,
  );
});

test("prepared simulator workflow is manual-only with pinned source, no signing, no upload", () => {
  const path = fileURLToPath(
    new URL(
      "../../../.github/workflows/ios-simulator-manual.yml",
      import.meta.url,
    ),
  );
  const workflow = readFileSync(path, "utf8");
  assert.match(workflow, /^\s+workflow_dispatch:/m);
  assert.doesNotMatch(
    workflow,
    /^\s+(push|pull_request|schedule|workflow_run):/m,
  );
  assert.match(workflow, /eazicart-ios-qa/);
  assert.match(workflow, /ios-runner-readiness\.mjs/);
  assert.match(workflow, /EAZICART_IOS_QA_APPROVED_SHA/);
  assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(workflow, /sdk iphonesimulator/);
  assert.match(workflow, /native-build-profile-verify\.mjs development/);
  assert.match(workflow, /android-staging-attestation\.mjs/);
  assert.doesNotMatch(
    workflow,
    /actions\/upload-artifact|eas build|app-store|fastlane/,
  );
});
