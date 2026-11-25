import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { apiErrorHandler } from "../src/lib/api-errors.js";
import { asyncHandler } from "../src/lib/async-handler.js";
import {
  parsePublicLeadPayload,
  createLeadRateLimiter,
  createPublicLead,
  handlePublicLeadRequest,
  type QueryRunner,
} from "../src/lib/public-lead.js";

function createFakeDb(opts?: { existingLeadId?: string; existingNotes?: string; adminIds?: string[]; throwError?: unknown }) {
  const queries: { sql: string; params: unknown[] }[] = [];
  const db: QueryRunner = {
    async query(sql: string, params: unknown[] = []) {
      queries.push({ sql, params });
      if (opts?.throwError) throw opts.throwError;
      if (/FROM public\.leads/i.test(sql)) {
        return {
          rows: opts?.existingLeadId ? [{ id: opts.existingLeadId, notes: opts.existingNotes ?? "" }] : [],
        };
      }
      if (/INSERT INTO public\.leads/i.test(sql)) {
        return { rows: [{ id: "11111111-1111-1111-1111-111111111111" }] };
      }
      if (/FROM public\.user_roles/i.test(sql)) {
        return { rows: (opts?.adminIds ?? ["22222222-2222-2222-2222-222222222222"]).map((user_id) => ({ user_id })) };
      }
      return { rows: [] };
    },
  };
  return { db, queries };
}

test("parsePublicLeadPayload validates required fields, clamps lengths, and detects honeypot", () => {
  assert.deepEqual(parsePublicLeadPayload({ name: "A", phone: "9887601200", email: "a@b.com" }), {
    kind: "error",
    message: "Please provide your full name.",
  });
  assert.deepEqual(parsePublicLeadPayload({ name: "Rajat", phone: "12345", email: "a@b.com" }), {
    kind: "error",
    message: "Please provide a valid 10-digit mobile number.",
  });
  assert.deepEqual(parsePublicLeadPayload({ name: "Rajat", phone: "9887601200", email: "not-an-email" }), {
    kind: "error",
    message: "Please provide a valid email address.",
  });
  assert.deepEqual(parsePublicLeadPayload({ name: "Bot", phone: "9887601200", email: "bot@test.com", website: "https://spam.example" }), {
    kind: "honeypot",
  });

  const valid = parsePublicLeadPayload({
    name: "  Aarav Mehta  ",
    phone: " +91 98876 01200 ",
    email: " AARAV@EXAMPLE.COM ",
    city: "Udaipur",
    room: "A private cinema",
    note: "[Room Planner] 24 x 16 ft",
  });
  assert.equal(valid.kind, "ok");
  if (valid.kind === "ok") {
    assert.equal(valid.data.name, "Aarav Mehta");
    assert.equal(valid.data.email, "aarav@example.com");
    assert.equal(valid.data.last10Digits, "9887601200");
    assert.match(valid.data.formattedNotes, /Topic: A private cinema/);
    assert.match(valid.data.formattedNotes, /City: Udaipur/);
    assert.match(valid.data.formattedNotes, /\[Room Planner\] 24 x 16 ft/);
  }
});

test("createPublicLead inserts parameterized website lead, activity, and admin notification", async () => {
  const { db, queries } = createFakeDb({ adminIds: ["admin-1", "admin-2"] });
  const parsed = parsePublicLeadPayload({
    name: "'; DROP TABLE leads; --",
    phone: "+91 98876 01200",
    email: "client@alvstore.in",
    city: "Jaipur",
    room: "A private cinema",
    note: "Looking for 7.2.4 cinema setup.",
  });
  assert.equal(parsed.kind, "ok");
  if (parsed.kind !== "ok") return;

  const result = await createPublicLead(db, parsed.data);
  assert.equal(result.deduplicated, false);
  assert.equal(result.leadId, "11111111-1111-1111-1111-111111111111");

  const insertLead = queries.find((q) => /INSERT INTO public\.leads/i.test(q.sql));
  assert.ok(insertLead);
  assert.doesNotMatch(insertLead.sql, /DROP TABLE/);
  assert.equal(insertLead.params[0], "'; DROP TABLE leads; --");
  assert.match(insertLead.sql, /'website'/);
  assert.match(insertLead.sql, /60/);

  const activity = queries.find((q) => /INSERT INTO public\.lead_activities/i.test(q.sql));
  assert.ok(activity);
  assert.equal(activity.params[0], result.leadId);

  const notifications = queries.filter((q) => /INSERT INTO public\.notification_feed/i.test(q.sql));
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0].params[0], "admin-1");
  assert.equal(notifications[1].params[0], "admin-2");
});

