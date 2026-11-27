/**
 * Pure helpers for Hik-Partner Pro attendance punch reconciliation and MQ event filtering.
 */

/** Minimal pg-compatible query interface for testable Hikvision persistence helpers. */
export interface QueryableDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }>;
}

export interface EmployeeMappingInput {
  code: string;
  name: string;
  deviceId: string | null;
  erpEmployeeId?: string | null;
  cardNumber?: string | null;
}

export interface AttendanceLogInput {
  deviceId: string | null;
  employeeCode: string;
  employeeName: string;
  erpEmployeeId: string | null;
  deviceSerial: string;
  deviceName: string;
  eventTime: string;
  eventType: string;
  rawData: unknown;
  dedupeKey: string;
  sourceMode: string;
  attStatus?: string;
  verifyMode?: string;
  serialNo?: string;
}

/** Upsert a hikvision_employee_mapping row, guarding NULL device_id where UNIQUE treats NULLs as distinct. */
export async function persistEmployeeMapping(db: QueryableDb, args: EmployeeMappingInput): Promise<void> {
  if (!args.deviceId) {
    const existing = await db.query(
      "SELECT id FROM public.hikvision_employee_mapping WHERE device_employee_code = $1 AND device_id IS NULL LIMIT 1",
      [args.code]
    );
    if (existing.rows.length > 0) {
      await db.query(
        `UPDATE public.hikvision_employee_mapping
         SET device_employee_name = $1,
             card_number = COALESCE($2, card_number),
             erp_employee_id = COALESCE($3, erp_employee_id),
             synced_at = now()
         WHERE id = $4`,
        [args.name, args.cardNumber ?? null, args.erpEmployeeId ?? null, existing.rows[0].id]
      );
    } else {
      await db.query(
        `INSERT INTO public.hikvision_employee_mapping
           (device_employee_code, device_employee_name, device_id, erp_employee_id, card_number, synced_at)
         VALUES ($1, $2, NULL, $3, $4, now())`,
        [args.code, args.name, args.erpEmployeeId ?? null, args.cardNumber ?? null]
      );
    }
    return;
  }

  await db.query(
    `INSERT INTO public.hikvision_employee_mapping
       (device_employee_code, device_employee_name, device_id, erp_employee_id, card_number, synced_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (device_employee_code, device_id) DO UPDATE
       SET device_employee_name = EXCLUDED.device_employee_name,
           card_number = COALESCE(EXCLUDED.card_number, hikvision_employee_mapping.card_number),
           erp_employee_id = COALESCE(EXCLUDED.erp_employee_id, hikvision_employee_mapping.erp_employee_id),
           synced_at = now()`,
    [args.code, args.name, args.deviceId, args.erpEmployeeId ?? null, args.cardNumber ?? null]
  );
}

/**
 * Persist a Hikvision attendance event using schema's real unique key (device_id, employee_code, event_time)
 * plus explicit dedupe_key / NULL-device_id pre-checks so duplicate webhook/MQ events never raise 42P10.
 */
export async function persistAttendanceLog(
  db: QueryableDb,
  args: AttendanceLogInput
): Promise<{ stored: boolean; duplicate?: boolean }> {
  if (args.dedupeKey) {
    const existingDedupe = await db.query(
      "SELECT 1 FROM public.hikvision_attendance_logs WHERE dedupe_key = $1 LIMIT 1",
      [args.dedupeKey]
    );
    if ((existingDedupe.rowCount ?? existingDedupe.rows.length) > 0) {
      return { stored: false, duplicate: true };
    }
  }

  if (!args.deviceId) {
    const existingNullDev = await db.query(
      `SELECT 1 FROM public.hikvision_attendance_logs
       WHERE device_id IS NULL AND employee_code = $1 AND event_time = $2 LIMIT 1`,
      [args.employeeCode, args.eventTime]
    );
    if ((existingNullDev.rowCount ?? existingNullDev.rows.length) > 0) {
      return { stored: false, duplicate: true };
    }
  }

  const r = await db.query(
    `INSERT INTO public.hikvision_attendance_logs
       (device_id, employee_code, employee_name, employee_id, device_ip, device_name, event_time, event_type,
        raw_data, dedupe_key, source_mode, attendance_status, verify_mode, event_serial_no)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
     ON CONFLICT (device_id, employee_code, event_time) DO NOTHING`,
    [
      args.deviceId,
      args.employeeCode,
      args.employeeName,
      args.erpEmployeeId,
      args.deviceSerial,
      args.deviceName,
      args.eventTime,
      args.eventType,
      JSON.stringify(args.rawData ?? {}),
      args.dedupeKey,
      args.sourceMode,
      args.attStatus || null,
      args.verifyMode || null,
      args.serialNo || null,
    ]
  );

  if ((r.rowCount ?? 0) > 0) return { stored: true };
  return { stored: false, duplicate: true };
}

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
