import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  PAYSTACK_SECRET_KEY: z.string().min(1).optional(),
  PAYSTACK_BASE_URL: z.string().url().optional(),
});

export type AppConfig = z.infer<typeof environmentSchema>;
export const parseEnvironment = (environment: NodeJS.ProcessEnv): AppConfig =>
  environmentSchema.parse(environment);
