/**
 * Connection settings expected by a future PostgreSQL adapter.
 * This package deliberately creates no connection and contains no credentials.
 */
export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  ssl?: boolean;
}

export const DATABASE_URL_ENV_KEY = "DATABASE_URL";

export { Prisma, PrismaClient } from "@prisma/client";
export type * from "@prisma/client";
