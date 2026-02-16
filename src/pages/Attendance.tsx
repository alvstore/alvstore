import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Clock, LogIn, LogOut, Calendar } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface AttendanceRecord {
  id: string;
  employee_id: string;
  check_in: string | null;
  check_out: string | null;
  date: string;
  source: string;
  notes: string | null;
}

export default function Attendance() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("staff");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  const fetchRecords = async () => {
    setLoading(true);
    let query = supabase.from("attendance_records").select("*").eq("date", dateFilter).order("check_in", { ascending: false });
    if (!isAdmin) query = query.eq("employee_id", user?.id);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    setRecords(data || []);

    // Get today's record for current user
    if (user) {
      const { data: today } = await supabase.from("attendance_records").select("*").eq("employee_id", user.id).eq("date", format(new Date(), "yyyy-MM-dd")).limit(1).maybeSingle();
      setTodayRecord(today);
    }
    setLoading(false);
  };

  useEffect(() => { fetchRecords(); }, [dateFilter]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
          <p className="text-muted-foreground">Track employee attendance</p>
        </div>
        <div className="flex gap-2">
          {!todayRecord ? (
            <Button onClick={checkIn} className="bg-success hover:bg-success/90">
              <LogIn className="h-4 w-4 mr-2" />Check In
            </Button>
          ) : !todayRecord.check_out ? (
            <Button onClick={checkOut} variant="destructive">
              <LogOut className="h-4 w-4 mr-2" />Check Out
            </Button>
          ) : (
            <Badge className="bg-success/10 text-success py-2 px-4">✓ Completed for today</Badge>
          )}
        </div>
      </div>

      {/* Today Status */}
      {todayRecord && (
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-primary/10"><Clock className="h-5 w-5 text-primary" /></div>
            <div>
              <p className="text-sm text-muted-foreground">Today's Record</p>
              <p className="font-medium">
                In: {todayRecord.check_in ? format(new Date(todayRecord.check_in), "hh:mm a") : "—"}
                {" · "}
                Out: {todayRecord.check_out ? format(new Date(todayRecord.check_out), "hh:mm a") : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Date filter */}
      <div className="flex gap-3 items-center">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
      </div>

      {/* Records Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Employee ID</TableHead>}
              <TableHead>Date</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : records.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No records for this date</TableCell></TableRow>
            ) : records.map(r => (
              <TableRow key={r.id}>
                {isAdmin && <TableCell className="font-mono text-xs">{r.employee_id.slice(0, 8)}...</TableCell>}
                <TableCell>{format(new Date(r.date), "dd MMM yyyy")}</TableCell>
                <TableCell>{r.check_in ? format(new Date(r.check_in), "hh:mm a") : "—"}</TableCell>
                <TableCell>{r.check_out ? format(new Date(r.check_out), "hh:mm a") : "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{r.source}</Badge></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
