import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { root } from "../tools/check-ui.mjs";

test("Prisma owns the schema; setup pushes and seeds without destructive flags", () => {
  assert.equal(fs.existsSync(path.join(root, "server/migrations")), false);
  const setup = fs.readFileSync(path.join(root, "server/tools/setup-db.ts"), "utf8");
  assert.match(setup, /"db", "push"/);
  assert.match(setup, /tools\/seed\.ts/);
  assert.doesNotMatch(setup, /--force-reset|--accept-data-loss|migrations\//);
  const schema = fs.readFileSync(path.join(root, "server/prisma/schema.prisma"), "utf8");
  assert.match(schema, /model AuthUser/);
  assert.match(schema, /model PasswordResetToken/);
  const runtime = fs.readFileSync(path.join(root, "server/prisma/runtime.sql"), "utf8");
  assert.doesNotMatch(runtime, /CREATE TABLE|CREATE TYPE|auth\.uid\(/i);
  assert.match(runtime, /VALUES \(NEW.id, 'staff'\)/);
  assert.match(runtime, /current_setting\('app.user_id', true\)/);
});

test("query metadata covers exactly the Prisma public models, not auth passwords", () => {
  const schema = fs.readFileSync(path.join(root, "server/prisma/schema.prisma"), "utf8");
  const metadata = JSON.parse(fs.readFileSync(path.join(root, "server/src/generated/schema-meta.json"), "utf8"));
  const tables = [...schema.matchAll(/model\s+(\w+)\s*\{([\s\S]*?)\n\}/g)]
    .filter(match => /@@schema\("public"\)/.test(match[2]))
    .map(match => match[2].match(/@@map\("([^"]+)"\)/)?.[1]);
  assert.equal(tables.length, 65);
  assert.deepEqual(Object.keys(metadata.tables).sort(), tables.sort());
  assert.equal(metadata.tables.users, undefined);
  assert.equal(metadata.tables.password_reset_tokens, undefined);
  assert.equal(metadata.tables.finance_transactions.columns.find(column => column.name === "date").udt, "date");
});
