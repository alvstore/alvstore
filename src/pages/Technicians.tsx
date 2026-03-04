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
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, Wrench, Pencil, ShieldCheck, AlertTriangle, Link2, Users, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

interface Technician {
  id: string; user_id: string | null; name: string; phone: string | null;
  email: string | null; department: string | null; designation: string | null;
  salary: number; status: string; created_at: string; avatar_url: string | null;
  device_employee_code: string | null;
}

const emptyForm = {
  name: "", email: "", phone: "", department: "", designation: "",
  salary: "0", joining_date: "", password: "", createLogin: true,
};

export default function Technicians() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeJobs, setActiveJobs] = useState<Record<string, number>>({});

  const fetchTechnicians = async () => {
    setLoading(true);
    let query = supabase.from("employees").select("*").eq("role", "technician").order("created_at", { ascending: false });
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setTechnicians((data || []) as Technician[]);

    // Fetch active job counts per technician
    const { data: jobs } = await supabase.from("job_sheets").select("assigned_technician_id")
      .not("status", "in", '("delivered","invoice_generated")');
    const counts: Record<string, number> = {};
    jobs?.forEach((j: any) => { if (j.assigned_technician_id) counts[j.assigned_technician_id] = (counts[j.assigned_technician_id] || 0) + 1; });
    setActiveJobs(counts);
    setLoading(false);
  };

  useEffect(() => { fetchTechnicians(); }, [search]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (t: Technician) => {
    setEditId(t.id);
    setForm({ name: t.name, email: t.email || "", phone: t.phone || "", department: t.department || "", designation: t.designation || "", salary: String(t.salary), joining_date: "", password: "", createLogin: false });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    if (!editId && form.createLogin && (!form.email || !form.password || form.password.length < 6)) {
      toast.error("Email and password (6+ chars) required for login"); return;
    }
    setSaving(true);
    try {
      if (editId) {
        await supabase.from("employees").update({
          name: form.name, phone: form.phone || null, email: form.email || null,
          department: form.department || null, designation: form.designation || null,
          salary: parseFloat(form.salary) || 0,
        } as any).eq("id", editId);
        toast.success("Technician updated");
      } else {
        let userId: string | null = null;
        if (form.createLogin && form.email && form.password) {
          const { data, error } = await supabase.functions.invoke("manage-staff", {
            body: { action: "create", email: form.email, password: form.password, full_name: form.name, phone: form.phone, role: "technician" },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          userId = data?.user_id || null;
        }
        await supabase.from("employees").insert({
          user_id: userId, name: form.name, phone: form.phone || null, email: form.email || null,
          role: "technician", department: form.department || null, designation: form.designation || null,
          salary: parseFloat(form.salary) || 0, employee_type: "internal",
        } as any);
        toast.success("Technician created");
      }
      setSheetOpen(false);
      fetchTechnicians();
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const stats = {
    total: technicians.length,
    active: technicians.filter(t => t.status === "active").length,
    withLogin: technicians.filter(t => t.user_id).length,
    totalActiveJobs: Object.values(activeJobs).reduce((s, v) => s + v, 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Technicians</h1>
          <p className="text-muted-foreground">Manage repair technicians</p>
        </div>
        {isAdmin && <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Technician</Button>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">{stats.active}</p><p className="text-xs text-muted-foreground">Active</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><Wrench className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{stats.totalActiveJobs}</p><p className="text-xs text-muted-foreground">Active Jobs</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><ShieldCheck className="h-5 w-5 text-info" /></div>
          <div><p className="text-2xl font-bold">{stats.withLogin}</p><p className="text-xs text-muted-foreground">With Login</p></div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search technicians..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Technician</TableHead>
              <TableHead className="hidden sm:table-cell">Contact</TableHead>
              <TableHead>Active Jobs</TableHead>
              <TableHead>Login</TableHead>
              <TableHead>Status</TableHead>
              {isAdmin && <TableHead className="w-20">Actions</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {technicians.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No technicians found</TableCell></TableRow>
              ) : technicians.map(t => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        {t.avatar_url ? <AvatarImage src={t.avatar_url} /> : null}
                        <AvatarFallback className="text-xs">{t.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium">{t.name}</span>
                        {t.designation && <span className="block text-xs text-muted-foreground">{t.designation}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{t.phone || t.email || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{activeJobs[t.user_id || ""] || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    {t.user_id ? (
                      <div className="flex items-center gap-1 text-success"><ShieldCheck className="h-3.5 w-3.5" /><span className="text-[11px]">Linked</span></div>
                    ) : (
                      <div className="flex items-center gap-1 text-warning"><AlertTriangle className="h-3.5 w-3.5" /><span className="text-[11px]">No Login</span></div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={t.status === "active" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                  {isAdmin && (
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Technician" : "Add Technician"}</SheetTitle>
            <SheetDescription>Manage technician details and login</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Department</Label><Input value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Designation</Label><Input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Salary</Label><Input type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} /></div>
            {!editId && (
              <>
                <div className="p-3 rounded-lg border border-warning/30 bg-warning/5">
                  <p className="text-xs text-warning font-medium">⚠ Technicians without login cannot access the app or receive job assignments</p>
                </div>
                <div className="space-y-1.5"><Label>Password *</Label><Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" /></div>
              </>
            )}
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editId ? "Update" : "Create Technician"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
