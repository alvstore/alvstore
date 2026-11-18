import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Clock, Calendar, Users, Download, ChevronLeft, ChevronRight,
  UserCheck, UserX, AlertTriangle, Save, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday,
  getDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay,
} from "date-fns";

interface AttendanceRecord {
  id: string; employee_id: string; check_in: string | null; check_out: string | null;
  date: string; source: string; notes: string | null;
}

interface Employee {
  id: string; name: string; user_id: string | null; salary: number | null;
}

type AttendanceStatus = "present" | "absent" | "half_day" | "leave";

const statusConfig: Record<AttendanceStatus, { label: string; color: string; short: string }> = {
  present: { label: "Present", color: "bg-success/10 text-success", short: "P" },
  absent: { label: "Absent", color: "bg-destructive/10 text-destructive", short: "A" },
  half_day: { label: "Half Day", color: "bg-warning/10 text-warning", short: "H" },
  leave: { label: "Leave", color: "bg-muted text-muted-foreground", short: "L" },
};

export default function Attendance() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isStaff = hasRole("staff");
  const canManage = isAdmin || isStaff;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance Management</h1>
        <p className="text-muted-foreground">Admin-controlled attendance tracking — biometric or manual entry only</p>
      </div>

      <Tabs defaultValue="daily">
        <TabsList>
          <TabsTrigger value="daily">Daily Marking</TabsTrigger>
          <TabsTrigger value="weekly">Weekly View</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
        </TabsList>

        <TabsContent value="daily">{canManage ? <AdminDailyTab /> : <p className="text-muted-foreground py-8 text-center">Admin access required</p>}</TabsContent>
        <TabsContent value="weekly">{canManage ? <WeeklyViewTab /> : null}</TabsContent>
        <TabsContent value="calendar">{canManage ? <CalendarViewTab /> : null}</TabsContent>
        <TabsContent value="monthly">{canManage ? <MonthlyReportTab /> : null}</TabsContent>
      </Tabs>
    </div>
  );
}

