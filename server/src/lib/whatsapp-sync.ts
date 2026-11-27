import {
  normalizePhoneLast10,
  normalizeWhatsappNumber,
  type NormalizedInboundMessage,
  type NormalizedStatusUpdate,
} from "./whatsapp-gateway.js";

export interface PgQueryable {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(val: unknown): val is string {
  return typeof val === "string" && UUID_RE.test(val.trim());
}

/** Find or create the `/chat` WhatsApp thread for a contact phone (matched by last 10 digits). */
export async function findOrCreateWhatsappChatConversation(
  db: PgQueryable,
  opts: {
    phone: string;
    title?: string | null;
    lastMessage?: string | null;
    timestampIso?: string;
    createdBy?: string | null;
  }
): Promise<{ id: string; phone: string; title: string; isNew: boolean }> {
  const normalizedPhone = normalizeWhatsappNumber(opts.phone);
  const last10 = normalizePhoneLast10(normalizedPhone || opts.phone);
  const ts = opts.timestampIso || new Date().toISOString();
  const displayPhone = normalizedPhone ? `+${normalizedPhone}` : opts.phone;
  const fallbackTitle = (opts.title || "").trim() || displayPhone;

  const existingRes = last10
    ? await db.query(
        `SELECT id, title, whatsapp_phone
         FROM public.chat_conversations
         WHERE channel = 'whatsapp'
           AND (
             right(regexp_replace(COALESCE(whatsapp_phone, ''), '\\D', '', 'g'), 10) = $1
             OR whatsapp_phone = $2
           )
         ORDER BY last_message_at DESC NULLS LAST, created_at DESC
         LIMIT 1`,
        [last10, normalizedPhone || opts.phone]
      )
    : { rows: [] };

  const existing = existingRes.rows[0] as
    | { id: string; title: string | null; whatsapp_phone: string | null }
    | undefined;

  if (existing) {
    const cleanTitle = (opts.title || "").trim();
    const shouldUpgradeTitle =
      Boolean(cleanTitle) &&
      (!existing.title ||
        existing.title.startsWith("+") ||
        existing.title.startsWith("WhatsApp "));
    const nextTitle = shouldUpgradeTitle ? cleanTitle : existing.title || fallbackTitle;

    await db.query(
      `UPDATE public.chat_conversations
       SET title = $1,
           last_message = COALESCE($2, last_message),
           last_message_at = $3::timestamptz,
           whatsapp_phone = COALESCE(whatsapp_phone, $4)
       WHERE id = $5::uuid`,
      [
        nextTitle,
        opts.lastMessage ?? null,
        ts,
        normalizedPhone || opts.phone,
        existing.id,
      ]
    );
    return {
      id: existing.id,
      phone: existing.whatsapp_phone || normalizedPhone || opts.phone,
      title: nextTitle,
      isNew: false,
    };
  }

  const createdBy = isValidUuid(opts.createdBy) ? opts.createdBy : null;
  const inserted = await db.query(
    `INSERT INTO public.chat_conversations
      (type, title, participant_ids, last_message, last_message_at, created_by, channel, whatsapp_phone)
     VALUES ('whatsapp', $1, '{}'::uuid[], $2, $3::timestamptz, $4::uuid, 'whatsapp', $5)
     RETURNING id, title, whatsapp_phone`,
    [
      fallbackTitle,
      opts.lastMessage || "",
      ts,
      createdBy,
      normalizedPhone || opts.phone,
    ]
  );

  const row = inserted.rows[0] as { id: string; title: string; whatsapp_phone: string };
  return {
    id: row.id,
    phone: row.whatsapp_phone || normalizedPhone || opts.phone,
    title: row.title || fallbackTitle,
    isNew: true,
  };
}

/** Record an outbound WhatsApp message (text or PDF/media) into `/chat`. */
export async function recordOutboundWhatsappChatMessage(
  db: PgQueryable,
  args: {
    phone: string;
    conversationId?: string | null;
    senderId?: string | null;
    customerName?: string | null;
    content: string;
    waMessageId?: string | null;
    fileUrl?: string | null;
    fileName?: string | null;
    fileType?: string | null;
  }
): Promise<{ conversationId: string; messageId: string | null }> {
  const ts = new Date().toISOString();
  let convoId = isValidUuid(args.conversationId) ? args.conversationId.trim() : "";

  if (!convoId) {
    const convo = await findOrCreateWhatsappChatConversation(db, {
      phone: args.phone,
      title: args.customerName,
      lastMessage: args.content,
      timestampIso: ts,
      createdBy: args.senderId ?? null,
    });
    convoId = convo.id;
  } else {
    await db.query(
      `UPDATE public.chat_conversations
       SET last_message = $1, last_message_at = $2::timestamptz
       WHERE id = $3::uuid`,
      [args.content, ts, convoId]
    );
  }

  const senderId = isValidUuid(args.senderId) ? args.senderId.trim() : null;
  const msgRes = await db.query(
    `INSERT INTO public.chat_messages
      (conversation_id, sender_id, content, channel, whatsapp_message_id, delivery_status, file_url, file_name, file_type)
     VALUES ($1::uuid, $2::uuid, $3, 'whatsapp', $4, 'sent', $5, $6, $7)
     RETURNING id`,
    [
      convoId,
      senderId,
      args.content,
      args.waMessageId ?? null,
      args.fileUrl ?? null,
      args.fileName ?? null,
      args.fileType ?? null,
    ]
  );

  return {
    conversationId: convoId,
    messageId: (msgRes.rows[0]?.id as string) ?? null,
  };
}

/**
 * Persist inbound WhatsApp messages strictly into `/chat` (`chat_conversations` + `chat_messages`),
 * linking existing Customers/Leads when phone matches without auto-creating leads for unknown numbers.
 */
export async function syncInboundWhatsappMessages(
  db: PgQueryable,
  messages: NormalizedInboundMessage[]
): Promise<{
  processed: number;
  skippedDuplicates: number;
  createdChats: number;
  linkedLeadIds: string[];
}> {
  let processed = 0;
  let skippedDuplicates = 0;
  let createdChats = 0;
  const linkedLeadIds: string[] = [];

  for (const msg of messages) {
    if (msg.externalId) {
      const dup = await db.query(
        `SELECT id FROM public.chat_messages WHERE whatsapp_message_id = $1 LIMIT 1`,
        [msg.externalId]
      );
      if (dup.rows.length > 0) {
        skippedDuplicates += 1;
        continue;
      }
    }

    const custRes = await db.query(
      `SELECT id, name
       FROM public.customers
       WHERE right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [msg.last10]
    );
    const customer = custRes.rows[0] as { id: string; name: string | null } | undefined;

    const leadRes = await db.query(
      `SELECT id, name
       FROM public.leads
       WHERE right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [msg.last10]
    );
    const lead = leadRes.rows[0] as { id: string; name: string | null } | undefined;
    if (lead?.id) linkedLeadIds.push(lead.id);

    const displayTitle =
      customer?.name || lead?.name || msg.senderName || `+${msg.fromPhone}`;

    const chatConvo = await findOrCreateWhatsappChatConversation(db, {
      phone: msg.fromPhone,
      title: displayTitle,
      lastMessage: msg.text,
      timestampIso: msg.timestampIso,
    });
    if (chatConvo.isNew) createdChats += 1;

    await db.query(
      `INSERT INTO public.chat_messages
        (conversation_id, sender_id, content, channel, whatsapp_message_id, delivery_status, created_at)
       VALUES ($1::uuid, NULL, $2, 'whatsapp', $3, 'received', $4::timestamptz)`,
      [chatConvo.id, msg.text, msg.externalId, msg.timestampIso]
    );

    // Mirror to whatsapp_conversations / whatsapp_messages audit log without auto-creating leads
    try {
      const waConvoRes = await db.query(
        `SELECT id, lead_id
         FROM public.whatsapp_conversations
         WHERE right(regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g'), 10) = $1
         LIMIT 1`,
        [msg.last10]
      );
      let waConvoId = waConvoRes.rows[0]?.id as string | undefined;
      if (!waConvoId) {
        const ins = await db.query(
          `INSERT INTO public.whatsapp_conversations (phone_number, lead_id, status, last_message_at)
           VALUES ($1, $2::uuid, 'open', $3::timestamptz)
           RETURNING id`,
          [msg.fromPhone, lead?.id ?? null, msg.timestampIso]
        );
        waConvoId = ins.rows[0]?.id as string | undefined;
      } else {
        await db.query(
          `UPDATE public.whatsapp_conversations
           SET last_message_at = $1::timestamptz,
               lead_id = COALESCE(lead_id, $2::uuid)
           WHERE id = $3::uuid`,
          [msg.timestampIso, lead?.id ?? null, waConvoId]
        );
      }

      if (waConvoId) {
        await db.query(
          `INSERT INTO public.whatsapp_messages
            (wa_message_id, conversation_id, lead_id, direction, type, body, status, timestamp)
           VALUES ($1, $2::uuid, $3::uuid, 'inbound', 'text', $4, 'received', $5::timestamptz)`,
          [msg.externalId, waConvoId, lead?.id ?? null, msg.text, msg.timestampIso]
        );
      }

      if (lead?.id) {
        await db.query(
          `INSERT INTO public.lead_activities (lead_id, type, description)
           VALUES ($1::uuid, 'whatsapp', $2)`,
          [lead.id, `Inbound WhatsApp: ${msg.text.slice(0, 240)}`]
        );
      }

      const recipientsRes = await db.query(
        `SELECT DISTINCT user_id FROM public.user_roles WHERE role IN ('admin', 'staff')`
      );
      for (const rec of recipientsRes.rows) {
        await db.query(
          `INSERT INTO public.notification_feed (user_id, type, title, body, metadata)
           VALUES ($1::uuid, 'whatsapp', $2, $3, $4::jsonb)`,
          [
            rec.user_id,
            `WhatsApp from ${displayTitle}`,
            msg.text.slice(0, 120),
            JSON.stringify({
              conversation_id: chatConvo.id,
              phone: msg.fromPhone,
              lead_id: lead?.id ?? null,
              link: `/chat?conversation=${chatConvo.id}`,
            }),
          ]
        );
      }
    } catch (auxErr) {
      console.warn("[whatsapp-sync] auxiliary log failed:", (auxErr as Error).message);
    }

    processed += 1;
  }

  return { processed, skippedDuplicates, createdChats, linkedLeadIds };
}

/** Propagate sent/delivered/read/failed ACKs to both `chat_messages` and `whatsapp_messages`. */
export async function syncWhatsappDeliveryStatuses(
  db: PgQueryable,
  updates: NormalizedStatusUpdate[]
): Promise<number> {
  let updated = 0;
  for (const upd of updates) {
    if (!upd.externalId) continue;
    await db.query(
      `UPDATE public.chat_messages
       SET delivery_status = $1,
           delivered_at = CASE WHEN $1 IN ('delivered', 'read') AND delivered_at IS NULL THEN now() ELSE delivered_at END,
           read_at = CASE WHEN $1 = 'read' AND read_at IS NULL THEN now() ELSE read_at END
       WHERE whatsapp_message_id = $2`,
      [upd.status, upd.externalId]
    );
    await db.query(
      `UPDATE public.whatsapp_messages SET status = $1 WHERE wa_message_id = $2`,
      [upd.status, upd.externalId]
    );
    updated += 1;
  }
  return updated;
}

/** Promote an unknown WhatsApp chat conversation into a tracked `/leads` CRM record on demand. */
export async function promoteWhatsappChatToLead(
  db: PgQueryable,
  opts: {
    conversationId: string;
    userId?: string | null;
    name?: string | null;
    interest?: string | null;
    notes?: string | null;
  }
): Promise<{ created: boolean; lead: Record<string, unknown> }> {
  const convoRes = await db.query(
    `SELECT id, title, whatsapp_phone, channel
     FROM public.chat_conversations
     WHERE id = $1::uuid
     LIMIT 1`,
    [opts.conversationId]
  );
  const convo = convoRes.rows[0] as
    | { id: string; title: string | null; whatsapp_phone: string | null; channel: string | null }
    | undefined;
  if (!convo) {
    throw Object.assign(new Error("WhatsApp conversation not found"), { status: 404 });
  }
  if (convo.channel !== "whatsapp" || !convo.whatsapp_phone) {
    throw Object.assign(new Error("Only WhatsApp conversations can be promoted to Leads"), {
      status: 400,
    });
  }

  const last10 = normalizePhoneLast10(convo.whatsapp_phone);
  const existingLeadRes = last10
    ? await db.query(
        `SELECT id, name, phone, status, pipeline_stage, source
         FROM public.leads
         WHERE right(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [last10]
      )
    : { rows: [] };

  if (existingLeadRes.rows.length > 0) {
    return { created: false, lead: existingLeadRes.rows[0] };
  }

  const msgRes = await db.query(
    `SELECT content
     FROM public.chat_messages
     WHERE conversation_id = $1::uuid
     ORDER BY created_at ASC
     LIMIT 5`,
    [convo.id]
  );
  const snippet = msgRes.rows
    .map((r) => String(r.content || "").trim())
    .filter(Boolean)
    .join("\n");

  const leadName =
    (opts.name || "").trim() ||
    (convo.title && !convo.title.startsWith("+") ? convo.title.trim() : "") ||
    `WhatsApp +${normalizeWhatsappNumber(convo.whatsapp_phone)}`;
  const interestLine = (opts.interest || "").trim() ? `Interest: ${(opts.interest || "").trim()}\n` : "";
  const leadNotes =
    (opts.notes || "").trim() ||
    `${interestLine}${snippet ? `Promoted from WhatsApp Chat:\n${snippet.slice(0, 600)}` : "Promoted from WhatsApp Chat"}`.trim();
  const assignedTo = isValidUuid(opts.userId) ? opts.userId.trim() : null;

  const insRes = await db.query(
    `INSERT INTO public.leads
      (name, phone, source, notes, assigned_to, created_by, status, pipeline_stage, score)
     VALUES ($1, $2, 'whatsapp', $3, $4::uuid, $4::uuid, 'new', 'new', 50)
     RETURNING id, name, phone, source, status, pipeline_stage`,
    [
      leadName,
      normalizeWhatsappNumber(convo.whatsapp_phone) || convo.whatsapp_phone,
      leadNotes,
      assignedTo,
    ]
  );
  const newLead = insRes.rows[0];

  if (last10 && newLead?.id) {
    await db.query(
      `UPDATE public.whatsapp_conversations
       SET lead_id = COALESCE(lead_id, $1::uuid)
       WHERE right(regexp_replace(COALESCE(phone_number, ''), '\\D', '', 'g'), 10) = $2`,
      [newLead.id, last10]
    );
  }

  if (newLead?.id) {
    await db.query(
      `INSERT INTO public.lead_activities (lead_id, type, description, created_by)
       VALUES ($1::uuid, 'note', $2, $3::uuid)`,
      [newLead.id, "Created lead from WhatsApp Chat thread", assignedTo]
    );
    await db.query(
      `INSERT INTO public.system_audit_log (user_id, action, module, entity_type, entity_id, details)
       VALUES ($1::uuid, 'whatsapp_chat_promoted_to_lead', 'leads', 'lead', $2::uuid, $3::jsonb)`,
      [
        assignedTo,
        newLead.id,
        JSON.stringify({ conversation_id: convo.id, phone: convo.whatsapp_phone }),
      ]
    );
  }

  return { created: true, lead: newLead };
}
