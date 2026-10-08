const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const sourcePath = path.join(__dirname, "verify.cjs");
const runtimePath = path.join(__dirname, ".verify-runtime.cjs");
let source = fs.readFileSync(sourcePath, "utf8");

function replaceExact(from, to, expectedCount = 1) {
  const count = source.split(from).length - 1;
  if (count !== expectedCount) {
    throw new Error(
      `Visual verifier compatibility patch expected ${expectedCount} match(es), found ${count}. Fold the current UI assertion into verify.cjs before changing this runner.`,
    );
  }
  source = source.split(from).join(to);
}

replaceExact(
  "    await page.locator('[data-figma-node=\"8:54\"]').waitFor();",
  `    await page\n      .getByRole("heading", { name: "Nike Air Max 90", exact: true })\n      .waitFor();`,
  2,
);

replaceExact(
  `    await page.getByRole("button", { name: "42", exact: true }).click();\n    if (\n      (await page\n        .getByRole("button", { name: "42", exact: true })\n        .getAttribute("aria-pressed")) !== "true"\n    )\n      throw Error("Size selection failed");\n`,
  "",
);

replaceExact(
  '        tested: ["size selection", "sandbox add to cart"],',
  '        tested: ["responsive product detail", "sandbox add to cart"],',
);

replaceExact(
  '      name: "Search products, stores or brands",',
  '      name: "Search products and sellers",',
);

try {
  fs.writeFileSync(runtimePath, source);
  const result = spawnSync(process.execPath, [runtimePath], {
    stdio: "inherit",
    env: process.env,
  });
  process.exitCode = result.status ?? 1;
} finally {
  fs.rmSync(runtimePath, { force: true });
}
