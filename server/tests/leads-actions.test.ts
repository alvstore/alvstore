import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app.js";
import { convertLeadTx, deleteLeadsTx, normalizePhoneLast10 } from "../src/lib/lead-actions.js";

test("normalizePhoneLast10 strips country codes and formatting cleanly", () => {
  assert.equal(normalizePhoneLast10("+91 98876-01200"), "9887601200");
  assert.equal(normalizePhoneLast10("09887601200"), "9887601200");
  assert.equal(normalizePhoneLast10("12345"), "12345");
});

test("deleteLeadsTx cleans polymorphic follow-ups, notifications, leads, and writes audit log", async () => {
  const queries = [];
  const mockClient = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      if (sql.includes("FROM public.leads WHERE id = ANY")) {
        return {
          rows: [
            { id: "11111111-1111-4111-8111-111111111111", name: "Fake Bot", phone: "9999999999", source: "website" },
          ],
        };
      }
      if (sql.includes("DELETE FROM public.leads")) {
        return { rows: [{ id: "11111111-1111-4111-8111-111111111111" }] };
      }
      return { rows: [] };
    },
  };

  const result = await deleteLeadsTx(mockClient, {
    ids: ["11111111-1111-4111-8111-111111111111"],
    userId: "99999999-9999-4999-8999-999999999999",
  });

  assert.equal(result.deletedCount, 1);
  assert.ok(queries.some((q) => q.sql.includes("DELETE FROM public.follow_up_notes")));
  assert.ok(queries.some((q) => q.sql.includes("DELETE FROM public.notification_feed")));
  assert.ok(queries.some((q) => q.sql.includes("INSERT INTO public.system_audit_log")));
});

test("convertLeadTx reuses existing customer matched by last-10 phone digits without creating duplicates", async () => {
  const inserts = [];
  const updates = [];
  const mockClient = {
    async query(sql, params = []) {
      if (sql.includes("FROM public.leads WHERE id =")) {
        return {
          rows: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              name: "Rajat Lekhari",
              phone: "+91 9887601200",
              email: "rajat@alvstore.in",
              source: "website",
              notes: "Topic: Home Cinema\nCity: Udaipur\n\nLooking for Dolby Atmos",
              converted_customer_id: null,
            },
          ],
        };
      }
      if (sql.includes("FROM public.customers") && sql.includes("LIKE")) {
        return { rows: [{ id: "33333333-3333-4333-8333-333333333333", name: "Rajat Lekhari", phone: "9887601200" }] };
      }
      if (sql.includes("INSERT INTO public.customers")) {
        inserts.push({ sql, params });
        return { rows: [{ id: "should-not-create" }] };
      }
      if (sql.includes("UPDATE public.leads")) {
        updates.push({ sql, params });
        return {
          rows: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              pipeline_stage: "converted",
              status: "converted",
              converted_customer_id: "33333333-3333-4333-8333-333333333333",
            },
          ],
        };
      }
      return { rows: [] };
    },
  };

  const result = await convertLeadTx(mockClient, {
    leadId: "22222222-2222-4222-8222-222222222222",
    userId: "99999999-9999-4999-8999-999999999999",
  });

  assert.equal(inserts.length, 0);
  assert.equal(result.reusedExistingCustomer, true);
  assert.equal(result.customer.id, "33333333-3333-4333-8333-333333333333");
  assert.equal(updates.length, 1);
});

test("leads-delete and leads-convert endpoints enforce authentication", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const { port } = server.address() as { port: number };
  try {
    for (const path of ["/api/functions/leads-delete", "/api/functions/leads-convert"]) {
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      assert.equal(res.status, 401);
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
