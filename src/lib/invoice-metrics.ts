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
    if (total > 0 && (payStatus === "paid" || balance <= 0.005)) {
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

export interface PaymentComputation {
  valid: boolean;
  error?: string;
  nextPaid: number;
  remaining: number;
  paymentStatus: "paid" | "partial" | "unpaid";
  invoiceStatus: "paid" | "partial" | "sent";
}

/** Validate and compute cent-rounded invoice payment updates without IEEE-754 drift. */
export function computePaymentUpdate(
  total: number,
  currentPaid: number,
  paymentAmount: number
): PaymentComputation {
  const roundCents = (value: number) => Math.round(value * 100) / 100;
  const safeTotal = Math.max(0, roundCents(Number(total || 0)));
  const safePaid = Math.max(0, roundCents(Number(currentPaid || 0)));
  const remainingBefore = Math.max(0, roundCents(safeTotal - safePaid));

  if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
    return {
      valid: false,
      error: "Enter a valid positive payment amount.",
      nextPaid: safePaid,
      remaining: remainingBefore,
      paymentStatus: safeTotal > 0 && remainingBefore <= 0.005 ? "paid" : safePaid > 0 ? "partial" : "unpaid",
      invoiceStatus: safeTotal > 0 && remainingBefore <= 0.005 ? "paid" : safePaid > 0 ? "partial" : "sent",
    };
  }

  const safePay = roundCents(paymentAmount);
  if (safePay - remainingBefore > 0.005) {
    return {
      valid: false,
      error: "Payment cannot exceed the remaining invoice balance.",
      nextPaid: safePaid,
      remaining: remainingBefore,
      paymentStatus: safePaid > 0 ? "partial" : "unpaid",
      invoiceStatus: safePaid > 0 ? "partial" : "sent",
    };
  }

  const nextPaid = Math.min(safeTotal, roundCents(safePaid + safePay));
  const remaining = Math.max(0, roundCents(safeTotal - nextPaid));
  const isSettled = safeTotal > 0 && remaining <= 0.005;

  return {
    valid: true,
    nextPaid: isSettled ? safeTotal : nextPaid,
    remaining: isSettled ? 0 : remaining,
    paymentStatus: isSettled ? "paid" : nextPaid > 0 ? "partial" : "unpaid",
    invoiceStatus: isSettled ? "paid" : nextPaid > 0 ? "partial" : "sent",
  };
}
