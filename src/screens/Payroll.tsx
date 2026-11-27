"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  FormControlLabel,
  MenuItem,
  Skeleton,
  Switch,
  Tab,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  AnimatedPage,
  DataTable,
  PageHeader,
  SearchToolbar,
  SideDrawer,
  StatCard,
  StatusChip,
  TabBar,
  TabPanel,
  TabView,
  confirmAction,
  toast,
} from "@/components/mui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { localDateKey, normalizeCashDate, openPayrollSlipPdf } from "@/lib/finance-sync";
import {
  calculateEmployeePayroll,
  DEFAULT_PAYROLL_POLICY,
  normalizePayrollPolicy,
  type AttendanceRecordLike,
  type PayrollPolicy,
  type WorkingDaysMode,
} from "@/lib/payroll-calculator";
import {
  CalendarDays,
  CheckCircle,
  Clock,
  Download,
  FileText,
  HandCoins,
  History,
  Pencil,
  Plus,
  Printer,
  Settings2,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { endOfMonth, format, startOfMonth } from "date-fns";

interface EmployeeRow {
  id: string;
  user_id: string | null;
  name: string;
  salary: number;
  role: string;
  department: string | null;
  status: string;
  employee_type?: string | null;
}

interface PayrollRow {
  id: string;
  slip_number?: string | null;
  employee_id: string;
  month: string;
  working_days?: number | null;
  present_days?: number | null;
  half_days?: number | null;
  leave_days?: number | null;
  absent_days?: number | null;
  gross_salary?: number | null;
  basic_salary: number;
  advance_deduction?: number | null;
  other_deductions?: number | null;
  deductions: number;
  bonus: number;
  net_salary: number;
  payment_status: string;
  payment_mode?: string | null;
  account_id?: string | null;
  finance_transaction_id?: string | null;
  paid_date: string | null;
  notes: string | null;
}

interface EmployeeAdvanceRow {
  id: string;
  advance_number: string;
  employee_id: string;
  amount: number;
  recovered_amount: number;
  remaining_amount: number;
  advance_date: string;
  payment_mode: string;
  account_id: string | null;
  status: string;
  reason: string | null;
  notes: string | null;
  finance_transaction_id: string | null;
  staff_name: string | null;
  created_at: string;
}

interface FinanceAccountOpt {
  id: string;
  name: string;
  type: string;
  current_balance: number;
  status: string;
}

const WEEKDAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PayrollPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("run");

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [allEmployees, setAllEmployees] = useState<EmployeeRow[]>([]);
  const [payrolls, setPayrolls] = useState<PayrollRow[]>([]);
  const [allPayrolls, setAllPayrolls] = useState<PayrollRow[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecordLike[]>([]);
  const [advances, setAdvances] = useState<EmployeeAdvanceRow[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccountOpt[]>([]);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PayrollPolicy>(DEFAULT_PAYROLL_POLICY);
  const [loading, setLoading] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Monthly Run Filters
  const [runSearch, setRunSearch] = useState("");
  const [runRoleFilter, setRunRoleFilter] = useState("all");
  const [runStatusFilter, setRunStatusFilter] = useState("all");

  // Advances Ledger Filters
  const [advSearch, setAdvSearch] = useState("");
  const [advEmpFilter, setAdvEmpFilter] = useState("all");
  const [advStatusFilter, setAdvStatusFilter] = useState("all");
  const [advFromDate, setAdvFromDate] = useState("");
  const [advToDate, setAdvToDate] = useState("");

  // Salary History Filters
  const [histSearch, setHistSearch] = useState("");
  const [histFromMonth, setHistFromMonth] = useState("");
  const [histToMonth, setHistToMonth] = useState("");
  const [histStatusFilter, setHistStatusFilter] = useState("all");
  const [histModeFilter, setHistModeFilter] = useState("all");

  // Generate / Edit Slip Drawer
  const [slipOpen, setSlipOpen] = useState(false);
  const [editingPayrollId, setEditingPayrollId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [savingSlip, setSavingSlip] = useState(false);
  const [slipForm, setSlipForm] = useState({
    employee_id: "",
    employee_name: "",
    basic_salary: "0",
    advance_deduction: "0",
    other_deductions: "0",
    bonus: "0",
    notes: "",
    working_days: 0,
    present_days: 0,
    half_days: 0,
    leave_days: 0,
    absent_days: 0,
    per_day_rate: 0,
    available_advances: 0,
  });

  // Mark Paid Settlement Drawer
  const [settleOpen, setSettleOpen] = useState(false);
  const [settleTarget, setSettleTarget] = useState<PayrollRow | null>(null);
  const [settleForm, setSettleForm] = useState({
    payment_mode: "cash",
    account_id: "",
    paid_date: localDateKey(),
    notes: "",
  });
  const [settling, setSettling] = useState(false);

  // Issue Advance Drawer
  const [advDrawerOpen, setAdvDrawerOpen] = useState(false);
  const [issuingAdvance, setIssuingAdvance] = useState(false);
  const [advForm, setAdvForm] = useState({
    employee_id: "",
    amount: "",
    advance_date: localDateKey(),
    payment_mode: "cash",
    account_id: "",
    reason: "",
    notes: "",
  });

  // Working Days Policy Drawer
  const [policyOpen, setPolicyOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<PayrollPolicy>(DEFAULT_PAYROLL_POLICY);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const monthDate = new Date(year, (month || 1) - 1, 1);
    const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

    const [
      allEmpRes,
      payMonthRes,
      allPayRes,
      attRes,
      advRes,
      acctRes,
      bsRes,
    ] = await Promise.all([
      supabase.from("employees").select("id, user_id, name, salary, role, department, status, employee_type").order("name"),
      supabase.from("payroll").select("*").eq("month", selectedMonth),
      supabase.from("payroll").select("*").order("month", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("attendance_records").select("employee_id, date, status, check_in, check_out, notes").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("employee_advances").select("*").order("advance_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("finance_accounts").select("id, name, type, current_balance, status").eq("status", "active").order("created_at"),
      supabase.from("business_settings").select("id, integrations").limit(1).maybeSingle(),
    ]);

    const allEmps = (allEmpRes.data || []) as EmployeeRow[];
    setAllEmployees(allEmps);
    setEmployees(
      allEmps.filter(
        (e) => e.status === "active" && (e.employee_type === "internal" || !e.employee_type)
      )
    );
    setPayrolls((payMonthRes.data || []) as PayrollRow[]);
    setAllPayrolls((allPayRes.data || []) as PayrollRow[]);
    setAttendanceRecords((attRes.data || []) as AttendanceRecordLike[]);
    setAdvances((advRes.data || []) as EmployeeAdvanceRow[]);
    setAccounts((acctRes.data || []) as FinanceAccountOpt[]);

    if (bsRes.data) {
      setSettingsId(bsRes.data.id);
      const integ = (bsRes.data.integrations || {}) as Record<string, any>;
      setPolicy(normalizePayrollPolicy(integ.payroll_policy));
    }
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const empNameById = useCallback(
    (empId: string) => allEmployees.find((e) => e.id === empId)?.name || "Employee",
    [allEmployees]
  );

  const activeAdvancesByEmp = useMemo(() => {
    const map: Record<string, EmployeeAdvanceRow[]> = {};
    for (const a of advances) {
      if (Number(a.remaining_amount || 0) > 0 && (a.status === "active" || a.status === "partial")) {
        if (!map[a.employee_id]) map[a.employee_id] = [];
        map[a.employee_id].push(a);
      }
    }
    return map;
  }, [advances]);

  const calcMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof calculateEmployeePayroll>> = {};
    for (const emp of employees) {
      map[emp.id] = calculateEmployeePayroll({
        employee: emp,
        month: selectedMonth,
        attendance: attendanceRecords,
        policy,
        activeAdvances: activeAdvancesByEmp[emp.id] || [],
      });
    }
    return map;
  }, [employees, selectedMonth, attendanceRecords, policy, activeAdvancesByEmp]);

  const getPayroll = (empId: string) => payrolls.find((p) => p.employee_id === empId);

  const uniqueRoles = useMemo(
    () => Array.from(new Set(employees.map((e) => e.role).filter(Boolean))),
    [employees]
  );

  const filteredRunEmployees = useMemo(() => {
    const q = runSearch.trim().toLowerCase();
    return employees.filter((emp) => {
      const p = getPayroll(emp.id);
      if (runRoleFilter !== "all" && emp.role !== runRoleFilter) return false;
      if (runStatusFilter === "not_generated" && p) return false;
      if (runStatusFilter === "pending" && (!p || p.payment_status !== "pending")) return false;
      if (runStatusFilter === "paid" && (!p || p.payment_status !== "paid")) return false;
      if (q) {
        return (
          emp.name.toLowerCase().includes(q) ||
          (emp.role || "").toLowerCase().includes(q) ||
          (emp.department || "").toLowerCase().includes(q) ||
          (p?.slip_number || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [employees, payrolls, runSearch, runRoleFilter, runStatusFilter]);

  const openGenerate = (emp: EmployeeRow, existing?: PayrollRow) => {
    const calc = calcMap[emp.id] || calculateEmployeePayroll({
      employee: emp,
      month: selectedMonth,
      attendance: attendanceRecords,
      policy,
      activeAdvances: activeAdvancesByEmp[emp.id] || [],
    });
    setEditingPayrollId(existing?.id || null);
    setSlipForm({
      employee_id: emp.id,
      employee_name: emp.name,
      basic_salary: String(existing ? existing.basic_salary : calc.earnedBasic),
      advance_deduction: String(existing ? (existing.advance_deduction ?? 0) : calc.recommendedAdvanceDeduction),
      other_deductions: String(existing ? (existing.other_deductions ?? existing.deductions ?? 0) : 0),
      bonus: String(existing ? existing.bonus : 0),
      notes: existing?.notes || "",
      working_days: Number(existing?.working_days ?? calc.scheduledWorkingDays),
      present_days: Number(existing?.present_days ?? calc.presentDays),
      half_days: Number(existing?.half_days ?? calc.halfDays),
      leave_days: Number(existing?.leave_days ?? calc.paidLeaveDays),
      absent_days: Number(existing?.absent_days ?? calc.absentDays + calc.unpaidLeaveDays),
      per_day_rate: calc.perDayRate,
      available_advances: calc.availableAdvanceBalance,
    });
    setSlipOpen(true);
  };

  const handleSaveSlip = async () => {
    const basic = Math.max(0, parseFloat(slipForm.basic_salary) || 0);
    const advDed = Math.max(0, parseFloat(slipForm.advance_deduction) || 0);
    const otherDed = Math.max(0, parseFloat(slipForm.other_deductions) || 0);
    const bonus = Math.max(0, parseFloat(slipForm.bonus) || 0);
    if (advDed > slipForm.available_advances + 0.01 && !editingPayrollId) {
      toast.error(`Advance deduction cannot exceed outstanding ₹${slipForm.available_advances.toLocaleString("en-IN")}`);
      return;
    }
    const totalDeductions = Math.round((advDed + otherDed) * 100) / 100;
    const net = Math.max(0, Math.round((basic + bonus - totalDeductions) * 100) / 100);
    const emp = employees.find((e) => e.id === slipForm.employee_id);

    setSavingSlip(true);
    try {
      const payload: Record<string, any> = {
        basic_salary: basic,
        gross_salary: Number(emp?.salary || basic),
        advance_deduction: advDed,
        other_deductions: otherDed,
        deductions: totalDeductions,
        bonus,
        net_salary: net,
        working_days: slipForm.working_days,
        present_days: slipForm.present_days,
        half_days: slipForm.half_days,
        leave_days: slipForm.leave_days,
        absent_days: slipForm.absent_days,
        policy_snapshot: policy as any,
        notes: slipForm.notes || null,
      };
      let error;
      if (editingPayrollId) {
        ({ error } = await supabase.from("payroll").update(payload).eq("id", editingPayrollId));
      } else {
        ({ error } = await supabase.from("payroll").insert({
          ...payload,
          employee_id: slipForm.employee_id,
          month: selectedMonth,
          created_by: user?.id,
        } as any));
      }
      if (error) toast.error(error.message);
      else {
        toast.success(editingPayrollId ? "Salary slip updated" : "Salary slip generated");
        setSlipOpen(false);
        await fetchData();
      }
    } finally {
      setSavingSlip(false);
    }
  };

  const bulkGenerate = async () => {
    setBulkProcessing(true);
    let generated = 0;
    const existingEmpIds = new Set(payrolls.map((p) => p.employee_id));
    for (const emp of employees) {
      if (existingEmpIds.has(emp.id)) continue;
      const calc = calcMap[emp.id];
      if (!calc) continue;
      const advDed = calc.recommendedAdvanceDeduction;
      const { error } = await supabase.from("payroll").insert({
        employee_id: emp.id,
        month: selectedMonth,
        working_days: calc.scheduledWorkingDays,
        present_days: calc.presentDays,
        half_days: calc.halfDays,
        leave_days: calc.paidLeaveDays,
        absent_days: calc.absentDays + calc.unpaidLeaveDays,
        gross_salary: calc.monthlySalary,
        basic_salary: calc.earnedBasic,
        advance_deduction: advDed,
        other_deductions: 0,
        deductions: advDed,
        bonus: 0,
        net_salary: calc.netSalary,
        policy_snapshot: policy as any,
        created_by: user?.id,
      } as any);
      if (!error) generated++;
    }
    toast.success(`Generated ${generated} attendance-linked salary slips`);
    setBulkProcessing(false);
    await fetchData();
  };

  const openSettleDrawer = (p: PayrollRow) => {
    setSettleTarget(p);
    const defaultCashAcct = accounts.find((a) => a.type === "cash")?.id || accounts[0]?.id || "";
    setSettleForm({
      payment_mode: "cash",
      account_id: defaultCashAcct,
      paid_date: localDateKey(),
      notes: p.notes || "",
    });
    setSettleOpen(true);
  };

  const handleSettlePayroll = async () => {
    if (!settleTarget) return;
    setSettling(true);
    try {
      const { error } = await supabase.functions.invoke("payroll-settle", {
        body: {
          payroll_id: settleTarget.id,
          payment_mode: settleForm.payment_mode,
          account_id: settleForm.account_id || null,
          paid_date: settleForm.paid_date,
          notes: settleForm.notes || null,
          staff_name: user?.email || "Admin",
        },
      });
      if (error) throw error;
      toast.success("Salary marked paid, advances recovered & synced to Finance");
      setSettleOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to settle payroll");
    } finally {
      setSettling(false);
    }
  };

  const handleIssueAdvance = async () => {
    const amt = parseFloat(advForm.amount) || 0;
    if (!advForm.employee_id) return toast.error("Select an employee");
    if (amt <= 0) return toast.error("Enter valid advance amount");
    setIssuingAdvance(true);
    try {
      const { error } = await supabase.functions.invoke("employee-advance-issue", {
        body: {
          employee_id: advForm.employee_id,
          amount: amt,
          advance_date: advForm.advance_date,
          payment_mode: advForm.payment_mode,
          account_id: advForm.account_id || null,
          reason: advForm.reason || null,
          notes: advForm.notes || null,
          staff_name: user?.email || "Admin",
        },
      });
      if (error) throw error;
      toast.success(`Advance ₹${amt.toLocaleString("en-IN")} issued & synced to Finance`);
      setAdvDrawerOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to issue advance");
    } finally {
      setIssuingAdvance(false);
    }
  };

  const handleCancelAdvance = async (adv: EmployeeAdvanceRow) => {
    if (Number(adv.recovered_amount || 0) > 0) {
      toast.error("Cannot cancel advance after salary recovery has occurred");
      return;
    }
    const ok = await confirmAction(
      `Cancel ${adv.advance_number}? This will cancel ₹${Number(adv.amount).toLocaleString("en-IN")} advance for ${empNameById(adv.employee_id)} and post a compensating refund entry into Finance.`
    );
    if (!ok) return;
    const { error } = await supabase.functions.invoke("employee-advance-cancel", {
      body: {
        advance_id: adv.id,
        reason: "Cancelled by admin",
        staff_name: user?.email || "Admin",
      },
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Advance cancelled and Finance balance refunded");
      await fetchData();
    }
  };

  const handleSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      let existingInteg: Record<string, any> = {};
      if (settingsId) {
        const { data: curr } = await supabase.from("business_settings").select("integrations").eq("id", settingsId).single();
        if (curr?.integrations && typeof curr.integrations === "object") existingInteg = curr.integrations as Record<string, any>;
        const { error } = await supabase
          .from("business_settings")
          .update({ integrations: { ...existingInteg, payroll_policy: policyDraft } as any })
          .eq("id", settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("business_settings")
          .insert({ integrations: { payroll_policy: policyDraft } as any })
          .select("id")
          .single();
        if (error) throw error;
        setSettingsId(data.id);
      }
      setPolicy(policyDraft);
      toast.success("Working-days payroll policy saved");
      setPolicyOpen(false);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to save policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  // Filtered Advances
  const filteredAdvances = useMemo(() => {
    const q = advSearch.trim().toLowerCase();
    return advances.filter((a) => {
      if (advEmpFilter !== "all" && a.employee_id !== advEmpFilter) return false;
      if (advStatusFilter !== "all" && a.status !== advStatusFilter) return false;
      const dk = normalizeCashDate(a.advance_date);
      if (advFromDate && dk < advFromDate) return false;
      if (advToDate && dk > advToDate) return false;
      if (q) {
        return (
          a.advance_number.toLowerCase().includes(q) ||
          empNameById(a.employee_id).toLowerCase().includes(q) ||
          (a.reason || "").toLowerCase().includes(q) ||
          (a.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [advances, advEmpFilter, advStatusFilter, advFromDate, advToDate, advSearch, empNameById]);

  // Filtered Salary History
  const filteredHistory = useMemo(() => {
    const q = histSearch.trim().toLowerCase();
    return allPayrolls.filter((p) => {
      if (histFromMonth && p.month < histFromMonth) return false;
      if (histToMonth && p.month > histToMonth) return false;
      if (histStatusFilter !== "all" && p.payment_status !== histStatusFilter) return false;
      if (histModeFilter !== "all" && (p.payment_mode || "cash") !== histModeFilter) return false;
      if (q) {
        return (
          (p.slip_number || "").toLowerCase().includes(q) ||
          empNameById(p.employee_id).toLowerCase().includes(q) ||
          p.month.toLowerCase().includes(q) ||
          (p.notes || "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allPayrolls, histFromMonth, histToMonth, histStatusFilter, histModeFilter, histSearch, empNameById]);

  // KPIs
  const totalPayable = payrolls.reduce((s, p) => s + Number(p.net_salary || 0), 0);
  const totalPaid = payrolls.filter((p) => p.payment_status === "paid").reduce((s, p) => s + Number(p.net_salary || 0), 0);
  const totalPending = totalPayable - totalPaid;
  const totalAdvRecoveredMonth = payrolls.reduce((s, p) => s + Number(p.advance_deduction || 0), 0);
  const notGeneratedCount = employees.filter((e) => !getPayroll(e.id)).length;

  const totalAdvDisbursed = advances.filter((a) => a.status !== "cancelled").reduce((s, a) => s + Number(a.amount || 0), 0);
  const totalAdvRecovered = advances.filter((a) => a.status !== "cancelled").reduce((s, a) => s + Number(a.recovered_amount || 0), 0);
  const totalAdvRemaining = advances.filter((a) => a.status !== "cancelled").reduce((s, a) => s + Number(a.remaining_amount || 0), 0);

  const exportCsv = (filename: string, headers: string[], rows: Array<Array<string | number>>) => {
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 3, minWidth: 0 }}>
        <PageHeader
          title="Payroll & Advances"
          subtitle="Working-days calculation, salary advances recovery, finance-synced disbursement & history"
          actions={
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1 }}>
              <Button
                variant="outlined"
                onClick={() => { setPolicyDraft(policy); setPolicyOpen(true); }}
                startIcon={<Settings2 size={16} />}
              >
                Working Days Policy
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  const cashAcct = accounts.find((a) => a.type === "cash")?.id || accounts[0]?.id || "";
                  setAdvForm({
                    employee_id: employees[0]?.id || "",
                    amount: "",
                    advance_date: localDateKey(),
                    payment_mode: "cash",
                    account_id: cashAcct,
                    reason: "",
                    notes: "",
                  });
                  setAdvDrawerOpen(true);
                }}
                startIcon={<HandCoins size={16} />}
              >
                Issue Advance
              </Button>
            </Box>
          }
        />

        <TabView value={activeTab} onChange={setActiveTab}>
          <TabBar aria-label="Payroll sections">
            <Tab value="run" label={<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><Wallet size={15} />Monthly Run</Box>} />
            <Tab value="advances" label={<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><HandCoins size={15} />Advances Ledger ({advances.filter((a) => Number(a.remaining_amount) > 0 && a.status !== "cancelled").length})</Box>} />
            <Tab value="history" label={<Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}><History size={15} />Salary History ({allPayrolls.length})</Box>} />
          </TabBar>

          {/* ─── TAB 1: MONTHLY PAYROLL RUN ─────────────────────────────── */}
          <TabPanel value="run" sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
              <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25 }}>
                <TextField
                  type="month"
                  label="Payroll Month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  size="small"
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { "aria-label": "Payroll Month" } }}
                  sx={{ width: 170 }}
                />
                <SearchToolbar onSearch={setRunSearch} value={runSearch} placeholder="Search staff, role, slip #..." sx={{ width: 250 }} />
                <TextField select size="small" label="Role" value={runRoleFilter} onChange={(e) => setRunRoleFilter(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 140 }}>
                  <MenuItem value="all">All Roles</MenuItem>
                  {uniqueRoles.map((r) => <MenuItem key={r} value={r} sx={{ textTransform: "capitalize" }}>{r}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Status" value={runStatusFilter} onChange={(e) => setRunStatusFilter(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 155 }}>
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="not_generated">Not Generated</MenuItem>
                  <MenuItem value="pending">Pending Payment</MenuItem>
                  <MenuItem value="paid">Paid</MenuItem>
                </TextField>
              </Box>

              {notGeneratedCount > 0 && (
                <Button onClick={bulkGenerate} disabled={bulkProcessing} variant="contained" startIcon={<FileText size={16} />}>
                  {bulkProcessing ? "Generating..." : `Generate All (${notGeneratedCount})`}
                </Button>
              )}
            </Box>

            <Alert severity="info" sx={{ py: 0.5 }}>
              Policy: {policy.working_days_mode.replace(/_/g, " ")} · Weekly Offs: {policy.weekly_off_days.map((d) => WEEKDAY_NAMES[d]).join(", ") || "None"} · Paid Holidays: {policy.paid_holidays.length} · Auto-Deduct Advances: {policy.auto_deduct_advances ? "On" : "Off"}
            </Alert>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
              <StatCard label="Total Payable" value={totalPayable} isCurrency icon={<Wallet size={18} />} accent="primary" />
              <StatCard label={`Paid (${payrolls.filter((p) => p.payment_status === "paid").length})`} value={totalPaid} isCurrency icon={<CheckCircle size={18} />} accent="success" />
              <StatCard label={`Pending (${payrolls.filter((p) => p.payment_status !== "paid").length})`} value={totalPending} isCurrency icon={<Clock size={18} />} accent="warning" />
              <StatCard label="Advances Adjusted" value={totalAdvRecoveredMonth} isCurrency icon={<HandCoins size={18} />} accent="info" />
            </Box>

            {loading ? (
              <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.5, minWidth: 0 }}>
                <Skeleton sx={{ height: 48 }} />
                <Skeleton sx={{ height: 48 }} />
                <Skeleton sx={{ height: 48 }} />
              </Box>
            ) : (
              <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))", minWidth: 0, width: "100%", overflow: "hidden" }}>
                <DataTable columnsCount={10} empty={filteredRunEmployees.length === 0} emptyMessage="No matching internal employees found" sx={{ "& td, & th": { px: 1.25 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Employee</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell sx={{ textAlign: "center" }}>Work / P / H / L / A</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Monthly Base</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Earned Basic</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Advance Adj.</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Bonus / Other</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>Net Payable</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell sx={{ width: 200 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredRunEmployees.map((emp) => {
                      const p = getPayroll(emp.id);
                      const c = calcMap[emp.id];
                      const openAdvBal = c?.availableAdvanceBalance || 0;
                      const previewNet = p ? Number(p.net_salary || 0) : (c?.netSalary || 0);
                      return (
                        <TableRow key={emp.id}>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>{emp.name}</Typography>
                            {p?.slip_number && (
                              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace" }}>
                                {p.slip_number}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusChip label={emp.role} variant="outlined" sx={{ textTransform: "capitalize", fontSize: "10px" }} />
                          </TableCell>
                          <TableCell sx={{ textAlign: "center", fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" }}>
                            {p?.working_days ?? c?.scheduledWorkingDays ?? 0}d ·{" "}
                            <Box component="span" sx={{ color: "success.main", fontWeight: 600 }}>{p?.present_days ?? c?.presentDays ?? 0}P</Box>{" · "}
                            {p?.half_days ?? c?.halfDays ?? 0}H{" · "}
                            {p?.leave_days ?? c?.paidLeaveDays ?? 0}L{" · "}
                            <Box component="span" sx={{ color: "error.main" }}>{p?.absent_days ?? (c ? c.absentDays + c.unpaidLeaveDays : 0)}A</Box>
                          </TableCell>
                          <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            ₹{Number(emp.salary || 0).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            ₹{Number(p ? p.basic_salary : (c?.earnedBasic || 0)).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {p ? (
                              Number(p.advance_deduction || 0) > 0 ? (
                                <Typography variant="body2" sx={{ color: "warning.main", fontWeight: 600 }}>
                                  -₹{Number(p.advance_deduction).toLocaleString("en-IN")}
                                </Typography>
                              ) : "—"
                            ) : openAdvBal > 0 ? (
                              <Typography variant="caption" color="warning.main">
                                Due ₹{openAdvBal.toLocaleString("en-IN")}
                              </Typography>
                            ) : "—"}
                          </TableCell>
                          <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontSize: "0.8rem" }}>
                            {p ? `+₹${Number(p.bonus || 0).toLocaleString("en-IN")} / -₹${Number(p.other_deductions || 0).toLocaleString("en-IN")}` : "—"}
                          </TableCell>
                          <TableCell sx={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                            ₹{previewNet.toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell>
                            {p ? (
                              <StatusChip
                                label={p.payment_status}
                                sx={
                                  p.payment_status === "paid"
                                    ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 12%, transparent)", color: "hsl(var(--success))" }
                                    : { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 12%, transparent)", color: "hsl(var(--warning))" }
                                }
                              />
                            ) : (
                              <StatusChip label="Preview" variant="outlined" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                              {!p ? (
                                <Button onClick={() => openGenerate(emp)} variant="outlined" size="small" startIcon={<Plus size={13} />}>
                                  Generate
                                </Button>
                              ) : p.payment_status !== "paid" ? (
                                <>
                                  <Button onClick={() => openGenerate(emp, p)} variant="outlined" size="small" startIcon={<Pencil size={13} />}>
                                    Edit
                                  </Button>
                                  <Button onClick={() => openSettleDrawer(p)} variant="contained" size="small" color="success" startIcon={<CheckCircle size={13} />}>
                                    Mark Paid
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button onClick={() => void openPayrollSlipPdf(p.id, false)} variant="outlined" size="small" startIcon={<Printer size={13} />}>
                                    PDF Slip
                                  </Button>
                                  <Button onClick={() => void openPayrollSlipPdf(p.id, true)} variant="text" size="small" startIcon={<Download size={13} />}>
                                    Save
                                  </Button>
                                </>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </DataTable>
              </Box>
            )}
          </TabPanel>

          {/* ─── TAB 2: EMPLOYEE ADVANCES LEDGER ────────────────────────── */}
          <TabPanel value="advances" sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5, minWidth: 0 }}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2, minWidth: 0 }}>
              <StatCard label="Total Disbursed" value={totalAdvDisbursed} isCurrency icon={<HandCoins size={18} />} accent="primary" />
              <StatCard label="Recovered via Payroll" value={totalAdvRecovered} isCurrency icon={<CheckCircle size={18} />} accent="success" />
              <StatCard label="Active Outstanding" value={totalAdvRemaining} isCurrency icon={<Clock size={18} />} accent="warning" />
              <StatCard label="Employees With Balance" value={Object.keys(activeAdvancesByEmp).length} icon={<Users size={18} />} accent="info" />
            </Box>

            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25 }}>
              <SearchToolbar onSearch={setAdvSearch} value={advSearch} placeholder="Search advance #, employee, reason..." sx={{ flex: 1, minWidth: 220, maxWidth: 320 }} />
              <TextField select size="small" label="Employee" value={advEmpFilter} onChange={(e) => setAdvEmpFilter(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 170 }}>
                <MenuItem value="all">All Employees</MenuItem>
                {allEmployees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Status" value={advStatusFilter} onChange={(e) => setAdvStatusFilter(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 140 }}>
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="partial">Partial</MenuItem>
                <MenuItem value="recovered">Recovered</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </TextField>
              <TextField type="date" label="From" size="small" value={advFromDate} onChange={(e) => setAdvFromDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 145 }} />
              <TextField type="date" label="To" size="small" value={advToDate} onChange={(e) => setAdvToDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 145 }} />
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download size={14} />}
                onClick={() =>
                  exportCsv(
                    `employee-advances-${localDateKey()}.csv`,
                    ["Advance #", "Date", "Employee", "Reason", "Mode", "Amount", "Recovered", "Remaining", "Status"],
                    filteredAdvances.map((a) => [
                      a.advance_number,
                      normalizeCashDate(a.advance_date),
                      empNameById(a.employee_id),
                      a.reason || "",
                      a.payment_mode,
                      a.amount,
                      a.recovered_amount,
                      a.remaining_amount,
                      a.status,
                    ])
                  )
                }
              >
                Export CSV
              </Button>
            </Box>

            <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))", minWidth: 0, width: "100%", overflow: "hidden" }}>
              <DataTable columnsCount={10} empty={filteredAdvances.length === 0} emptyMessage="No employee advances found" sx={{ "& td, & th": { px: 1.25 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Advance #</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell>Reason / Notes</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Amount</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Recovered</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Remaining</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredAdvances.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", fontWeight: 600 }}>{a.advance_number || "—"}</TableCell>
                      <TableCell>{format(new Date(`${normalizeCashDate(a.advance_date)}T00:00:00`), "dd MMM yyyy")}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{empNameById(a.employee_id)}</TableCell>
                      <TableCell sx={{ maxWidth: 200 }} title={a.notes || a.reason || ""}>{a.reason || a.notes || "—"}</TableCell>
                      <TableCell sx={{ textTransform: "uppercase", fontSize: "0.75rem" }}>{a.payment_mode}</TableCell>
                      <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{Number(a.amount || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ textAlign: "right", color: "success.main", fontVariantNumeric: "tabular-nums" }}>₹{Number(a.recovered_amount || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>₹{Number(a.remaining_amount || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell><StatusChip label={a.status} variant="outlined" /></TableCell>
                      <TableCell>
                        {a.status !== "cancelled" && Number(a.recovered_amount || 0) <= 0 ? (
                          <Button size="small" color="error" variant="outlined" onClick={() => void handleCancelAdvance(a)} startIcon={<XCircle size={13} />}>
                            Cancel
                          </Button>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </Box>
          </TabPanel>

          {/* ─── TAB 3: MULTI-MONTH SALARY HISTORY ──────────────────────── */}
          <TabPanel value="history" sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 2.5, minWidth: 0 }}>
            <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.25 }}>
              <SearchToolbar onSearch={setHistSearch} value={histSearch} placeholder="Search slip #, employee, month, notes..." sx={{ flex: 1, minWidth: 220, maxWidth: 320 }} />
              <TextField type="month" label="From Month" size="small" value={histFromMonth} onChange={(e) => setHistFromMonth(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 165 }} />
              <TextField type="month" label="To Month" size="small" value={histToMonth} onChange={(e) => setHistToMonth(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 165 }} />
              <TextField select size="small" label="Status" value={histStatusFilter} onChange={(e) => setHistStatusFilter(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 135 }}>
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="paid">Paid</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </TextField>
              <TextField select size="small" label="Mode" value={histModeFilter} onChange={(e) => setHistModeFilter(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 135 }}>
                <MenuItem value="all">All Modes</MenuItem>
                <MenuItem value="cash">Cash</MenuItem>
                <MenuItem value="upi">UPI</MenuItem>
                <MenuItem value="bank_transfer">Bank</MenuItem>
              </TextField>
              <Button
                variant="outlined"
                size="small"
                startIcon={<Download size={14} />}
                onClick={() =>
                  exportCsv(
                    `payroll-history-${localDateKey()}.csv`,
                    ["Slip #", "Month", "Employee", "Work Days", "Present", "Half", "Absent", "Basic", "Bonus", "Advance Ded.", "Other Ded.", "Net Salary", "Status", "Paid Date", "Mode"],
                    filteredHistory.map((p) => [
                      p.slip_number || "",
                      p.month,
                      empNameById(p.employee_id),
                      p.working_days ?? "",
                      p.present_days ?? "",
                      p.half_days ?? "",
                      p.absent_days ?? "",
                      p.basic_salary,
                      p.bonus,
                      p.advance_deduction ?? 0,
                      p.other_deductions ?? 0,
                      p.net_salary,
                      p.payment_status,
                      p.paid_date ? normalizeCashDate(p.paid_date) : "",
                      p.payment_mode || "",
                    ])
                  )
                }
              >
                Export CSV
              </Button>
            </Box>

            <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))", minWidth: 0, width: "100%", overflow: "hidden" }}>
              <DataTable columnsCount={11} empty={filteredHistory.length === 0} emptyMessage="No salary history matching your filter" sx={{ "& td, & th": { px: 1.25 } }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Slip #</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell>Employee</TableCell>
                    <TableCell sx={{ textAlign: "center" }}>Attendance</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Earned Basic</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Bonus</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Advances</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Net Salary</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Paid Date / Mode</TableCell>
                    <TableCell sx={{ width: 130 }}>Payslip</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredHistory.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem" }}>{p.slip_number || "—"}</TableCell>
                      <TableCell>{p.month}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{empNameById(p.employee_id)}</TableCell>
                      <TableCell sx={{ textAlign: "center", fontSize: "0.78rem" }}>
                        {p.working_days != null ? `${p.present_days ?? 0}/${p.working_days}d` : "—"}
                      </TableCell>
                      <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{Number(p.basic_salary || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{Number(p.bonus || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ textAlign: "right", color: "warning.main", fontVariantNumeric: "tabular-nums" }}>₹{Number(p.advance_deduction || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ textAlign: "right", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>₹{Number(p.net_salary || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell><StatusChip label={p.payment_status} variant="outlined" /></TableCell>
                      <TableCell sx={{ fontSize: "0.78rem" }}>
                        {p.paid_date ? `${format(new Date(`${normalizeCashDate(p.paid_date)}T00:00:00`), "dd MMM yyyy")} · ${(p.payment_mode || "cash").toUpperCase()}` : "Unpaid"}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", gap: 0.5 }}>
                          <Button size="small" variant="outlined" onClick={() => void openPayrollSlipPdf(p.id, false)} startIcon={<Printer size={13} />}>View</Button>
                          <Button size="small" variant="text" onClick={() => void openPayrollSlipPdf(p.id, true)} startIcon={<Download size={13} />} />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </Box>
          </TabPanel>
        </TabView>

        {/* Generate / Edit Salary Slip Drawer */}
        <SideDrawer
          open={slipOpen}
          busy={savingSlip}
          onClose={() => setSlipOpen(false)}
          title={editingPayrollId ? "Edit Pending Salary Slip" : "Generate Salary Slip"}
          description={`${slipForm.employee_name} — ${selectedMonth}`}
          width={480}
          footer={
            <>
              <Button variant="outlined" onClick={() => setSlipOpen(false)} disabled={savingSlip}>Cancel</Button>
              <Button onClick={() => void handleSaveSlip()} disabled={savingSlip} variant="contained">
                {savingSlip ? "Saving..." : editingPayrollId ? "Save Changes" : "Generate Slip"}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            <Card>
              <CardContent sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box component={CalendarDays} sx={{ width: 20, height: 20, color: "primary.main", flexShrink: 0 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>Attendance & Working Days</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Working: {slipForm.working_days}d · Present: {slipForm.present_days} · Half: {slipForm.half_days} · Paid Leave: {slipForm.leave_days} · Absent: {slipForm.absent_days}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    Calculated per-day rate: ₹{slipForm.per_day_rate.toLocaleString("en-IN")} · Active Advances Due: ₹{slipForm.available_advances.toLocaleString("en-IN")}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            <TextField
              type="number"
              value={slipForm.basic_salary}
              onChange={(e) => setSlipForm((p) => ({ ...p, basic_salary: e.target.value }))}
              label="Earned Basic Salary (Attendance Adjusted)"
              size="small"
              fullWidth
            />
            <TextField
              type="number"
              value={slipForm.advance_deduction}
              onChange={(e) => setSlipForm((p) => ({ ...p, advance_deduction: e.target.value }))}
              label={`Advance Recovery Deduction (Max ₹${slipForm.available_advances.toLocaleString("en-IN")})`}
              size="small"
              fullWidth
            />
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField
                type="number"
                value={slipForm.bonus}
                onChange={(e) => setSlipForm((p) => ({ ...p, bonus: e.target.value }))}
                label="Bonus"
                size="small"
                fullWidth
              />
              <TextField
                type="number"
                value={slipForm.other_deductions}
                onChange={(e) => setSlipForm((p) => ({ ...p, other_deductions: e.target.value }))}
                label="Other Deductions"
                size="small"
                fullWidth
              />
            </Box>
            <Divider />
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="caption" color="text.secondary">Net Payable Salary</Typography>
              <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                ₹{Math.max(
                  0,
                  (parseFloat(slipForm.basic_salary) || 0) +
                    (parseFloat(slipForm.bonus) || 0) -
                    (parseFloat(slipForm.advance_deduction) || 0) -
                    (parseFloat(slipForm.other_deductions) || 0)
                ).toLocaleString("en-IN")}
              </Typography>
            </Box>
            <TextField
              value={slipForm.notes}
              onChange={(e) => setSlipForm((p) => ({ ...p, notes: e.target.value }))}
              label="Notes"
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </SideDrawer>

        {/* Settle / Mark Paid Drawer */}
        <SideDrawer
          open={settleOpen}
          busy={settling}
          onClose={() => setSettleOpen(false)}
          title="Settle Salary & Post to Finance"
          description={settleTarget ? `${empNameById(settleTarget.employee_id)} · ${settleTarget.month}` : undefined}
          width={440}
          footer={
            <>
              <Button variant="outlined" onClick={() => setSettleOpen(false)} disabled={settling}>Cancel</Button>
              <Button onClick={() => void handleSettlePayroll()} disabled={settling} variant="contained" color="success">
                {settling ? "Settling..." : "Mark Paid & Sync Finance"}
              </Button>
            </>
          }
        >
          {settleTarget && (
            <Box sx={{ display: "grid", gap: 2 }}>
              <Box sx={{ p: 2, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">Disbursement Amount</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  ₹{Number(settleTarget.net_salary || 0).toLocaleString("en-IN")}
                </Typography>
                {Number(settleTarget.advance_deduction || 0) > 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ display: "block", mt: 0.5 }}>
                    Will recover ₹{Number(settleTarget.advance_deduction).toLocaleString("en-IN")} FIFO from open advances
                  </Typography>
                )}
              </Box>
              <TextField
                type="date"
                label="Paid Date"
                value={settleForm.paid_date}
                onChange={(e) => setSettleForm((f) => ({ ...f, paid_date: e.target.value }))}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                select
                label="Payment Mode"
                value={settleForm.payment_mode}
                onChange={(e) => {
                  const mode = e.target.value;
                  const targetType = mode === "cash" ? "cash" : "bank";
                  const matchingAcct = accounts.find((a) => a.type === targetType)?.id || accounts[0]?.id || "";
                  setSettleForm((f) => ({ ...f, payment_mode: mode, account_id: matchingAcct }));
                }}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              >
                <MenuItem value="cash">Cash (Updates Daily Cash Control)</MenuItem>
                <MenuItem value="upi">UPI (Bank Account)</MenuItem>
                <MenuItem value="bank_transfer">Bank Transfer (NEFT/IMPS)</MenuItem>
                <MenuItem value="cheque">Cheque</MenuItem>
              </TextField>
              <TextField
                select
                label="Pay From Account"
                value={settleForm.account_id}
                onChange={(e) => setSettleForm((f) => ({ ...f, account_id: e.target.value }))}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              >
                {accounts.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {a.name} ({a.type} · Bal ₹{Number(a.current_balance || 0).toLocaleString("en-IN")})
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Payment Remarks"
                value={settleForm.notes}
                onChange={(e) => setSettleForm((f) => ({ ...f, notes: e.target.value }))}
                size="small"
                fullWidth
                multiline
                rows={2}
              />
            </Box>
          )}
        </SideDrawer>

        {/* Issue Employee Advance Drawer */}
        <SideDrawer
          open={advDrawerOpen}
          busy={issuingAdvance}
          onClose={() => setAdvDrawerOpen(false)}
          title="Issue Employee Salary Advance"
          description="Disburse advance immediately into Finance & Daily Cash Control"
          width={440}
          footer={
            <>
              <Button variant="outlined" onClick={() => setAdvDrawerOpen(false)} disabled={issuingAdvance}>Cancel</Button>
              <Button onClick={() => void handleIssueAdvance()} disabled={issuingAdvance} variant="contained">
                {issuingAdvance ? "Issuing..." : "Issue & Post Expense"}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2 }}>
            <TextField
              select
              label="Employee *"
              value={advForm.employee_id}
              onChange={(e) => setAdvForm((f) => ({ ...f, employee_id: e.target.value }))}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            >
              {employees.map((e) => <MenuItem key={e.id} value={e.id}>{e.name} ({e.role})</MenuItem>)}
            </TextField>
            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
              <TextField
                type="number"
                label="Advance Amount (₹) *"
                value={advForm.amount}
                onChange={(e) => setAdvForm((f) => ({ ...f, amount: e.target.value }))}
                size="small"
                fullWidth
              />
              <TextField
                type="date"
                label="Advance Date"
                value={advForm.advance_date}
                onChange={(e) => setAdvForm((f) => ({ ...f, advance_date: e.target.value }))}
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Box>
            <TextField
              select
              label="Payment Mode"
              value={advForm.payment_mode}
              onChange={(e) => {
                const mode = e.target.value;
                const tType = mode === "cash" ? "cash" : "bank";
                const matchingAcct = accounts.find((a) => a.type === tType)?.id || accounts[0]?.id || "";
                setAdvForm((f) => ({ ...f, payment_mode: mode, account_id: matchingAcct }));
              }}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="cash">Cash (Drawer)</MenuItem>
              <MenuItem value="upi">UPI (Bank)</MenuItem>
              <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
            </TextField>
            <TextField
              select
              label="Pay From Account"
              value={advForm.account_id}
              onChange={(e) => setAdvForm((f) => ({ ...f, account_id: e.target.value }))}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            >
              {accounts.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {a.name} ({a.type} · Bal ₹{Number(a.current_balance || 0).toLocaleString("en-IN")})
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Reason"
              placeholder="Medical / Family / Festival advance"
              value={advForm.reason}
              onChange={(e) => setAdvForm((f) => ({ ...f, reason: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Notes"
              value={advForm.notes}
              onChange={(e) => setAdvForm((f) => ({ ...f, notes: e.target.value }))}
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </SideDrawer>

        {/* Working Days Policy Drawer */}
        <SideDrawer
          open={policyOpen}
          busy={savingPolicy}
          onClose={() => setPolicyOpen(false)}
          title="Working Days & Payroll Policy"
          description="Applies store-wide working days, weekly offs, holidays, and advance auto-recovery"
          width={500}
          footer={
            <>
              <Button variant="outlined" onClick={() => setPolicyOpen(false)} disabled={savingPolicy}>Cancel</Button>
              <Button onClick={() => void handleSavePolicy()} disabled={savingPolicy} variant="contained">
                {savingPolicy ? "Saving..." : "Save Policy"}
              </Button>
            </>
          }
        >
          <Box sx={{ display: "grid", gap: 2.25 }}>
            <TextField
              select
              label="Working Days Basis Mode"
              value={policyDraft.working_days_mode}
              onChange={(e) => setPolicyDraft((p) => ({ ...p, working_days_mode: e.target.value as WorkingDaysMode }))}
              size="small"
              fullWidth
              slotProps={{ inputLabel: { shrink: true } }}
            >
              <MenuItem value="exclude_weekly_off">Scheduled Working Days (Month Days minus Weekly Offs & Holidays)</MenuItem>
              <MenuItem value="calendar_days">Calendar Days (28 / 30 / 31 days in month)</MenuItem>
              <MenuItem value="fixed_26">Fixed 26 Working Days / Month</MenuItem>
              <MenuItem value="fixed_30">Fixed 30 Standard Days / Month</MenuItem>
            </TextField>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                Weekly Off Days (Never docked for missing punches)
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {WEEKDAY_NAMES.map((day, idx) => {
                  const selected = policyDraft.weekly_off_days.includes(idx);
                  return (
                    <Chip
                      key={day}
                      label={day}
                      color={selected ? "primary" : "default"}
                      variant={selected ? "filled" : "outlined"}
                      onClick={() =>
                        setPolicyDraft((p) => ({
                          ...p,
                          weekly_off_days: selected
                            ? p.weekly_off_days.filter((d) => d !== idx)
                            : [...p.weekly_off_days, idx].sort(),
                        }))
                      }
                    />
                  );
                })}
              </Box>
            </Box>

            <TextField
              type="number"
              label="Half-Day Minimum Worked Hours Threshold"
              helperText="Biometric shifts shorter than this count as 0.5 day"
              value={policyDraft.half_day_hours_threshold}
              onChange={(e) =>
                setPolicyDraft((p) => ({
                  ...p,
                  half_day_hours_threshold: Math.max(1, Math.min(12, Number(e.target.value) || 5)),
                }))
              }
              size="small"
              fullWidth
            />

            <FormControlLabel
              control={
                <Switch
                  checked={policyDraft.auto_deduct_advances}
                  onChange={(_, c) => setPolicyDraft((p) => ({ ...p, auto_deduct_advances: c }))}
                />
              }
              label="Automatically recover outstanding advances when generating slips"
            />

            <Divider />

            <Box sx={{ display: "grid", gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 650 }}>Paid Store Holidays</Typography>
              <Box sx={{ display: "flex", gap: 1 }}>
                <TextField type="date" size="small" label="Date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ width: 155 }} />
                <TextField size="small" label="Holiday Name" value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} fullWidth />
                <Button
                  variant="outlined"
                  onClick={() => {
                    if (!newHolidayDate || !newHolidayName.trim()) return;
                    setPolicyDraft((p) => ({
                      ...p,
                      paid_holidays: [...p.paid_holidays.filter((h) => h.date !== newHolidayDate), { date: newHolidayDate, name: newHolidayName.trim() }].sort((a, b) => a.date.localeCompare(b.date)),
                    }));
                    setNewHolidayDate("");
                    setNewHolidayName("");
                  }}
                >
                  Add
                </Button>
              </Box>
              {policyDraft.paid_holidays.map((h) => (
                <Box key={h.date} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 0.5 }}>
                  <Typography variant="caption">{h.date} — {h.name}</Typography>
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setPolicyDraft((p) => ({ ...p, paid_holidays: p.paid_holidays.filter((x) => x.date !== h.date) }))}
                    startIcon={<Trash2 size={12} />}
                  >
                    Remove
                  </Button>
                </Box>
              ))}
            </Box>
          </Box>
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}
