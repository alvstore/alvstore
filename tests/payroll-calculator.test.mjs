import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { root } from "../tools/check-ui.mjs";

async function importTs(file) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}

const {
  DEFAULT_PAYROLL_POLICY,
  allocateAdvanceRecovery,
  calculateEmployeePayroll,
  matchesEmployeeAttendance,
} = await importTs("src/lib/payroll-calculator.ts");

test("matchesEmployeeAttendance matches both employees.id and employees.user_id cleanly", () => {
  const emp = { id: "emp-uuid-1", user_id: "user-uuid-9" };
  assert.equal(matchesEmployeeAttendance(emp, "emp-uuid-1"), true);
  assert.equal(matchesEmployeeAttendance(emp, "user-uuid-9"), true);
  assert.equal(matchesEmployeeAttendance(emp, "other-uuid"), false);
  assert.equal(matchesEmployeeAttendance({ id: "emp-only", user_id: null }, "emp-only"), true);
});

test("exclude_weekly_off + paid holidays never dock salaried employees for Sundays or Paid Leaves", () => {
  // November 2026: 30 days, Sundays on 1, 8, 15, 22, 29 -> 25 non-Sunday days;
  // plus 1 paid holiday on 2026-11-12 (Thu) -> 24 scheduled workdays, holiday unpunched = NOT deducted!
  const emp = { id: "emp-1", user_id: "user-1", salary: 30000 };
  const holiday = "2026-11-12";
  const allWorkdaysExceptOneAbsentAndOneHalf = [];
  for (let d = 1; d <= 30; d++) {
    const dateKey = `2026-11-${String(d).padStart(2, "0")}`;
    const dow = new Date(2026, 10, d).getDay();
    if (dow === 0 || dateKey === holiday) continue;
    if (dateKey === "2026-11-02") {
      // Explicit paid leave stored via user_id -> must NOT dock pay
      allWorkdaysExceptOneAbsentAndOneHalf.push({
        employee_id: "user-1",
        date: dateKey,
        status: "paid_leave",
      });
    } else if (dateKey === "2026-11-03") {
      // Unpunched / omitted = 1 absent day
      continue;
    } else if (dateKey === "2026-11-04") {
      // Short punch duration (<5h) -> half day (0.5d deduction)
      allWorkdaysExceptOneAbsentAndOneHalf.push({
        employee_id: "user-1",
        date: dateKey,
        check_in: "2026-11-04T09:30:00+05:30",
        check_out: "2026-11-04T13:00:00+05:30",
      });
    } else {
      allWorkdaysExceptOneAbsentAndOneHalf.push({
        employee_id: d % 2 === 0 ? "user-1" : "emp-1",
        date: dateKey,
        check_in: `${dateKey}T09:30:00+05:30`,
        check_out: `${dateKey}T18:30:00+05:30`,
      });
    }
  }

  const res = calculateEmployeePayroll({
    employee: emp,
    month: "2026-11",
    attendance: allWorkdaysExceptOneAbsentAndOneHalf,
    policy: {
      ...DEFAULT_PAYROLL_POLICY,
      paid_holidays: [{ date: holiday, name: "Diwali Holiday" }],
    },
    activeAdvances: [{ id: "adv-1", remaining_amount: 5000, advance_date: "2026-11-05" }],
  });

  // 25 Mon-Sat days total in Nov 2026 (Sun = 1,8,15,22,29; 1 holiday = 2026-11-12 -> 24 workdays: 21 present + 1 half + 1 paid leave + 1 absent)
  assert.equal(res.scheduledWorkingDays, 24);
  assert.equal(res.divisorDays, 24);
  assert.equal(res.presentDays, 21);
  assert.equal(res.halfDays, 1);
  assert.equal(res.paidLeaveDays, 1);
  assert.equal(res.absentDays, 1);
  assert.equal(res.deductionDays, 1.5);
  assert.equal(res.perDayRate, 1250);
  // 30000 - 1.5 * 1250 = 28125
  assert.equal(res.earnedBasic, 28125);
  assert.equal(res.availableAdvanceBalance, 5000);
  assert.equal(res.recommendedAdvanceDeduction, 5000);
  assert.equal(res.netSalary, 23125);
});

test("calendar_days and fixed_26 modes respect weekly offs without docking Sundays and cap negative net", () => {
  const emp = { id: "emp-2", user_id: null, salary: 26000 };
  const recs = [];
  for (let d = 1; d <= 30; d++) {
    const dateKey = `2026-11-${String(d).padStart(2, "0")}`;
    const dow = new Date(2026, 10, d).getDay();
    if (dow === 0) continue; // Sunday off
    recs.push({ employee_id: "emp-2", date: dateKey, status: "present" });
  }

  const fixed26 = calculateEmployeePayroll({
    employee: emp,
    month: "2026-11",
    attendance: recs,
    policy: { ...DEFAULT_PAYROLL_POLICY, working_days_mode: "fixed_26" },
    activeAdvances: [{ id: "adv-big", remaining_amount: 40000, advance_date: "2026-11-01" }],
    bonus: 1000,
    otherDeductions: 2000,
  });

  assert.equal(fixed26.divisorDays, 26);
  assert.equal(fixed26.absentDays, 0);
  assert.equal(fixed26.earnedBasic, 26000); // Full salary when no absences!
  assert.equal(fixed26.recommendedAdvanceDeduction, 25000); // Capped at 26000 + 1000 - 2000
  assert.equal(fixed26.netSalary, 0);

  const cal30 = calculateEmployeePayroll({
    employee: { id: "emp-3", user_id: null, salary: 30000 },
    month: "2026-11",
    attendance: [{ employee_id: "emp-3", date: "2026-11-02", status: "unpaid_leave" }],
    policy: { ...DEFAULT_PAYROLL_POLICY, working_days_mode: "calendar_days" },
    activeAdvances: [],
  });
  // Only 2026-11-02 has a record (unpaid_leave), all other Mon-Sat (24 days) have no punch -> 25 absent/unpaid days
  assert.equal(cal30.divisorDays, 30);
  assert.equal(cal30.deductionDays, 25);
  assert.equal(cal30.earnedBasic, 5000);
});

test("allocateAdvanceRecovery splits deduction FIFO across multiple active advances cleanly", () => {
  const plan = allocateAdvanceRecovery(
    [
      { id: "a2", remaining_amount: 4000, advance_date: "2026-11-10" },
      { id: "a1", remaining_amount: 3000, advance_date: "2026-11-02" },
    ],
    4500
  );

  assert.deepEqual(plan, [
    {
      advance_id: "a1",
      amount_recovered: 3000,
      previous_remaining: 3000,
      new_remaining: 0,
      new_status: "recovered",
    },
    {
      advance_id: "a2",
      amount_recovered: 1500,
      previous_remaining: 4000,
      new_remaining: 2500,
      new_status: "partial",
    },
  ]);
});
