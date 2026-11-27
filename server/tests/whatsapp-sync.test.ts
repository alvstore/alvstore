import assert from "node:assert/strict";
import test from "node:test";
import {
  promoteWhatsappChatToLead,
  recordOutboundWhatsappChatMessage,
  syncInboundWhatsappMessages,
  syncWhatsappDeliveryStatuses,
  type PgQueryable,
} from "../src/lib/whatsapp-sync.js";

test("syncInboundWhatsappMessages creates /chat thread for unknown number WITHOUT creating a lead in leads table", async () => {
  const executed: Array<{ sql: string; params?: unknown[] }> = [];

  const db: PgQueryable = {
    async query(sql, params) {
      executed.push({ sql, params });
      if (sql.includes("FROM public.chat_messages WHERE whatsapp_message_id")) {
        return { rows: [] };
      }
      if (sql.includes("FROM public.customers")) {
        return { rows: [] };
      }
      if (sql.includes("FROM public.leads")) {
        return { rows: [] };
      }
      if (sql.includes("FROM public.chat_conversations")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO public.chat_conversations")) {
        return {
          rows: [{ id: "11111111-1111-4111-8111-111111111111", title: "Walk-in Buyer", whatsapp_phone: "919988776655" }],
        };
      }
      if (sql.includes("FROM public.whatsapp_conversations")) {
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO public.whatsapp_conversations")) {
        return { rows: [{ id: "22222222-2222-4222-8222-222222222222" }] };
      }
      if (sql.includes("FROM public.user_roles")) {
        return { rows: [{ user_id: "33333333-3333-4333-8333-333333333333" }] };
      }
      return { rows: [] };
    },
  };

  const res = await syncInboundWhatsappMessages(db, [
    {
      externalId: "wa-ext-001",
      fromPhone: "919988776655",
      last10: "9988776655",
      senderName: "Walk-in Buyer",
      text: "Hi, need pricing on Sony 4K projector",
      timestampIso: "2026-11-27T09:00:00.000Z",
    },
  ]);

  assert.equal(res.processed, 1);
  assert.equal(res.createdChats, 1);
  assert.equal(res.linkedLeadIds.length, 0);

  // Critical invariant: ZERO inserts into public.leads
  assert.equal(
    executed.some((q) => q.sql.includes("INSERT INTO public.leads")),
    false
  );
  assert.ok(executed.some((q) => q.sql.includes("INSERT INTO public.chat_conversations")));
  assert.ok(executed.some((q) => q.sql.includes("INSERT INTO public.chat_messages")));
  assert.ok(executed.some((q) => q.sql.includes("INSERT INTO public.notification_feed")));
});

test("syncInboundWhatsappMessages deduplicates repeated webhook externalId and links matching CRM lead", async () => {
  const executed: Array<{ sql: string }> = [];
  let seen = false;

  const db: PgQueryable = {
    async query(sql) {
      executed.push({ sql });
      if (sql.includes("FROM public.chat_messages WHERE whatsapp_message_id")) {
        if (seen) return { rows: [{ id: "dup-row" }] };
        seen = true;
        return { rows: [] };
      }
      if (sql.includes("FROM public.customers")) {
        return { rows: [] };
      }
      if (sql.includes("FROM public.leads")) {
        return { rows: [{ id: "44444444-4444-4444-8444-444444444444", name: "Rohan Mehta" }] };
      }
      if (sql.includes("FROM public.chat_conversations")) {
        return { rows: [{ id: "55555555-5555-4555-8555-555555555555", title: "+919887601200", whatsapp_phone: "919887601200" }] };
      }
      if (sql.includes("FROM public.whatsapp_conversations")) {
        return { rows: [{ id: "66666666-6666-4666-8666-666666666666", lead_id: null }] };
      }
      if (sql.includes("FROM public.user_roles")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
  };

  const msg = {
    externalId: "wa-ext-dup",
    fromPhone: "919887601200",
    last10: "9887601200",
    senderName: "Rohan",
    text: "Send brochure please",
    timestampIso: "2026-11-27T09:10:00.000Z",
  };

  const first = await syncInboundWhatsappMessages(db, [msg]);
  const second = await syncInboundWhatsappMessages(db, [msg]);

  assert.equal(first.processed, 1);
  assert.deepEqual(first.linkedLeadIds, ["44444444-4444-4444-8444-444444444444"]);
  assert.ok(executed.some((q) => q.sql.includes("INSERT INTO public.lead_activities")));

  assert.equal(second.processed, 0);
  assert.equal(second.skippedDuplicates, 1);
});

test("syncWhatsappDeliveryStatuses updates both chat_messages and whatsapp_messages", async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const db: PgQueryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [] };
    },
  };

  const updated = await syncWhatsappDeliveryStatuses(db, [
    { externalId: "msg-ack-1", status: "read" },
  ]);
  assert.equal(updated, 1);
  assert.ok(queries.some((q) => q.sql.includes("UPDATE public.chat_messages") && q.params?.[0] === "read"));
  assert.ok(queries.some((q) => q.sql.includes("UPDATE public.whatsapp_messages") && q.params?.[0] === "read"));
});

