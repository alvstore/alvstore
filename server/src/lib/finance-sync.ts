export interface Queryable {
  query: <T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: unknown[]
  ) => Promise<{ rows: T[] }>;
}

export type FinanceEntrySource =
  | "manual"
  | "pos"
  | "invoice"
  | "payment"
  | "payment_register"
  | "repair"
  | "purchase_bill"
  | "supplier"
  | "technician"
  | "payroll"
  | "advance"
  | "advance_refund"
  | "razorpay";

export interface CashDayTotals {
  opening_cash?: number | string | null;
  pos_total?: number | string | null;
  auto_income?: number | string | null;
  manual_income?: number | string | null;
  transfer_in?: number | string | null;
  auto_expense?: number | string | null;
  manual_expense?: number | string | null;
  transfer_out?: number | string | null;
}

export interface CashDaySummary extends CashDayTotals {
  date: string;
  closing_cash?: number | string | null;
  expected_closing?: number | string | null;
  status?: string | null;
  opening_override_reason?: string | null;
}

export interface CarryAuditEntry {
  status: "genesis" | "linked" | "overridden" | "mismatch";
  previousDate: string | null;
  previousClosing: number | null;
  delta: number;
  overrideReason: string | null;
}

export interface FinanceSyncInput {
  entry_source: FinanceEntrySource;
  source_id?: string | null;
  type: "income" | "expense";
  amount: number;
  date?: string | null;
  payment_mode?: string | null;
  account_id?: string | null;
  category_name?: string | null;
  category_id?: string | null;
  customer_id?: string | null;
  reference?: string | null;
  description?: string | null;
  staff_name?: string | null;
  user_id?: string | null;
  sync_cash_control?: boolean;
}

export function normalizeDateKey(val?: string | Date | null): string {
  if (!val) {
    // Default IST-aware local YYYY-MM-DD when called on UTC host
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  }
  if (val instanceof Date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(val);
  }
  const s = String(val).trim();
  const match = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(parsed);
  }
  return normalizeDateKey(null);
}

/** Routes cash -> 'cash', card/upi/bank/online/razorpay/cheque -> 'bank'. */
export function resolveAccountTypeForMode(paymentMode?: string | null): "cash" | "bank" {
  const mode = String(paymentMode ?? "cash").trim().toLowerCase();
  if (!mode || mode === "cash" || mode === "petty_cash" || mode === "drawer") return "cash";
  return "bank";
}

function n2(v: unknown): number {
  const num = Number(v ?? 0);
  return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
}

/** Canonical daily cash drawer closing expectation. */
export function computeCashDayExpectedClosing(row: CashDayTotals): number {
  const sum =
    n2(row.opening_cash) +
    n2(row.pos_total) +
    n2(row.auto_income) +
    n2(row.manual_income) +
    n2(row.transfer_in) -
    n2(row.auto_expense) -
    n2(row.manual_expense) -
    n2(row.transfer_out);
  return Math.round(sum * 100) / 100;
}

/** Audits consecutive days so every day's closing balance chains cleanly to next day's opening. */
export function auditCarryForwardChain(days: CashDaySummary[]): Record<string, CarryAuditEntry> {
  const sortedAsc = [...days].sort((a, b) =>
    normalizeDateKey(a.date).localeCompare(normalizeDateKey(b.date))
  );
  const result: Record<string, CarryAuditEntry> = {};

  for (let i = 0; i < sortedAsc.length; i++) {
    const curr = sortedAsc[i];
    const currKey = normalizeDateKey(curr.date);
    if (i === 0) {
      result[currKey] = {
        status: "genesis",
        previousDate: null,
        previousClosing: null,
        delta: 0,
        overrideReason: curr.opening_override_reason || null,
      };
      continue;
    }

    const prev = sortedAsc[i - 1];
    const prevKey = normalizeDateKey(prev.date);
    const prevExpected = prev.expected_closing != null ? n2(prev.expected_closing) : computeCashDayExpectedClosing(prev);
    const prevClosing = prev.closing_cash != null ? n2(prev.closing_cash) : prevExpected;
    const delta = Math.round((n2(curr.opening_cash) - prevClosing) * 100) / 100;
    const reason = curr.opening_override_reason?.trim() || null;

    result[currKey] = {
      status: Math.abs(delta) < 0.01 ? "linked" : reason ? "overridden" : "mismatch",
      previousDate: prevKey,
      previousClosing: prevClosing,
      delta,
      overrideReason: reason,
    };
  }

  return result;
}

