/**
 * Dev helper: serves the embedded PGlite database over a PostgreSQL wire
 * socket so the Prisma client (via @prisma/adapter-pg) can talk to it.
 *
 * Only used when DATABASE_URL is not set (local development). In production
 * point DATABASE_URL at a real PostgreSQL and skip this entirely.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(serverRoot, ".pgdata");
const port = Number(process.env.PGLITE_SOCKET_PORT ?? 5433);

if (!fs.existsSync(dataDir)) {
  console.error("[db] data dir missing — run `npm run db:bootstrap` first:", dataDir);
  process.exit(1);
}

const db = new PGlite(dataDir);
await db.waitReady;

const server = new PGLiteSocketServer({
  db,
  port,
  host: "127.0.0.1",
  // the embedded engine is single-connection; queue others
  inspectOnNewConnection: false,
});
await server.start();
console.log(`[db] embedded PostgreSQL listening on 127.0.0.1:${port}`);

const shutdown = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
