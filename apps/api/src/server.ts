import { existsSync } from "node:fs";
import { buildApp } from "./app.js";
import { parseEnvironment } from "./config.js";
import { PrismaClient } from "@eazicart/database";
import { PrismaAuthStore } from "./modules/auth/prisma-store.js";

if (existsSync(".env")) process.loadEnvFile(".env");
const config = parseEnvironment(process.env);
const database = new PrismaClient();
const app = buildApp(config, {
  authStore: new PrismaAuthStore(database),
  database,
});
app.addHook("onClose", async () => database.$disconnect());

let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  try {
    await app.close();
  } catch (error) {
    app.log.error(error, "API shutdown failed");
    process.exitCode = 1;
  } finally {
    clearTimeout(deadline);
  }
}
process.once("SIGTERM", () => void shutdown());
process.once("SIGINT", () => void shutdown());

try {
  await database.$connect();
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.error(error, "API startup failed");
  process.exitCode = 1;
  await shutdown();
}
