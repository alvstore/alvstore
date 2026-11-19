/** Serve the local embedded Postgres database. Schema setup is Prisma-owned. */
import { env } from "../src/env.js";
import { isLocalDatabase, startLocalDatabase } from "./local-database.js";

if (!isLocalDatabase(env.databaseUrl)) {
  console.log("[db] DATABASE_URL points to external PostgreSQL; embedded socket not needed.");
} else {
  const stop = await startLocalDatabase();
  let stopping = false;
  const shutdown = async () => {
    if (stopping) return;
    stopping = true;
    await stop();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
