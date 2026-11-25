export interface InvoiceMetricRow {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  total: number;
  paid_amount: number;
  payment_status: string;
  status: string;
  customers?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

export interface InvoiceSummaryStats {
  uniqueClients: number;
  totalCount: number;
  paidCount: number;
  unpaidCount: number;
  paidRevenue: number;
  unpaidBalance: number;
  totalBilled: number;
}

function safeNum(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Compute portfolio KPI metrics over unfiltered invoices cleanly, excluding
 * cancelled invoices from billed/receivable totals while counting all clients.
 */
export function summarizeInvoices(invoices: InvoiceMetricRow[]): InvoiceSummaryStats {
  const clients = new Set<string>();
  let paidCount = 0;
  let unpaidCount = 0;
  let paidRevenue = 0;
  let unpaidBalance = 0;
  let totalBilled = 0;

  for (const inv of invoices) {
    const clientKey = inv.customer_id || inv.customers?.name?.trim() || "";
    if (clientKey) clients.add(clientKey);

    const status = String(inv.status ?? "").toLowerCase();
    const payStatus = String(inv.payment_status ?? "").toLowerCase();
    if (status === "cancelled") continue;

    const total = Math.max(0, safeNum(inv.total));
    const paidAmount = Math.max(0, safeNum(inv.paid_amount));
    const collected = payStatus === "paid" ? Math.max(paidAmount, total) : Math.min(total, paidAmount);
    const balance = Math.max(0, total - collected);

    totalBilled += total;
    paidRevenue += collected;
    if (payStatus === "paid" || balance <= 0) {
      paidCount += 1;
    } else {
      unpaidCount += 1;
      unpaidBalance += balance;
    }
  }

  return {
    uniqueClients: clients.size,
    totalCount: invoices.length,
    paidCount,
    unpaidCount,
    paidRevenue,
    unpaidBalance,
    totalBilled,
  };
}

/** Client-side filter across status tabs, invoice number, and customer details. */
export function filterInvoices<T extends InvoiceMetricRow>(
  invoices: T[],
  statusFilter: string,
  search: string
): T[] {
  const q = search.trim().toLowerCase();
  return invoices.filter((inv) => {
    if (statusFilter !== "all" && inv.status !== statusFilter) return false;
    if (!q) return true;
    return (
      String(inv.invoice_number ?? "").toLowerCase().includes(q) ||
      String(inv.customers?.name ?? "").toLowerCase().includes(q) ||
      String(inv.customers?.email ?? "").toLowerCase().includes(q) ||
      String(inv.customers?.phone ?? "").toLowerCase().includes(q)
    );
  });
}
