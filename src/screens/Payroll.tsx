"use client";

import { Box, Button, Card, CardContent, Skeleton, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, FormDialog, PageHeader, StatCard, StatusChip, toast } from "@/components/mui";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Wallet, CheckCircle, Clock, Plus, Users, CalendarDays, FileText, Printer } from "lucide-react";
import { format, getDaysInMonth, startOfMonth, endOfMonth } from "date-fns";
interface Employee {
    id: string;
    name: string;
    salary: number;
    role: string;
    status: string;
}
interface Payroll {
    id: string;
    employee_id: string;
    month: string;
    basic_salary: number;
    deductions: number;
    bonus: number;
    net_salary: number;
    payment_status: string;
    paid_date: string | null;
    notes: string | null;
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
            if (!counts[r.employee_id])
                counts[r.employee_id] = new Set();
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
        if (error)
            toast.error(error.message);
        else
            toast.success("Salary slip generated");
        setSheetOpen(false);
        fetchData();
    };
    const bulkGenerate = async () => {
        setBulkProcessing(true);
        let generated = 0;
        const existingEmpIds = new Set(payrolls.map(p => p.employee_id));
        for (const emp of employees) {
            if (existingEmpIds.has(emp.id))
                continue;
            const presentDays = attendanceCounts[emp.id] || 0;
            const perDay = emp.salary / totalDays;
            const basic = Math.round(perDay * presentDays);
            const { error } = await supabase.from("payroll").insert({
                employee_id: emp.id, month: selectedMonth,
                basic_salary: basic, deductions: 0, bonus: 0, net_salary: basic,
                created_by: user?.id,
            });
            if (!error)
                generated++;
        }
        toast.success(`Generated ${generated} salary slips`);
        setBulkProcessing(false);
        fetchData();
    };
    const markPaid = async (payrollId: string) => {
        const { error } = await supabase.from("payroll").update({
            payment_status: "paid", paid_date: new Date().toISOString().split("T")[0],
        }).eq("id", payrollId);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Marked as paid");
            fetchData();
        }
    };
    const printPayslip = (emp: Employee, p: Payroll) => {
        const monthLabel = new Date(p.month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" });
        const w = window.open("", "_blank", "width=800,height=600");
        if (!w)
            return;
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
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Payroll"} subtitle={"Process monthly salaries with attendance-based calculation"} actions={<><Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <TextField type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "180px" }}/>
          {notGenerated > 0 && (<Button onClick={bulkGenerate} disabled={bulkProcessing} variant="outlined">
              <Box component={FileText} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>{bulkProcessing ? "Processing..." : `Generate All (${notGenerated})`}
            </Button>)}
        </Box></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total Payable"} value={totalPayable} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={Wallet} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={<>Paid ({paidCount})</>} value={totalPaid} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={CheckCircle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={<>Pending ({pendingCount})</>} value={totalPending} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={Clock} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Internal Staff"} value={employees.length} icon={<Box component={Users} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
      </Box>

      {loading ? (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
          <Skeleton sx={{ height: "3rem", width: "100%" }}/>
          <Skeleton sx={{ height: "3rem", width: "100%" }}/>
          <Skeleton sx={{ height: "3rem", width: "100%" }}/>
        </Box>) : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={9} empty={employees.length === 0} emptyMessage={"No internal employees found"}>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Role</TableCell>
                <TableCell sx={{ textAlign: "center" }}>Present / Total</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Basic</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Deductions</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Bonus</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Net Salary</TableCell>
                <TableCell>Status</TableCell>
                <TableCell sx={{ width: "8rem" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{employees.map(emp => {
            const p = getPayroll(emp.id);
            const present = attendanceCounts[emp.id] || 0;
            return (<TableRow key={emp.id}>
                    <TableCell sx={{ fontWeight: "500" }}>{emp.name}</TableCell>
                    <TableCell><StatusChip label={emp.role} variant="outlined" sx={{ textTransform: "capitalize", fontSize: "10px" }}/></TableCell>
                    <TableCell sx={{ textAlign: "center" }}>
                      <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{present}</Box>
                      <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}> / {totalDays}</Box>
                    </TableCell>
                    <TableCell sx={{ textAlign: "right" }}>{p ? `₹${p.basic_salary.toLocaleString()}` : `₹${emp.salary.toLocaleString()}`}</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>{p ? `₹${p.deductions.toLocaleString()}` : "—"}</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>{p ? `₹${p.bonus.toLocaleString()}` : "—"}</TableCell>
                    <TableCell sx={{ textAlign: "right", fontWeight: "500" }}>{p ? `₹${p.net_salary.toLocaleString()}` : "—"}</TableCell>
                    <TableCell>
                      {p ? (<StatusChip label={p.payment_status} sx={p.payment_status === "paid" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }}/>) : <StatusChip label={"Not generated"} variant="filled"/>}
                    </TableCell>
                    <TableCell>
                      {!p ? (<Button onClick={() => openGenerate(emp)} variant="outlined" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          <Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Generate
                        </Button>) : p.payment_status !== "paid" ? (<Button onClick={() => markPaid(p.id)} variant="outlined" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          <Box component={CheckCircle} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Mark Paid
                        </Button>) : (<Button onClick={() => printPayslip(emp, p)} variant="outlined" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          <Box component={Printer} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Print Slip
                        </Button>)}
                    </TableCell>
                  </TableRow>);
        })}</TableBody>
          </DataTable>
        </Box>)}

      {/* Generate Salary Slip Sheet */}
      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={"Generate Salary Slip"} description={<>{form.employee_name} — {selectedMonth}</>} paperSx={{ "@media (min-width: 640px)": { maxWidth: "28rem" } }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" }}>
              <CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Box component={CalendarDays} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>
                <Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>Attendance Summary</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                    {form.present_days} present out of {form.total_days} working days
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="number" value={form.basic_salary} onChange={e => setForm(p => ({ ...p, basic_salary: e.target.value }))} label={"Calculated Salary (based on attendance)"} size="small" fullWidth/>
              <Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Auto-calculated: (Monthly Salary ÷ {form.total_days} days) × {form.present_days} present</Typography>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.deductions} onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))} label={"Deductions"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.bonus} onChange={e => setForm(p => ({ ...p, bonus: e.target.value }))} label={"Bonus"} size="small" fullWidth/></Box>
            <Box sx={{ textAlign: "right", fontWeight: "700", fontSize: "1.125rem", lineHeight: "1.75rem" }}>
              Net: ₹{((parseFloat(form.basic_salary) || 0) - (parseFloat(form.deductions) || 0) + (parseFloat(form.bonus) || 0)).toLocaleString()}
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} label={"Notes"} size="small" fullWidth/></Box>
            <Button onClick={handleGenerate} variant="contained" sx={{ width: "100%" }}>Generate Slip</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
