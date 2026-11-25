export interface RepairPartLine {
  cost: number | string | null | undefined;
  quantity: number | string | null | undefined;
  gst_percentage?: number | string | null | undefined;
  total: number | string | null | undefined;
}

export interface RepairBillingSummary {
  serviceCharge: number;
  serviceGstAmount: number;
  serviceTotal: number;
  partsSubtotal: number;
  partsGst: number;
  partsTotalWithGst: number;
  combinedGst: number;
  grandTotal: number;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeRepairPartGst(part: RepairPartLine, gstMode: string | null | undefined): number {
  if (!gstMode || gstMode === "none") return 0;
  const lineTotal = Number(part.total) || 0;
  const gstPct = Number(part.gst_percentage ?? 18) || 0;
  if (gstPct <= 0 || lineTotal <= 0) return 0;
  if (gstMode === "inclusive") {
    return round2((lineTotal * gstPct) / (100 + gstPct));
  }
  return round2((lineTotal * gstPct) / 100);
}

/**
 * Unifies GST and parts math across Repair Detail, Invoice Generation,
 * Payment Recording, and Customer Public Portal.
 */
export function computeRepairBillingSummary(input: {
  serviceCharge?: number | string | null;
  gstAmount?: number | string | null;
  totalAmount?: number | string | null;
  gstMode?: string | null;
  repairParts?: RepairPartLine[];
}): RepairBillingSummary {
  const serviceCharge = round2(Number(input.serviceCharge) || 0);
  const serviceGstAmount = round2(Number(input.gstAmount) || 0);
  const serviceTotal = round2(Number(input.totalAmount) || 0);
  const parts = input.repairParts || [];
  const partsSubtotal = round2(parts.reduce((s, p) => s + (Number(p.total) || 0), 0));
  const partsGst = round2(parts.reduce((s, p) => s + computeRepairPartGst(p, input.gstMode), 0));
  const partsTotalWithGst =
    input.gstMode === "exclusive" ? round2(partsSubtotal + partsGst) : partsSubtotal;
  const combinedGst = input.gstMode === "none" ? 0 : round2(serviceGstAmount + partsGst);
  const grandTotal = round2(serviceTotal + partsTotalWithGst);

  return {
    serviceCharge,
    serviceGstAmount,
    serviceTotal,
    partsSubtotal,
    partsGst,
    partsTotalWithGst,
    combinedGst,
    grandTotal,
  };
}
