import test from "node:test";
import assert from "node:assert/strict";
import { isEmbeddedPostgresUrl } from "../src/env.js";
import { DEFAULT_FINANCE_CATEGORIES } from "../src/lib/default-finance-categories.js";

test("default finance seed includes top 15 unique income and top 15 unique expense categories", () => {
  const income = DEFAULT_FINANCE_CATEGORIES.filter(([, type]) => type === "income").map(([name]) => name);
  const expense = DEFAULT_FINANCE_CATEGORIES.filter(([, type]) => type === "expense").map(([name]) => name);

  assert.equal(income.length, 15);
  assert.equal(expense.length, 15);
  assert.equal(new Set(income.map(name => name.toLowerCase())).size, 15);
  assert.equal(new Set(expense.map(name => name.toLowerCase())).size, 15);

  for (const legacy of ["POS Sales", "Repair Income", "Service Income", "Other Income"]) {
    assert.ok(income.includes(legacy), `Expected legacy income category: ${legacy}`);
  }
  for (const legacy of ["Salary", "Rent", "Purchase", "Utilities", "Maintenance", "Misc Expense"]) {
    assert.ok(expense.includes(legacy), `Expected legacy expense category: ${legacy}`);
  }
});

test("isEmbeddedPostgresUrl recognizes loopback and configured PGLITE_CONNECT_HOST sockets", () => {
  const previousHost = process.env.PGLITE_CONNECT_HOST;
  const previousPort = process.env.PGLITE_SOCKET_PORT;
  try {
    process.env.PGLITE_SOCKET_PORT = "5433";
    process.env.PGLITE_CONNECT_HOST = "195.35.46.243";

    assert.equal(isEmbeddedPostgresUrl("postgres://postgres:postgres@127.0.0.1:5433/postgres"), true);
    assert.equal(isEmbeddedPostgresUrl("postgres://postgres:postgres@localhost:5433/postgres"), true);
    assert.equal(isEmbeddedPostgresUrl("postgres://postgres:postgres@195.35.46.243:5433/postgres"), true);
    assert.equal(isEmbeddedPostgresUrl("postgres://postgres:postgres@195.35.46.243:5432/postgres"), false);
    assert.equal(isEmbeddedPostgresUrl("postgres://user:pass@db.example.com:5432/alvstore"), false);
    assert.equal(isEmbeddedPostgresUrl("not-a-valid-url"), false);
  } finally {
    if (previousHost === undefined) delete process.env.PGLITE_CONNECT_HOST;
    else process.env.PGLITE_CONNECT_HOST = previousHost;
    if (previousPort === undefined) delete process.env.PGLITE_SOCKET_PORT;
    else process.env.PGLITE_SOCKET_PORT = previousPort;
  }
});