async function resolveAccountForSync(
  client: Queryable,
  preferredAccountId: string | null | undefined,
  paymentMode: string | null | undefined,
  userId?: string | null
): Promise<{ id: string; type: string; name: string }> {
  const desiredType = resolveAccountTypeForMode(paymentMode);
  if (preferredAccountId) {
    const { rows } = await client.query<{ id: string; type: string; name: string }>(
      "SELECT id, type, name FROM public.finance_accounts WHERE id = $1 LIMIT 1",
      [preferredAccountId]
    );
    if (rows[0]) return rows[0];
  }

  const { rows: matching } = await client.query<{ id: string; type: string; name: string }>(
    `SELECT id, type, name FROM public.finance_accounts
     WHERE status = 'active' AND type = $1
     ORDER BY created_at ASC LIMIT 1`,
    [desiredType]
  );
  if (matching[0]) return matching[0];

  const { rows: created } = await client.query<{ id: string; type: string; name: string }>(
    `INSERT INTO public.finance_accounts (name, type, opening_balance, current_balance, status, created_by)
     VALUES ($1, $2, 0, 0, 'active', $3)
     RETURNING id, type, name`,
    [desiredType === "cash" ? "Cash Drawer" : "Primary Bank Account", desiredType, userId || null]
  );
  return created[0];
}

async function resolveCategoryId(
  client: Queryable,
  explicitCategoryId: string | null | undefined,
  categoryName: string | null | undefined,
  type: "income" | "expense"
): Promise<string | null> {
  if (explicitCategoryId) return explicitCategoryId;
  if (!categoryName?.trim()) return null;
  const { rows } = await client.query<{ id: string }>(
    `SELECT id FROM public.finance_categories
     WHERE type = $1 AND LOWER(name) = LOWER($2)
     LIMIT 1`,
    [type, categoryName.trim()]
  );
  if (rows[0]) return rows[0].id;
  const { rows: inserted } = await client.query<{ id: string }>(
    `INSERT INTO public.finance_categories (name, type, status)
     VALUES ($1, $2, 'active')
     RETURNING id`,
    [categoryName.trim(), type]
  );
  return inserted[0]?.id ?? null;
}

export async function aggregateCashMovementsForDate(
  client: Queryable,
  dateKey: string
): Promise<{
  pos_total: number;
  auto_income: number;
  manual_income: number;
  auto_expense: number;
  manual_expense: number;
  transfer_in: number;
  transfer_out: number;
}> {
  const { rows: cashAccts } = await client.query<{ id: string }>(
    "SELECT id FROM public.finance_accounts WHERE type = 'cash'"
  );
  const cashSet = new Set(cashAccts.map((a) => a.id));

  const { rows: txns } = await client.query<{
    type: string;
    entry_source: string;
    amount: number | string;
    payment_mode: string | null;
    account_id: string | null;
    to_account_id: string | null;
  }>(
    `SELECT type, entry_source, amount, payment_mode, account_id, to_account_id
     FROM public.finance_transactions
     WHERE COALESCE(daily_cash_date, date) = $1::date`,
    [dateKey]
  );

  let pos_total = 0;
  let auto_income = 0;
  let manual_income = 0;
  let auto_expense = 0;
  let manual_expense = 0;
  let transfer_in = 0;
  let transfer_out = 0;

  for (const t of txns) {
    const amt = n2(t.amount);
    if (amt <= 0) continue;
    const fromIsCash = t.account_id ? cashSet.has(t.account_id) : resolveAccountTypeForMode(t.payment_mode) === "cash";
    const toIsCash = t.to_account_id ? cashSet.has(t.to_account_id) : false;

    if (t.type === "transfer") {
      if (fromIsCash && !toIsCash) transfer_out += amt;
      else if (!fromIsCash && toIsCash) transfer_in += amt;
      continue;
    }

    if (!fromIsCash) continue;

    if (t.type === "income") {
      if (t.entry_source === "pos") pos_total += amt;
      else if (t.entry_source === "manual") manual_income += amt;
      else auto_income += amt;
    } else if (t.type === "expense") {
      if (t.entry_source === "manual") manual_expense += amt;
      else auto_expense += amt;
    }
  }

  return {
    pos_total: Math.round(pos_total * 100) / 100,
    auto_income: Math.round(auto_income * 100) / 100,
    manual_income: Math.round(manual_income * 100) / 100,
    auto_expense: Math.round(auto_expense * 100) / 100,
    manual_expense: Math.round(manual_expense * 100) / 100,
    transfer_in: Math.round(transfer_in * 100) / 100,
    transfer_out: Math.round(transfer_out * 100) / 100,
  };
}

