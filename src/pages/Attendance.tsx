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
  Clock, LogIn, LogOut, Calendar, RefreshCw, Plus, TestTube, Pencil, Trash2, Link, Cloud, Download, Users, Building2, Camera, Zap, Info,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ── Types ──
interface AttendanceRecord {
  id: string; employee_id: string; check_in: string | null; check_out: string | null;
  date: string; source: string; notes: string | null; employee_name?: string;
}

interface HikDevice {
  id: string; name: string; ip_address: string; port: number; username: string;
  password: string; status: string; last_sync_at: string | null; created_at: string;
  device_model?: string; device_version?: string; device_serial?: string;
}

interface HikLog {
  id: string; device_id: string; employee_code: string; employee_name: string;
  employee_id: string | null; device_ip: string; device_name: string;
  event_time: string; event_type: string; created_at: string;
}

interface HikMapping {
  id: string; device_employee_code: string; device_employee_name: string;
  erp_employee_id: string | null; device_id: string;
  card_number?: string; department_name?: string; synced_at?: string; avatar_synced?: boolean;
}

interface SyncLog {
  id: string; device_id: string; action: string; status: string;
  records_synced: number; error_message: string | null; created_at: string;
  sync_type?: string;
}

interface Employee { id: string; name: string; }

interface Department {
  id: string; name: string; device_department_id: string | null;
  parent_id: string | null; device_id: string | null; created_at: string;
}

