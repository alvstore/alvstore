export type WorkingDaysMode = "exclude_weekly_off" | "calendar_days" | "fixed_26" | "fixed_30";

export interface PaidHolidayEntry {
  date: string;
  name: string;
}

export interface PayrollPolicy {
  working_days_mode: WorkingDaysMode;
  weekly_off_days: number[];
  half_day_hours_threshold: number;
  auto_deduct_advances: boolean;
  paid_holidays: PaidHolidayEntry[];
}

export const DEFAULT_PAYROLL_POLICY: PayrollPolicy = {
  working_days_mode: "exclude_weekly_off",
  weekly_off_days: [0],
  half_day_hours_threshold: 5,
  auto_deduct_advances: true,
  paid_holidays: [],
};

export interface AttendanceRecordLike {
  employee_id: string;
  date: string;
  status?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  notes?: string | null;
}

export interface PayrollAdvanceLike {
  id: string;
  advance_number?: string | null;
  remaining_amount: number | string;
  advance_date?: string | null;
  created_at?: string | null;
}

export interface AdvanceRecoveryAllocation {
  advance_id: string;
  amount_recovered: number;
  previous_remaining: number;
  new_remaining: number;
  new_status: "partial" | "recovered";
}

export interface PayrollCalculationInput {
  employee: { id: string; user_id?: string | null; salary?: number | string | null };
  month: string;
  attendance: AttendanceRecordLike[];
  policy?: Partial<PayrollPolicy> | null;
  activeAdvances?: PayrollAdvanceLike[];
  bonus?: number;
  otherDeductions?: number;
}

export interface PayrollCalculationResult {
  month: string;
  calendarDays: number;
  scheduledWorkingDays: number;
  divisorDays: number;
  weeklyOffCount: number;
  paidHolidayCount: number;
  presentDays: number;
  halfDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  absentDays: number;
  deductionDays: number;
  paidDays: number;
  workedOnOffDays: number;
  totalHours: number;
  perDayRate: number;
  monthlySalary: number;
  earnedBasic: number;
  availableAdvanceBalance: number;
  recommendedAdvanceDeduction: number;
  netSalary: number;
}

type DayClassification = "present" | "half_day" | "paid_leave" | "unpaid_leave" | "absent";

const CLASS_PRIORITY: Record<DayClassification, number> = {
  present: 5,
  half_day: 4,
  paid_leave: 3,
  unpaid_leave: 2,
  absent: 1,
};

/** Merges saved integrations.payroll_policy safely with sensible defaults. */
export function normalizePayrollPolicy(raw?: Partial<PayrollPolicy> | null): PayrollPolicy {
  const mode = raw?.working_days_mode;
  const validModes: WorkingDaysMode[] = ["exclude_weekly_off", "calendar_days", "fixed_26", "fixed_30"];
  const working_days_mode: WorkingDaysMode = mode && validModes.includes(mode) ? mode : DEFAULT_PAYROLL_POLICY.working_days_mode;
  const weekly_off_days = Array.isArray(raw?.weekly_off_days)
    ? raw!.weekly_off_days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
    : DEFAULT_PAYROLL_POLICY.weekly_off_days;
  const threshold = Number(raw?.half_day_hours_threshold);
  const half_day_hours_threshold = Number.isFinite(threshold) && threshold > 0 && threshold <= 12
    ? threshold
    : DEFAULT_PAYROLL_POLICY.half_day_hours_threshold;
  const auto_deduct_advances = raw?.auto_deduct_advances ?? DEFAULT_PAYROLL_POLICY.auto_deduct_advances;
  const paid_holidays = Array.isArray(raw?.paid_holidays)
    ? raw!.paid_holidays
        .filter((h) => h && typeof h.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(h.date))
        .map((h) => ({ date: String(h.date).slice(0, 10), name: String(h.name || "Holiday").trim() || "Holiday" }))
    : [];
  return {
    working_days_mode,
    weekly_off_days,
    half_day_hours_threshold,
    auto_deduct_advances,
    paid_holidays,
  };
}

/** Matches attendance_records saved under either employees.id or employees.user_id. */
export function matchesEmployeeAttendance(
  emp: { id: string; user_id?: string | null },
  recordEmployeeId: string | null | undefined
): boolean {
  if (!recordEmployeeId) return false;
  if (recordEmployeeId === emp.id) return true;
  if (emp.user_id && recordEmployeeId === emp.user_id) return true;
  return false;
}

