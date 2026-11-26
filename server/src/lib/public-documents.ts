export function todayIstDateString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isQuotationExpired(validUntil: string | Date | null | undefined, now: Date = new Date()): boolean {
  if (!validUntil) return false;
  const isoDate =
    validUntil instanceof Date
      ? validUntil.toISOString().slice(0, 10)
      : String(validUntil).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  return isoDate < todayIstDateString(now);
}

export function validatePublicQuotationResponse(input: {
  status: string;
  validUntil: string | Date | null | undefined;
  action: string;
  signatureName?: string;
  signatureData?: string;
  now?: Date;
}): { ok: true } | { ok: false; code: string; message: string; status: number } {
  const act = input.action?.toLowerCase();
  if (act !== "accept" && act !== "reject") {
    return { ok: false, code: "INVALID_ACTION", message: "Action must be 'accept' or 'reject'", status: 400 };
  }
  if (!["draft", "sent"].includes(input.status)) {
    return {
      ok: false,
      code: "ALREADY_RESPONDED",
      message: `Quotation has already been marked as ${input.status}`,
      status: 409,
    };
  }
  if (isQuotationExpired(input.validUntil, input.now)) {
    return {
      ok: false,
      code: "EXPIRED",
      message: "This quotation has expired past its validity date. Please request a fresh quotation.",
      status: 400,
    };
  }
  if (act === "accept") {
    if (!input.signatureName || !input.signatureName.trim()) {
      return { ok: false, code: "SIGNATURE_NAME_REQUIRED", message: "Please enter your full name to accept", status: 400 };
    }
    if (!input.signatureData || !input.signatureData.startsWith("data:image/")) {
      return { ok: false, code: "SIGNATURE_REQUIRED", message: "Please draw your signature to accept this quotation", status: 400 };
    }
  }
  return { ok: true };
}

export const CHALLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  packed: "Packed & Ready",
  sent: "Dispatched",
  dispatched: "Dispatched",
  in_transit: "In Transit",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  returned: "Returned",
  invoiced: "Invoiced",
  cancelled: "Cancelled",
};

export const CHALLAN_POD_ALLOWED_STATUSES = new Set(["sent", "dispatched", "in_transit", "out_for_delivery"]);

export interface ChallanTimelineEntry {
  status: string;
  label: string;
  note?: string;
  at: string;
  by?: string;
}

export function appendChallanTimeline(
  existing: unknown,
  entry: Omit<ChallanTimelineEntry, "at" | "label"> & { at?: string; label?: string }
): ChallanTimelineEntry[] {
  const list: ChallanTimelineEntry[] = Array.isArray(existing) ? existing : [];
  return [
    ...list,
    {
      status: entry.status,
      label: entry.label || CHALLAN_STATUS_LABELS[entry.status] || entry.status,
      note: entry.note,
      by: entry.by,
      at: entry.at || new Date().toISOString(),
    },
  ];
}
