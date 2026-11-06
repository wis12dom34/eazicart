#!/usr/bin/env node
/**
 * Read-only, fail-closed Android runner readiness report.
 * This script never provisions a runner, accepts credentials, or builds APKs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const GIB = 1024 ** 3;

export function checkAndroidRunnerReadiness(snapshot) {
  const errors = [];
  if (snapshot.platform !== "linux")
    errors.push("The build runner must be Linux.");
  if (snapshot.uid === 0 || snapshot.uid === undefined)
    errors.push("The build runner must use a dedicated, unprivileged user.");
  if (snapshot.operatorApproved !== true)
    errors.push("Explicit dedicated-runner authorization is required.");
  if (snapshot.productionServicesRunning)
    errors.push(
      "EaziCart production services are running on this host; build refused.",
    );
  if (snapshot.productionSourcePresent)
    errors.push(
      "Production EaziCart source exists on this host; use a separate machine.",
    );
  if (!Number.isFinite(snapshot.freeDisk) || snapshot.freeDisk < 16 * GIB)
    errors.push("At least 16 GiB of free disk is required.");
  if (
    !Number.isFinite(snapshot.availableRam) ||
    snapshot.availableRam < 6 * GIB
  )
    errors.push("At least 6 GiB of available RAM is required.");
  if (!Number.isFinite(snapshot.freeSwap) || snapshot.freeSwap < 2 * GIB)
    errors.push("At least 2 GiB of free swap is required.");
  if (snapshot.javaMajor !== 17)
    errors.push("A separately installed JDK 17 is required for Expo SDK 58.");
  if (!snapshot.sdkReady)
    errors.push(
      "Android SDK API 37 / Build Tools 37 / NDK 27.1.12297006 missing.",
    );
  if (!snapshot.gradleIsolated)
    errors.push(
      "Use a dedicated Gradle cache outside production or system-wide paths.",
    );
  if (snapshot.githubActions) {
    if (
      !/^[a-f0-9]{40}$/i.test(snapshot.commit ?? "") ||
      snapshot.approvedCommit !== snapshot.commit
    ) {
      errors.push(
        "The current GitHub commit must match the exact maintainer-approved SHA.",
      );
    }
    if (
      snapshot.refType !== "branch" ||
      !/^refs\/heads\/feat\/[a-z0-9/_-]+$/i.test(snapshot.ref ?? "")
    )
      errors.push("Only a manually reviewed feature-branch ref is permitted.");
  }
  return { ready: errors.length === 0, errors };
}

function readMemInfo() {
  const text = fs.readFileSync("/proc/meminfo", "utf8");
  const read = (key) => {
    const match = text.match(new RegExp("^" + key + ":\\s+(\\d+) kB$", "m"));
    return match ? Number(match[1]) * 1024 : 0;
  };
  return { availableRam: read("MemAvailable"), freeSwap: read("SwapFree") };
}

function isProductionServiceRunning() {
  for (const name of ["eazicart-api.service", "eazicart-web.service"]) {
    try {
      execFileSync("systemctl", ["is-active", "--quiet", name], {
        stdio: "ignore",
        timeout: 2000,
      });
      return true;
    } catch {
      // Not active, or systemctl unavailable on an ephemeral CI runner.
    }
  }
  return false;
}

/** Verify the actual Android SDK 37 platform layout, not a versioned build-tools folder. */
export function checkAndroidSdkLayout(sdk, java, exists = fs.existsSync) {
  if (!sdk || !java) return false;
  return [
    path.join(sdk, "platforms", "android-37", "android.jar"),
    path.join(sdk, "build-tools", "37.0.0", "apksigner"),
    path.join(sdk, "ndk", "27.1.12297006", "source.properties"),
    path.join(sdk, "platform-tools", "adb"),
    path.join(java, "bin", "java"),
  ].every((file) => exists(file));
}

export function inspectAndroidRunnerEnvironment(env = process.env) {
  const sdk = env.ANDROID_SDK_ROOT ?? "";
  const gradle = env.GRADLE_USER_HOME ?? "";
  const java = env.JAVA_HOME ?? "";
  let freeDisk = 0;
  try {
    const stats = fs.statfsSync(process.cwd(), { bigint: true });
    freeDisk = Number(stats.bavail * stats.bsize);
  } catch {
    freeDisk = 0;
  }
  let javaMajor = 0;
  if (java) {
    const result = spawnSync(path.join(java, "bin", "java"), ["-version"], {
      encoding: "utf8",
      timeout: 5000,
    });
    if (result.status === 0) {
      const major = (result.stdout + result.stderr).match(/version "([0-9]+)/);
      javaMajor = major ? Number(major[1]) : 0;
    }
  }
  let gradleIsolated = false;
  if (gradle) {
    const abs = path.resolve(gradle);
    gradleIsolated =
      abs !== "/root/.gradle" &&
      abs !== "/home/runner/.gradle" &&
      !abs.startsWith("/opt/eazicart/source/") &&
      !abs.startsWith("/root/") &&
      !abs.startsWith("/etc/");
  }
  const sdkReady = checkAndroidSdkLayout(sdk, java);
  return checkAndroidRunnerReadiness({
    platform: os.platform(),
    uid: process.getuid?.(),
    operatorApproved: env.EAZICART_ANDROID_QA_ISOLATED_RUNNER === "1",
    productionServicesRunning: isProductionServiceRunning(),
    productionSourcePresent: fs.existsSync("/opt/eazicart/source"),
    freeDisk,
    ...readMemInfo(),
    javaMajor,
    sdkReady,
    gradleIsolated,
    githubActions: env.GITHUB_ACTIONS === "true",
    commit: env.GITHUB_SHA,
    approvedCommit: env.EAZICART_ANDROID_QA_APPROVED_SHA,
    ref: env.GITHUB_REF,
    refType: env.GITHUB_REF_TYPE,
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const result = inspectAndroidRunnerEnvironment();
  if (!result.ready) {
    for (const reason of result.errors) console.error("REFUSED: " + reason);
    process.exitCode = 23;
  } else {
    console.log(
      "PASS: isolated Android runner meets resource, SDK and approval gates.",
    );
  }
}
