import type { Queryable } from "./finance-sync.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizePhoneLast10(phone?: string | null): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function extractCityAndNotes(rawNotes?: string | null): { city: string | null; cleanNotes: string | null } {
  const raw = String(rawNotes ?? "").trim();
  if (!raw) return { city: null, cleanNotes: null };
  let city: string | null = null;
  for (const line of raw.split(/\r?\n/)) {
    const m = line.trim().match(/^city\s*:\s*(.+)$/i);
    if (m) {
      city = m[1].trim() || null;
      break;
    }
  }
  return { city, cleanNotes: raw.slice(0, 1000) };
}

/**
 * Atomically deletes leads plus polymorphic child rows (follow_up_notes, lead notification_feed items)
 * while lead_activities cascade and WhatsApp threads unlink safely via SetNull.
 */
export async function deleteLeadsTx(
  client: Queryable,
  input: { ids: string[]; userId?: string | null }
): Promise<{ deletedIds: string[]; deletedCount: number }> {
  const cleanIds = [...new Set((input.ids || []).map((id) => String(id).trim()).filter((id) => UUID_RE.test(id)))];
  if (cleanIds.length === 0) {
    throw Object.assign(new Error("At least one valid lead id is required"), { status: 400 });
  }
  if (cleanIds.length > 100) {
    throw Object.assign(new Error("Cannot delete more than 100 leads in one request"), { status: 400 });
  }

  const { rows: existing } = await client.query<{
    id: string;
    name: string;
    phone: string | null;
    source: string | null;
  }>(`SELECT id, name, phone, source FROM public.leads WHERE id = ANY($1::uuid[])`, [cleanIds]);

  if (existing.length === 0) {
    return { deletedIds: [], deletedCount: 0 };
  }

  const foundIds = existing.map((r) => r.id);

  await client.query(
    `DELETE FROM public.follow_up_notes WHERE entity_type = 'lead' AND entity_id = ANY($1::uuid[])`,
    [foundIds]
  );
  await client.query(
    `DELETE FROM public.notification_feed WHERE type = 'lead' AND metadata->>'lead_id' = ANY($1::text[])`,
    [foundIds]
  );

  const { rows: deletedRows } = await client.query<{ id: string }>(
    `DELETE FROM public.leads WHERE id = ANY($1::uuid[]) RETURNING id`,
    [foundIds]
  );

  const namesPreview = existing
    .slice(0, 5)
    .map((r) => r.name || r.phone || r.id)
    .join(", ");
  const extraCount = existing.length > 5 ? ` (+${existing.length - 5} more)` : "";
  await client.query(
    `INSERT INTO public.system_audit_log (user_id, action, entity_type, entity_id, details)
     VALUES ($1::uuid, 'LEADS_DELETED', 'lead', $2::uuid, $3)`,
    [
      input.userId || null,
      foundIds.length === 1 ? foundIds[0] : null,
      `Deleted ${foundIds.length} lead(s): ${namesPreview}${extraCount}`,
    ]
  );

  return {
    deletedIds: deletedRows.map((r) => r.id),
    deletedCount: deletedRows.length,
  };
}

/**
 * Idempotently converts a CRM lead into a Customer, reusing an existing customer matched by
 * normalized 10-digit phone or lowercase email to prevent duplicate accounts in /customers.
 */
export async function convertLeadTx(
  client: Queryable,
  input: { leadId: string; userId?: string | null }
): Promise<{
  customer: Record<string, unknown>;
  lead: Record<string, unknown>;
  reusedExistingCustomer: boolean;
}> {
  const leadId = String(input.leadId || "").trim();
  if (!UUID_RE.test(leadId)) {
    throw Object.assign(new Error("Valid lead id is required"), { status: 400 });
  }

  const { rows: leadRows } = await client.query<Record<string, unknown>>(
    `SELECT * FROM public.leads WHERE id = $1::uuid LIMIT 1`,
    [leadId]
  );
  const lead = leadRows[0];
  if (!lead) {
    throw Object.assign(new Error("Lead not found"), { status: 404 });
  }

  let customer: Record<string, unknown> | undefined;
  let reusedExistingCustomer = false;

  if (lead.converted_customer_id) {
    const { rows: linked } = await client.query<Record<string, unknown>>(
      `SELECT * FROM public.customers WHERE id = $1::uuid LIMIT 1`,
      [lead.converted_customer_id]
    );
    if (linked[0]) {
      customer = linked[0];
      reusedExistingCustomer = true;
    }
  }

  const last10 = normalizePhoneLast10(lead.phone as string | null);
  const email = typeof lead.email === "string" ? lead.email.trim().toLowerCase() : "";

  if (!customer && last10.length >= 10) {
    const { rows: byPhone } = await client.query<Record<string, unknown>>(
      `SELECT * FROM public.customers
       WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') LIKE '%' || $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [last10]
    );
    if (byPhone[0]) {
      customer = byPhone[0];
      reusedExistingCustomer = true;
    }
  }

  if (!customer && email) {
    const { rows: byEmail } = await client.query<Record<string, unknown>>(
      `SELECT * FROM public.customers WHERE lower(coalesce(email, '')) = $1 ORDER BY created_at ASC LIMIT 1`,
      [email]
    );
    if (byEmail[0]) {
      customer = byEmail[0];
      reusedExistingCustomer = true;
    }
  }

  if (!customer) {
    const { city, cleanNotes } = extractCityAndNotes(lead.notes as string | null);
    const { rows: insertedCustomer } = await client.query<Record<string, unknown>>(
      `INSERT INTO public.customers (name, phone, email, city, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6::uuid)
       RETURNING *`,
      [
        String(lead.name || "Customer").trim(),
        (lead.phone as string | null) || null,
        email || null,
        city,
        cleanNotes,
        input.userId || null,
      ]
    );
    customer = insertedCustomer[0];
  }

  const wasConverted = Boolean(lead.converted_customer_id) && lead.pipeline_stage === "converted";
  const { rows: updatedLeadRows } = await client.query<Record<string, unknown>>(
    `UPDATE public.leads
     SET status = 'converted',
         pipeline_stage = 'converted',
         converted_customer_id = $1::uuid,
         updated_at = now()
     WHERE id = $2::uuid
     RETURNING *`,
    [customer.id, leadId]
  );

  if (!wasConverted) {
    await client.query(
      `INSERT INTO public.lead_activities (lead_id, type, description, outcome, created_by)
       VALUES ($1::uuid, 'note', $2, $3, $4::uuid)`,
      [
        leadId,
        reusedExistingCustomer
          ? `Linked lead to existing customer ${String(customer.name || "")}`
          : `Converted lead to new customer ${String(customer.name || "")}`,
        "Converted",
        input.userId || null,
      ]
    );
  }

  return {
    customer,
    lead: updatedLeadRows[0] ?? lead,
    reusedExistingCustomer,
  };
}
