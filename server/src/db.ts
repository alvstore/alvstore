import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { env } from "./env.js";

const url = new URL(env.databaseUrl);
const embedded = ["127.0.0.1", "localhost"].includes(url.hostname) && url.port === (process.env.PGLITE_SOCKET_PORT ?? "5433");
const pool = new pg.Pool({
  connectionString: env.databaseUrl,
  max: embedded ? 1 : 5,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30_000,
  keepAlive: true,
});

// An idle client can disconnect when the DB restarts. pg emits `error` on
// the pool, which would otherwise be an uncaught EventEmitter exception.
// pg removes that client automatically; later requests get a fresh one.
// Do NOT replay writes: their commit state may be unknown after disconnect.
pool.on("error", error => console.error("[db] idle connection lost; pool will reconnect:", error.message));

export const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
  log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["error"],
});

export { pool };
