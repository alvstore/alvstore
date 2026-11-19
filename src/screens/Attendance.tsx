"use client";

import { Box, Button, Card, CardContent, IconButton, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, StatCard, StatusChip, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Clock, Calendar, Users, Download, ChevronLeft, ChevronRight, UserCheck, UserX, AlertTriangle, Save, Loader2, } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, getDay, addMonths, subMonths, startOfWeek, endOfWeek, addWeeks, subWeeks, isSameDay, } from "date-fns";
interface AttendanceRecord {
    id: string;
    employee_id: string;
    check_in: string | null;
    check_out: string | null;
    date: string;
    source: string;
    notes: string | null;
}
interface Employee {
    id: string;
    name: string;
    user_id: string | null;
    salary: number | null;
}
type AttendanceStatus = "present" | "absent" | "half_day" | "leave";
const statusConfig = {
    present: { label: "Present", color: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }, short: "P" },
    absent: { label: "Absent", color: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" }, short: "A" },
    half_day: { label: "Half Day", color: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }, short: "H" },
    leave: { label: "Leave", color: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }, short: "L" },
};
export default function Attendance() {
    const { hasRole } = useAuth();
    const isAdmin = hasRole("admin");
    const isStaff = hasRole("staff");
    const canManage = isAdmin || isStaff;
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Attendance Management"} subtitle={"Admin-controlled attendance tracking \u2014 biometric or manual entry only"}/>

      <TabView defaultValue="daily">
        <TabBar>
          <Tab value="daily" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Daily Marking</Box>}/>
          <Tab value="weekly" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Weekly View</Box>}/>
          <Tab value="calendar" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Calendar</Box>}/>
          <Tab value="monthly" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Monthly Report</Box>}/>
        </TabBar>

        <TabPanel value="daily">{canManage ? <AdminDailyTab /> : <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", paddingTop: "2rem", paddingBottom: "2rem", textAlign: "center" }}>Admin access required</Typography>}</TabPanel>
        <TabPanel value="weekly">{canManage ? <WeeklyViewTab /> : null}</TabPanel>
        <TabPanel value="calendar">{canManage ? <CalendarViewTab /> : null}</TabPanel>
        <TabPanel value="monthly">{canManage ? <MonthlyReportTab /> : null}</TabPanel>
      </TabView>
    </Box></AnimatedPage>;
}
// ── Admin Daily Marking ──
function AdminDailyTab() {
    const { user } = useAuth();
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [markings, setMarkings] = useState<Record<string, {
        status: AttendanceStatus;
        checkIn: string;
        checkOut: string;
    }>>({});
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
            }
            else {
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
            if (!m)
                continue;
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
            }
            else {
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
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      {/* KPI row */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }, gap: "0.75rem" }}>
        <StatCard label={"Present"} value={presentCount} icon={<Box component={UserCheck} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={"Half Day"} value={halfDayCount} icon={<Box component={AlertTriangle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Absent"} value={absentCount} icon={<Box component={UserX} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--destructive))" }}/>} accent="error"/>
        <StatCard label={"Leave"} value={leaveCount} icon={<Box component={Calendar} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--muted-foreground))" }}/>}/>
        <StatCard label={"Total"} value={employees.length} icon={<Box component={Users} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
      </Box>

      {/* Controls */}
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row", alignItems: "center" }, justifyContent: "space-between", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Box component={Calendar} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--muted-foreground))" }}/>
          <TextField type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "auto" }}/>
        </Box>
        <Button onClick={saveAll} disabled={saving} variant="contained">
          {saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}
          Save All
        </Button>
      </Box>

      {/* Attendance grid */}
      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={5}>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Check In</TableCell>
                <TableCell>Check Out</TableCell>
                <TableCell>Source</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map(emp => {
                const empId = emp.user_id || emp.id;
                const m = markings[empId] || { status: "absent" as AttendanceStatus, checkIn: "09:30", checkOut: "18:30" };
                const existingRec = records.find(r => r.employee_id === empId);
                return (<TableRow key={emp.id}>
                    <TableCell sx={{ fontWeight: "500" }}>{emp.name}</TableCell>
                    <TableCell>
                      <TextField value={m.status} select size="small" fullWidth onChange={event => ((v) => setMarkings(prev => ({ ...prev, [empId]: { ...m, status: v as AttendanceStatus } })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "2rem", width: "120px", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          {Object.entries(statusConfig).map(([k, v]) => (<MenuItem key={k} value={k} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{v.label}</MenuItem>))}
                        </TextField>
                    </TableCell>
                    <TableCell>
                      {(m.status === "present" || m.status === "half_day") && (<TextField type="time" value={m.checkIn} onChange={e => setMarkings(prev => ({ ...prev, [empId]: { ...m, checkIn: e.target.value } }))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", width: "110px", fontSize: "0.75rem", lineHeight: "1rem" }}/>)}
                    </TableCell>
                    <TableCell>
                      {(m.status === "present" || m.status === "half_day") && (<TextField type="time" value={m.checkOut} onChange={e => setMarkings(prev => ({ ...prev, [empId]: { ...m, checkOut: e.target.value } }))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", width: "110px", fontSize: "0.75rem", lineHeight: "1rem" }}/>)}
                    </TableCell>
                    <TableCell>
                      <StatusChip label={existingRec?.source || "manual"} variant="outlined" sx={{ textTransform: "capitalize", fontSize: "10px" }}/>
                    </TableCell>
                  </TableRow>);
            })}
            </TableBody>
          </DataTable>
        </Box>)}
    </Box>);
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
            if (!map[r.employee_id])
                map[r.employee_id] = new Set();
            map[r.employee_id].add(r.date);
        });
        return map;
    }, [records]);
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))} aria-label={"Chevron Left"}><Box component={ChevronLeft} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
        <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>
          {format(weekStart, "dd MMM")} — {format(weekEnd, "dd MMM yyyy")}
        </Typography>
        <IconButton onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))} aria-label={"Chevron Right"}><Box component={ChevronRight} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
      </Box>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))", overflowX: "auto" }}>
          <DataTable columnsCount={3}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: "sticky", left: "0px", backgroundColor: "hsl(var(--card))", zIndex: "10" }}>Employee</TableCell>
                {days.map(d => (<TableCell key={d.toISOString()} sx={mergeSx({ textAlign: "center", minWidth: "60px" }, isToday(d) ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" } : {})}>
                    <Box sx={{ fontSize: "10px" }}>{format(d, "EEE")}</Box>
                    <Box sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }}>{format(d, "dd")}</Box>
                  </TableCell>))}
                <TableCell sx={{ textAlign: "center" }}>Total</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map(emp => {
                const empId = emp.user_id || emp.id;
                const empRecs = recMap[empId] || new Set();
                let total = 0;
                return (<TableRow key={emp.id}>
                    <TableCell sx={{ position: "sticky", left: "0px", backgroundColor: "hsl(var(--card))", zIndex: "10", fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{emp.name}</TableCell>
                    {days.map(d => {
                        const ds = format(d, "yyyy-MM-dd");
                        const present = empRecs.has(ds);
                        if (present)
                            total++;
                        return (<TableCell key={ds} sx={{ textAlign: "center", padding: "0.25rem" }}>
                          <Box sx={mergeSx({ height: "2rem", width: "2rem", marginLeft: "auto", marginRight: "auto", borderRadius: "calc(var(--radius) - 2px)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "700" }, present ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : d <= new Date() ? { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", color: "hsl(var(--muted-foreground))" })}>
                            {present ? "P" : d <= new Date() ? "A" : "—"}
                          </Box>
                        </TableCell>);
                    })}
                    <TableCell sx={{ textAlign: "center", fontWeight: "700", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{total}/7</TableCell>
                  </TableRow>);
            })}
            </TableBody>
          </DataTable>
        </Box>)}
    </Box>);
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
            if (!map[r.date])
                map[r.date] = new Set();
            map[r.date].add(r.employee_id);
        });
        return map;
    }, [records]);
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <IconButton onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label={"Chevron Left"}><Box component={ChevronLeft} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
        <Typography component="h3" variant="h3" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "600" }}>{format(currentMonth, "MMMM yyyy")}</Typography>
        <IconButton onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label={"Chevron Right"}><Box component={ChevronRight} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
      </Box>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Card>
          <CardContent sx={{ padding: "1rem" }}>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: "0.25rem" }}>
              {dayNames.map(d => <Box key={d} sx={{ textAlign: "center", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>{d}</Box>)}
              {Array.from({ length: startDay }).map((_, i) => <Box key={`empty-${i}`}/>)}
              {days.map(day => {
                const ds = format(day, "yyyy-MM-dd");
                const presentIds = attendanceMap[ds] || new Set();
                const present = presentIds.size;
                const total = employees.length;
                const pct = total > 0 ? (present / total) * 100 : 0;
                return (<Box key={ds} sx={mergeSx({ position: "relative", padding: "0.5rem", borderRadius: "var(--radius)", textAlign: "center", minHeight: "60px", borderWidth: "1px", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, isToday(day) ? { borderColor: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" } :
                    !isSameMonth(day, currentMonth) ? { opacity: "0.3" } : { borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" } })}>
                    <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }, isToday(day) ? { color: "hsl(var(--primary))" } : {})}>{format(day, "d")}</Typography>
                    {present > 0 && (<Box sx={{ marginTop: "0.25rem" }}>
                        <Box sx={{ height: "0.375rem", backgroundColor: "hsl(var(--muted))", borderRadius: "9999px", overflow: "hidden" }}>
                          <Box sx={mergeSx({ height: "100%", backgroundColor: "hsl(var(--success))", borderRadius: "9999px" }, { width: `${pct}%` })}/>
                        </Box>
                        <Typography component="p" variant="body1" sx={{ fontSize: "9px", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>{present}/{total}</Typography>
                      </Box>)}
                  </Box>);
            })}
            </Box>
          </CardContent>
        </Card>)}
    </Box>);
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
        const map: Record<string, {
            dates: Set<string>;
            lateCount: number;
            halfDays: number;
            totalHours: number;
        }> = {};
        records.forEach(r => {
            if (!map[r.employee_id])
                map[r.employee_id] = { dates: new Set(), lateCount: 0, halfDays: 0, totalHours: 0 };
            map[r.employee_id].dates.add(r.date);
            if (r.check_in) {
                const checkInHour = new Date(r.check_in).getHours();
                const checkInMin = new Date(r.check_in).getMinutes();
                if (checkInHour > 10 || (checkInHour === 10 && checkInMin > 0))
                    map[r.employee_id].lateCount++;
            }
            if (r.notes?.includes("Half day"))
                map[r.employee_id].halfDays++;
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
        a.href = url;
        a.download = `attendance-payroll-${month}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Report downloaded");
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <TextField type="month" value={month} onChange={e => setMonth(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ width: "auto" }}/>
        <Button onClick={downloadCSV} variant="outlined"><Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Download Payroll CSV</Button>
      </Box>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Card>
          <CardContent sx={{ padding: "0px" }}>
            <DataTable columnsCount={9} empty={employees.length === 0} emptyMessage={"No employees found"}>
              <TableHead><TableRow>
                <TableCell>Employee</TableCell>
                <TableCell>Present</TableCell>
                <TableCell>Absent</TableCell>
                <TableCell>Half Days</TableCell>
                <TableCell>Late</TableCell>
                <TableCell>Hours</TableCell>
                <TableCell>Salary</TableCell>
                <TableCell>Deductions</TableCell>
                <TableCell>Net Payable</TableCell>
              </TableRow></TableHead>
              <TableBody>{employees.map(e => {
            const empId = e.user_id || e.id;
            const s = summary[empId] || { dates: new Set(), lateCount: 0, halfDays: 0, totalHours: 0 };
            const present = s.dates.size;
            const absent = daysInMonth - present;
            const salary = e.salary || 0;
            const perDay = daysInMonth > 0 ? salary / daysInMonth : 0;
            const deduction = absent + s.halfDays * 0.5;
            const netPay = Math.max(0, salary - deduction * perDay);
            const pct = daysInMonth > 0 ? Math.round((present / daysInMonth) * 100) : 0;
            return (<TableRow key={e.id}>
                      <TableCell sx={{ fontWeight: "500" }}>{e.name}</TableCell>
                      <TableCell><StatusChip label={present} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }}/></TableCell>
                      <TableCell><StatusChip label={absent} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" }}/></TableCell>
                      <TableCell><StatusChip label={s.halfDays} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }}/></TableCell>
                      <TableCell>
                        {s.lateCount > 0 ? <StatusChip label={s.lateCount} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }}/> : <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.875rem", lineHeight: "1.25rem" }}>0</Box>}
                      </TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{s.totalHours.toFixed(1)}h</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>₹{salary.toLocaleString("en-IN")}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--destructive))" }}>{deduction > 0 ? `${deduction.toFixed(1)}d` : "—"}</TableCell>
                      <TableCell sx={{ fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem" }}>₹{Math.round(netPay).toLocaleString("en-IN")}</TableCell>
                    </TableRow>);
        })}</TableBody>
            </DataTable>
          </CardContent>
        </Card>)}
    </Box>);
}
