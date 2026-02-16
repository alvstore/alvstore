import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Search, User } from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "staff" | "technician" | "customer";

interface StaffMember {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: AppRole;
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  useEffect(() => {
    const fetch = async () => {
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
    fetch();
  }, [search, roleFilter]);

  const roleColors: Record<AppRole, string> = {
    admin: "bg-destructive/10 text-destructive",
    staff: "bg-primary/10 text-primary",
    technician: "bg-warning/10 text-warning",
    customer: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Staff Directory</h1>
        <p className="text-muted-foreground">View all team members</p>
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
            <Card key={s.user_id}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-full bg-muted"><User className="h-6 w-6 text-muted-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{s.full_name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{s.phone || "No phone"}</p>
                </div>
                <Badge className={roleColors[s.role]}>{s.role}</Badge>
              </CardContent>
            </Card>
          ))}
          {staff.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No staff found</p>}
        </div>
      )}
    </div>
  );
}