// ── Main Component ──
export default function Attendance() {
  const { hasRole } = useAuth();
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
          {isAdmin && <TabsTrigger value="departments">Departments</TabsTrigger>}
          {canView && <TabsTrigger value="device-logs">Device Logs</TabsTrigger>}
        </TabsList>

        <TabsContent value="attendance"><ManualAttendanceTab /></TabsContent>
        {isAdmin && <TabsContent value="devices"><DevicesTab /></TabsContent>}
        {isAdmin && <TabsContent value="sync-logs"><SyncLogsTab /></TabsContent>}
        {isAdmin && <TabsContent value="mapping"><EmployeeMappingTab /></TabsContent>}
        {isAdmin && <TabsContent value="departments"><DepartmentsTab /></TabsContent>}
        {canView && <TabsContent value="device-logs"><DeviceLogsTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

// ══════════════════════════════════════
// TAB 1: Manual Attendance
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
            <Button onClick={checkIn} className="bg-success hover:bg-success/90"><LogIn className="h-4 w-4 mr-2" />Check In</Button>
          ) : !todayRecord.check_out ? (
            <Button onClick={checkOut} variant="destructive"><LogOut className="h-4 w-4 mr-2" />Check Out</Button>
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
                {" · "}Out: {todayRecord.check_out ? format(new Date(todayRecord.check_out), "hh:mm a") : "—"}
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
          <TableHeader><TableRow>
            {isAdmin && <TableHead>Employee</TableHead>}
            <TableHead>Date</TableHead><TableHead>Check In</TableHead><TableHead>Check Out</TableHead><TableHead>Source</TableHead>
          </TableRow></TableHeader>
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
// TAB 2: Devices (Enhanced)
// ══════════════════════════════════════
function DevicesTab() {
  const [devices, setDevices] = useState<HikDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editDevice, setEditDevice] = useState<HikDevice | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [fetchingCloud, setFetchingCloud] = useState(false);
  const [fullSyncingId, setFullSyncingId] = useState<string | null>(null);
  const [fetchingInfoId, setFetchingInfoId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", ip_address: "", port: "80" });

  const fetchDevices = async () => {
    setLoading(true);
    const { data } = await supabase.from("hikvision_devices").select("*").order("created_at");
    setDevices((data || []) as HikDevice[]);
    setLoading(false);
  };

  useEffect(() => { fetchDevices(); }, []);

  const openAdd = () => { setEditDevice(null); setForm({ name: "", ip_address: "", port: "80" }); setSheetOpen(true); };
  const openEdit = (d: HikDevice) => { setEditDevice(d); setForm({ name: d.name, ip_address: d.ip_address, port: d.port.toString() }); setSheetOpen(true); };

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
    setSheetOpen(false); fetchDevices();
  };

  const deleteDevice = async (id: string) => {
    if (!confirm("Delete this device?")) return;
    const { error } = await supabase.from("hikvision_devices").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchDevices(); }
  };

  const fetchCloudDevices = async () => {
    setFetchingCloud(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "list-devices" } });
      if (error) throw error;
      if (data?.success && data.devices) {
        toast.success(`Found ${data.devices.length} devices on Hik-Partner Pro`);
        let imported = 0;
        for (const cd of data.devices) {
          const serial = cd.deviceSerial || cd.serial;
          if (!serial) continue;
          const exists = devices.find(d => d.ip_address === serial);
          if (!exists) {
            await supabase.from("hikvision_devices").insert({ name: cd.deviceName || cd.name || serial, ip_address: serial, port: 80 });
            imported++;
          }
        }
        if (imported > 0) { toast.success(`Imported ${imported} new devices`); fetchDevices(); }
      } else { toast.error("Failed: " + (data?.error || "Unknown error")); }
    } catch (e: any) { toast.error("Error: " + (e.message || "Unknown")); }
    setFetchingCloud(false);
  };

  const testConnection = async (d: HikDevice) => {
    setTestingId(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "test", device_id: d.id, device_serial: d.ip_address } });
      if (error) throw error;
      if (data?.success) toast.success("✅ Connected to " + d.name); else toast.error("❌ " + (data?.error || "Failed"));
    } catch (e: any) { toast.error(e.message || "Error"); }
    setTestingId(null);
  };

  const syncAttendance = async (d: HikDevice) => {
    setSyncingId(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "sync", device_id: d.id, device_serial: d.ip_address } });
      if (error) throw error;
      if (data?.success) toast.success(`Synced ${data.records_synced} attendance records`); else toast.error(data?.error || "Failed");
    } catch (e: any) { toast.error(e.message || "Error"); }
    setSyncingId(null); fetchDevices();
  };

  const fetchDeviceInfo = async (d: HikDevice) => {
    setFetchingInfoId(d.id);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "device-info", device_id: d.id, device_serial: d.ip_address } });
      if (error) throw error;
      if (data?.success) { toast.success(`Device info updated: ${data.device?.deviceModel || "OK"}`); fetchDevices(); }
      else toast.error(data?.error || "Failed");
    } catch (e: any) { toast.error(e.message || "Error"); }
    setFetchingInfoId(null);
  };

  const fullSync = async (d: HikDevice) => {
    setFullSyncingId(d.id);
    toast.info("Full sync started. This may take a minute...");
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "full-sync", device_id: d.id, device_serial: d.ip_address } });
      if (error) throw error;
      if (data?.success) toast.success("Full sync completed!"); else toast.error(data?.error || "Failed");
    } catch (e: any) { toast.error(e.message || "Error"); }
    setFullSyncingId(null); fetchDevices();
  };

  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-start gap-3">
          <Cloud className="h-5 w-5 text-primary mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-primary">Hik-Partner Pro Cloud Integration</p>
            <p className="text-muted-foreground mt-1">Devices are accessed via the Hik-Partner Pro Cloud API. Use Full Sync to sync device info, employees, photos, departments, and attendance in one go.</p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Registered Devices</h3>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchCloudDevices} disabled={fetchingCloud}>
            {fetchingCloud ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}Import from Cloud
          </Button>
          <Button onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Add Device</Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Status</TableHead><TableHead>Name</TableHead><TableHead>Serial</TableHead>
            <TableHead>Model</TableHead><TableHead>Firmware</TableHead><TableHead>Last Sync</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : devices.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No devices. Import from cloud or add manually.</TableCell></TableRow>
            ) : devices.map(d => (
              <TableRow key={d.id}>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-xs">
                    <span className={`h-2 w-2 rounded-full ${d.status === "active" ? "bg-green-500" : "bg-red-500"}`} />
                    {d.status === "active" ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="font-mono text-sm">{d.device_serial || d.ip_address}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.device_model || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{d.device_version || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {d.last_sync_at ? format(new Date(d.last_sync_at), "dd MMM hh:mm a") : "Never"}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex gap-1 justify-end flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => fetchDeviceInfo(d)} disabled={fetchingInfoId === d.id} title="Fetch Device Info">
                      {fetchingInfoId === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Info className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => testConnection(d)} disabled={testingId === d.id} title="Test Connection">
                      {testingId === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <TestTube className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => syncAttendance(d)} disabled={syncingId === d.id} title="Sync Attendance">
                      {syncingId === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" variant="default" onClick={() => fullSync(d)} disabled={fullSyncingId === d.id} title="Full Sync (All)">
                      {fullSyncingId === d.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
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
// TAB 3: Sync Logs (Enhanced with sync_type)
// ══════════════════════════════════════
function SyncLogsTab() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [devices, setDevices] = useState<HikDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");

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

  const deviceName = (id: string) => devices.find(d => d.id === id)?.name || id?.slice(0, 8) || "—";
  let filtered = deviceFilter === "all" ? logs : logs.filter(l => l.device_id === deviceFilter);
  if (typeFilter !== "all") filtered = filtered.filter(l => l.sync_type === typeFilter);

  const syncTypeColor: Record<string, string> = {
    attendance: "bg-primary/10 text-primary",
    employee: "bg-blue-500/10 text-blue-600",
    photo: "bg-purple-500/10 text-purple-600",
    department: "bg-orange-500/10 text-orange-600",
    device_info: "bg-green-500/10 text-green-600",
    full_sync: "bg-yellow-500/10 text-yellow-700",
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Sync Logs</h3>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All Types" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="attendance">Attendance</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="department">Department</SelectItem>
              <SelectItem value="device_info">Device Info</SelectItem>
              <SelectItem value="full_sync">Full Sync</SelectItem>
            </SelectContent>
          </Select>
          <Select value={deviceFilter} onValueChange={setDeviceFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Devices" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Time</TableHead><TableHead>Device</TableHead><TableHead>Type</TableHead>
            <TableHead>Action</TableHead><TableHead>Status</TableHead><TableHead>Records</TableHead><TableHead>Error</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No sync logs</TableCell></TableRow>
            ) : filtered.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-sm">{format(new Date(l.created_at), "dd MMM hh:mm a")}</TableCell>
                <TableCell className="text-sm">{deviceName(l.device_id)}</TableCell>
                <TableCell>
                  {l.sync_type ? (
                    <Badge className={syncTypeColor[l.sync_type] || "bg-muted text-muted-foreground"}>
                      {l.sync_type.replace(/_/g, " ")}
                    </Badge>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </TableCell>
                <TableCell><Badge variant="outline" className="capitalize">{l.action.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell><Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge></TableCell>
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
// TAB 4: Employee Mapping (Enhanced)
// ══════════════════════════════════════
function EmployeeMappingTab() {
  const [mappings, setMappings] = useState<HikMapping[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [devices, setDevices] = useState<HikDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingEmployees, setSyncingEmployees] = useState(false);
  const [syncingPhotos, setSyncingPhotos] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("all");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: mapData }, { data: empData }, { data: devData }] = await Promise.all([
      supabase.from("hikvision_employee_mapping").select("*").order("device_employee_code"),
      supabase.from("employees").select("id, name").eq("status", "active").order("name"),
      supabase.from("hikvision_devices").select("*"),
    ]);
    setMappings((mapData || []) as HikMapping[]);
    setEmployees((empData || []) as Employee[]);
    setDevices((devData || []) as HikDevice[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const updateMapping = async (id: string, erpEmployeeId: string) => {
    const value = erpEmployeeId === "none" ? null : erpEmployeeId;
    const { error } = await supabase.from("hikvision_employee_mapping").update({ erp_employee_id: value }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Mapping updated"); fetchData(); }
  };

  const autoMap = async () => {
    setAutoMapping(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "auto-map" } });
      if (error) throw error;
      toast.success(`Auto-mapped ${data?.mapped || 0} employees`);
      fetchData();
    } catch (e: any) { toast.error(e.message || "Error"); }
    setAutoMapping(false);
  };

  const syncEmployeesFromDevice = async (deviceId: string) => {
    setSyncingEmployees(true);
    const dev = devices.find(d => d.id === deviceId);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "sync-employees", device_id: deviceId, device_serial: dev?.ip_address },
      });
      if (error) throw error;
      if (data?.success) toast.success(`Synced ${data.records_synced} employees from device`);
      else toast.error(data?.error || "Failed");
      fetchData();
    } catch (e: any) { toast.error(e.message || "Error"); }
    setSyncingEmployees(false);
  };

  const syncPhotos = async (deviceId: string) => {
    setSyncingPhotos(true);
    const dev = devices.find(d => d.id === deviceId);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "sync-photos", device_id: deviceId, device_serial: dev?.ip_address },
      });
      if (error) throw error;
      if (data?.success) toast.success(`Synced ${data.records_synced} photos`);
      else toast.error(data?.error || "Failed");
      fetchData();
    } catch (e: any) { toast.error(e.message || "Error"); }
    setSyncingPhotos(false);
  };

  const filteredMappings = selectedDevice === "all" ? mappings : mappings.filter(m => m.device_id === selectedDevice);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Employee Mapping</h3>
        <div className="flex gap-2 flex-wrap">
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Devices" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedDevice !== "all" && (
            <>
              <Button variant="outline" onClick={() => syncEmployeesFromDevice(selectedDevice)} disabled={syncingEmployees}>
                {syncingEmployees ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Users className="h-4 w-4 mr-2" />}Sync Employees
              </Button>
              <Button variant="outline" onClick={() => syncPhotos(selectedDevice)} disabled={syncingPhotos}>
                {syncingPhotos ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}Sync Photos
              </Button>
            </>
          )}
          <Button variant="outline" onClick={autoMap} disabled={autoMapping}>
            {autoMapping ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Link className="h-4 w-4 mr-2" />}Auto Map
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Device Code</TableHead><TableHead>Device Name</TableHead>
            <TableHead>Card No</TableHead><TableHead>Department</TableHead>
            <TableHead>Avatar</TableHead><TableHead>ERP Employee</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filteredMappings.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No mappings. Select a device and sync employees first.</TableCell></TableRow>
            ) : filteredMappings.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-mono">{m.device_employee_code}</TableCell>
                <TableCell>{m.device_employee_name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.card_number || "—"}</TableCell>
                <TableCell className="text-sm">{m.department_name || "—"}</TableCell>
                <TableCell>
                  {m.avatar_synced ? <Badge className="bg-success/10 text-success">✓</Badge> : <Badge variant="outline">No</Badge>}
                </TableCell>
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
// TAB 5: Departments
// ══════════════════════════════════════
function DepartmentsTab() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [devices, setDevices] = useState<HikDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("all");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const [{ data: deptData }, { data: devData }] = await Promise.all([
        supabase.from("departments").select("*").order("name"),
        supabase.from("hikvision_devices").select("*"),
      ]);
      setDepartments((deptData || []) as Department[]);
      setDevices((devData || []) as HikDevice[]);
      setLoading(false);
    };
    fetch();
  }, []);

  const syncDepartments = async (deviceId: string) => {
    setSyncing(true);
    const dev = devices.find(d => d.id === deviceId);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "sync-departments", device_id: deviceId, device_serial: dev?.ip_address },
      });
      if (error) throw error;
      if (data?.success) toast.success(`Synced ${data.records_synced} departments`);
      else toast.error(data?.error || "Failed");
      // Refresh
      const { data: deptData } = await supabase.from("departments").select("*").order("name");
      setDepartments((deptData || []) as Department[]);
    } catch (e: any) { toast.error(e.message || "Error"); }
    setSyncing(false);
  };

  const filtered = selectedDevice === "all" ? departments : departments.filter(d => d.device_id === selectedDevice);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-semibold">Departments (from Device)</h3>
        <div className="flex gap-2">
          <Select value={selectedDevice} onValueChange={setSelectedDevice}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Devices" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Devices</SelectItem>
              {devices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {selectedDevice !== "all" && (
            <Button variant="outline" onClick={() => syncDepartments(selectedDevice)} disabled={syncing}>
              {syncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Building2 className="h-4 w-4 mr-2" />}Sync Departments
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Device Dept ID</TableHead><TableHead>Created</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No departments synced. Select a device and sync.</TableCell></TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.name}</TableCell>
                <TableCell className="font-mono text-sm">{d.device_department_id || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{format(new Date(d.created_at), "dd MMM yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════
// TAB 6: Device Logs (raw events)
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
      const { data } = await supabase.from("hikvision_attendance_logs").select("*")
        .gte("event_time", startOfDay).lte("event_time", endOfDay)
        .order("event_time", { ascending: false }).limit(500);
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
          <TableHeader><TableRow>
            <TableHead>Time</TableHead><TableHead>Employee Code</TableHead><TableHead>Employee Name</TableHead>
            <TableHead>Event Type</TableHead><TableHead>Device</TableHead>
          </TableRow></TableHeader>
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
