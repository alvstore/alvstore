import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { isDatabaseUnavailable, apiErrorHandler } from "../src/lib/api-errors.js";
import { asyncHandler } from "../src/lib/async-handler.js";

test("recognizes pg, Prisma, nested adapter, aggregate, and pool failures", () => {
  for (const code of ["ECONNREFUSED", "ECONNRESET", "EPIPE", "ETIMEDOUT", "53300", "57P01", "P1001", "P1017", "P2024", "P2037"]) assert.equal(isDatabaseUnavailable({ code }), true, code);
  assert.equal(isDatabaseUnavailable({ code: "P2010", meta: { code: "57P03" } }), true);
  assert.equal(isDatabaseUnavailable({ meta: { driverAdapterError: { cause: { kind: "ConnectionClosed" } } } }), true);
  assert.equal(isDatabaseUnavailable({ originalError: { originalCode: "08006" } }), true);
  assert.equal(isDatabaseUnavailable(new AggregateError([Object.assign(new Error("offline"), { code: "ECONNREFUSED" })])), true);
  assert.equal(isDatabaseUnavailable(new Error("timeout exceeded when trying to connect")), true);
  assert.equal(isDatabaseUnavailable(new Error("Connection terminated unexpectedly")), true);
});

test("does not classify validation, uniqueness, or provider failures as pool outages", () => {
  for (const error of [null, undefined, "offline", new Error("bad input"), { code: "P2002" }, { code: "P2025" }, { cause: { kind: "UniqueConstraintViolation" } }]) assert.equal(isDatabaseUnavailable(error), false);
  const circular: { cause?: unknown } = {};
  circular.cause = circular;
  assert.equal(isDatabaseUnavailable(circular), false);
  assert.equal(isDatabaseUnavailable({ errors: "not-an-array" }), false);
});

test("Express 4 forwards sync/async errors, returns 503, and remains alive", async t => {
  const app = express();
  app.get("/async", asyncHandler(async () => { throw Object.assign(new Error("DB disconnected"), { code: "ECONNRESET" }); }));
  app.get("/sync", asyncHandler(() => { throw new Error("sensitive internal message"); }));
  app.get("/bad", asyncHandler(() => { throw Object.assign(new Error("Invalid input"), { status: 400 }); }));
  app.get("/health", (_req, res) => res.json({ ok: true }));
  app.use(apiErrorHandler);
  const server = app.listen(0, "0.0.0.0");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const unavailable = await fetch(`${base}/async`);
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("retry-after"), "2");
  assert.deepEqual(await unavailable.json(), { error: { code: "DB_UNAVAILABLE", message: "Database temporarily unavailable. Please try again shortly." } });
  const failure = await fetch(`${base}/sync`);
  assert.equal(failure.status, 500);
  assert.deepEqual(await failure.json(), { error: { message: "Internal server error" } });
  const bad = await fetch(`${base}/bad`);
  assert.equal(bad.status, 400);
  assert.deepEqual(await bad.json(), { error: { message: "Invalid input" } });
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { ok: true });
});
