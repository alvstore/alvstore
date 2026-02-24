import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wallet, CheckCircle, Clock, Plus } from "lucide-react";
import { toast } from "sonner";

interface Employee { id: string; name: string; salary: number; role: string; status: string; }
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

export default function Payroll() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState({ employee_id: "", basic_salary: "0", deductions: "0", bonus: "0", notes: "" });

  const fetchData = async () => {
    setLoading(true);
    const [empRes, payRes] = await Promise.all([
      supabase.from("employees").select("id, name, salary, role, status, employee_type").eq("status", "active").or("employee_type.eq.internal,employee_type.is.null"),
      supabase.from("payroll").select("*").eq("month", selectedMonth),
    ]);
    setEmployees(empRes.data || []);
    setPayrolls(payRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [selectedMonth]);

  const getPayroll = (empId: string) => payrolls.find(p => p.employee_id === empId);

  const openGenerate = (emp: Employee) => {
    setForm({ employee_id: emp.id, basic_salary: String(emp.salary), deductions: "0", bonus: "0", notes: "" });
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

  const markPaid = async (payrollId: string) => {
    const { error } = await supabase.from("payroll").update({
      payment_status: "paid", paid_date: new Date().toISOString().split("T")[0],
    }).eq("id", payrollId);
    if (error) toast.error(error.message);
    else { toast.success("Marked as paid"); fetchData(); }
  };

  const totalPayable = payrolls.reduce((s, p) => s + p.net_salary, 0);
  const totalPaid = payrolls.filter(p => p.payment_status === "paid").reduce((s, p) => s + p.net_salary, 0);
  const totalPending = totalPayable - totalPaid;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">Process monthly salaries and generate slips</p>
        </div>
        <Input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-[180px]" />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Wallet className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">₹{totalPayable.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Payable</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">₹{totalPaid.toLocaleString()}</p><p className="text-xs text-muted-foreground">Paid</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">₹{totalPending.toLocaleString()}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        </CardContent></Card>
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Role</TableHead>
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
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No active employees</TableCell></TableRow>
              ) : employees.map(emp => {
                const p = getPayroll(emp.id);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{emp.role}</Badge></TableCell>
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
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Generate Salary Slip */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Generate Salary Slip</SheetTitle>
            <SheetDescription>Month: {selectedMonth}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Basic Salary</Label><Input type="number" value={form.basic_salary} onChange={e => setForm(p => ({ ...p, basic_salary: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Deductions</Label><Input type="number" value={form.deductions} onChange={e => setForm(p => ({ ...p, deductions: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Bonus</Label><Input type="number" value={form.bonus} onChange={e => setForm(p => ({ ...p, bonus: e.target.value }))} /></div>
            <div className="text-right font-bold">
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
