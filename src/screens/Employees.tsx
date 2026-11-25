"use client";

import { Avatar, Box, Button, FormLabel, IconButton, MenuItem, Switch, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, User, Pencil, Loader2, UserCog, ShieldCheck, AlertTriangle, Link2 } from "lucide-react";
import { AvatarUpload } from "@/components/AvatarUpload";
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
const roleColors = {
    admin: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
    staff: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    technician: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
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
        let query = supabase.from("employees").select("*").neq("role", "technician").order("created_at", { ascending: false });
        if (roleFilter !== "all")
            query = query.eq("role", roleFilter);
        if (search)
            query = query.ilike("name", `%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setEmployees(data || []);
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
        if (!linkingId)
            return;
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
            if (error)
                throw error;
            if (data?.error)
                throw new Error(data.error);
            const userId = data?.user_id;
            if (userId) {
                await supabase.from("employees").update({ user_id: userId, email: linkForm.email } as any).eq("id", linkingId);
            }
            toast.success("Login account linked successfully");
            setLinkSheetOpen(false);
            fetchEmployees();
        }
        catch (err: any) {
            toast.error(err.message || "Failed to link account");
        }
        setSaving(false);
    };
    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error("Name is required");
            return;
        }
        // Validate login fields when creating with login
        if (!editId && form.createLogin) {
            if (!form.email) {
                toast.error("Email is required for login account");
                return;
            }
            if (!form.password || form.password.length < 6) {
                toast.error("Password must be at least 6 characters");
                return;
            }
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
                if (error)
                    throw error;
                const emp = employees.find(e => e.id === editId);
                if (emp?.user_id && form.password) {
                    await supabase.functions.invoke("manage-staff", {
                        body: { action: "update", user_id: emp.user_id, full_name: form.name, phone: form.phone, role: form.role as AppRole, password: form.password },
                    });
                }
                else if (emp?.user_id) {
                    await supabase.functions.invoke("manage-staff", {
                        body: { action: "update", user_id: emp.user_id, full_name: form.name, phone: form.phone, role: form.role as AppRole },
                    });
                }
                toast.success("Employee updated");
            }
            else {
                let userId: string | null = null;
                if (form.createLogin && form.email && form.password) {
                    const { data, error } = await supabase.functions.invoke("manage-staff", {
                        body: { action: "create", email: form.email, password: form.password, full_name: form.name, phone: form.phone, role: form.role as AppRole },
                    });
                    if (error)
                        throw error;
                    if (data?.error)
                        throw new Error(data.error);
                    userId = data?.user_id || null;
                }
                const { error } = await supabase.from("employees").insert({
                    user_id: userId, name: form.name, phone: form.phone || null, email: form.email || null,
                    role: form.role, department: form.department || null, designation: form.designation || null,
                    salary: parseFloat(form.salary) || 0, joining_date: form.joining_date || null,
                    employee_type: form.employee_type,
                } as any);
                if (error)
                    throw error;
                toast.success("Employee created");
            }
            setSheetOpen(false);
            fetchEmployees();
        }
        catch (err: any) {
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
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Employees"} subtitle={"Manage your team members"} actions={<>{isAdmin && <Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Add Employee</Button>}</>}/>

      {/* KPI */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total"} value={kpiStats.total} icon={<Box component={UserCog} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Active"} value={kpiStats.active} icon={<Box component={User} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={"Technicians"} value={kpiStats.technicians} icon={<Box component={User} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"With Login"} value={kpiStats.withLogin} icon={<Box component={ShieldCheck} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", gap: "0.75rem" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search by name..." sx={{ flex: "1 1 0%", maxWidth: "24rem" }}/>
        <TextField value={roleFilter} select size="small" fullWidth onChange={event => setRoleFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "150px" }}>
            <MenuItem value="all">All Roles</MenuItem>
            <MenuItem value="admin">Admin</MenuItem>
            <MenuItem value="staff">Staff</MenuItem>
            <MenuItem value="technician">Technician</MenuItem>
          </TextField>
      </Box>

      {/* Table */}
      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
          <DataTable columnsCount={8} empty={employees.length === 0} emptyMessage={"No employees found"}>
            <TableHead>
              <TableRow>
                <TableCell>Employee</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Contact</TableCell>
                <TableCell>Role</TableCell>
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Department</TableCell>
                <TableCell sx={{ textAlign: "right", display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>Salary</TableCell>
                <TableCell>Login</TableCell>
                <TableCell>Status</TableCell>
                {isAdmin && <TableCell sx={{ width: "6rem" }}>Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>{employees.map(e => (<TableRow key={e.id}>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <Avatar src={e.avatar_url ?? undefined} alt={e.name} sx={mergeSx({ height: "2rem", width: "2rem" }, { fontSize: "0.75rem", lineHeight: "1rem" })}>{e.name.slice(0, 2).toUpperCase()}</Avatar>
                      <Box>
                        <Box component="span" sx={{ fontWeight: "500" }}>{e.name}</Box>
                        {e.device_employee_code && (<Box component="span" sx={{ display: "block", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono, monospace" }}>{e.device_employee_code}</Box>)}
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{e.phone || e.email || "—"}</TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <StatusChip label={e.role} sx={roleColors[e.role] || { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/>
                      {(e as any).employee_type === "external" && (<StatusChip label={"External"} variant="outlined" sx={{ fontSize: "10px", borderColor: "color-mix(in srgb, hsl(var(--warning)) 40%, transparent)", color: "hsl(var(--warning))" }}/>)}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>{e.department || "—"}</TableCell>
                  <TableCell sx={{ textAlign: "right", display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>₹{e.salary.toLocaleString()}</TableCell>
                  <TableCell>
                    {e.user_id ? (<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "hsl(var(--success))" }}>
                        <Box component={ShieldCheck} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                        <Box component="span" sx={{ fontSize: "11px", fontWeight: "500" }}>Linked</Box>
                      </Box>) : (<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", color: "hsl(var(--warning))" }}>
                        <Box component={AlertTriangle} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                        <Box component="span" sx={{ fontSize: "11px", fontWeight: "500" }}>No Login</Box>
                      </Box>)}
                  </TableCell>
                  <TableCell><StatusChip label={e.status}/></TableCell>
                  {isAdmin && (<TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                        <IconButton onClick={() => openEdit(e)} title="Edit" aria-label={"Edit"}>
                          <Box component={Pencil} sx={{ height: "1rem", width: "1rem" }}/>
                        </IconButton>
                        {!e.user_id && (<IconButton onClick={() => openLinkAccount(e)} title="Link Login Account" aria-label={"Link Login Account"} sx={{ color: "hsl(var(--warning))", "&:hover": { color: "hsl(var(--warning))" } }}>
                            <Box component={Link2} sx={{ height: "1rem", width: "1rem" }}/>
                          </IconButton>)}
                      </Box>
                    </TableCell>)}
                </TableRow>))}</TableBody>
          </DataTable>
        </Box>)}

      {/* Add/Edit Sheet */}
      <SideDrawer
        open={sheetOpen}
        busy={saving}
        onClose={() => setSheetOpen(false)}
        title={editId ? "Edit Employee" : "Add Employee"}
        description={editId ? "Update employee details" : "Create a new employee with optional login account"}
        width={520}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>
              {saving && <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/>}
              {editId ? "Update Employee" : "Create Employee"}
            </Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <AvatarUpload currentUrl={editId ? employees.find(e => e.id === editId)?.avatar_url : undefined} name={form.name} folder="employees" entityId={editId || undefined} onUploaded={async (url) => {
        if (editId) {
            await supabase.from("employees").update({ avatar_url: url } as any).eq("id", editId);
            fetchEmployees();
        }
    }}/>
              <Box sx={{ flex: "1 1 0%", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Full Name *"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} label={<>Email {form.createLogin && !editId ? "*" : ""}</>} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} label={"Phone"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.role} label={"Role *"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, role: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                    <MenuItem value="admin">Admin</MenuItem>
                    <MenuItem value="staff">Staff</MenuItem>
                    <MenuItem value="technician">Technician</MenuItem>
                  </TextField>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.employee_type} label={"Type"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, employee_type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                    <MenuItem value="internal">Internal</MenuItem>
                    <MenuItem value="external">External / Outsourced</MenuItem>
                  </TextField>
              </Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.department} onChange={e => setForm(p => ({ ...p, department: e.target.value }))} label={"Department"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} label={"Designation"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="date" value={form.joining_date} onChange={e => setForm(p => ({ ...p, joining_date: e.target.value }))} label={"Joining Date"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.salary} onChange={e => setForm(p => ({ ...p, salary: e.target.value }))} label={"Salary"} size="small" fullWidth/></Box>
            </Box>

            {/* Create with Login toggle - only for new employees */}
            {!editId && (<Box sx={{ borderRadius: "0.75rem", borderWidth: "1px", borderColor: "hsl(var(--border))", padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Box>
                    <FormLabel sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>Create with Login</FormLabel>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>Required for Chat, Tasks & system access</Typography>
                  </Box>
                  <Switch checked={form.createLogin} onChange={(event, checked) => (v => setForm(p => ({ ...p, createLogin: v })))(checked)}/>
                </Box>
                {!form.createLogin && (<Box sx={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.625rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--warning)) 20%, transparent)" }}>
                    <Box component={AlertTriangle} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--warning))", flexShrink: "0", marginTop: "0.125rem" }}/>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--warning))" }}>Employees without login credentials cannot access Chat, Tasks, or other system features.</Typography>
                  </Box>)}
              </Box>)}

            {/* Password field */}
            {(form.createLogin || editId) && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} placeholder={editId ? "Leave blank to keep" : "Min 6 chars"} label={<>Password {!editId && form.createLogin ? "*" : "(optional)"}</>} size="small" fullWidth/>
              </Box>)}
          </Box>
        </SideDrawer>

      {/* Link Account Sheet */}
      <SideDrawer
        open={linkSheetOpen}
        busy={saving}
        onClose={() => setLinkSheetOpen(false)}
        title={"Link Login Account"}
        description={"Create a login account for this employee so they can access Chat, Tasks, and other features."}
        width={440}
        footer={
          <>
            <Button variant="outlined" onClick={() => setLinkSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleLinkAccount} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>
              {saving && <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/>}
              Link Account
            </Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="email" value={linkForm.email} onChange={e => setLinkForm(p => ({ ...p, email: e.target.value }))} label={"Email *"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="password" value={linkForm.password} onChange={e => setLinkForm(p => ({ ...p, password: e.target.value }))} placeholder="Min 6 characters" label={"Password *"} size="small" fullWidth/>
            </Box>
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