/**
 * Recomputes an open day's DailyCashControl drawer totals deterministically from finance_transactions
 * (or auto-initializes an open drawer row with yesterday's closing balance if none exists yet).
 * Closed days are NEVER silently overwritten.
 */
export async function syncDailyCashForDate(
  client: Queryable,
  dateInput?: string | Date | null,
  actor?: { userId?: string | null; staffName?: string | null; allowCreate?: boolean }
) {
  const dateKey = normalizeDateKey(dateInput);
  const { rows: existingRows } = await client.query<Record<string, unknown>>(
    "SELECT * FROM public.daily_cash_control WHERE date = $1::date LIMIT 1",
    [dateKey]
  );
  const existing = existingRows[0];

  if (existing && existing.status === "closed") {
    return { ...existing, postCloseSkipped: true };
  }

  const agg = await aggregateCashMovementsForDate(client, dateKey);

  if (!existing) {
    if (actor?.allowCreate === false) return null;
    const { rows: priorRows } = await client.query<{
      date: string;
      closing_cash: number | string | null;
      expected_closing: number | string | null;
      opening_cash: number | string | null;
    }>(
      `SELECT date, closing_cash, expected_closing, opening_cash
       FROM public.daily_cash_control
       WHERE date < $1::date
       ORDER BY date DESC LIMIT 1`,
      [dateKey]
    );
    const prior = priorRows[0];
    const carryOpening = prior ? n2(prior.closing_cash ?? prior.expected_closing ?? prior.opening_cash) : 0;
    const expected = computeCashDayExpectedClosing({ opening_cash: carryOpening, ...agg });

    const { rows: inserted } = await client.query<Record<string, unknown>>(
      `INSERT INTO public.daily_cash_control
       (date, opening_cash, previous_closing, pos_total, auto_income, manual_income, auto_expense, manual_expense, transfer_in, transfer_out, expected_closing, status, staff_name, created_by)
       VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'open', $12, $13)
       ON CONFLICT (date) DO UPDATE SET
         pos_total = EXCLUDED.pos_total,
         auto_income = EXCLUDED.auto_income,
         manual_income = EXCLUDED.manual_income,
         auto_expense = EXCLUDED.auto_expense,
         manual_expense = EXCLUDED.manual_expense,
         transfer_in = EXCLUDED.transfer_in,
         transfer_out = EXCLUDED.transfer_out,
         expected_closing = EXCLUDED.expected_closing
       RETURNING *`,
      [
        dateKey,
        carryOpening,
        carryOpening,
        agg.pos_total,
        agg.auto_income,
        agg.manual_income,
        agg.auto_expense,
        agg.manual_expense,
        agg.transfer_in,
        agg.transfer_out,
        expected,
        actor?.staffName || "Auto Sync",
        actor?.userId || null,
      ]
    );
    return inserted[0] ?? null;
  }

  const openingCash = n2(existing.opening_cash);
  const expected = computeCashDayExpectedClosing({ opening_cash: openingCash, ...agg });
  const { rows: updated } = await client.query<Record<string, unknown>>(
    `UPDATE public.daily_cash_control
     SET pos_total = $2,
         auto_income = $3,
         manual_income = $4,
         auto_expense = $5,
         manual_expense = $6,
         transfer_in = $7,
         transfer_out = $8,
         expected_closing = $9
     WHERE id = $1 AND status != 'closed'
     RETURNING *`,
    [
      existing.id,
      agg.pos_total,
      agg.auto_income,
      agg.manual_income,
      agg.auto_expense,
      agg.manual_expense,
      agg.transfer_in,
      agg.transfer_out,
      expected,
    ]
  );
  return updated[0] ?? existing;
}

