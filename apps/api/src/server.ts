import { existsSync } from "node:fs";
import { buildApp } from "./app.js";
import { parseEnvironment } from "./config.js";
import { PrismaClient } from "@eazicart/database";
import { PrismaAuthStore } from "./modules/auth/prisma-store.js";

if (existsSync(".env")) process.loadEnvFile(".env");
const config = parseEnvironment(process.env);
const database = new PrismaClient();
const app = buildApp(config, {
  authStore: new PrismaAuthStore(
    database,
    config.BROWSER_ACCOUNTS_ENABLED === "1",
  ),
  database,
});
app.addHook("onClose", async () => database.$disconnect());
await app.listen({ host: config.HOST, port: config.PORT });