test("promoteWhatsappChatToLead creates a lead on demand with chat notes and avoids duplicates", async () => {
  let existing = false;
  const queries: Array<{ sql: string; params?: unknown[] }> = [];

  const db: PgQueryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("FROM public.chat_conversations")) {
        return {
          rows: [{ id: "11111111-1111-4111-8111-111111111111", title: "Aarav Studio", whatsapp_phone: "919822334455", channel: "whatsapp" }],
        };
      }
      if (sql.includes("FROM public.leads")) {
        return existing
          ? { rows: [{ id: "77777777-7777-4777-8777-777777777777", name: "Aarav Studio", phone: "919822334455", status: "new" }] }
          : { rows: [] };
      }
      if (sql.includes("FROM public.chat_messages")) {
        return { rows: [{ content: "Interested in 7.2.4 setup" }] };
      }
      if (sql.includes("INSERT INTO public.leads")) {
        existing = true;
        return { rows: [{ id: "77777777-7777-4777-8777-777777777777", name: "Aarav Studio", phone: "919822334455", status: "new" }] };
      }
      return { rows: [] };
    },
  };

  const first = await promoteWhatsappChatToLead(db, {
    conversationId: "11111111-1111-4111-8111-111111111111",
    userId: "99999999-9999-4999-8999-999999999999",
  });
  assert.equal(first.created, true);
  assert.ok(queries.some((q) => q.sql.includes("INSERT INTO public.leads")));
  assert.ok(queries.some((q) => q.sql.includes("INSERT INTO public.lead_activities")));

  const second = await promoteWhatsappChatToLead(db, {
    conversationId: "11111111-1111-4111-8111-111111111111",
    userId: "99999999-9999-4999-8999-999999999999",
  });
  assert.equal(second.created, false);
});

test("recordOutboundWhatsappChatMessage creates thread if needed and records file metadata", async () => {
  const queries: Array<{ sql: string; params?: unknown[] }> = [];
  const db: PgQueryable = {
    async query(sql, params) {
      queries.push({ sql, params });
      if (sql.includes("FROM public.chat_conversations")) return { rows: [] };
      if (sql.includes("INSERT INTO public.chat_conversations")) {
        return { rows: [{ id: "11111111-1111-4111-8111-111111111111", title: "Rajat", whatsapp_phone: "919887601200" }] };
      }
      if (sql.includes("INSERT INTO public.chat_messages")) {
        return { rows: [{ id: "88888888-8888-4888-8888-888888888888" }] };
      }
      return { rows: [] };
    },
  };

  const out = await recordOutboundWhatsappChatMessage(db, {
    phone: "9887601200",
    customerName: "Rajat",
    content: "Quotation QTN-001 attached",
    waMessageId: "wa-doc-1",
    fileUrl: "/api/functions/document-pdf?type=quotation&id=abc",
    fileName: "QTN-001.pdf",
    fileType: "application/pdf",
  });
  assert.equal(out.conversationId, "11111111-1111-4111-8111-111111111111");
  assert.equal(out.messageId, "88888888-8888-4888-8888-888888888888");
});