/**
 * Idempotently records a finance transaction (with account & category resolution) and syncs
 * DailyCashControl when the target account or payment mode affects the physical cash drawer.
 */
export async function recordFinanceSync(client: Queryable, input: FinanceSyncInput) {
  const amount = n2(input.amount);
  if (amount <= 0) {
    throw new Error("Transaction amount must be greater than zero");
  }
  const dateKey = normalizeDateKey(input.date);
  const entrySource = input.entry_source || "manual";
  const sourceId = input.source_id ? String(input.source_id).trim() : null;
  const paymentMode = (input.payment_mode || "cash").toLowerCase();

  const account = await resolveAccountForSync(client, input.account_id, paymentMode, input.user_id);
  const categoryId = await resolveCategoryId(client, input.category_id, input.category_name, input.type);
  const affectsCashDrawer = account.type === "cash" || (!input.account_id && resolveAccountTypeForMode(paymentMode) === "cash");
  const dailyCashDate = affectsCashDrawer && input.sync_cash_control !== false ? dateKey : null;

  let transaction: Record<string, unknown> | null = null;
  let deduplicated = false;

  if (sourceId) {
    // Serialize concurrent sync calls per (entry_source, source_id) without requiring a Prisma @@unique
    // constraint that triggers --accept-data-loss on existing populated databases during db push.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${entrySource}:${sourceId}`]);
    const { rows: existing } = await client.query<Record<string, unknown>>(
      `SELECT * FROM public.finance_transactions WHERE entry_source = $1 AND source_id = $2 LIMIT 1`,
      [entrySource, sourceId]
    );
    if (existing[0]) {
      transaction = existing[0];
      deduplicated = true;
    } else {
      const { rows } = await client.query<Record<string, unknown>>(
        `INSERT INTO public.finance_transactions
         (type, entry_source, source_id, date, daily_cash_date, amount, payment_mode, account_id, category_id, customer_id, reference, description, staff_name, created_by)
         VALUES ($1, $2, $3, $4::date, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING *`,
        [
          input.type,
          entrySource,
          sourceId,
          dateKey,
          dailyCashDate,
          amount,
          paymentMode,
          account.id,
          categoryId,
          input.customer_id || null,
          input.reference || null,
          input.description || null,
          input.staff_name || null,
          input.user_id || null,
        ]
      );
      transaction = rows[0] ?? null;
    }
  } else {
    const { rows } = await client.query<Record<string, unknown>>(
      `INSERT INTO public.finance_transactions
       (type, entry_source, date, daily_cash_date, amount, payment_mode, account_id, category_id, customer_id, reference, description, staff_name, created_by)
       VALUES ($1, $2, $3::date, $4::date, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.type,
        entrySource,
        dateKey,
        dailyCashDate,
        amount,
        paymentMode,
        account.id,
        categoryId,
        input.customer_id || null,
        input.reference || null,
        input.description || null,
        input.staff_name || null,
        input.user_id || null,
      ]
    );
    transaction = rows[0] ?? null;
  }

  let dailyCash: Record<string, unknown> | null = null;
  if (dailyCashDate && !deduplicated) {
    dailyCash = await syncDailyCashForDate(client, dailyCashDate, {
      userId: input.user_id,
      staffName: input.staff_name,
    });
  }

  return {
    transaction,
    account,
    deduplicated,
    affectsCashDrawer,
    dailyCash,
  };
}
