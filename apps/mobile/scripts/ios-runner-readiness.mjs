#!/usr/bin/env node
/**
 * Read-only, fail-closed iOS Simulator QA runner readiness.
 * This file does not install tooling, build, sign or upload anything.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const GIB = 1024 ** 3;
const MIN_XCODE = [26, 4];

function parseXcodeVersion(raw) {
  const match =
    typeof raw === "string" && raw.match(/^Xcode ([0-9]+)\.([0-9]+)/m);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

export function checkIosRunnerReadiness(snapshot) {
  const errors = [];
  if (snapshot.platform !== "darwin" || snapshot.arch !== "arm64")
    errors.push("Use a dedicated Apple Silicon macOS QA runner.");
  if (!Number.isInteger(snapshot.uid) || snapshot.uid === 0)
    errors.push("The macOS QA runner must use an unprivileged account.");
  if (snapshot.operatorApproved !== true)
    errors.push("Explicit isolated iOS QA runner authorization is required.");
  if (snapshot.productionSourcePresent || snapshot.productionServicesRunning)
    errors.push("Production source or services cannot share the iOS runner.");
  if (!Number.isFinite(snapshot.freeDisk) || snapshot.freeDisk < 20 * GIB)
    errors.push("The iOS runner needs at least 20 GiB free disk space.");
  if (!Number.isFinite(snapshot.freeRam) || snapshot.freeRam < 6 * GIB)
    errors.push("The iOS runner needs at least 6 GiB available RAM.");
  const version = parseXcodeVersion(snapshot.xcodeVersion);
  if (
    !version ||
    version[0] < MIN_XCODE[0] ||
    (version[0] === MIN_XCODE[0] && version[1] < MIN_XCODE[1])
  )
    errors.push("Expo SDK 58 requires Xcode 26.4 or newer.");
  if (snapshot.simulatorSdkReady !== true)
    errors.push("An iOS Simulator SDK and xcrun simulator tools are required.");
  if (snapshot.cocoaPodsReady !== true)
    errors.push("CocoaPods must be installed on the dedicated macOS runner.");
  if (snapshot.githubActions) {
    if (
      !/^[0-9a-f]{40}$/i.test(snapshot.commit ?? "") ||
      snapshot.approvedCommit !== snapshot.commit
    )
      errors.push(
        "The source commit must exactly match the approved 40-character SHA.",
      );
    if (
      snapshot.refType !== "branch" ||
      !/^refs\/heads\/feat\/[a-z0-9/_-]+$/i.test(snapshot.ref ?? "")
    )
      errors.push("Only a reviewed feature branch may run iOS QA.");
  }
  return { ready: errors.length === 0, errors };
}

function run(command, args) {
  try {
    const r = spawnSync(command, args, {
      encoding: "utf8",
      timeout: 5000,
      env: process.env,
    });
    return r.status === 0 ? (r.stdout + r.stderr).trim() : "";
  } catch {
    return "";
  }
}

export function inspectIosRunnerEnvironment(env = process.env) {
  let freeDisk = 0;
  try {
    const stats = fs.statfsSync(process.cwd(), { bigint: true });
    freeDisk = Number(stats.bavail * stats.bsize);
  } catch {
    // Fail closed.
  }
  const simulatorSdkReady =
    Boolean(run("xcrun", ["--sdk", "iphonesimulator", "--show-sdk-path"])) &&
    Boolean(run("xcrun", ["--find", "simctl"])) &&
    Boolean(run("xcrun", ["--find", "xcodebuild"]));
  return checkIosRunnerReadiness({
    platform: os.platform(),
    arch: os.arch(),
    uid: process.getuid?.(),
    operatorApproved: env.EAZICART_IOS_QA_ISOLATED_RUNNER === "1",
    productionSourcePresent: fs.existsSync("/opt/eazicart/source"),
    productionServicesRunning: env.EAZICART_IOS_QA_PRODUCTION_WORKLOAD === "1",
    freeDisk,
    freeRam: os.freemem(),
    xcodeVersion: run("xcodebuild", ["-version"]),
    simulatorSdkReady,
    cocoaPodsReady: Boolean(run("pod", ["--version"])),
    githubActions: env.GITHUB_ACTIONS === "true",
    commit: env.GITHUB_SHA,
    approvedCommit: env.EAZICART_IOS_QA_APPROVED_SHA,
    ref: env.GITHUB_REF,
    refType: env.GITHUB_REF_TYPE,
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const report = inspectIosRunnerEnvironment();
  if (!report.ready) {
    report.errors.forEach((msg) => console.error("REFUSED: " + msg));
    process.exitCode = 23;
  } else {
    console.log(
      "PASS: isolated iOS Simulator QA runner is ready; no build started.",
    );
  }
}
