/**
 * Bootstraps the local PostgreSQL database (PGlite) for development:
 *  1. Creates Supabase-compat stubs (auth/storage schemas, roles)
 *  2. Applies every migration from ../migrations in order
 *  3. Applies our own auth additions (password credentials)
 *
 * Idempotent — applied migrations are recorded in `public._alv_migrations`.
 *
 * Usage: tsx tools/bootstrap-db.ts [--reset]
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(serverRoot, ".pgdata");
const migrationsDir = path.join(serverRoot, "migrations");

if (process.argv.includes("--reset") && fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log("[bootstrap] wiped data dir", dataDir);
}

function sanitize(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      // PGlite has no pg_cron / pg_net — skip those extension statements.
      if (/CREATE\s+EXTENSION/i.test(line) && /(pg_cron|pg_net)/i.test(line)) {
        return "-- [bootstrap] skipped: " + line;
      }
      // Supabase realtime publication doesn't exist locally (chat/notifications
      // use polling in the new stack) — skip publication statements.
      if (/ALTER\s+PUBLICATION\s+supabase_realtime/i.test(line)) {
        return "-- [bootstrap] skipped: " + line;
      }
      return line;
    })
    .join("\n");
}

async function main() {
  console.log("[bootstrap] opening database at", dataDir);
  const db = new PGlite(dataDir);
  await db.waitReady;

  // 1. stubs
  await db.exec(fs.readFileSync(path.join(serverRoot, "sql", "bootstrap.sql"), "utf8"));
  console.log("[bootstrap] supabase-compat stubs ready");

  // 2. migration ledger
  await db.exec(
    `CREATE TABLE IF NOT EXISTS public._alv_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
  const appliedRows = await db.query<{ name: string }>("SELECT name FROM public._alv_migrations");
  const applied = new Set(appliedRows.rows.map((r) => r.name));

  // 3. schema migrations, in filename order
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
  let ran = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = sanitize(fs.readFileSync(path.join(migrationsDir, file), "utf8"));
    try {
      await db.exec(sql);
      await db.query("INSERT INTO public._alv_migrations (name) VALUES ($1)", [file]);
      ran++;
      console.log(`[bootstrap] applied ${file}`);
    } catch (err) {
      console.error(`[bootstrap] FAILED at ${file}:`);
      throw err;
    }
  }
  console.log(`[bootstrap] migrations up to date (${ran} new, ${applied.size} previously applied)`);

  // 4. our own auth additions
  await db.exec(fs.readFileSync(path.join(serverRoot, "sql", "own-auth.sql"), "utf8"));
  console.log("[bootstrap] own-auth schema applied");

  const tables = await db.query<{ count: string }>(
    "SELECT count(*)::text AS count FROM information_schema.tables WHERE table_schema = 'public'"
  );
  console.log(`[bootstrap] public schema has ${tables.rows[0].count} tables`);

  await db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
