export interface PosProduct {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  category?: string | null;
  image_url: string | null;
  selling_price: number;
  gst_percentage: number;
  stock_quantity: number;
  unit: string | null;
  isCustom?: boolean;
}

export interface PosCartItem {
  product: PosProduct;
  quantity: number;
  lineTotal: number;
  lineGst: number;
}

export interface PosTxnRecord {
  id?: string;
  transaction_number?: string;
  subtotal?: number | string | null;
  gst_amount?: number | string | null;
  total?: number | string | null;
  payment_method?: string | null;
  created_at: string;
  items?: unknown;
}

export interface PosCartTotals {
  grossSubtotal: number;
  discountAmount: number;
  subtotal: number;
  gstAmount: number;
  total: number;
  itemCount: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computePosCartTotals(
  cart: PosCartItem[],
  discountType: "percentage" | "fixed",
  discountValue: number
): PosCartTotals {
  const grossSubtotal = round2(cart.reduce((s, c) => s + Number(c.lineTotal || 0), 0));
  const rawGst = round2(cart.reduce((s, c) => s + Number(c.lineGst || 0), 0));
  const safeVal = Math.max(0, Number(discountValue) || 0);
  const rawDiscount =
    discountType === "percentage"
      ? (grossSubtotal * Math.min(safeVal, 100)) / 100
      : safeVal;
  const discountAmount = round2(Math.min(rawDiscount, grossSubtotal));
  const subtotal = round2(Math.max(0, grossSubtotal - discountAmount));
  const ratio = grossSubtotal > 0 ? subtotal / grossSubtotal : 1;
  const gstAmount = round2(rawGst * ratio);
  const total = round2(subtotal + gstAmount);
  const itemCount = cart.reduce((s, c) => s + Number(c.quantity || 0), 0);

  return {
    grossSubtotal,
    discountAmount,
    subtotal,
    gstAmount,
    total,
    itemCount,
  };
}

export interface ShiftTelemetry {
  todayRevenue: number;
  todayOrders: number;
  periodRevenue: number;
  periodOrders: number;
  avgTicket: number;
  hourlyBuckets: { hour: string; revenue: number; orders: number }[];
  dailyBuckets: { label: string; revenue: number; orders: number }[];
  methodBreakdown: { method: string; label: string; amount: number; count: number; pct: number }[];
}

export function buildPosShiftTelemetry(
  txns: PosTxnRecord[],
  rangeDays: 1 | 7 | 30,
  now: Date = new Date()
): ShiftTelemetry {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const cutoff = startOfToday - (rangeDays - 1) * 86400000;

  const todayTxns = txns.filter(t => new Date(t.created_at).getTime() >= startOfToday);
  const periodTxns = txns.filter(t => new Date(t.created_at).getTime() >= cutoff);

  const todayRevenue = round2(todayTxns.reduce((s, t) => s + (Number(t.total) || 0), 0));
  const periodRevenue = round2(periodTxns.reduce((s, t) => s + (Number(t.total) || 0), 0));
  const avgTicket = periodTxns.length > 0 ? round2(periodRevenue / periodTxns.length) : 0;

  // Hourly cadence buckets across operating day (09:00 .. 21:00)
  const hourlyMap = new Map<number, { revenue: number; orders: number }>();
  for (let h = 9; h <= 21; h++) hourlyMap.set(h, { revenue: 0, orders: 0 });
  for (const t of todayTxns) {
    const h = Math.min(21, Math.max(9, new Date(t.created_at).getHours()));
    const slot = hourlyMap.get(h)!;
    slot.revenue = round2(slot.revenue + (Number(t.total) || 0));
    slot.orders += 1;
  }
  const hourlyBuckets = Array.from(hourlyMap.entries()).map(([h, v]) => ({
    hour: `${String(h).padStart(2, "0")}:00`,
    revenue: v.revenue,
    orders: v.orders,
  }));

  // Multi-day buckets (7d / 30d)
  const dailyMap = new Map<string, { label: string; revenue: number; orders: number }>();
  const span = rangeDays === 1 ? 7 : rangeDays;
  for (let i = span - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const label = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    dailyMap.set(key, { label, revenue: 0, orders: 0 });
  }
  for (const t of txns) {
    const d = new Date(t.created_at);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    const slot = dailyMap.get(key);
    if (slot) {
      slot.revenue = round2(slot.revenue + (Number(t.total) || 0));
      slot.orders += 1;
    }
  }
  const dailyBuckets = Array.from(dailyMap.values());

  // Payment method mix
  const methodTotals: Record<string, { label: string; amount: number; count: number }> = {
    cash: { label: "Cash", amount: 0, count: 0 },
    upi: { label: "UPI", amount: 0, count: 0 },
    card: { label: "Card", amount: 0, count: 0 },
  };
  for (const t of periodTxns) {
    const m = String(t.payment_method || "cash").toLowerCase();
    const key = m in methodTotals ? m : "cash";
    methodTotals[key].amount = round2(methodTotals[key].amount + (Number(t.total) || 0));
    methodTotals[key].count += 1;
  }
  const methodBreakdown = Object.entries(methodTotals).map(([method, v]) => ({
    method,
    label: v.label,
    amount: v.amount,
    count: v.count,
    pct: periodRevenue > 0 ? Math.round((v.amount / periodRevenue) * 100) : 0,
  }));

  return {
    todayRevenue,
    todayOrders: todayTxns.length,
    periodRevenue,
    periodOrders: periodTxns.length,
    avgTicket,
    hourlyBuckets,
    dailyBuckets,
    methodBreakdown,
  };
}
