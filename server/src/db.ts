import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "./env.js";

// Single connection pool: the embedded PGlite socket used in dev accepts one
// client at a time; real Postgres in production happily takes a small pool.
const embedded = env.databaseUrl.includes("127.0.0.1:5433");
const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: embedded ? 1 : 5,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({
  adapter,
  log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["error"],
});

export { pool };
