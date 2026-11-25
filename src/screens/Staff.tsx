"use client";

import { Box, Button, Card, CardContent, IconButton, MenuItem, TextField, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, SearchToolbar, SideDrawer, StatusChip, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { primaryUserRole, type AppRole } from "@/lib/sidebar-state";
import { Search, User, Plus, Pencil, Loader2 } from "lucide-react";
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
                role: primaryUserRole(roles.filter(r => r.user_id === p.user_id).map(r => r.role)),
            }));
            if (roleFilter !== "all")
                mapped = mapped.filter(m => m.role === roleFilter);
            if (search)
                mapped = mapped.filter(m => m.full_name?.toLowerCase().includes(search.toLowerCase()));
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
                if (error)
                    throw error;
                if (data?.error)
                    throw new Error(data.error);
                toast.success("Staff member updated");
            }
            else {
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
                if (error)
                    throw error;
                if (data?.error)
                    throw new Error(data.error);
                toast.success("Staff member created");
            }
            setSheetOpen(false);
            fetchStaff();
        }
        catch (err: any) {
            toast.error(err.message || "Operation failed");
        }
        setSaving(false);
    };
    const roleColors = {
        admin: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
        staff: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
        technician: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
        customer: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Staff Directory"} subtitle={"View and manage team members"} actions={<>{isAdmin && (<Button onClick={openNew} variant="contained">
            <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Add Staff
          </Button>)}</>}/>

      <Box sx={{ display: "flex", gap: "0.75rem" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search by name..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
        <TextField value={roleFilter} select size="small" fullWidth onChange={event => setRoleFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "150px" }}>
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="staff">Staff</MenuItem>
            <MenuItem value="technician">Technician</MenuItem>
            <MenuItem value="customer">Customer</MenuItem>
          </TextField>
      </Box>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
          {staff.map(s => (<Card key={s.user_id} data-ui-group sx={{}}>
              <CardContent sx={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <Box sx={{ padding: "0.75rem", borderRadius: "9999px", backgroundColor: "hsl(var(--muted))" }}><Box component={User} sx={{ height: "1.5rem", width: "1.5rem", color: "hsl(var(--muted-foreground))" }}/></Box>
                <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                  <Typography component="p" variant="body1" sx={{ fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.full_name || "Unnamed"}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{s.phone || "No phone"}</Typography>
                </Box>
                <StatusChip label={s.role} sx={roleColors[s.role]}/>
                {isAdmin && (<IconButton onClick={() => openEdit(s)} aria-label={"Pencil"} sx={{ opacity: "0", "[data-ui-group]:hover &": { opacity: "1" }, transitionProperty: "opacity", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                    <Box component={Pencil} sx={{ height: "1rem", width: "1rem" }}/>
                  </IconButton>)}
              </CardContent>
            </Card>))}
          {staff.length === 0 && <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", gridColumn: "1 / -1", textAlign: "center", paddingTop: "2rem", paddingBottom: "2rem" }}>No staff found</Typography>}
        </Box>)}

      {/* Add/Edit Staff Sheet */}
      <SideDrawer
        open={sheetOpen}
        busy={saving}
        onClose={() => setSheetOpen(false)}
        title={editUserId ? "Edit Staff Member" : "Add New Staff Member"}
        description={editUserId ? "Update staff details and role" : "Create a new user account with role assignment"}
        width={480}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>
              {saving && <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/>}
              {editUserId ? "Update Staff" : "Create Staff"}
            </Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="John Doe" label={"Full Name *"} size="small" fullWidth/>
            </Box>
            {!editUserId && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder="john@example.com" label={"Email *"} size="small" fullWidth/>
              </Box>)}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+91 9876543210" label={"Phone"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.role} label={"Role *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, role: v as AppRole })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="staff">Staff</MenuItem>
                  <MenuItem value="technician">Technician</MenuItem>
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={editUserId ? "Leave blank to keep current" : "Min 6 characters"} label={editUserId ? "New Password (leave blank to keep current)" : "Password *"} size="small" fullWidth/>
            </Box>
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
