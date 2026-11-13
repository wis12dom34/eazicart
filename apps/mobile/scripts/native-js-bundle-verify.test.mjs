import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { verifyNativeJsExport } from "./native-js-bundle-verify.mjs";

function fixture(platform = "android") {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "eazicart-export-verify-"),
  );
  const entry = "_expo/static/js/" + platform + "/entry-abc123.hbc";
  const asset = "assets/abcdef123";
  fs.mkdirSync(path.join(root, "_expo/static/js", platform), {
    recursive: true,
  });
  fs.mkdirSync(path.join(root, "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, entry), Buffer.alloc(60_000, 1));
  fs.writeFileSync(path.join(root, asset), Buffer.from([1, 2, 3]));
  const metadata = {
    version: 0,
    bundler: "metro",
    fileMetadata: {
      [platform]: { bundle: entry, assets: [{ path: asset, ext: "png" }] },
    },
  };
  function save() {
    fs.writeFileSync(
      path.join(root, "metadata.json"),
      JSON.stringify(metadata),
    );
  }
  save();
  return {
    root,
    entry,
    asset,
    metadata,
    save,
    remove: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

test("accepts complete Android and iOS Hermes bundles with assets", (t) => {
  for (const platform of ["android", "ios"]) {
    const f = fixture(platform);
    t.after(f.remove);
    assert.deepEqual(verifyNativeJsExport(f.root, platform), {
      ok: true,
      errors: [],
    });
  }
});

test("rejects missing metadata and unexpected platform metadata", (t) => {
  const f = fixture();
  t.after(f.remove);
  assert.equal(verifyNativeJsExport(f.root, "ios").ok, false);
  fs.rmSync(path.join(f.root, "metadata.json"));
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
  f.save();
  f.metadata.fileMetadata.ios = f.metadata.fileMetadata.android;
  f.save();
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
});

test("rejects missing, tiny, incorrect-platform or traversing bytecode entries", (t) => {
  const f = fixture();
  t.after(f.remove);
  fs.writeFileSync(path.join(f.root, f.entry), Buffer.alloc(1));
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
  fs.writeFileSync(path.join(f.root, f.entry), Buffer.alloc(60_000, 1));
  for (const file of [
    "../entry.hbc",
    "_expo/static/js/ios/entry-abc123.hbc",
    "file://entry.hbc",
  ]) {
    f.metadata.fileMetadata.android.bundle = file;
    f.save();
    assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
  }
  f.metadata.fileMetadata.android.bundle = f.entry;
  f.save();
  fs.rmSync(path.join(f.root, f.entry));
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
});

test("rejects missing, empty, duplicate and unsafe referenced assets", (t) => {
  const f = fixture();
  t.after(f.remove);
  fs.rmSync(path.join(f.root, f.asset));
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
  fs.writeFileSync(path.join(f.root, f.asset), Buffer.from([1]));
  f.metadata.fileMetadata.android.assets.push({ path: f.asset, ext: "png" });
  f.save();
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
  f.metadata.fileMetadata.android.assets = [{ path: "../file", ext: "png" }];
  f.save();
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
});

test("rejects malformed metadata and unknown platform", (t) => {
  const f = fixture();
  t.after(f.remove);
  assert.equal(verifyNativeJsExport(f.root, "web").ok, false);
  f.metadata.bundler = "unknown";
  f.save();
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
  f.metadata.fileMetadata.android.assets = [];
  f.save();
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
});

test("read-only CLI succeeds on complete exports and exits 23 on a missing bundle", (t) => {
  const f = fixture("ios");
  t.after(f.remove);
  const script = fileURLToPath(
    new URL("./native-js-bundle-verify.mjs", import.meta.url),
  );
  const ok = spawnSync(process.execPath, [script, "ios", f.root], {
    encoding: "utf8",
  });
  assert.equal(ok.status, 0, ok.stderr);
  const bad = spawnSync(process.execPath, [script, "android", f.root], {
    encoding: "utf8",
  });
  assert.equal(bad.status, 23);
  assert.match(bad.stderr, /REFUSED/);
});

test("rejects assets that escape the export through a symbolic-link directory", (t) => {
  const f = fixture();
  const external = fs.mkdtempSync(
    path.join(os.tmpdir(), "eazicart-export-external-"),
  );
  t.after(f.remove);
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  const externalAsset = path.join(external, "abcdef123");
  fs.writeFileSync(externalAsset, Buffer.from([1, 2, 3]));
  fs.rmSync(path.join(f.root, "assets"), { recursive: true, force: true });
  fs.symlinkSync(external, path.join(f.root, "assets"));
  assert.equal(verifyNativeJsExport(f.root, "android").ok, false);
});

test("both manual native QA workflows verify Hermes exports before generating native projects", () => {
  for (const [workflowName, platform] of [
    ["android-debug-manual.yml", "android"],
    ["ios-simulator-manual.yml", "ios"],
  ]) {
    const workflowPath = fileURLToPath(
      new URL("../../../.github/workflows/" + workflowName, import.meta.url),
    );
    const workflow = fs.readFileSync(workflowPath, "utf8");
    const exportCommand = "expo export --platform " + platform;
    const verifyCommand = "native-js-bundle-verify.mjs " + platform;
    const prebuildCommand = "expo prebuild --platform " + platform;
    const exportAt = workflow.indexOf(exportCommand);
    const verifyAt = workflow.indexOf(verifyCommand);
    const prebuildAt = workflow.indexOf(prebuildCommand);
    assert.ok(exportAt >= 0, workflowName + " has no bundle export");
    assert.ok(
      verifyAt > exportAt,
      workflowName + " lacks post-export verification",
    );
    assert.ok(
      prebuildAt > verifyAt,
      workflowName + " generates native code before verifying JS",
    );
    assert.match(workflow, /workflow_dispatch:/);
    assert.doesNotMatch(workflow, /^\s+(push|pull_request|schedule):/m);
    assert.doesNotMatch(workflow, /actions\/upload-artifact/);
  }
});
