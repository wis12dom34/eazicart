import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
import process from "node:process";
import console from "node:console";

// Create configuration only: never overwrite an existing environment file.
if (!existsSync(".env")) {
  const password = randomBytes(24).toString("hex");
  const secret = randomBytes(48).toString("hex");
  writeFileSync(
    ".env",
    [
      `POSTGRES_PASSWORD=${password}`,
      `DATABASE_URL=postgresql://eazicart:${password}@127.0.0.1:5432/eazicart`,
      `JWT_SECRET=${secret}`,
      "WEB_ORIGIN=http://localhost:3000",
      "NEXT_PUBLIC_API_BASE_URL=http://localhost:3001",
      "ALLOW_DEMO_SEED=true",
      "",
    ].join("\n"),
    { mode: 0o600, flag: "wx" },
  );
}
process.loadEnvFile(".env");
const required = ["DATABASE_URL", "JWT_SECRET", "POSTGRES_PASSWORD"];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Missing ${key} in root .env`);
}
const files = {
  "apps/api/.env": [
    `DATABASE_URL=${process.env.DATABASE_URL}`,
    `JWT_SECRET=${process.env.JWT_SECRET}`,
    `WEB_ORIGIN=${process.env.WEB_ORIGIN || "http://localhost:3000"}`,
  ],
  "apps/web/.env": [
    `NEXT_PUBLIC_API_BASE_URL=${process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001"}`,
  ],
  "packages/database/.env": [
    `DATABASE_URL=${process.env.DATABASE_URL}`,
    "ALLOW_DEMO_SEED=true",
  ],
};
for (const [path, lines] of Object.entries(files)) {
  if (!existsSync(path)) {
    writeFileSync(path, lines.join("\n") + "\n", { mode: 0o600, flag: "wx" });
  }
}
console.log("Development configuration ready; existing files preserved.");
