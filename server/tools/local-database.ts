import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import net from "node:net";
import path from "node:path";
import { env, isEmbeddedPostgresUrl, serverRoot } from "../src/env.js";

export const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(serverRoot, ".pgdata");
export const socketHost = process.env.PGLITE_SOCKET_HOST ?? "0.0.0.0";
export const socketConnectHost =
  process.env.PGLITE_CONNECT_HOST ??
  (process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : "127.0.0.1");
export const socketPort = Number(process.env.PGLITE_SOCKET_PORT ?? 5433);

export function isLocalDatabase(databaseUrl: string) {
  return isEmbeddedPostgresUrl(databaseUrl);
}

export function socketAvailable(port: number, host = socketConnectHost): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.connect({ host, port });
    const done = (available: boolean) => { socket.destroy(); resolve(available); };
    socket.setTimeout(1000);
    socket.once("connect", () => done(true));
    socket.once("error", () => done(false));
    socket.once("timeout", () => done(false));
  });
}

export async function startLocalDatabase() {
  const db = new PGlite(dataDir);
  await db.waitReady;
  const server = new PGLiteSocketServer({ db, port: socketPort, host: socketHost, inspectOnNewConnection: false });
  try { await server.start(); }
  catch (error) { await db.close(); throw error; }
  console.log(`[db] embedded PostgreSQL listening on ${socketHost}:${socketPort}`);
  return async () => { await server.stop(); await db.close(); };
}

/** Setup may own a temporary socket, but must never open a live data dir twice. */
export async function withDatabase<T>(run: () => Promise<T>): Promise<T> {
  let stop: (() => Promise<void>) | undefined;
  if (isLocalDatabase(env.databaseUrl) && !await socketAvailable(socketPort)) stop = await startLocalDatabase();
  try { return await run(); }
  finally { await stop?.(); }
}
