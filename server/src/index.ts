import { createApp } from "./app.js";
import { env } from "./env.js";
import { prisma, pool } from "./db.js";

const server = createApp().listen(env.port, "0.0.0.0", () => {
  console.log(`[server] ALV Store API listening on http://0.0.0.0:${env.port}`);
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 10_000).unref();
  server.close(async () => {
    try { await prisma.$disconnect(); await pool.end(); }
    catch (error) { console.error("[server] shutdown error:", error); process.exitCode = 1; }
    finally { clearTimeout(deadline); }
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
