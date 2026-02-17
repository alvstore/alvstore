import { useState, useEffect, useCallback } from "react";
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
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Clock, LogIn, LogOut, Calendar, RefreshCw, Plus, TestTube, Pencil, Trash2, Link, Cloud, Download,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Types ──
interface AttendanceRecord {
  id: string;
  employee_id: string;
  check_in: string | null;
  check_out: string | null;
  date: string;
  source: string;
  notes: string | null;
  employee_name?: string;
}

interface HikDevice {
  id: string;
  name: string;
  ip_address: string; // used as device serial number now
  port: number;
  username: string;
  password: string;
  status: string;
  last_sync_at: string | null;
  created_at: string;
}

interface HikLog {
  id: string;
  device_id: string;
  employee_code: string;
  employee_name: string;
  employee_id: string | null;
  device_ip: string;
  device_name: string;
  event_time: string;
  event_type: string;
  created_at: string;
}

interface HikMapping {
  id: string;
  device_employee_code: string;
  device_employee_name: string;
  erp_employee_id: string | null;
  device_id: string;
}

interface SyncLog {
  id: string;
  device_id: string;
  action: string;
  status: string;
  records_synced: number;
  error_message: string | null;
  created_at: string;
}

interface Employee {
  id: string;
  name: string;
}