function workedHours(rec: AttendanceRecordLike): number {
  if (!rec.check_in || !rec.check_out) return 0;
  const inMs = Date.parse(rec.check_in);
  const outMs = Date.parse(rec.check_out);
  if (!Number.isFinite(inMs) || !Number.isFinite(outMs) || outMs <= inMs) return 0;
  return (outMs - inMs) / 3600000;
}

export function classifyAttendanceRecord(rec: AttendanceRecordLike, halfDayThresholdHours = 5): DayClassification {
  const status = String(rec.status ?? "").toLowerCase().trim();
  const notes = String(rec.notes ?? "").toLowerCase();
  if (status === "absent") return "absent";
  if (status === "unpaid_leave") return "unpaid_leave";
  if (status === "paid_leave" || status === "leave" || notes.includes("paid leave")) return "paid_leave";
  if (notes.includes("unpaid leave")) return "unpaid_leave";
  if (status === "half_day" || notes.includes("half day")) return "half_day";
  const hrs = workedHours(rec);
  if (hrs > 0 && hrs < halfDayThresholdHours) return "half_day";
  return "present";
}

function daysInYearMonth(year: number, monthIndexZero: number): number {
  return new Date(Date.UTC(year, monthIndexZero + 1, 0)).getUTCDate();
}

/**
 * Pure attendance & salary computation engine.
 * Weekly offs and configured paid holidays never dock salaried employees for missing punches;
 * only explicit unpaid leaves, unpunched scheduled workdays, and half-days (0.5d) reduce earned basic.
 */
