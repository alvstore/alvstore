import assert from "node:assert/strict";
import test from "node:test";
import {
  extractEventDateKey,
  persistAttendanceLog,
  persistEmployeeMapping,
  planAttendancePunchUpdate,
} from "../src/lib/hikvision-sync.js";

test("extractEventDateKey preserves IST local calendar date even past midnight UTC boundaries", () => {
  assert.equal(extractEventDateKey("2026-11-27T01:15:00+05:30"), "2026-11-27");
  assert.equal(extractEventDateKey(new Date("2026-11-26T19:45:00.000Z")), "2026-11-27");
  assert.equal(extractEventDateKey("2026-11-27T15:26:27+05:30"), "2026-11-27");
});

test("planAttendancePunchUpdate inserts initial check-in, ignores 4s double-tap, and advances evening check-out", () => {
  // First punch inserts check_in
  const first = planAttendancePunchUpdate({
    eventTime: "2026-11-27T15:26:27+05:30",
  });
  assert.equal(first.action, "insert");
  assert.equal(first.dateKey, "2026-11-27");
  assert.equal(first.checkInIso, "2026-11-27T15:26:27+05:30");

  // Stored UTC Date from PostgreSQL (15:26:27 IST = 09:56:27Z) + 4s double-tap (15:26:31 IST)
  const storedCheckInUtc = new Date("2026-11-27T09:56:27.000Z");
  const doubleTap = planAttendancePunchUpdate({
    existingCheckIn: storedCheckInUtc,
    existingCheckOut: null,
    eventTime: "2026-11-27T15:26:31+05:30",
  });
  assert.equal(doubleTap.action, "noop");

  // Afternoon check-out 2 hours later updates check_out cleanly
  const afternoonOut = planAttendancePunchUpdate({
    existingCheckIn: storedCheckInUtc,
    existingCheckOut: null,
    eventTime: "2026-11-27T17:30:00+05:30",
  });
  assert.equal(afternoonOut.action, "update_check_out");
  assert.equal(afternoonOut.checkOutIso, "2026-11-27T17:30:00+05:30");

  // Even later evening check-out overrides intermediate break punch cleanly
  const eveningOut = planAttendancePunchUpdate({
    existingCheckIn: storedCheckInUtc,
    existingCheckOut: new Date("2026-11-27T12:00:00.000Z"),
    eventTime: "2026-11-27T19:45:00+05:30",
  });
  assert.equal(eveningOut.action, "update_check_out");
  assert.equal(eveningOut.checkOutIso, "2026-11-27T19:45:00+05:30");
});

test("planAttendancePunchUpdate shifts check_in earlier when backfill punches arrive out of chronological order", () => {
  const res = planAttendancePunchUpdate({
    existingCheckIn: new Date("2026-11-27T12:30:00.000Z"), // 18:00 IST
    existingCheckOut: null,
    eventTime: "2026-11-27T09:30:00+05:30", // 04:00Z
  });
  assert.equal(res.action, "update_check_in");
  assert.equal(res.checkInIso, "2026-11-27T09:30:00+05:30");
  assert.equal(res.checkOutIso, "2026-11-27T12:30:00.000Z");
});

test("persistAttendanceLog uses schema unique constraint (device_id, employee_code, event_time) and dedupes by dedupe_key", async () => {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const fakeDb = {
    async query(sql: string, params: unknown[] = []) {
      calls.push({ sql, params });
      if (sql.includes("WHERE dedupe_key = $1")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO public.hikvision_attendance_logs")) return { rows: [], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    },
  };

  const first = await persistAttendanceLog(fakeDb, {
    deviceId: "dev-uuid-1",
    employeeCode: "1",
    employeeName: "Rajat Lekhari",
    erpEmployeeId: "emp-uuid-1",
    deviceSerial: "FF6426490",
    deviceName: "DS-K1T343EFWX",
    eventTime: "2026-11-27T15:26:27+05:30",
    eventType: "access",
    rawData: { employeeNoString: "1" },
    dedupeKey: "FF6426490:101",
    sourceMode: "polling",
    attStatus: "checkIn",
    verifyMode: "face",
    serialNo: "101",
  });

  assert.equal(first.stored, true);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].sql.includes("ON CONFLICT (device_id, employee_code, event_time) DO NOTHING"));
  assert.ok(!calls[1].sql.includes("ON CONFLICT (dedupe_key)"));

  const dupDb = {
    async query(sql: string) {
      if (sql.includes("WHERE dedupe_key = $1")) return { rows: [{ "?column?": 1 }], rowCount: 1 };
      throw new Error("Should skip INSERT when dedupe_key already exists");
    },
  };
  const second = await persistAttendanceLog(dupDb, {
    deviceId: null,
    employeeCode: "1",
    employeeName: "Rajat Lekhari",
    erpEmployeeId: null,
    deviceSerial: "FF6426490",
    deviceName: "",
    eventTime: "2026-11-27T15:26:27+05:30",
    eventType: "attendance",
    rawData: {},
    dedupeKey: "FF6426490:101",
    sourceMode: "webhook",
  });
  assert.deepEqual(second, { stored: false, duplicate: true });
});

test("persistEmployeeMapping avoids duplicate NULL-device_id conflicts and upserts concrete device_id", async () => {
  const nullCalls: string[] = [];
  await persistEmployeeMapping(
    {
      async query(sql: string) {
        nullCalls.push(sql);
        if (sql.includes("SELECT id")) return { rows: [{ id: "map-1" }], rowCount: 1 };
        return { rows: [], rowCount: 1 };
      },
    },
    { code: "1", name: "Rajat Lekhari", deviceId: null, erpEmployeeId: "emp-1" }
  );
  assert.equal(nullCalls.length, 2);
  assert.ok(nullCalls[1].includes("UPDATE public.hikvision_employee_mapping"));

  const devCalls: string[] = [];
  await persistEmployeeMapping(
    {
      async query(sql: string) {
        devCalls.push(sql);
        return { rows: [], rowCount: 1 };
      },
    },
    { code: "1", name: "Rajat Lekhari", deviceId: "dev-1", erpEmployeeId: "emp-1" }
  );
  assert.equal(devCalls.length, 1);
  assert.ok(devCalls[0].includes("ON CONFLICT (device_employee_code, device_id) DO UPDATE"));
});