// ── Main Component ──
export default function Attendance() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const isStaff = hasRole("staff");
  const canView = isAdmin || isStaff;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-muted-foreground">Track employee attendance & manage Hikvision devices via Hik-Partner Pro Cloud</p>
      </div>

      <Tabs defaultValue="attendance">
        <TabsList className="flex-wrap">
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          {isAdmin && <TabsTrigger value="devices">Devices</TabsTrigger>}
          {isAdmin && <TabsTrigger value="sync-logs">Sync Logs</TabsTrigger>}
          {isAdmin && <TabsTrigger value="mapping">Employee Mapping</TabsTrigger>}
          {canView && <TabsTrigger value="device-logs">Device Logs</TabsTrigger>}
        </TabsList>

        <TabsContent value="attendance">
          <ManualAttendanceTab />
        </TabsContent>
        {isAdmin && (
          <TabsContent value="devices">
            <DevicesTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="sync-logs">
            <SyncLogsTab />
          </TabsContent>
        )}
        {isAdmin && (
          <TabsContent value="mapping">
            <EmployeeMappingTab />
          </TabsContent>
        )}
        {canView && (
          <TabsContent value="device-logs">
            <DeviceLogsTab />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════
// TAB 1: Manual Attendance (existing)
// ══════════════════════════════════════
function ManualAttendanceTab() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("staff");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

      <div className="flex gap-3 items-center">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {isAdmin && <TableHead>Employee</TableHead>}
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
                {isAdmin && <TableCell className="text-sm">{r.employee_name || r.employee_id.slice(0, 8) + "..."}</TableCell>}
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

// ══════════════════════════════════════
// TAB 2: Devices (Hik-Partner Pro Cloud)
// ══════════════════════════════════════
function DevicesTab() {
  const [devices, setDevices] = useState<HikDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<HikDevice | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [fetchingCloud, setFetchingCloud] = useState(false);
  const [form, setForm] = useState({ name: "", ip_address: "", port: "80" });

  const fetchDevices = async () => {
    setLoading(true);
    const { data } = await supabase.from("hikvision_devices").select("*").order("created_at");
    setDevices((data || []) as HikDevice[]);
    setLoading(false);
  };

  useEffect(() => { fetchDevices(); }, []);

  const openAdd = () => {
    setEditDevice(null);
    setForm({ name: "", ip_address: "", port: "80" });
    setSheetOpen(true);
  };

  const openEdit = (d: HikDevice) => {
    setEditDevice(d);
    setForm({ name: d.name, ip_address: d.ip_address, port: d.port.toString() });
    setSheetOpen(true);
  };

  const save = async () => {
    const payload = { name: form.name, ip_address: form.ip_address, port: parseInt(form.port) || 80 };
    if (!payload.name || !payload.ip_address) { toast.error("Name and Device Serial are required"); return; }

    if (editDevice) {
      const { error } = await supabase.from("hikvision_devices").update(payload).eq("id", editDevice.id);
      if (error) toast.error(error.message); else toast.success("Device updated");
    } else {
      const { error } = await supabase.from("hikvision_devices").insert(payload);
      if (error) toast.error(error.message); else toast.success("Device added");
    }
    setSheetOpen(false);
    fetchDevices();
  };

  const deleteDevice = async (id: string) => {
    if (!confirm("Delete this device?")) return;
    const { error } = await supabase.from("hikvision_devices").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchDevices(); }
  };

  const fetchCloudDevices = async () => {
    setFetchingCloud(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "list-devices" },
      });
      if (error) throw error;
      if (data?.success && data.devices) {
        toast.success(`Found ${data.devices.length} devices on Hik-Partner Pro`);
        // Auto-import devices that don't exist locally
        let imported = 0;
        for (const cd of data.devices) {
          const serial = cd.deviceSerial || cd.serial;
          if (!serial) continue;
          const exists = devices.find(d => d.ip_address === serial);
          if (!exists) {
            await supabase.from("hikvision_devices").insert({
              name: cd.deviceName || cd.name || serial,
              ip_address: serial,
              port: 80,
            });
            imported++;
          }
        }
        if (imported > 0) {
          toast.success(`Imported ${imported} new devices`);
          fetchDevices();
        }
      } else {
        toast.error("Failed: " + (data?.error || "Unknown error"));
      }
    } catch (e: any) {
      toast.error("Error: " + (e.message || "Unknown"));
    }
    setFetchingCloud(false);
  };

  const testConnection = async (d: HikDevice) => {
    setTestingId(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "test", device_id: d.id, device_serial: d.ip_address },
      });
      if (error) throw error;
      if (data?.success) toast.success("✅ Connected to " + d.name + " via Hik-Partner Pro Cloud");
      else toast.error("❌ Connection failed: " + (data?.error || "Unknown error"));
    } catch (e: any) {
      toast.error("Connection error: " + (e.message || "Unknown"));
    }
    setTestingId(null);
  };

  const syncDevice = async (d: HikDevice) => {
    setSyncingId(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "sync", device_id: d.id, device_serial: d.ip_address },
      });
      if (error) throw error;
      if (data?.success) toast.success(`Synced ${data.records_synced} records from ${d.name}`);
      else toast.error("Sync failed: " + (data?.error || "Unknown error"));
    } catch (e: any) {
      toast.error("Sync error: " + (e.message || "Unknown"));
    }
    setSyncingId(null);
    fetchDevices();
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Cloud className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary">Hik-Partner Pro Cloud Integration</p>
            <p className="text-muted-foreground mt-1">
              Devices are accessed via the Hik-Partner Pro Cloud API. Add devices by their serial number,
              or import them automatically from your Hik-Partner Pro account.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Registered Devices</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCloudDevices} disabled={fetchingCloud}>
            {fetchingCloud ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            Import from Cloud
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Device</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Device Serial</TableHead>
              <TableHead>Last Sync</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : devices.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No devices configured. Import from cloud or add manually.</TableCell></TableRow>
            ) : devices.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  {d.status === "active" ? (
                    <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-green-500" />Active</span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs"><span className="h-2 w-2 rounded-full bg-red-500" />Inactive</span>
                  )}
                </TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="font-mono text-sm">{d.ip_address}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.last_sync_at ? format(new Date(d.last_sync_at), "dd MMM yyyy hh:mm a") : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end">
                    <Button size="sm" variant="outline" onClick={() => testConnection(d)} disabled={testingId === d.id} title="Test Connection">
                      {testingId === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => syncDevice(d)} disabled={syncingId === d.id} title="Sync Events">
                      {syncingId === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteDevice(d.id)} className="text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>{editDevice ? "Edit Device" : "Add Device"}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div><Label>Device Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Office Controller" /></div>
            <div>
              <Label>Device Serial Number *</Label>
              <Input value={form.ip_address} onChange={e => setForm(p => ({ ...p, ip_address: e.target.value }))} placeholder="e.g. Q01XXXXXX" />
              <p className="text-xs text-muted-foreground mt-1">The serial number from your Hik-Partner Pro account</p>
            </div>
            <Button onClick={save} className="w-full">{editDevice ? "Update Device" : "Add Device"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ══════════════════════════════════════
// TAB 3: Sync Logs
// ══════════════════════════════════════
function SyncLogsTab() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [devices, setDevices] = useState<HikDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: logsData }, { data: devData }] = await Promise.all([
        supabase.from("hikvision_sync_log").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("hikvision_devices").select("*"),
      ]);
      setLogs((logsData || []) as SyncLog[]);
      setDevices((devData || []) as HikDevice[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const deviceName = (id: string) => devices.find(d => d.id === id)?.name || id.slice(0, 8);
  const filtered = deviceFilter === "all" ? logs : logs.filter(l => l.device_id === deviceFilter);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Sync Logs</h3>
        <Select value={deviceFilter} onValueChange={setDeviceFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Devices" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Devices</SelectItem>
            {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Device</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No sync logs</TableCell></TableRow>
            ) : filtered.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-sm">{format(new Date(l.created_at), "dd MMM hh:mm a")}</TableCell>
                <TableCell className="text-sm">{deviceName(l.device_id)}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{l.action.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell>
                  <Badge variant={l.status === "success" ? "default" : "destructive"}>
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell>{l.records_synced || "—"}</TableCell>
                <TableCell className="text-sm text-destructive max-w-[200px] truncate">{l.error_message || "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// TAB 4: Employee Mapping
// ══════════════════════════════════════
function EmployeeMappingTab() {
  const [mappings, setMappings] = useState<HikMapping[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: mapData }, { data: empData }] = await Promise.all([
      supabase.from("hikvision_employee_mapping").select("*").order("device_employee_code"),
      supabase.from("employees").select("id, name").eq("status", "active").order("name"),
    ]);
    setMappings((mapData || []) as HikMapping[]);
    setEmployees((empData || []) as Employee[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateMapping = async (id: string, erpEmployeeId: string) => {
    const value = erpEmployeeId === "none" ? null : erpEmployeeId;
    const { error } = await supabase.from("hikvision_employee_mapping").update({ erp_employee_id: value }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Mapping updated"); fetchData(); }
  };

  const autoMap = async () => {
    let mapped = 0;
    for (const m of mappings) {
      if (m.erp_employee_id) continue;
      const match = employees.find(e =>
        e.name.toLowerCase() === (m.device_employee_name || "").toLowerCase()
      );
      if (match) {
        await supabase.from("hikvision_employee_mapping").update({ erp_employee_id: match.id }).eq("id", m.id);
        mapped++;
      }
    }
    toast.success(`Auto-mapped ${mapped} employees`);
    fetchData();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Employee Mapping</h3>
        <Button variant="outline" onClick={autoMap}><Link className="h-4 w-4 mr-2" />Auto Map</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Device Code</TableHead>
              <TableHead>Device Name</TableHead>
              <TableHead>ERP Employee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : mappings.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No mappings yet. Sync a device first.</TableCell></TableRow>
            ) : mappings.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.device_employee_code}</TableCell>
                <TableCell>{m.device_employee_name || "—"}</TableCell>
                <TableCell>
                  <Select value={m.erp_employee_id || "none"} onValueChange={v => updateMapping(m.id, v)}>
                    <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select Employee" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Not Mapped —</SelectItem>
                      {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// TAB 5: Device Logs (raw events)
// ══════════════════════════════════════
function DeviceLogsTab() {
  const [logs, setLogs] = useState<HikLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const startOfDay = `${dateFilter}T00:00:00`;
      const endOfDay = `${dateFilter}T23:59:59`;
      const { data } = await supabase
        .from("hikvision_attendance_logs")
        .select("*")
        .gte("event_time", startOfDay)
        .lte("event_time", endOfDay)
        .order("event_time", { ascending: false })
        .limit(500);
      setLogs((data || []) as HikLog[]);
      setLoading(false);
    };
    fetch();
  }, [dateFilter]);

  const filtered = search
    ? logs.filter(l => l.employee_code?.toLowerCase().includes(search.toLowerCase()) || l.employee_name?.toLowerCase().includes(search.toLowerCase()))
    : logs;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h3 className="text-lg font-semibold">Device Attendance Logs</h3>
        <div className="flex gap-2">
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" />
          <Input placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)} className="w-[200px]" />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Employee Code</TableHead>
              <TableHead>Employee Name</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No device logs for this date</TableCell></TableRow>
            ) : filtered.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-sm">{format(new Date(l.event_time), "hh:mm:ss a")}</TableCell>
                <TableCell className="font-mono">{l.employee_code}</TableCell>
                <TableCell>{l.employee_name || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{l.event_type}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{l.device_name || l.device_ip}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