export function calculateEmployeePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const policy = normalizePayrollPolicy(input.policy);
  const [yrStr, moStr] = String(input.month || "").split("-");
  const year = Number.parseInt(yrStr || "", 10) || new Date().getFullYear();
  const monthNum = Number.parseInt(moStr || "", 10) || new Date().getMonth() + 1;
  const monthIndex = Math.max(0, Math.min(11, monthNum - 1));
  const calendarDays = daysInYearMonth(year, monthIndex);
  const holidaySet = new Set(policy.paid_holidays.map((h) => h.date));
  const offDaySet = new Set(policy.weekly_off_days);

  const byDate = new Map<string, { classification: DayClassification; hours: number }>();
  for (const rec of input.attendance || []) {
    if (!matchesEmployeeAttendance(input.employee, rec.employee_id)) continue;
    const dk = String(rec.date || "").slice(0, 10);
    if (!dk.startsWith(`${year}-${String(monthNum).padStart(2, "0")}`)) continue;
    const cls = classifyAttendanceRecord(rec, policy.half_day_hours_threshold);
    const hrs = workedHours(rec);
    const existing = byDate.get(dk);
    if (!existing) {
      byDate.set(dk, { classification: cls, hours: hrs });
    } else {
      const winner = CLASS_PRIORITY[cls] >= CLASS_PRIORITY[existing.classification] ? cls : existing.classification;
      byDate.set(dk, { classification: winner, hours: Math.max(existing.hours, hrs) });
    }
  }

  let scheduledWorkingDays = 0;
  let weeklyOffCount = 0;
  let paidHolidayCount = 0;
  let presentDays = 0;
  let halfDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;
  let workedOnOffDays = 0;
  let totalHours = 0;

  for (let d = 1; d <= calendarDays; d++) {
    const dk = `${year}-${String(monthNum).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dow = new Date(Date.UTC(year, monthIndex, d)).getUTCDay();
    const isWeeklyOff = offDaySet.has(dow);
    const isPaidHoliday = holidaySet.has(dk);
    const dayEntry = byDate.get(dk);
    if (dayEntry) totalHours += dayEntry.hours;

    if (isWeeklyOff || isPaidHoliday) {
      if (isWeeklyOff) weeklyOffCount++;
      if (isPaidHoliday && !isWeeklyOff) paidHolidayCount++;
      if (dayEntry && (dayEntry.classification === "present" || dayEntry.classification === "half_day")) {
        workedOnOffDays += dayEntry.classification === "half_day" ? 0.5 : 1;
      }
      continue;
    }

    scheduledWorkingDays += 1;
    if (!dayEntry || dayEntry.classification === "absent") {
      absentDays += 1;
    } else if (dayEntry.classification === "present") {
      presentDays += 1;
    } else if (dayEntry.classification === "half_day") {
      halfDays += 1;
    } else if (dayEntry.classification === "paid_leave") {
      paidLeaveDays += 1;
    } else if (dayEntry.classification === "unpaid_leave") {
      unpaidLeaveDays += 1;
    }
  }

  let divisorDays = calendarDays;
  if (policy.working_days_mode === "exclude_weekly_off") {
    divisorDays = Math.max(1, scheduledWorkingDays);
  } else if (policy.working_days_mode === "fixed_26") {
    divisorDays = 26;
  } else if (policy.working_days_mode === "fixed_30") {
    divisorDays = 30;
  }

  const rawDeductionDays = absentDays + unpaidLeaveDays + halfDays * 0.5;
  const deductionDays = Math.min(divisorDays, Math.round(rawDeductionDays * 100) / 100);
  const paidDays = Math.max(0, Math.round((divisorDays - deductionDays) * 100) / 100);

  const monthlySalary = Math.max(0, Number(input.employee.salary ?? 0) || 0);
  const perDayRate = divisorDays > 0 ? monthlySalary / divisorDays : 0;
  const earnedBasic = Math.max(0, Math.round(monthlySalary - deductionDays * perDayRate));

  const bonus = Math.max(0, Number(input.bonus ?? 0) || 0);
  const otherDeductions = Math.max(0, Number(input.otherDeductions ?? 0) || 0);
  const availableAdvanceBalance = Math.round(
    (input.activeAdvances || []).reduce((sum, a) => sum + Math.max(0, Number(a.remaining_amount || 0)), 0) * 100
  ) / 100;

  const preAdvanceNet = Math.max(0, earnedBasic + bonus - otherDeductions);
  const recommendedAdvanceDeduction = policy.auto_deduct_advances
    ? Math.min(availableAdvanceBalance, preAdvanceNet)
    : 0;
  const netSalary = Math.max(0, Math.round((preAdvanceNet - recommendedAdvanceDeduction) * 100) / 100);

  return {
    month: `${year}-${String(monthNum).padStart(2, "0")}`,
    calendarDays,
    scheduledWorkingDays,
    divisorDays,
    weeklyOffCount,
    paidHolidayCount,
    presentDays,
    halfDays,
    paidLeaveDays,
    unpaidLeaveDays,
    absentDays,
    deductionDays,
    paidDays,
    workedOnOffDays,
    totalHours: Math.round(totalHours * 10) / 10,
    perDayRate: Math.round(perDayRate * 100) / 100,
    monthlySalary,
    earnedBasic,
    availableAdvanceBalance,
    recommendedAdvanceDeduction,
    netSalary,
  };
}

/** Allocates a target payroll advance deduction FIFO oldest-first across active employee advances. */
export function allocateAdvanceRecovery(
  advances: PayrollAdvanceLike[],
  targetRecoveryAmount: number
): AdvanceRecoveryAllocation[] {
  let remainingToRecover = Math.max(0, Number(targetRecoveryAmount || 0));
  if (remainingToRecover <= 0) return [];

  const sorted = [...advances]
    .filter((a) => Number(a.remaining_amount || 0) > 0)
    .sort((a, b) => {
      const da = String(a.advance_date || a.created_at || "");
      const db = String(b.advance_date || b.created_at || "");
      return da.localeCompare(db);
    });

  const allocations: AdvanceRecoveryAllocation[] = [];
  for (const adv of sorted) {
    if (remainingToRecover <= 0.005) break;
    const prevRem = Math.max(0, Number(adv.remaining_amount || 0));
    const recovered = Math.min(prevRem, remainingToRecover);
    const nextRem = Math.max(0, Math.round((prevRem - recovered) * 100) / 100);
    allocations.push({
      advance_id: adv.id,
      amount_recovered: Math.round(recovered * 100) / 100,
      previous_remaining: prevRem,
      new_remaining: nextRem,
      new_status: nextRem <= 0.005 ? "recovered" : "partial",
    });
    remainingToRecover = Math.round((remainingToRecover - recovered) * 100) / 100;
  }
  return allocations;
}
