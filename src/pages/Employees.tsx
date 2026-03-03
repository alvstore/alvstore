import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, User, Pencil, Loader2, UserCog, ShieldCheck, AlertTriangle, Link2 } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "staff" | "technician" | "customer";

interface Employee {
  id: string;
  user_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  role: string;
  department: string | null;
  designation: string | null;
  salary: number;
  joining_date: string | null;
  status: string;
  created_at: string;
  avatar_url: string | null;
  device_employee_code: string | null;
}

const emptyForm = {
  name: "", email: "", phone: "", role: "staff", department: "", designation: "",
  salary: "0", joining_date: "", password: "", employee_type: "internal", createLogin: true,
};

const roleColors: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive",
  staff: "bg-primary/10 text-primary",
  technician: "bg-warning/10 text-warning",
};

export default function Employees() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkForm, setLinkForm] = useState({ email: "", password: "" });
  const [linkSheetOpen, setLinkSheetOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchEmployees = async () => {
    setLoading(true);
    let query = supabase.from("employees").select("*").order("created_at", { ascending: false });
    if (roleFilter !== "all") query = query.eq("role", roleFilter);
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setEmployees(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchEmployees(); }, [search, roleFilter]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (e: Employee) => {
    setEditId(e.id);
    setForm({
      name: e.name, email: e.email || "", phone: e.phone || "", role: e.role,
      department: e.department || "", designation: e.designation || "",
      salary: String(e.salary), joining_date: e.joining_date || "", password: "",
      employee_type: (e as any).employee_type || "internal",
      createLogin: false, // editing — no login toggle needed
    });
    setSheetOpen(true);
  };

  const openLinkAccount = (e: Employee) => {
    setLinkingId(e.id);
    setLinkForm({ email: e.email || "", password: "" });
    setLinkSheetOpen(true);
  };

  const handleLinkAccount = async () => {
    if (!linkingId) return;
    if (!linkForm.email || !linkForm.password) {
      toast.error("Email and password are required");
      return;
    }
    if (linkForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSaving(true);
    try {
      const emp = employees.find(e => e.id === linkingId);
      const { data, error } = await supabase.functions.invoke("manage-staff", {
        body: { action: "create", email: linkForm.email, password: linkForm.password, full_name: emp?.name || "", phone: emp?.phone || "", role: (emp?.role || "staff") as AppRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      const userId = data?.user_id;
      if (userId) {
        await supabase.from("employees").update({ user_id: userId, email: linkForm.email } as any).eq("id", linkingId);
      }
      toast.success("Login account linked successfully");
      setLinkSheetOpen(false);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.message || "Failed to link account");
    }
    setSaving(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    
    // Validate login fields when creating with login
    if (!editId && form.createLogin) {
      if (!form.email) { toast.error("Email is required for login account"); return; }
      if (!form.password || form.password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    }
    
    setSaving(true);
    try {
      if (editId) {
        const { error } = await supabase.from("employees").update({
          name: form.name, phone: form.phone || null, email: form.email || null,
          role: form.role, department: form.department || null,
          designation: form.designation || null,
          salary: parseFloat(form.salary) || 0,
          joining_date: form.joining_date || null,
          employee_type: form.employee_type,
        } as any).eq("id", editId);
        if (error) throw error;

        const emp = employees.find(e => e.id === editId);
        if (emp?.user_id && form.password) {
          await supabase.functions.invoke("manage-staff", {
            body: { action: "update", user_id: emp.user_id, full_name: form.name, phone: form.phone, role: form.role as AppRole, password: form.password },
          });
        } else if (emp?.user_id) {
          await supabase.functions.invoke("manage-staff", {
            body: { action: "update", user_id: emp.user_id, full_name: form.name, phone: form.phone, role: form.role as AppRole },
          });
        }
        toast.success("Employee updated");
      } else {
        let userId: string | null = null;
        if (form.createLogin && form.email && form.password) {
          const { data, error } = await supabase.functions.invoke("manage-staff", {
            body: { action: "create", email: form.email, password: form.password, full_name: form.name, phone: form.phone, role: form.role as AppRole },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          userId = data?.user_id || null;
        }
        const { error } = await supabase.from("employees").insert({
          user_id: userId, name: form.name, phone: form.phone || null, email: form.email || null,
          role: form.role, department: form.department || null, designation: form.designation || null,
          salary: parseFloat(form.salary) || 0, joining_date: form.joining_date || null,
          employee_type: form.employee_type,
        } as any);
        if (error) throw error;
        toast.success("Employee created");
      }
      setSheetOpen(false);
      fetchEmployees();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
    setSaving(false);
  };

  const kpiStats = {
    total: employees.length,
    active: employees.filter(e => e.status === "active").length,
    technicians: employees.filter(e => e.role === "technician").length,
    withLogin: employees.filter(e => e.user_id).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Employees</h1>
          <p className="text-muted-foreground">Manage your team members</p>
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Employee</Button>}
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><UserCog className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{kpiStats.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><User className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">{kpiStats.active}</p><p className="text-xs text-muted-foreground">Active</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><User className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{kpiStats.technicians}</p><p className="text-xs text-muted-foreground">Technicians</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><ShieldCheck className="h-5 w-5 text-info" /></div>
          <div><p className="text-2xl font-bold">{kpiStats.withLogin}</p><p className="text-xs text-muted-foreground">With Login</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by name..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="technician">Technician</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="hidden sm:table-cell">Contact</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Department</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Salary</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Status</TableHead>
                {isAdmin && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No employees found</TableCell></TableRow>
              ) : employees.map(e => (
                <TableRow key={e.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {e.avatar_url ? <AvatarImage src={e.avatar_url} alt={e.name} /> : null}
                        <AvatarFallback className="text-xs">{e.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{e.name}</span>
                        {e.device_employee_code && (
                          <span className="block text-xs text-muted-foreground font-mono">{e.device_employee_code}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{e.phone || e.email || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Badge className={roleColors[e.role] || "bg-muted text-muted-foreground"}>{e.role}</Badge>
                      {(e as any).employee_type === "external" && (
                        <Badge variant="outline" className="text-[10px] border-warning/40 text-warning">External</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm">{e.department || "—"}</TableCell>
                  <TableCell className="text-right hidden lg:table-cell">₹{e.salary.toLocaleString()}</TableCell>
                  <TableCell>
                    {e.user_id ? (
                      <div className="flex items-center gap-1 text-success">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">Linked</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-warning">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-medium">No Login</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={e.status === "active" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)} title="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!e.user_id && (
                          <Button variant="ghost" size="icon" onClick={() => openLinkAccount(e)} title="Link Login Account" className="text-warning hover:text-warning">
                            <Link2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Employee" : "Add Employee"}</SheetTitle>
            <SheetDescription>{editId ? "Update employee details" : "Create a new employee with optional login account"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email {form.createLogin && !editId ? "*" : ""}</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="technician">Technician</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={form.employee_type} onValueChange={v => setForm(p => ({ ...p, employee_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External / Outsourced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Department</Label><Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Joining Date</Label><Input type="date" value={form.joining_date} onChange={e => setForm(p => ({ ...p, joining_date: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Salary</Label><Input type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} /></div>
            </div>

            {/* Create with Login toggle - only for new employees */}
            {!editId && (
              <div className="rounded-xl border border-border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-semibold">Create with Login</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Required for Chat, Tasks & system access</p>
                  </div>
                  <Switch
                    checked={form.createLogin}
                    onCheckedChange={v => setForm(p => ({ ...p, createLogin: v }))}
                  />
                </div>
                {!form.createLogin && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <p className="text-xs text-warning">Employees without login credentials cannot access Chat, Tasks, or other system features.</p>
                  </div>
                )}
              </div>
            )}

            {/* Password field */}
            {(form.createLogin || editId) && (
              <div className="space-y-1.5">
                <Label>Password {!editId && form.createLogin ? "*" : "(optional)"}</Label>
                <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={editId ? "Leave blank to keep" : "Min 6 chars"} />
              </div>
            )}

            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editId ? "Update Employee" : "Create Employee"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Link Account Sheet */}
      <Sheet open={linkSheetOpen} onOpenChange={setLinkSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Link Login Account</SheetTitle>
            <SheetDescription>Create a login account for this employee so they can access Chat, Tasks, and other features.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={linkForm.email} onChange={e => setLinkForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Password *</Label>
              <Input type="password" value={linkForm.password} onChange={e => setLinkForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" />
            </div>
            <Button className="w-full" onClick={handleLinkAccount} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Link Account
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
