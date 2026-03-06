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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Clock, LogIn, LogOut, Calendar, Users, Download, ChevronLeft, ChevronRight,
  UserCheck, UserX, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay, addMonths, subMonths } from "date-fns";

interface AttendanceRecord {
  id: string; employee_id: string; check_in: string | null; check_out: string | null;
  date: string; source: string; notes: string | null; employee_name?: string;
}

export default function Attendance() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isStaff = hasRole("staff");
  const canView = isAdmin || isStaff;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">Track daily employee attendance</p>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Daily View</TabsTrigger>
          {canView && <TabsTrigger value="calendar">Calendar</TabsTrigger>}
          {canView && <TabsTrigger value="monthly">Monthly Report</TabsTrigger>}
        </TabsList>

        <TabsContent value="attendance"><ManualAttendanceTab /></TabsContent>
        {canView && <TabsContent value="calendar"><CalendarViewTab /></TabsContent>}
        {canView && <TabsContent value="monthly"><MonthlyReportTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ── Daily Attendance Tab ──
function ManualAttendanceTab() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("staff");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [totalEmployees, setTotalEmployees] = useState(0);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("attendance_records").select("*").eq("date", dateFilter).order("check_in", { ascending: false });
    if (!isAdmin) query = query.eq("employee_id", user?.id);
    const { data, error } = await query;
    if (error) toast.error(error.message);

    let enriched = data || [];
    if (isAdmin && enriched.length > 0) {
      const empIds = [...new Set(enriched.map(r => r.employee_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", empIds);
      const nameMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
      enriched = enriched.map(r => ({ ...r, employee_name: nameMap.get(r.employee_id) || undefined }));
    }
    setRecords(enriched as AttendanceRecord[]);

    if (isAdmin) {
      const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("status", "active");
      setTotalEmployees(count || 0);
    }

    if (user) {
      const { data: today } = await supabase.from("attendance_records").select("*").eq("employee_id", user.id).eq("date", format(new Date(), "yyyy-MM-dd")).limit(1).maybeSingle();
      setTodayRecord(today);
    }
    setLoading(false);
  }, [dateFilter, isAdmin, user]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const checkIn = async () => {
    if (!user) return;
    const { error } = await supabase.from("attendance_records").insert({
      employee_id: user.id, check_in: new Date().toISOString(),
      date: format(new Date(), "yyyy-MM-dd"), source: "manual" as any, created_by: user.id,
    });
    if (error) toast.error(error.message);
    else { toast.success("Checked in!"); fetchRecords(); }
  };

  const checkOut = async () => {
    if (!todayRecord) return;
    const { error } = await supabase.from("attendance_records").update({ check_out: new Date().toISOString() }).eq("id", todayRecord.id);
    if (error) toast.error(error.message);
    else { toast.success("Checked out!"); fetchRecords(); }
  };

  const presentCount = records.filter(r => r.check_in).length;
  const completedCount = records.filter(r => r.check_in && r.check_out).length;
  const absentCount = totalEmployees > 0 ? Math.max(0, totalEmployees - presentCount) : 0;

  const calcHours = (r: AttendanceRecord) => {
    if (!r.check_in || !r.check_out) return "—";
    const diff = (new Date(r.check_out).getTime() - new Date(r.check_in).getTime()) / 3600000;
    return diff.toFixed(1) + "h";
  };

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success/10"><UserCheck className="h-5 w-5 text-success" /></div>
            <div><p className="text-xl font-bold">{presentCount}</p><p className="text-[11px] text-muted-foreground">Present</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-destructive/10"><UserX className="h-5 w-5 text-destructive" /></div>
            <div><p className="text-xl font-bold">{absentCount}</p><p className="text-[11px] text-muted-foreground">Absent</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-warning/10"><AlertTriangle className="h-5 w-5 text-warning" /></div>
            <div><p className="text-xl font-bold">{presentCount - completedCount}</p><p className="text-[11px] text-muted-foreground">Still Working</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
            <div><p className="text-xl font-bold">{totalEmployees}</p><p className="text-[11px] text-muted-foreground">Total Employees</p></div>
          </CardContent></Card>
          <Card><CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-info/10"><LogIn className="h-5 w-5 text-info" /></div>
            <div><p className="text-xl font-bold">{completedCount}</p><p className="text-[11px] text-muted-foreground">Completed</p></div>
          </CardContent></Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex gap-2">
          {!todayRecord ? (
            <Button onClick={checkIn} className="bg-success hover:bg-success/90"><LogIn className="h-4 w-4 mr-2" />Check In</Button>
          ) : !todayRecord.check_out ? (
            <Button onClick={checkOut} variant="destructive"><LogOut className="h-4 w-4 mr-2" />Check Out</Button>
          ) : (
            <Badge className="bg-success/10 text-success py-2 px-4">✓ Completed for today</Badge>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
        </div>
      </div>

      {todayRecord && (
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Record</p>
              <p className="font-medium">
                In: {todayRecord.check_in ? format(new Date(todayRecord.check_in), "hh:mm a") : "—"}
                {" · "}Out: {todayRecord.check_out ? format(new Date(todayRecord.check_out), "hh:mm a") : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            {isAdmin && <TableHead>Employee</TableHead>}
            <TableHead>Date</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead>Hours</TableHead><TableHead>Source</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No records for this date</TableCell></TableRow>
            ) : records.map(r => (
              <TableRow key={r.id}>
                {isAdmin && <TableCell className="text-sm font-medium">{r.employee_name || r.employee_id.slice(0, 8) + "..."}</TableCell>}
                <TableCell>{format(new Date(r.date), "dd MMM yyyy")}</TableCell>
                <TableCell>{r.check_in ? format(new Date(r.check_in), "hh:mm a") : "—"}</TableCell>
                <TableCell>{r.check_out ? format(new Date(r.check_out), "hh:mm a") : "—"}</TableCell>
                <TableCell className="font-medium">{calcHours(r)}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.source}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Calendar View Tab ──
function CalendarViewTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; user_id: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const [{ data: recs }, { data: emps }] = await Promise.all([
        supabase.from("attendance_records").select("*").gte("date", monthStart).lte("date", monthEnd),
        supabase.from("employees").select("id, name, user_id").eq("status", "active").order("name"),
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

  // Build attendance map: date -> set of employee_ids
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

// ── Monthly Report Tab ──
function MonthlyReportTab() {
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; user_id: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    const start = `${month}-01`;
    const end = format(endOfMonth(new Date(`${month}-01`)), "yyyy-MM-dd");
    const [{ data: recs }, { data: emps }] = await Promise.all([
      supabase.from("attendance_records").select("*").gte("date", start).lte("date", end),
      supabase.from("employees").select("id, name, user_id").eq("status", "active").order("name"),
    ]);
    setRecords(recs || []);
    setEmployees(emps || []);
    setLoading(false);
  };

  useEffect(() => { fetchReport(); }, [month]);

  // Build: employee_id -> number of present days
  const summary = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    records.forEach(r => {
      if (!map[r.employee_id]) map[r.employee_id] = new Set();
      map[r.employee_id].add(r.date);
    });
    return map;
  }, [records]);

  const daysInMonth = endOfMonth(new Date(`${month}-01`)).getDate();

  const downloadCSV = () => {
    const headers = ["Employee", "Present Days", "Absent Days", "Total Days"];
    const rows = employees.map(e => {
      const userId = e.user_id || e.id;
      const present = summary[userId]?.size || 0;
      return [e.name, present, daysInMonth - present, daysInMonth];
    });
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `attendance-${month}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-auto" />
        </div>
        <Button variant="outline" onClick={downloadCSV}><Download className="h-4 w-4 mr-2" />Download CSV</Button>
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Employee</TableHead><TableHead>Present Days</TableHead><TableHead>Absent Days</TableHead><TableHead>Attendance %</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {employees.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
                ) : employees.map(e => {
                  const userId = e.user_id || e.id;
                  const present = summary[userId]?.size || 0;
                  const pct = daysInMonth > 0 ? Math.round((present / daysInMonth) * 100) : 0;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.name}</TableCell>
                      <TableCell><Badge className="bg-success/10 text-success">{present}</Badge></TableCell>
                      <TableCell><Badge className="bg-destructive/10 text-destructive">{daysInMonth - present}</Badge></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs font-medium">{pct}%</span>
                        </div>
                      </TableCell>
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
