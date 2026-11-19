import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import { once } from "node:events";
import type { Server } from "node:http";

const exec = promisify(execFile);
async function unusedPort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}

// Opt-in and disposable: never stop the developer's DB or touch server/.pgdata.
test("Prisma setup, idempotent seed, dates, audit identity and API recovery", { skip: process.env.RUN_DB_INTEGRATION !== "1", timeout: 180_000 }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), "alv-db-test-"));
  const port = await unusedPort();
  const serverRoot = path.resolve(import.meta.dirname, "..");
  const email = "lifecycle@example.test", password = "Lifecycle-test-123!";
  Object.assign(process.env, {
    DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${port}/postgres`,
    PGLITE_SOCKET_PORT: String(port), PGLITE_DATA_DIR: directory,
    ADMIN_EMAIL: email, ADMIN_PASSWORD: password,
  });
  let stopDatabase: (() => Promise<void>) | undefined;
  let server: Server | undefined;
  let prisma: any, pool: any;
  t.after(async () => {
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    await prisma?.$disconnect();
    await pool?.end();
    await stopDatabase?.();
    await rm(directory, { recursive: true, force: true });
  });
  const setup = () => exec(process.execPath, ["node_modules/tsx/dist/cli.mjs", "tools/setup-db.ts"], { cwd: serverRoot, env: process.env, timeout: 90_000, maxBuffer: 1024 * 1024 });
  await setup();
  const { startLocalDatabase } = await import("../tools/local-database.js");
  stopDatabase = await startLocalDatabase();
  // PGlite serializes socket clients. Close the inspection connection before
  // invoking the CLI, as a real embedded-DB deployment does during setup.
  const { Client } = await import("pg");
  const inspect = new Client({ connectionString: process.env.DATABASE_URL });
  await inspect.connect();
  const original = (await inspect.query("SELECT id, password_hash FROM auth.users WHERE email = $1", [email])).rows[0];
  const categoriesBefore = Number((await inspect.query("SELECT count(*) FROM finance_categories")).rows[0].count);
  await inspect.end();
  const metadataPath = path.join(serverRoot, "src/generated/schema-meta.json");
  const metadataModified = (await stat(metadataPath)).mtimeMs;
  await setup();
  assert.equal((await stat(metadataPath)).mtimeMs, metadataModified, "unchanged metadata must not restart an API file watcher");
  ({ prisma, pool } = await import("../src/db.js"));
  const reseeded = await prisma.authUser.findFirstOrThrow({ where: { email } });
  assert.equal(reseeded.id, original.id);
  assert.equal(reseeded.password_hash, original.password_hash, "setup must not reset an existing password");
  assert.equal(await prisma.financeCategories.count(), categoriesBefore);
  assert.equal(await prisma.userRoles.count({ where: { user_id: original.id, role: "admin" } }), 1);

  const { createApp } = await import("../src/app.js");
  server = createApp().listen(0, "0.0.0.0");
  await once(server, "listening");
  const base = `http://127.0.0.1:${(server.address() as net.AddressInfo).port}/api`;
  let token = "";
  const request = (endpoint: string, body?: unknown) => fetch(`${base}${endpoint}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const login = await request("/auth/login", { email, password });
  assert.equal(login.status, 200);
  token = (await login.json() as any).access_token;
  const signup = await request("/auth/signup", { email: "staff@example.test", password, full_name: "Test Staff" });
  assert.equal(signup.status, 200);
  const staff = (await signup.json() as any).user;
  assert.ok(staff.roles.includes("staff"));
  assert.ok(!staff.roles.includes("admin"));

  async function query(table: string, op: string, values?: unknown, filters: unknown[] = []) {
    const response = await request("/data/query", { table, op, values, filters, select: "*", ...(op === "insert" ? { single: "single" } : {}) });
    const body: any = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    return body.data;
  }
  const task = await query("tasks", "insert", { title: "Date round trip", due_date: "2026-11-18" });
  assert.equal(task.due_date, "2026-11-18");
  const dateRows = await query("tasks", "select", undefined, [{ type: "op", col: "due_date", op: "gte", val: "2026-11-18" }]);
  assert.equal(dateRows.length, 1);
  const invalid = await request("/data/query", { table: "tasks", op: "insert", values: { title: "Invalid", due_date: "not-a-date" } });
  assert.equal(invalid.status, 400);

  const customer = await query("customers", "insert", { name: "Lifecycle customer", phone: "9000000000" });
  const job = await query("job_sheets", "insert", { customer_id: customer.id, device_brand: "Test", device_type: "Phone", problem_description: "Test repair" });
  await query("job_sheets", "update", { status: "in_progress" }, [{ type: "op", col: "id", op: "eq", val: job.id }]);
  const audit = await prisma.jobSheetAuditLog.findFirstOrThrow({ where: { job_sheet_id: job.id, action: "status_changed" } });
  assert.equal(audit.user_id, original.id);
  const actor = await pool.query("SELECT current_setting('app.user_id', true) AS actor");
  assert.ok(!actor.rows[0].actor, "transaction-local audit identity must not leak into a reused pool connection");

  // A real disconnect, not a mocked rejection: liveness remains up, readiness
  // and requests fail safely; the same pool connects again after restart.
  await stopDatabase(); stopDatabase = undefined;
  assert.equal((await request("/health")).status, 200);
  const outage = await request("/ready");
  assert.equal(outage.status, 503);
  assert.equal((await outage.json() as any).error.code, "DB_UNAVAILABLE");
  const failedQuery = await request("/data/query", { table: "tasks", op: "select" });
  assert.equal(failedQuery.status, 503);
  assert.equal(failedQuery.headers.get("retry-after"), "2");
  assert.equal((await request("/health")).status, 200);
  stopDatabase = await startLocalDatabase();
  assert.equal((await request("/ready")).status, 200);
  assert.equal((await query("tasks", "select")).length, 1);
  assert.equal((await request("/auth/login", { email, password })).status, 200);
});
