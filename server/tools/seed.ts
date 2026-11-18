/**
 * Seeds the initial admin user (idempotent).
 *   ADMIN_EMAIL / ADMIN_PASSWORD env vars, defaults: admin@alvstore.in / admin123
 *
 * Dual mode: talks to the embedded PGlite data dir directly (default), or to
 * DATABASE_URL when one is provided.
 */
import bcrypt from "bcryptjs";
import path from "node:path";
import url from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";

const here = path.dirname(url.fileURLToPath(import.meta.url));
const serverRoot = path.resolve(here, "..");
if (fs.existsSync(path.join(serverRoot, ".env"))) dotenv.config({ path: path.join(serverRoot, ".env") });

const email = process.env.ADMIN_EMAIL ?? "admin@alvstore.in";
const password = process.env.ADMIN_PASSWORD ?? "admin123";
const fullName = process.env.ADMIN_NAME ?? "ALV Admin";

interface Querier {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
  close: () => Promise<void>;
}

async function openDb(): Promise<Querier> {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("127.0.0.1:5433")) {
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    return {
      query: async (sql, params) => client.query(sql, params as never[]),
      close: () => client.end(),
    };
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(serverRoot, ".pgdata");
  const db = new PGlite(dataDir);
  await db.waitReady;
  return {
    query: async (sql, params) => db.query(sql, (params ?? []) as never[]),
    close: () => db.close(),
  };
}

const db = await openDb();
const existing = await db.query("SELECT id FROM auth.users WHERE lower(email) = lower($1)", [email]);
if (existing.rows.length) {
  console.log(`[seed] admin user ${email} already exists`);
} else {
  const hash = await bcrypt.hash(password, 10);
  const inserted = await db.query(
    `INSERT INTO auth.users (email, password_hash, raw_user_meta_data) VALUES ($1, $2, $3) RETURNING id`,
    [email, hash, JSON.stringify({ full_name: fullName })]
  );
  await db.query(
    `INSERT INTO public.user_roles (user_id, role) VALUES ($1, 'admin') ON CONFLICT (user_id, role) DO NOTHING`,
    [inserted.rows[0].id]
  );
  console.log(`[seed] created admin user ${email} (password: ${password})`);
}
await db.close();
process.exit(0);
