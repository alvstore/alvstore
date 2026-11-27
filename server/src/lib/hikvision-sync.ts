/**
 * Pure helpers for Hik-Partner Pro attendance punch reconciliation and MQ event filtering.
 */

export interface PunchUpdatePlan {
  action: "insert" | "update_check_in" | "update_check_out" | "noop";
  dateKey: string;
  checkInIso?: string;
  checkOutIso?: string | null;
}

const MIN_CHECKOUT_GAP_MS = 60_000;

function parseTimeMs(val: unknown): number | null {
  if (!val) return null;
  if (val instanceof Date) {
    const ms = val.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(String(val));
  return Number.isFinite(ms) ? ms : null;
}

function toIsoStringSafe(val: unknown): string | undefined {
  if (!val) return undefined;
  if (val instanceof Date) return Number.isFinite(val.getTime()) ? val.toISOString() : undefined;
  return String(val);
}

/** Extract YYYY-MM-DD in device local calendar day (uses IST fallback for JS Date objects from Postgres). */
export function extractEventDateKey(eventTime: unknown): string {
  if (typeof eventTime === "string") {
    const m = eventTime.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }
  const ms = parseTimeMs(eventTime);
  if (ms !== null) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ms));
  }
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
}

/**
 * Decide how a biometric punch updates a single employee+date attendance_records row:
 * - No existing row -> insert check_in.
 * - Earlier punch -> shift check_in earlier cleanly (prevents timezone string compare bugs).
 * - Punch >= 60s after check_in and later than current check_out -> set/advance check_out.
 * - Rapid double-tap within 60s -> ignore as duplicate check-in.
 */
export function planAttendancePunchUpdate(args: {
  existingCheckIn?: unknown;
  existingCheckOut?: unknown;
  eventTime: string | Date;
}): PunchUpdatePlan {
  const dateKey = extractEventDateKey(args.eventTime);
  const eventMs = parseTimeMs(args.eventTime);
  const eventIso = toIsoStringSafe(args.eventTime);
  if (eventMs === null || !eventIso) {
    return { action: "noop", dateKey };
  }

  const inMs = parseTimeMs(args.existingCheckIn);
  if (inMs === null) {
    return { action: "insert", dateKey, checkInIso: eventIso };
  }

  if (eventMs < inMs) {
    // Keep previous check_in as candidate check_out if separated by >= 60s
    const existingOutMs = parseTimeMs(args.existingCheckOut);
    const promotedOut =
      inMs - eventMs >= MIN_CHECKOUT_GAP_MS && (existingOutMs === null || inMs > existingOutMs)
        ? toIsoStringSafe(args.existingCheckIn)
        : toIsoStringSafe(args.existingCheckOut) ?? null;
    return {
      action: "update_check_in",
      dateKey,
      checkInIso: eventIso,
      checkOutIso: promotedOut,
    };
  }

  if (eventMs - inMs < MIN_CHECKOUT_GAP_MS) {
    return { action: "noop", dateKey };
  }

  const outMs = parseTimeMs(args.existingCheckOut);
  if (outMs === null || eventMs > outMs) {
    return { action: "update_check_out", dateKey, checkOutIso: eventIso };
  }

  return { action: "noop", dateKey };
}
