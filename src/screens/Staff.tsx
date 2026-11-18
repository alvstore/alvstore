import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Search, User, Plus, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "staff" | "technician" | "customer";

interface StaffMember {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
}

export default function Staff() {
  const { hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", role: "staff" as AppRole, password: "",
  });

  const fetchStaff = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    if (profiles && roles) {
      let mapped = profiles.map(p => ({
        user_id: p.user_id,
        full_name: p.full_name,
        phone: p.phone,
        role: (roles.find(r => r.user_id === p.user_id)?.role || "staff") as AppRole,
      }));
      if (roleFilter !== "all") mapped = mapped.filter(m => m.role === roleFilter);
      if (search) mapped = mapped.filter(m => m.full_name?.toLowerCase().includes(search.toLowerCase()));
      setStaff(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchStaff(); }, [search, roleFilter]);

  const openNew = () => {
    setEditUserId(null);
    setForm({ full_name: "", email: "", phone: "", role: "staff", password: "" });
    setSheetOpen(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditUserId(s.user_id);
    setForm({ full_name: s.full_name || "", email: "", phone: s.phone || "", role: s.role, password: "" });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editUserId) {
        // Update existing staff
        const { data, error } = await supabase.functions.invoke("manage-staff", {
          body: {
            action: "update",
            user_id: editUserId,
            full_name: form.full_name,
            phone: form.phone,
            role: form.role,
            ...(form.password ? { password: form.password } : {}),
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Staff member updated");
      } else {
        // Create new staff
        if (!form.email || !form.password || !form.full_name) {
          toast.error("Name, email, and password are required");
          setSaving(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("manage-staff", {
          body: {
            action: "create",
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            phone: form.phone,
            role: form.role,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast.success("Staff member created");
      }
      setSheetOpen(false);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
    setSaving(false);
  };

  const roleColors: Record<AppRole, string> = {
    admin: "bg-destructive/10 text-destructive",
    staff: "bg-primary/10 text-primary",
    technician: "bg-warning/10 text-warning",
    customer: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Staff Directory</h1>
          <p className="text-muted-foreground">View and manage team members</p>
        </div>
        {isAdmin && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />Add Staff
          </Button>
        )}
      </div>

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
            <SelectItem value="customer">Customer</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staff.map(s => (
            <Card key={s.user_id} className="group">
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-full bg-muted"><User className="h-6 w-6 text-muted-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.full_name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{s.phone || "No phone"}</p>
                </div>
                <Badge className={roleColors[s.role]}>{s.role}</Badge>
                {isAdmin && (
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
          {staff.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No staff found</p>}
        </div>
      )}

      {/* Add/Edit Staff Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editUserId ? "Edit Staff Member" : "Add New Staff Member"}</SheetTitle>
            <SheetDescription>{editUserId ? "Update staff details and role" : "Create a new user account with role assignment"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="John Doe" />
            </div>
            {!editUserId && (
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9876543210" />
            </div>
            <div className="space-y-1.5">
              <Label>Role *</Label>
              <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v as AppRole }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="technician">Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{editUserId ? "New Password (leave blank to keep current)" : "Password *"}</Label>
              <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={editUserId ? "Leave blank to keep current" : "Min 6 characters"} />
            </div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editUserId ? "Update Staff" : "Create Staff"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
