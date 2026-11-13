#!/usr/bin/env node
/** Read-only verification of an offline, nonproduction Expo Hermes JS export. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function safeRelativeFile(root, relative) {
  if (
    typeof relative !== "string" ||
    !relative ||
    path.posix.isAbsolute(relative) ||
    !relative
      .split("/")
      .every((part) => part && part !== "." && part !== "..") ||
    relative.includes("\\")
  ) {
    return null;
  }
  const file = path.resolve(root, relative);
  const base = path.resolve(root) + path.sep;
  if (!file.startsWith(base)) return null;
  try {
    // A symlinked parent directory could otherwise escape the export root.
    const realRoot = fs.realpathSync(root);
    const realFile = fs.realpathSync(file);
    if (!realFile.startsWith(realRoot + path.sep)) return null;
    const stat = fs.lstatSync(file);
    return stat.isFile() && !stat.isSymbolicLink() && stat.size > 0
      ? file
      : null;
  } catch {
    return null;
  }
}

export function verifyNativeJsExport(root, platform) {
  const errors = [];
  if (!["android", "ios"].includes(platform)) {
    return { ok: false, errors: ["Unsupported mobile export platform."] };
  }
  let metadata;
  try {
    metadata = JSON.parse(
      fs.readFileSync(path.join(root, "metadata.json"), "utf8"),
    );
  } catch {
    return { ok: false, errors: ["Missing or invalid Expo export metadata."] };
  }
  if (
    metadata?.bundler !== "metro" ||
    !metadata.fileMetadata ||
    Object.keys(metadata.fileMetadata).length !== 1 ||
    !Object.hasOwn(metadata.fileMetadata, platform)
  ) {
    errors.push(
      "Expo metadata must reference only the requested Metro platform.",
    );
  }
  const record = metadata?.fileMetadata?.[platform];
  if (!record || typeof record !== "object") {
    errors.push("The selected platform has no export manifest.");
  } else {
    if (
      typeof record.bundle !== "string" ||
      !new RegExp(
        "^_expo/static/js/" + platform + "/entry-[a-zA-Z0-9]+\\.hbc$",
      ).test(record.bundle)
    ) {
      errors.push("A platform-specific compiled Hermes entry is required.");
    } else {
      const entry = safeRelativeFile(root, record.bundle);
      if (!entry || fs.statSync(entry).size < 50_000)
        errors.push("Hermes bytecode bundle is missing or incomplete.");
    }
    if (!Array.isArray(record.assets) || record.assets.length === 0) {
      errors.push("Expo export assets are missing.");
    } else {
      const seen = new Set();
      for (const asset of record.assets) {
        if (
          !asset ||
          !/^assets\/[a-z0-9]+$/i.test(asset.path ?? "") ||
          !/^[a-z0-9]+$/i.test(asset.ext ?? "")
        ) {
          errors.push("Malformed Expo asset reference.");
          continue;
        }
        if (seen.has(asset.path)) {
          errors.push("Duplicate Expo asset reference.");
          continue;
        }
        seen.add(asset.path);
        if (!safeRelativeFile(root, asset.path))
          errors.push("Missing or empty exported asset: " + asset.path);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const platform = process.argv[2];
  const directory = process.argv[3];
  const result = directory
    ? verifyNativeJsExport(directory, platform)
    : {
        ok: false,
        errors: ["Specify the platform and Expo export directory."],
      };
  if (!result.ok) {
    result.errors.forEach((reason) => console.error("REFUSED: " + reason));
    process.exitCode = 23;
  } else {
    console.log("PASS: " + platform + " Hermes bundle and assets validated.");
  }
}
