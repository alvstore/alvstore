import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, CheckCircle, Clock, Plus, Users, CalendarDays, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";

interface Employee { id: string; name: string; salary: number; role: string; status: string; }
interface Payroll {
  id: string; employee_id: string; month: string;
  basic_salary: number; deductions: number; bonus: number; net_salary: number;
  payment_status: string; paid_date: string | null; notes: string | null;
}

export default function PayrollPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [attendanceCounts, setAttendanceCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [form, setForm] = useState({ employee_id: "", employee_name: "", basic_salary: "0", deductions: "0", bonus: "0", notes: "", present_days: 0, total_days: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [year, month] = selectedMonth.split("-").map(Number);
    const totalDays = getDaysInMonth(new Date(year, month - 1));
    const monthStart = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
    const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

    const [empRes, payRes, attRes] = await Promise.all([
      supabase.from("employees").select("id, name, salary, role, status, employee_type")
        .eq("status", "active").or("employee_type.eq.internal,employee_type.is.null"),
      supabase.from("payroll").select("*").eq("month", selectedMonth),
      supabase.from("attendance_records").select("employee_id, date")
        .gte("date", monthStart).lte("date", monthEnd),
    ]);

    setEmployees(empRes.data || []);
    setPayrolls(payRes.data || []);

    // Count unique attendance days per employee
    const counts: Record<string, Set<string>> = {};
    attRes.data?.forEach(r => {
      if (!counts[r.employee_id]) counts[r.employee_id] = new Set();
      counts[r.employee_id].add(r.date);
    });
    const countMap: Record<string, number> = {};
    Object.entries(counts).forEach(([empId, dates]) => { countMap[empId] = dates.size; });
    setAttendanceCounts(countMap);
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getPayroll = (empId: string) => payrolls.find(p => p.employee_id === empId);

  const [year, month] = selectedMonth.split("-").map(Number);
  const totalDays = getDaysInMonth(new Date(year, month - 1));

  const openGenerate = (emp: Employee) => {
    const presentDays = attendanceCounts[emp.id] || 0;
    const perDay = emp.salary / totalDays;
    const calculatedSalary = Math.round(perDay * presentDays);
    setForm({
      employee_id: emp.id, employee_name: emp.name,
      basic_salary: String(calculatedSalary),
      deductions: "0", bonus: "0", notes: "",
      present_days: presentDays, total_days: totalDays,
    });
    setSheetOpen(true);
  };

  const handleGenerate = async () => {
    const basic = parseFloat(form.basic_salary) || 0;
    const deductions = parseFloat(form.deductions) || 0;
    const bonus = parseFloat(form.bonus) || 0;
    const net = basic - deductions + bonus;

    const { error } = await supabase.from("payroll").insert({
      employee_id: form.employee_id, month: selectedMonth,
      basic_salary: basic, deductions, bonus, net_salary: net,
      notes: form.notes || null, created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else toast.success("Salary slip generated");
    setSheetOpen(false);
    fetchData();
  };

  const bulkGenerate = async () => {
    setBulkProcessing(true);
    let generated = 0;
    const existingEmpIds = new Set(payrolls.map(p => p.employee_id));

    for (const emp of employees) {
      if (existingEmpIds.has(emp.id)) continue;
      const presentDays = attendanceCounts[emp.id] || 0;
      const perDay = emp.salary / totalDays;
      const basic = Math.round(perDay * presentDays);
      const { error } = await supabase.from("payroll").insert({
        employee_id: emp.id, month: selectedMonth,
        basic_salary: basic, deductions: 0, bonus: 0, net_salary: basic,
        created_by: user?.id,
      });
      if (!error) generated++;
    }
    toast.success(`Generated ${generated} salary slips`);
    setBulkProcessing(false);
    fetchData();
  };

  const markPaid = async (payrollId: string) => {
    const { error } = await supabase.from("payroll").update({
      payment_status: "paid", paid_date: new Date().toISOString().split("T")[0],
    }).eq("id", payrollId);
    if (error) toast.error(error.message);
    else { toast.success("Marked as paid"); fetchData(); }
  };

  const printPayslip = (emp: Employee, p: Payroll) => {
    const monthLabel = new Date(p.month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Payslip - ${emp.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #000; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 18px; margin: 0 0 4px; }
        .header p { font-size: 12px; color: #666; margin: 0; }
        .info { display: flex; justify-content: space-between; margin-bottom: 24px; }
        .info div { font-size: 13px; }
        .info .label { color: #666; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th, td { border: 1px solid #ddd; padding: 10px 14px; text-align: left; font-size: 13px; }
        th { background: #f5f5f5; font-weight: 600; }
        .total td { font-weight: 700; font-size: 14px; border-top: 2px solid #333; }
        .watermark { text-align: center; color: #ccc; font-size: 9px; letter-spacing: 2px; margin-top: 40px; }
        .footer { text-align: center; font-size: 11px; color: #999; margin-top: 30px; }
        @media print { body { padding: 20px; } }
      </style>
    </head><body>
      <div class="header">
        <h1>SALARY SLIP</h1>
        <p>${monthLabel}</p>
      </div>
      <div class="info">
        <div><span class="label">Employee:</span> <strong>${emp.name}</strong></div>
        <div><span class="label">Role:</span> ${emp.role}</div>
        <div><span class="label">Paid On:</span> ${p.paid_date ? new Date(p.paid_date).toLocaleDateString("en-IN") : "—"}</div>
      </div>
      <table>
        <thead><tr><th>Component</th><th style="text-align:right">Amount (₹)</th></tr></thead>
        <tbody>
          <tr><td>Basic Salary</td><td style="text-align:right">${p.basic_salary.toLocaleString("en-IN")}</td></tr>
          <tr><td>Bonus</td><td style="text-align:right">+ ${p.bonus.toLocaleString("en-IN")}</td></tr>
          <tr><td>Deductions</td><td style="text-align:right">- ${p.deductions.toLocaleString("en-IN")}</td></tr>
          <tr class="total"><td>Net Salary</td><td style="text-align:right">₹${p.net_salary.toLocaleString("en-IN")}</td></tr>
        </tbody>
      </table>
      ${p.notes ? `<p style="font-size:12px;color:#666;">Notes: ${p.notes}</p>` : ""}
      <div class="watermark">ORIGINAL COPY — DO NOT ALTER</div>
      <div class="footer">This is a computer-generated payslip and does not require a signature.</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  const totalPayable = payrolls.reduce((s, p) => s + p.net_salary, 0);
  const totalPaid = payrolls.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.net_salary, 0);
  const totalPending = totalPayable - totalPaid;
  const generatedCount = payrolls.length;
  const pendingCount = payrolls.filter(p => p.payment_status !== "paid").length;
  const paidCount = payrolls.filter(p => p.payment_status === "paid").length;
  const notGenerated = employees.length - generatedCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground text-sm">Process monthly salaries with attendance-based calculation</p>
        </div>
        <div className="flex items-center gap-3">
          <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-[180px]" />
          {notGenerated > 0 && (
            <Button variant="outline" onClick={bulkGenerate} disabled={bulkProcessing}>
              <FileText className="h-4 w-4 mr-2" />{bulkProcessing ? "Processing..." : `Generate All (${notGenerated})`}
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><Wallet className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xl font-bold">₹{totalPayable.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Total Payable</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
          <div><p className="text-xl font-bold">₹{totalPaid.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Paid ({paidCount})</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
          <div><p className="text-xl font-bold">₹{totalPending.toLocaleString()}</p><p className="text-[11px] text-muted-foreground">Pending ({pendingCount})</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-info/10"><Users className="h-5 w-5 text-info" /></div>
          <div><p className="text-xl font-bold">{employees.length}</p><p className="text-[11px] text-muted-foreground">Internal Staff</p></div>
        </CardContent></Card>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Present / Total</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Bonus</TableHead>
                <TableHead className="text-right">Net Salary</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No internal employees found</TableCell></TableRow>
              ) : employees.map(emp => {
                const p = getPayroll(emp.id);
                const present = attendanceCounts[emp.id] || 0;
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-[10px]">{emp.role}</Badge></TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-medium">{present}</span>
                      <span className="text-muted-foreground text-xs"> / {totalDays}</span>
                    </TableCell>
                    <TableCell className="text-right">{p ? `₹${p.basic_salary.toLocaleString()}` : `₹${emp.salary.toLocaleString()}`}</TableCell>
                    <TableCell className="text-right">{p ? `₹${p.deductions.toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-right">{p ? `₹${p.bonus.toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{p ? `₹${p.net_salary.toLocaleString()}` : "—"}</TableCell>
                    <TableCell>
                      {p ? (
                        <Badge className={p.payment_status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}>
                          {p.payment_status}
                        </Badge>
                      ) : <Badge variant="secondary">Not generated</Badge>}
                    </TableCell>
                    <TableCell>
                      {!p ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openGenerate(emp)}>
                          <Plus className="h-3 w-3 mr-1" />Generate
                        </Button>
                      ) : p.payment_status !== "paid" ? (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => markPaid(p.id)}>
                          <CheckCircle className="h-3 w-3 mr-1" />Mark Paid
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => printPayslip(emp, p)}>
                          <Printer className="h-3 w-3 mr-1" />Print Slip
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Generate Salary Slip Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Generate Salary Slip</SheetTitle>
            <SheetDescription>{form.employee_name} — {selectedMonth}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4 flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Attendance Summary</p>
                  <p className="text-xs text-muted-foreground">
                    {form.present_days} present out of {form.total_days} working days
                  </p>
                </div>
              </CardContent>
            </Card>
            <div className="space-y-1.5">
              <Label>Calculated Salary (based on attendance)</Label>
              <Input type="number" value={form.basic_salary} onChange={e => setForm(p => ({ ...p, basic_salary: e.target.value }))} />
              <p className="text-[11px] text-muted-foreground">Auto-calculated: (Monthly Salary ÷ {form.total_days} days) × {form.present_days} present</p>
            </div>
            <div className="space-y-1.5"><Label>Deductions</Label><Input type="number" value={form.deductions} onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Bonus</Label><Input type="number" value={form.bonus} onChange={e => setForm(p => ({ ...p, bonus: e.target.value }))} /></div>
            <div className="text-right font-bold text-lg">
              Net: ₹{((parseFloat(form.basic_salary) || 0) - (parseFloat(form.deductions) || 0) + (parseFloat(form.bonus) || 0)).toLocaleString()}
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <Button className="w-full" onClick={handleGenerate}>Generate Slip</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
