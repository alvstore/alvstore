import assert from "node:assert/strict";
import test from "node:test";
import { extractEventDateKey, planAttendancePunchUpdate } from "../src/lib/hikvision-sync.js";

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