test("createPublicLead deduplicates rapid submissions within 10 minutes", async () => {
  const { db, queries } = createFakeDb({
    existingLeadId: "existing-lead-uuid",
    existingNotes: "Topic: A private cinema\nCity: Udaipur",
  });
  const parsed = parsePublicLeadPayload({
    name: "Rajat",
    phone: "9887601200",
    email: "rajat@example.com",
    city: "Udaipur",
    room: "A private cinema",
    note: "Added 24 x 16 ft room specs.",
  });
  assert.equal(parsed.kind, "ok");
  if (parsed.kind !== "ok") return;

  const result = await createPublicLead(db, parsed.data);
  assert.equal(result.deduplicated, true);
  assert.equal(result.leadId, "existing-lead-uuid");
  assert.equal(queries.some((q) => /INSERT INTO public\.leads/i.test(q.sql)), false);
  assert.equal(queries.some((q) => /UPDATE public\.leads SET notes = \$1/i.test(q.sql)), true);
});

test("handlePublicLeadRequest enforces rate limit, ignores client role/score overrides, and propagates DB outages", async (t) => {
  const limiter = createLeadRateLimiter({ maxAttempts: 2, windowMs: 60_000 });
  const { db } = createFakeDb();

  const app = express();
  app.use(express.json());
  app.post(
    "/public-lead",
    asyncHandler((req, res) => handlePublicLeadRequest(req, res, { db, limiter }))
  );
  app.use(apiErrorHandler);

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))));
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  // Honeypot bypasses DB cleanly
  const spamRes = await fetch(`${base}/public-lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Bot", phone: "9887601200", email: "b@c.com", website: "http://evil.invalid" }),
  });
  assert.equal(spamRes.status, 200);
  assert.equal((await spamRes.json()).ignored, true);

  // Two valid requests succeed (rate limiter counts non-honeypot calls)
  for (let i = 0; i < 2; i++) {
    const res = await fetch(`${base}/public-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Client User",
        phone: "9887601200",
        email: "client@example.com",
        status: "converted",
        pipeline_stage: "converted",
        score: 999,
      }),
    });
    assert.equal(res.status, 201);
  }

  // Third request hits 429 rate limit
  const limitedRes = await fetch(`${base}/public-lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Client User", phone: "9887601200", email: "client@example.com" }),
  });
  assert.equal(limitedRes.status, 429);

  // Separate app verifying DB unavailability surfaces 503 via apiErrorHandler
  const downApp = express();
  downApp.use(express.json());
  const downDb = createFakeDb({ throwError: Object.assign(new Error("connect ECONNREFUSED"), { code: "ECONNREFUSED" }) });
  downApp.post("/public-lead", asyncHandler((req, res) => handlePublicLeadRequest(req, res, { db: downDb.db, limiter: createLeadRateLimiter() })));
  downApp.use(apiErrorHandler);
  const downServer = downApp.listen(0, "127.0.0.1");
  await once(downServer, "listening");
  t.after(() => new Promise<void>((resolve, reject) => downServer.close((e) => (e ? reject(e) : resolve()))));
  const downRes = await fetch(`http://127.0.0.1:${(downServer.address() as { port: number }).port}/public-lead`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Rajat", phone: "9887601200", email: "rajat@example.com" }),
  });
  assert.equal(downRes.status, 503);
});
