import { getBackendAuthHeaders, supabase } from "@/integrations/supabase/client";

export type ClientFinanceEntrySource =
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

export interface ClientFinanceSyncInput {
  entry_source: ClientFinanceEntrySource;
  source_id?: string | null;
  type: "income" | "expense";
  amount: number;
  date?: string;
  payment_mode?: string | null;
  account_id?: string | null;
  category_name?: string | null;
  category_id?: string | null;
  customer_id?: string | null;
  reference?: string | null;
  description?: string | null;
  staff_name?: string | null;
  sync_cash_control?: boolean;
}

export interface CashControlContextResponse {
  targetDate: string;
  previousDay: {
    date: string;
    status: string | null;
    opening_cash: number;
    closing_cash: number | null;
    expected_closing: number | null;
  } | null;
  suggestedOpening: number;
  nonCashSummary: {
    income: number;
    expense: number;
    net: number;
    byChannel: Record<string, { income: number; expense: number }>;
  };
  chainAudit: Record<
    string,
    {
      status: "genesis" | "linked" | "overridden" | "mismatch";
      previousDate: string | null;
      previousClosing: number | null;
      delta: number;
      overrideReason: string | null;
    }
  >;
  postCloseAlerts: Record<string, { liveExpected: number; savedExpected: number; delta: number }>;
}

/** IST-safe YYYY-MM-DD formatter avoiding UTC shift bugs near midnight. */
export function localDateKey(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Normalizes any PG date string or ISO timestamp to YYYY-MM-DD safely. */
export function normalizeCashDate(v?: string | Date | null): string {
  if (!v) return localDateKey();
  if (v instanceof Date) return localDateKey(v);
  const m = String(v).trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : localDateKey();
}

/** Non-throwing idempotent helper that posts money movements into Finance & Daily Cash Control. */
export async function syncFinanceEvent(input: ClientFinanceSyncInput): Promise<{
  ok: boolean;
  transactionId?: string | null;
  deduplicated?: boolean;
  error?: string;
}> {
  try {
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      return { ok: true, transactionId: null };
    }
    const { data, error } = await supabase.functions.invoke("finance-sync", {
      body: {
        ...input,
        date: input.date || localDateKey(),
      },
    });
    if (error) {
      console.warn("[syncFinanceEvent]", error.message);
      return { ok: false, error: error.message };
    }
    return {
      ok: true,
      transactionId: data?.transaction?.id ?? null,
      deduplicated: Boolean(data?.deduplicated),
    };
  } catch (err) {
    console.warn("[syncFinanceEvent]", err);
    return { ok: false, error: err instanceof Error ? err.message : "Sync failed" };
  }
}

export async function fetchCashControlContext(dateKey?: string): Promise<CashControlContextResponse | null> {
  try {
    const qs = new URLSearchParams();
    if (dateKey) qs.set("date", dateKey);
    const res = await fetch(`/api/backend/functions/cash-control-context?${qs.toString()}`, {
      method: "GET",
      headers: { ...getBackendAuthHeaders() },
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return payload as CashControlContextResponse;
  } catch {
    return null;
  }
}

export async function recomputeCashControlDay(opts: {
  date: string;
  reopen?: boolean;
  reason?: string;
  allow_create?: boolean;
}) {
  const { data, error } = await supabase.functions.invoke("cash-control-recompute", {
    body: opts,
  });
  if (error) throw new Error(error.message || "Failed to recompute day");
  return data;
}

export async function openCashflowAuditPdf(opts: {
  fromDate: string;
  toDate: string;
  entrySource?: string;
  channel?: string;
  download?: boolean;
}) {
  const params = new URLSearchParams({
    from: opts.fromDate,
    to: opts.toDate,
    entry_source: opts.entrySource || "all",
    channel: opts.channel || "all",
  });
  if (opts.download) params.set("download", "1");

  const res = await fetch(`/api/backend/functions/cashflow-audit-pdf?${params.toString()}`, {
    method: "GET",
    headers: { ...getBackendAuthHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to generate Cash Flow PDF (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  if (opts.download) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `ALVStore-CashFlow-Audit-${opts.fromDate}-to-${opts.toDate}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function openPayrollSlipPdf(payrollId: string, download = false, filename?: string) {
  const params = new URLSearchParams({ id: payrollId });
  if (download) params.set("download", "1");
  const res = await fetch(`/api/backend/functions/payroll-pdf?${params.toString()}`, {
    method: "GET",
    headers: { ...getBackendAuthHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error || `Failed to generate Payslip PDF (${res.status})`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  if (download) {
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || `Payslip-${payrollId.slice(0, 8)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } else {
    window.open(blobUrl, "_blank", "noopener,noreferrer");
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}