// ── Admin Daily Marking ──
function AdminDailyTab() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [markings, setMarkings] = useState<Record<string, { status: AttendanceStatus; checkIn: string; checkOut: string }>>({});

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [{ data: emps }, { data: recs }] = await Promise.all([
      supabase.from("employees").select("id, name, user_id, salary").eq("status", "active").order("name"),
      supabase.from("attendance_records").select("*").eq("date", dateFilter),
    ]);
    setEmployees(emps || []);
    setRecords(recs || []);

    // Build initial markings from existing records
    const m: typeof markings = {};
    (emps || []).forEach(emp => {
      const empId = emp.user_id || emp.id;
      const rec = (recs || []).find(r => r.employee_id === empId);
      if (rec) {
        const hours = rec.check_in && rec.check_out
          ? (new Date(rec.check_out).getTime() - new Date(rec.check_in).getTime()) / 3600000
          : 0;
        m[empId] = {
          status: hours > 0 && hours < 5 ? "half_day" : "present",
          checkIn: rec.check_in ? format(new Date(rec.check_in), "HH:mm") : "09:30",
          checkOut: rec.check_out ? format(new Date(rec.check_out), "HH:mm") : "",
        };
      } else {
        m[empId] = { status: "absent", checkIn: "09:30", checkOut: "18:30" };
      }
    });
    setMarkings(m);
    setLoading(false);
  }, [dateFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveAll = async () => {
    setSaving(true);
    let saved = 0;
    for (const emp of employees) {
      const empId = emp.user_id || emp.id;
      const m = markings[empId];
      if (!m) continue;

      const existing = records.find(r => r.employee_id === empId);

      if (m.status === "absent" || m.status === "leave") {
        if (existing) {
          await supabase.from("attendance_records").delete().eq("id", existing.id);
        }
        // For leave, we might want to track it differently in the future
        continue;
      }

      const checkInTime = `${dateFilter}T${m.checkIn}:00+05:30`;
      const checkOutTime = m.checkOut ? `${dateFilter}T${m.checkOut}:00+05:30` : null;

      if (existing) {
        await supabase.from("attendance_records").update({
          check_in: checkInTime, check_out: checkOutTime,
          source: "manual" as any, notes: m.status === "half_day" ? "Half day" : null,
        }).eq("id", existing.id);
      } else {
        await supabase.from("attendance_records").insert({
          employee_id: empId, date: dateFilter,
          check_in: checkInTime, check_out: checkOutTime,
          source: "manual" as any, created_by: user?.id,
          notes: m.status === "half_day" ? "Half day" : null,
        });
      }
      saved++;
    }
    toast.success(`Saved attendance for ${saved} employees`);
    setSaving(false);
    fetchData();
  };

  const presentCount = Object.values(markings).filter(m => m.status === "present").length;
  const halfDayCount = Object.values(markings).filter(m => m.status === "half_day").length;
  const absentCount = Object.values(markings).filter(m => m.status === "absent").length;
  const leaveCount = Object.values(markings).filter(m => m.status === "leave").length;

  return (
    <div className="space-y-4">
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-success/10"><UserCheck className="h-5 w-5 text-success" /></div>
          <div><p className="text-xl font-bold">{presentCount}</p><p className="text-[11px] text-muted-foreground">Present</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-warning/10"><AlertTriangle className="h-5 w-5 text-warning" /></div>
          <div><p className="text-xl font-bold">{halfDayCount}</p><p className="text-[11px] text-muted-foreground">Half Day</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-destructive/10"><UserX className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-xl font-bold">{absentCount}</p><p className="text-[11px] text-muted-foreground">Absent</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-muted"><Calendar className="h-5 w-5 text-muted-foreground" /></div>
          <div><p className="text-xl font-bold">{leaveCount}</p><p className="text-[11px] text-muted-foreground">Leave</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xl font-bold">{employees.length}</p><p className="text-[11px] text-muted-foreground">Total</p></div>
        </CardContent></Card>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        </div>
        <Button onClick={saveAll} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All
        </Button>
      </div>

      {/* Attendance grid */}
      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => {
                const empId = emp.user_id || emp.id;
                const m = markings[empId] || { status: "absent" as AttendanceStatus, checkIn: "09:30", checkOut: "18:30" };
                const existingRec = records.find(r => r.employee_id === empId);
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell>
                      <Select
                        value={m.status}
                        onValueChange={(v) => setMarkings(prev => ({ ...prev, [empId]: { ...m, status: v as AttendanceStatus } }))}
                      >
                        <SelectTrigger className="h-8 w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(statusConfig).map(([k, v]) => (
                            <SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(m.status === "present" || m.status === "half_day") && (
                        <Input type="time" className="h-8 w-[110px] text-xs" value={m.checkIn}
                          onChange={e => setMarkings(prev => ({ ...prev, [empId]: { ...m, checkIn: e.target.value } }))} />
                      )}
                    </TableCell>
                    <TableCell>
                      {(m.status === "present" || m.status === "half_day") && (
                        <Input type="time" className="h-8 w-[110px] text-xs" value={m.checkOut}
                          onChange={e => setMarkings(prev => ({ ...prev, [empId]: { ...m, checkOut: e.target.value } }))} />
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {existingRec?.source || "manual"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Weekly View ──
function WeeklyViewTab() {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: emps }, { data: recs }] = await Promise.all([
        supabase.from("employees").select("id, name, user_id, salary").eq("status", "active").order("name"),
        supabase.from("attendance_records").select("*")
          .gte("date", format(weekStart, "yyyy-MM-dd"))
          .lte("date", format(weekEnd, "yyyy-MM-dd")),
      ]);
      setEmployees(emps || []);
      setRecords(recs || []);
      setLoading(false);
    };
    fetch();
  }, [currentWeek]);

  const recMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    records.forEach(r => {
      if (!map[r.employee_id]) map[r.employee_id] = new Set();
      map[r.employee_id].add(r.date);
    });
    return map;
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="text-sm font-semibold">
          {format(weekStart, "dd MMM")} — {format(weekEnd, "dd MMM yyyy")}
        </h3>
        <Button variant="outline" size="icon" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10">Employee</TableHead>
                {days.map(d => (
                  <TableHead key={d.toISOString()} className={`text-center min-w-[60px] ${isToday(d) ? "bg-primary/5" : ""}`}>
                    <div className="text-[10px]">{format(d, "EEE")}</div>
                    <div className="text-xs font-medium">{format(d, "dd")}</div>
                  </TableHead>
                ))}
                <TableHead className="text-center">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map(emp => {
                const empId = emp.user_id || emp.id;
                const empRecs = recMap[empId] || new Set();
                let total = 0;
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">{emp.name}</TableCell>
                    {days.map(d => {
                      const ds = format(d, "yyyy-MM-dd");
                      const present = empRecs.has(ds);
                      if (present) total++;
                      return (
                        <TableCell key={ds} className="text-center p-1">
                          <div className={`h-8 w-8 mx-auto rounded-md flex items-center justify-center text-xs font-bold ${
                            present ? "bg-success/10 text-success" : d <= new Date() ? "bg-destructive/10 text-destructive" : "bg-muted/30 text-muted-foreground"
                          }`}>
                            {present ? "P" : d <= new Date() ? "A" : "—"}
                          </div>
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold text-sm">{total}/7</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ── Calendar View ──
function CalendarViewTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const [{ data: recs }, { data: emps }] = await Promise.all([
        supabase.from("attendance_records").select("*").gte("date", monthStart).lte("date", monthEnd),
        supabase.from("employees").select("id, name, user_id, salary").eq("status", "active").order("name"),
      ]);
      setRecords(recs || []);
      setEmployees(emps || []);
      setLoading(false);
    };
    fetch();
  }, [currentMonth]);

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const startDay = getDay(startOfMonth(currentMonth));

  const attendanceMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    records.forEach(r => {
      if (!map[r.date]) map[r.date] = new Set();
      map[r.date].add(r.employee_id);
    });
    return map;
  }, [records]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-4 w-4" /></Button>
        <h3 className="text-lg font-semibold">{format(currentMonth, "MMMM yyyy")}</h3>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-4 w-4" /></Button>
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {dayNames.map(d => <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>)}
              {Array.from({ length: startDay }).map((_, i) => <div key={`empty-${i}`} />)}
              {days.map(day => {
                const ds = format(day, "yyyy-MM-dd");
                const presentIds = attendanceMap[ds] || new Set();
                const present = presentIds.size;
                const total = employees.length;
                const pct = total > 0 ? (present / total) * 100 : 0;
                return (
                  <div
                    key={ds}
                    className={`relative p-2 rounded-lg text-center min-h-[60px] border transition-colors ${
                      isToday(day) ? "border-primary bg-primary/5" :
                      !isSameMonth(day, currentMonth) ? "opacity-30" : "border-border/50 hover:bg-muted/30"
                    }`}
                  >
                    <p className={`text-xs font-medium ${isToday(day) ? "text-primary" : ""}`}>{format(day, "d")}</p>
                    {present > 0 && (
                      <div className="mt-1">
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-success rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{present}/{total}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Monthly Report with Payroll Data ──
function MonthlyReportTab() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const start = `${month}-01`;
    const end = format(endOfMonth(new Date(`${month}-01`)), "yyyy-MM-dd");
    const [{ data: recs }, { data: emps }] = await Promise.all([
      supabase.from("attendance_records").select("*").gte("date", start).lte("date", end),
      supabase.from("employees").select("id, name, user_id, salary").eq("status", "active").order("name"),
    ]);
    setRecords(recs || []);
    setEmployees(emps || []);
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, [month]);

  const daysInMonth = endOfMonth(new Date(`${month}-01`)).getDate();

  const summary = useMemo(() => {
    const map: Record<string, { dates: Set<string>; lateCount: number; halfDays: number; totalHours: number }> = {};
    records.forEach(r => {
      if (!map[r.employee_id]) map[r.employee_id] = { dates: new Set(), lateCount: 0, halfDays: 0, totalHours: 0 };
      map[r.employee_id].dates.add(r.date);
      if (r.check_in) {
        const checkInHour = new Date(r.check_in).getHours();
        const checkInMin = new Date(r.check_in).getMinutes();
        if (checkInHour > 10 || (checkInHour === 10 && checkInMin > 0)) map[r.employee_id].lateCount++;
      }
      if (r.notes?.includes("Half day")) map[r.employee_id].halfDays++;
      if (r.check_in && r.check_out) {
        map[r.employee_id].totalHours += (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
      }
    });
    return map;
  }, [records]);

  const downloadCSV = () => {
    const headers = ["Employee", "Present", "Absent", "Half Days", "Late", "Hours", "Salary", "Working Days", "Deduction Days", "Net Payable"];
    const rows = employees.map(e => {
      const empId = e.user_id || e.id;
      const s = summary[empId] || { dates: new Set(), lateCount: 0, halfDays: 0, totalHours: 0 };
      const present = s.dates.size;
      const absent = daysInMonth - present;
      const salary = e.salary || 0;
      const perDay = salary / daysInMonth;
      const deduction = absent + s.halfDays * 0.5;
      const netPay = Math.max(0, salary - deduction * perDay);
      return [e.name, present, absent, s.halfDays, s.lateCount, s.totalHours.toFixed(1), salary, present, deduction.toFixed(1), Math.round(netPay)];
    });
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-payroll-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" />
        <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-2" />Download Payroll CSV</Button>
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Half Days</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Salary</TableHead>
                <TableHead>Deductions</TableHead>
                <TableHead>Net Payable</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                ) : employees.map(e => {
                  const empId = e.user_id || e.id;
                  const s = summary[empId] || { dates: new Set(), lateCount: 0, halfDays: 0, totalHours: 0 };
                  const present = s.dates.size;
                  const absent = daysInMonth - present;
                  const salary = e.salary || 0;
                  const perDay = daysInMonth > 0 ? salary / daysInMonth : 0;
                  const deduction = absent + s.halfDays * 0.5;
                  const netPay = Math.max(0, salary - deduction * perDay);
                  const pct = daysInMonth > 0 ? Math.round((present / daysInMonth) * 100) : 0;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell><Badge className="bg-success/10 text-success">{present}</Badge></TableCell>
                      <TableCell><Badge className="bg-destructive/10 text-destructive">{absent}</Badge></TableCell>
                      <TableCell><Badge className="bg-warning/10 text-warning">{s.halfDays}</Badge></TableCell>
                      <TableCell>
                        {s.lateCount > 0 ? <Badge className="bg-warning/10 text-warning">{s.lateCount}</Badge> : <span className="text-muted-foreground text-sm">0</span>}
                      </TableCell>
                      <TableCell className="text-sm">{s.totalHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-sm">₹{salary.toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-sm text-destructive">{deduction > 0 ? `${deduction.toFixed(1)}d` : "—"}</TableCell>
                      <TableCell className="font-medium text-sm">₹{Math.round(netPay).toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
