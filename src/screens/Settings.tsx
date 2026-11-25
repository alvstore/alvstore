"use client";

import { Box, Button, ButtonBase, Card, CardContent, Checkbox, Divider, FormLabel, IconButton, InputAdornment, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, FormDialog, PageHeader, StatusChip, TabBar, TabView, confirmAction, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { primaryUserRole, type AppRole } from "@/lib/sidebar-state";
import { User, Shield, Building2, Receipt, Mail, MessageSquare, Phone, Camera, FileText, Save, Loader2, Plus, Pencil, Trash2, File, Clock, Cloud, TestTube, RefreshCw, CreditCard, Globe, Copy, CheckCircle2, Wrench, Code, Eye, EyeOff } from "lucide-react";
interface Profile {
    id: string;
    user_id: string;
    full_name: string | null;
    phone: string | null;
    avatar_url: string | null;
}
interface UserWithRole {
    profile: Profile;
    role: AppRole;
}
const SETTINGS_SECTIONS = [
    { id: "profile", label: "Profile", icon: User, group: "Account" },
    { id: "users", label: "User Management", icon: Shield, group: "Account", adminOnly: true },
    { id: "business", label: "Business Info", icon: Building2, group: "Organization", adminOnly: true },
    { id: "gst", label: "GST Settings", icon: Receipt, group: "Organization", adminOnly: true },
    { id: "documents", label: "Document Settings", icon: FileText, group: "Organization", adminOnly: true },
    { id: "email", label: "Email / SMTP", icon: Mail, group: "Integrations", adminOnly: true },
    { id: "sms", label: "SMS Gateway", icon: MessageSquare, group: "Integrations", adminOnly: true },
    { id: "whatsapp", label: "WhatsApp", icon: Phone, group: "Integrations", adminOnly: true },
    { id: "razorpay", label: "Razorpay", icon: CreditCard, group: "Integrations", adminOnly: true },
    { id: "hikvision", label: "Hikvision", icon: Camera, group: "Integrations", adminOnly: true },
    { id: "templates", label: "Templates", icon: FileText, group: "System", adminOnly: true },
    { id: "service-categories", label: "Service Categories", icon: Wrench, group: "System", adminOnly: true },
];
export default function Settings() {
    const { hasRole } = useAuth();
    const isAdmin = hasRole("admin");
    const [activeSection, setActiveSection] = useState("profile");
    const visibleSections = SETTINGS_SECTIONS.filter(s => !s.adminOnly || isAdmin);
    const groups = [...new Set(visibleSections.map(s => s.group))];
    const renderContent = () => {
        switch (activeSection) {
            case "profile": return <ProfileTab />;
            case "users": return isAdmin ? <UsersTab /> : null;
            case "business": return isAdmin ? <BusinessTab /> : null;
            case "gst": return isAdmin ? <GSTTab /> : null;
            case "documents": return isAdmin ? <DocumentSettingsTab /> : null;
            case "email": return isAdmin ? <EmailTab /> : null;
            case "sms": return isAdmin ? <SMSTab /> : null;
            case "whatsapp": return isAdmin ? <WhatsAppTab /> : null;
            case "razorpay": return isAdmin ? <RazorpayTab /> : null;
            case "hikvision": return isAdmin ? <HikvisionTab /> : null;
            case "templates": return isAdmin ? <TemplatesTab /> : null;
            case "service-categories": return isAdmin ? <ServiceCategoriesTab /> : null;
            default: return <ProfileTab />;
        }
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Settings"} subtitle={"Manage your account, organization, and integrations"}/>

      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 1024px)": { flexDirection: "row" }, gap: "1.5rem" }}>
        {/* Vertical Sidebar Navigation */}
        <Box sx={{ "@media (min-width: 1024px)": { width: "16rem" }, flexShrink: "0" }}>
          <Card sx={{ position: "sticky", top: "1rem" }}>
            <CardContent sx={{ padding: "0.5rem" }}>
              {groups.map(group => (<Box key={group} sx={{ marginBottom: "0.5rem" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>{group}</Typography>
                  {visibleSections.filter(s => s.group === group).map(section => {
                const Icon = section.icon;
                return (<ButtonBase key={section.id} onClick={() => setActiveSection(section.id)} type="button" sx={mergeSx({ width: "100%", display: "flex", alignItems: "center", gap: "0.625rem", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", borderRadius: "calc(var(--radius) - 2px)", fontSize: "0.875rem", lineHeight: "1.25rem", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", textAlign: "left" }, activeSection === section.id
                    ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))", fontWeight: "500" } : { color: "hsl(var(--muted-foreground))", "&:hover": { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--foreground))" } })}>
                        <Box component={Icon} sx={{ height: "1rem", width: "1rem", flexShrink: "0" }}/>
                        {section.label}
                      </ButtonBase>);
            })}
                </Box>))}
            </CardContent>
          </Card>
        </Box>

        {/* Main Content */}
        <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
          {renderContent()}
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
// ─── Profile Tab ────────────────────────────────────────────────
function ProfileTab() {
    const { user } = useAuth();
    const [fullName, setFullName] = useState("");
    const [phone, setPhone] = useState("");
    const [saving, setSaving] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    useEffect(() => {
        if (!user)
            return;
        supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
            if (data) {
                setFullName(data.full_name || "");
                setPhone(data.phone || "");
            }
        });
    }, [user]);
    const saveProfile = async () => {
        if (!user)
            return;
        setSaving(true);
        const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("user_id", user.id);
        if (error)
            toast.error(error.message);
        else
            toast.success("Profile updated");
        setSaving(false);
    };
    const changePassword = async () => {
        if (password.length < 6) {
            toast.error("Password must be at least 6 characters");
            return;
        }
        if (password !== confirmPassword) {
            toast.error("Passwords don't match");
            return;
        }
        setSaving(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error)
            toast.error(error.message);
        else {
            toast.success("Password updated");
            setPassword("");
            setConfirmPassword("");
        }
        setSaving(false);
    };
    return (<Box sx={{ display: "grid", gap: "1.5rem", maxWidth: "42rem" }}>
      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Profile Information</Typography><Typography variant="body2" color="text.secondary">Update your personal details</Typography></Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={user?.email || ""} disabled label={"Email"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={fullName} onChange={e => setFullName(e.target.value)} label={"Full Name"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={phone} onChange={e => setPhone(e.target.value)} label={"Phone"} size="small" fullWidth/></Box>
          <Button onClick={saveProfile} disabled={saving} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save</Button>
        </CardContent>
      </Card>
      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Change Password</Typography><Typography variant="body2" color="text.secondary">Update your account password</Typography></Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="password" value={password} onChange={e => setPassword(e.target.value)} label={"New Password"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} label={"Confirm Password"} size="small" fullWidth/></Box>
          <Button onClick={changePassword} disabled={saving} variant="contained">Update Password</Button>
        </CardContent>
      </Card>
    </Box>);
}
// ─── Users Tab ──────────────────────────────────────────────────
interface EmployeeLink {
    id: string;
    name: string;
    designation: string | null;
    role: string | null;
}
function UsersTab() {
    const [users, setUsers] = useState<(UserWithRole & {
        employee?: EmployeeLink | null;
    })[]>([]);
    const [loading, setLoading] = useState(true);
    const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
    const fetchUsers = async () => {
        setLoading(true);
        const [profilesRes, rolesRes, employeesRes] = await Promise.all([
            supabase.from("profiles").select("*"),
            supabase.from("user_roles").select("*"),
            supabase.from("employees").select("id, name, designation, role, user_id"),
        ]);
        const profiles = profilesRes.data || [];
        const roles = rolesRes.data || [];
        const employees = employeesRes.data || [];
        setUsers(profiles.map(p => {
            const emp = employees.find(e => e.user_id === p.user_id);
            const userRoles = roles.filter(r => r.user_id === p.user_id).map(r => r.role);
            return {
                profile: p,
                role: primaryUserRole(userRoles),
                employee: emp ? { id: emp.id, name: emp.name, designation: emp.designation, role: emp.role } : null,
            };
        }));
        setLoading(false);
    };
    useEffect(() => { fetchUsers(); }, []);
    const updateRole = async (userId: string, newRole: AppRole) => {
        setUpdatingUserId(userId);
        try {
            const { data, error } = await supabase.functions.invoke("manage-staff", {
                body: { action: "update", user_id: userId, role: newRole },
            });
            if (error)
                throw error;
            if (data?.error)
                throw new Error(data.error);
            toast.success("Role updated");
            await fetchUsers();
        }
        catch (err: any) {
            toast.error(err?.message || "Failed to update role");
        }
        finally {
            setUpdatingUserId(null);
        }
    };
    const roleColors = {
        admin: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
        staff: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
        technician: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
        customer: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
    };
    return (<Card>
      <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>User Management</Typography><Typography variant="body2" color="text.secondary">Manage user accounts and roles. Auth role determines access level. Employee link shows HR record.</Typography></Box>
      <CardContent>
        {loading ? <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", paddingTop: "1.5rem", paddingBottom: "1.5rem", textAlign: "center" }}>Loading...</Typography> : (<DataTable columnsCount={5}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell><TableCell>Phone</TableCell><TableCell>Auth Role</TableCell><TableCell>Employee Link</TableCell><TableCell>Change Role</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map(u => (<TableRow key={u.profile.user_id}>
                  <TableCell sx={{ fontWeight: "500" }}>{u.profile.full_name || "—"}</TableCell>
                  <TableCell>{u.profile.phone || "—"}</TableCell>
                  <TableCell><StatusChip label={u.role} sx={roleColors[u.role]}/></TableCell>
                  <TableCell>
                    {u.employee ? (<Box sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>
                        <Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{u.employee.designation || u.employee.role || "Employee"}</Box>
                        <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", marginLeft: "0.25rem" }}>({u.employee.name})</Box>
                      </Box>) : (<Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>Not linked</Box>)}
                  </TableCell>
                  <TableCell>
                    <TextField value={u.role} disabled={updatingUserId === u.profile.user_id} select size="small" fullWidth onChange={event => ((v) => updateRole(u.profile.user_id, v as AppRole))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "140px" }}>
                        <MenuItem value="admin">Admin</MenuItem>
                        <MenuItem value="staff">Staff</MenuItem>
                        <MenuItem value="technician">Technician</MenuItem>
                        <MenuItem value="customer">Customer</MenuItem>
                      </TextField>
                  </TableCell>
                </TableRow>))}
            </TableBody>
          </DataTable>)}
      </CardContent>
    </Card>);
}
// ─── Business Tab ───────────────────────────────────────────────
function BusinessTab() {
    const [form, setForm] = useState({
        company_name: "", company_address: "", company_phone: "",
        company_email: "", logo_url: "", invoice_prefix: "INV-", quotation_prefix: "QT-",
        timezone: "Asia/Kolkata",
        bank_name: "", bank_account_number: "", bank_ifsc: "", bank_branch: "", bank_upi_id: "",
    });
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    useEffect(() => {
        supabase.from("business_settings").select("*").limit(1).single().then(({ data }) => {
            if (data) {
                setSettingsId(data.id);
                const d = data as any;
                setForm({
                    company_name: data.company_name || "",
                    company_address: data.company_address || "",
                    company_phone: data.company_phone || "",
                    company_email: data.company_email || "",
                    logo_url: data.logo_url || "",
                    invoice_prefix: data.invoice_prefix || "INV-",
                    quotation_prefix: data.quotation_prefix || "QT-",
                    timezone: d.timezone || "Asia/Kolkata",
                    bank_name: d.bank_name || "",
                    bank_account_number: d.bank_account_number || "",
                    bank_ifsc: d.bank_ifsc || "",
                    bank_branch: d.bank_branch || "",
                    bank_upi_id: d.bank_upi_id || "",
                });
            }
        });
    }, []);
    const save = async () => {
        setSaving(true);
        if (settingsId) {
            const { error } = await supabase.from("business_settings").update(form as any).eq("id", settingsId);
            if (error)
                toast.error(error.message);
            else
                toast.success("Settings saved");
        }
        else {
            const { data, error } = await supabase.from("business_settings").insert(form as any).select().single();
            if (error)
                toast.error(error.message);
            else {
                toast.success("Settings saved");
                setSettingsId(data.id);
            }
        }
        setSaving(false);
    };
    const timezones = ["Asia/Kolkata", "Asia/Dubai", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
    return (<Card>
      <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Business Settings</Typography><Typography variant="body2" color="text.secondary">Company information, logo, address, and timezone</Typography></Box>
      <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, maxWidth: "42rem" }}>
        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} label={"Company Name"} size="small" fullWidth/></Box>
        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.company_address} onChange={e => setForm(p => ({ ...p, company_address: e.target.value }))} rows={3} label={"Address"} size="small" fullWidth multiline/></Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.company_phone} onChange={e => setForm(p => ({ ...p, company_phone: e.target.value }))} label={"Phone"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.company_email} onChange={e => setForm(p => ({ ...p, company_email: e.target.value }))} label={"Email"} size="small" fullWidth/></Box>
        </Box>
        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://example.com/logo.png" label={"Logo URL"} size="small" fullWidth/></Box>
        {form.logo_url && <Box src={form.logo_url} alt="Logo preview" component="img" sx={{ height: "4rem", width: "auto", borderRadius: "0.25rem", borderWidth: "1px", borderColor: "hsl(var(--border))" }}/>}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.invoice_prefix} onChange={e => setForm(p => ({ ...p, invoice_prefix: e.target.value }))} label={"Invoice Prefix"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.quotation_prefix} onChange={e => setForm(p => ({ ...p, quotation_prefix: e.target.value }))} label={"Quotation Prefix"} size="small" fullWidth/></Box>
        </Box>
        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

          <TextField value={form.timezone} label={"Timezone"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, timezone: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>{timezones.map(tz => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}</TextField>
        </Box>

        <Divider sx={{ marginTop: "1rem", marginBottom: "1rem" }}/>
        <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>Bank Details</Typography>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Displayed on quotations and invoices for customer payment</Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. HDFC Bank" label={"Bank Name"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.bank_account_number} onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))} label={"Account Number"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.bank_ifsc} onChange={e => setForm(p => ({ ...p, bank_ifsc: e.target.value }))} label={"IFSC Code"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.bank_branch} onChange={e => setForm(p => ({ ...p, bank_branch: e.target.value }))} label={"Branch"} size="small" fullWidth/></Box>
        </Box>
        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.bank_upi_id} onChange={e => setForm(p => ({ ...p, bank_upi_id: e.target.value }))} placeholder="e.g. business@upi" label={"UPI ID"} size="small" fullWidth/></Box>
        <Button onClick={save} disabled={saving} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save Settings</Button>
      </CardContent>
    </Card>);
}
// ─── GST Tab ────────────────────────────────────────────────────
function GSTTab() {
    const [form, setForm] = useState({
        gst_number: "", gst_state_code: "", gst_type: "regular",
        default_cgst_rate: "9", default_sgst_rate: "9", default_igst_rate: "18", hsn_default: "",
    });
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    useEffect(() => {
        supabase.from("business_settings").select("*").limit(1).single().then(({ data }) => {
            if (data) {
                setSettingsId(data.id);
                const d = data as any;
                setForm({
                    gst_number: data.gst_number || "",
                    gst_state_code: d.gst_state_code || "",
                    gst_type: d.gst_type || "regular",
                    default_cgst_rate: String(d.default_cgst_rate ?? 9),
                    default_sgst_rate: String(d.default_sgst_rate ?? 9),
                    default_igst_rate: String(d.default_igst_rate ?? 18),
                    hsn_default: d.hsn_default || "",
                });
            }
        });
    }, []);
    const save = async () => {
        setSaving(true);
        const payload = {
            gst_number: form.gst_number, gst_state_code: form.gst_state_code, gst_type: form.gst_type,
            default_cgst_rate: parseFloat(form.default_cgst_rate) || 9,
            default_sgst_rate: parseFloat(form.default_sgst_rate) || 9,
            default_igst_rate: parseFloat(form.default_igst_rate) || 18,
            hsn_default: form.hsn_default,
        };
        if (settingsId) {
            const { error } = await supabase.from("business_settings").update(payload as any).eq("id", settingsId);
            if (error)
                toast.error(error.message);
            else
                toast.success("GST settings saved");
        }
        else {
            const { data, error } = await supabase.from("business_settings").insert(payload as any).select().single();
            if (error)
                toast.error(error.message);
            else {
                toast.success("GST settings saved");
                setSettingsId(data.id);
            }
        }
        setSaving(false);
    };
    return (<Card>
      <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>GST Settings</Typography><Typography variant="body2" color="text.secondary">Configure GST rates and tax information</Typography></Box>
      <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, maxWidth: "42rem" }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.gst_number} onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))} placeholder="22AAAAA0000A1Z5" label={"GST Number (GSTIN)"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.gst_state_code} onChange={e => setForm(p => ({ ...p, gst_state_code: e.target.value }))} placeholder="27" label={"State Code"} size="small" fullWidth/></Box>
        </Box>
        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

          <TextField value={form.gst_type} label={"GST Type"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, gst_type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value="regular">Regular</MenuItem>
              <MenuItem value="composition">Composition</MenuItem>
            </TextField>
        </Box>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.default_cgst_rate} onChange={e => setForm(p => ({ ...p, default_cgst_rate: e.target.value }))} label={"Default CGST Rate (%)"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.default_sgst_rate} onChange={e => setForm(p => ({ ...p, default_sgst_rate: e.target.value }))} label={"Default SGST Rate (%)"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.default_igst_rate} onChange={e => setForm(p => ({ ...p, default_igst_rate: e.target.value }))} label={"Default IGST Rate (%)"} size="small" fullWidth/></Box>
        </Box>
        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.hsn_default} onChange={e => setForm(p => ({ ...p, hsn_default: e.target.value }))} placeholder="9987" label={"Default HSN/SAC Code"} size="small" fullWidth/></Box>
        <Button onClick={save} disabled={saving} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save GST Settings</Button>
      </CardContent>
    </Card>);
}
// ─── Document Settings Tab ──────────────────────────────────────
function DocumentSettingsTab() {
    const { user } = useAuth();
    const [signatureUrl, setSignatureUrl] = useState("");
    const [showOnQuotations, setShowOnQuotations] = useState(false);
    const [showOnInvoices, setShowOnInvoices] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    useEffect(() => {
        supabase.from("business_settings").select("id, integrations").limit(1).single().then(({ data }) => {
            if (data) {
                setSettingsId(data.id);
                const int = (data.integrations as Record<string, any>) || {};
                setSignatureUrl(int.signature_url || "");
                setShowOnQuotations(int.show_signature_quotations === true);
                setShowOnInvoices(int.show_signature_invoices === true);
            }
        });
    }, []);
    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0)
            return;
        setUploading(true);
        const file = files[0];
        const ext = file.name.split(".").pop();
        const path = `signatures/signature_${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("uploads").upload(path, file);
        if (error) {
            toast.error(error.message);
            setUploading(false);
            return;
        }
        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
        setSignatureUrl(urlData.publicUrl);
        setUploading(false);
        toast.success("Signature uploaded");
    };
    const saveSettings = async () => {
        if (!settingsId)
            return;
        setSaving(true);
        const { data: current } = await supabase.from("business_settings").select("integrations").eq("id", settingsId).single();
        const existing = (current?.integrations as Record<string, any>) || {};
        const updated = { ...existing, signature_url: signatureUrl, show_signature_quotations: showOnQuotations, show_signature_invoices: showOnInvoices };
        const { error } = await supabase.from("business_settings").update({ integrations: updated }).eq("id", settingsId);
        if (error)
            toast.error(error.message);
        else
            toast.success("Document settings saved");
        setSaving(false);
    };
    return (<Box sx={{ display: "grid", gap: "1.5rem", maxWidth: "42rem" }}>
      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Signature Settings</Typography><Typography variant="body2" color="text.secondary">Upload a signature image for documents</Typography></Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          {signatureUrl && (<Box sx={{ borderWidth: "1px", borderRadius: "var(--radius)", padding: "1rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}>
              <Box src={signatureUrl} alt="Signature" component="img" sx={{ maxHeight: "5rem", width: "auto" }}/>
            </Box>)}
          <Box>
            <FormLabel>Upload Signature Image</FormLabel>
            <Box component="label" sx={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))", cursor: "pointer" }}>
              <Box component={Camera} sx={{ height: "1rem", width: "1rem" }}/> {uploading ? "Uploading..." : "Choose file"}
              <Box type="file" accept="image/*" onChange={e => handleUpload(e.target.files)} disabled={uploading} component="input" sx={{ display: "none" }}/>
            </Box>
          </Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <FormLabel>Show on Quotations</FormLabel>
              <Checkbox checked={showOnQuotations} onChange={e => setShowOnQuotations(e.target.checked)} sx={{ height: "1rem", width: "1rem", borderRadius: "0.25rem", borderColor: "hsl(var(--border))" }}/>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <FormLabel>Show on Invoices</FormLabel>
              <Checkbox checked={showOnInvoices} onChange={e => setShowOnInvoices(e.target.checked)} sx={{ height: "1rem", width: "1rem", borderRadius: "0.25rem", borderColor: "hsl(var(--border))" }}/>
            </Box>
          </Box>
          <Button onClick={saveSettings} disabled={saving} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save Document Settings</Button>
        </CardContent>
      </Card>
    </Box>);
}
// ─── Integration Settings Helpers ───────────────────────────────
function useIntegrations() {
    const [integrations, setIntegrations] = useState<Record<string, string>>({});
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        supabase.from("business_settings").select("id, integrations").limit(1).single().then(({ data }) => {
            if (data) {
                setSettingsId(data.id);
                if (data.integrations && typeof data.integrations === "object") {
                    setIntegrations(data.integrations as Record<string, string>);
                }
            }
        });
    }, []);
    const updateField = (key: string, value: string) => {
        setIntegrations(prev => ({ ...prev, [key]: value }));
    };
    const persistIntegrations = async (silent = false): Promise<boolean> => {
        setSaving(true);
        let ok = false;
        try {
            let targetId = settingsId;
            let existingIntegrations: Record<string, string> = {};
            if (!targetId) {
                const { data: rows } = await supabase.from("business_settings").select("id, integrations").limit(1);
                if (rows?.[0]) {
                    targetId = rows[0].id;
                    setSettingsId(targetId);
                    if (rows[0].integrations && typeof rows[0].integrations === "object") {
                        existingIntegrations = rows[0].integrations as Record<string, string>;
                    }
                }
            } else {
                const { data: current } = await supabase.from("business_settings").select("integrations").eq("id", targetId).single();
                if (current?.integrations && typeof current.integrations === "object") {
                    existingIntegrations = current.integrations as Record<string, string>;
                }
            }
            const merged = { ...existingIntegrations, ...integrations };
            if (targetId) {
                const { error } = await supabase.from("business_settings").update({ integrations: merged }).eq("id", targetId);
                if (error) {
                    toast.error(error.message);
                } else {
                    ok = true;
                    if (!silent)
                        toast.success("Settings saved");
                }
            }
            else {
                const { data, error } = await supabase.from("business_settings").insert({ integrations: merged } as any).select().single();
                if (error) {
                    toast.error(error.message);
                } else {
                    setSettingsId(data.id);
                    ok = true;
                    if (!silent)
                        toast.success("Settings saved");
                }
            }
        }
        finally {
            setSaving(false);
        }
        return ok;
    };
    const saveIntegrations = () => persistIntegrations(false);
    const saveIntegrationsSilent = () => persistIntegrations(true);
    return { integrations, updateField, saveIntegrations, saveIntegrationsSilent, saving };
}
function IntegrationFieldGroup({ title, description, fields, integrations, updateField }: {
    title: string;
    description: string;
    fields: {
        key: string;
        label: string;
        type?: string;
        placeholder?: string;
        readOnly?: boolean;
        copyable?: boolean;
    }[];
    integrations: Record<string, string>;
    updateField: (k: string, v: string) => void;
}) {
    const copyToClipboard = (value: string) => {
        navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard");
    };
    return (<Card>
      <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>{title}</Typography><Typography variant="body2" color="text.secondary">{description}</Typography></Box>
      <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
        {fields.map(f => (<Box key={f.key} sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
            <FormLabel>{f.label}</FormLabel>
            <Box sx={{ display: "flex", gap: "0.5rem" }}>
              <TextField type={f.type || "text"} placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`} value={integrations[f.key] || ""} onChange={e => updateField(f.key, e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { readOnly: f.readOnly, "aria-label": f.placeholder || `Enter ${f.label.toLowerCase()}` } }} sx={f.readOnly ? { backgroundColor: "hsl(var(--muted))" } : {}}/>
              {f.copyable && (<IconButton onClick={() => copyToClipboard(integrations[f.key] || "")} aria-label={"Copy"} sx={{ flexShrink: "0" }}>
                  <Box component={Copy} sx={{ height: "1rem", width: "1rem" }}/>
                </IconButton>)}
            </Box>
          </Box>))}
      </CardContent>
    </Card>);
}
// ─── Email/SMTP Tab ─────────────────────────────────────────────
function EmailTab() {
    const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
    return (<Box sx={{ display: "grid", gap: "1.5rem", maxWidth: "42rem" }}>
      <IntegrationFieldGroup title="SMTP Configuration" description="Configure your email sending settings" fields={[
        { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.example.com" },
        { key: "smtp_port", label: "SMTP Port", placeholder: "587" },
        { key: "smtp_user", label: "Username" },
        { key: "smtp_pass", label: "Password", type: "password" },
        { key: "smtp_from_name", label: "From Name", placeholder: "My Company" },
        { key: "smtp_from_email", label: "From Email", placeholder: "noreply@example.com" },
    ]} integrations={integrations} updateField={updateField}/>
      <Button onClick={saveIntegrations} disabled={saving} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save Email Settings</Button>
    </Box>);
}
// ─── SMS Tab ────────────────────────────────────────────────────
function SMSTab() {
    const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
    return (<Box sx={{ display: "grid", gap: "1.5rem", maxWidth: "42rem" }}>
      <IntegrationFieldGroup title="SMS API Configuration" description="DLT-compliant SMS gateway settings" fields={[
        { key: "sms_api_url", label: "API Endpoint", placeholder: "https://api.sms-provider.com/send" },
        { key: "sms_api_key", label: "API Key", type: "password" },
        { key: "sms_sender_id", label: "Sender ID", placeholder: "MYCOMP" },
        { key: "sms_dlt_entity_id", label: "DLT Entity ID" },
    ]} integrations={integrations} updateField={updateField}/>
      <Button onClick={saveIntegrations} disabled={saving} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save SMS Settings</Button>
    </Box>);
}
// ─── WhatsApp Tab ───────────────────────────────────────────────
function WhatsAppTab() {
    const [form, setForm] = useState({ whatsapp_api_url: "", whatsapp_api_key: "", whatsapp_phone_id: "" });
    const { integrations, updateField, saveIntegrations, saving: intSaving } = useIntegrations();
    const [saving, setSaving] = useState(false);
    const [settingsId, setSettingsId] = useState<string | null>(null);
    const webhookUrl = `${window.location.origin}/api/backend/functions/whatsapp-webhook`;
    const verifyToken = integrations["wa_verify_token"] || "lovable_whatsapp_verify_" + Math.random().toString(36).substring(2, 10);
    useEffect(() => {
        supabase.from("business_settings").select("*").limit(1).single().then(({ data }) => {
            if (data) {
                setSettingsId(data.id);
                const d = data as any;
                setForm({
                    whatsapp_api_url: d.whatsapp_api_url || "",
                    whatsapp_api_key: d.whatsapp_api_key || "",
                    whatsapp_phone_id: d.whatsapp_phone_id || "",
                });
            }
        });
        // Ensure verify token is set
        if (!integrations["wa_verify_token"]) {
            updateField("wa_verify_token", verifyToken);
        }
    }, []);
    const save = async () => {
        setSaving(true);
        if (settingsId) {
            const { error } = await supabase.from("business_settings").update(form as any).eq("id", settingsId);
            if (error)
                toast.error(error.message);
            else
                toast.success("WhatsApp settings saved");
        }
        // Also save integrations (for webhook verify token, fb app id/secret)
        await saveIntegrations();
        setSaving(false);
    };
    const copyToClipboard = (value: string) => {
        navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard");
    };
    return (<Box sx={{ display: "grid", gap: "1.5rem", maxWidth: "42rem" }}>
      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>WhatsApp Business API</Typography><Typography variant="body2" color="text.secondary">Configure WhatsApp messaging integration</Typography></Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.whatsapp_api_url} onChange={e => setForm(p => ({ ...p, whatsapp_api_url: e.target.value }))} placeholder="https://graph.facebook.com/v17.0" label={"API URL"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="password" value={form.whatsapp_api_key} onChange={e => setForm(p => ({ ...p, whatsapp_api_key: e.target.value }))} label={"API Key / Access Token"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.whatsapp_phone_id} onChange={e => setForm(p => ({ ...p, whatsapp_phone_id: e.target.value }))} label={"Phone Number ID"} size="small" fullWidth/></Box>
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
          <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Globe} sx={{ height: "1rem", width: "1rem" }}/> Facebook Developer Portal</Typography>
          <Typography variant="body2" color="text.secondary">Configure these settings for webhook verification in your Facebook App</Typography>
        </Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

            <TextField value={integrations["fb_app_id"] || ""} onChange={e => updateField("fb_app_id", e.target.value)} placeholder="Enter Facebook App ID" label={"Facebook App ID"} size="small" fullWidth/>
          </Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

            <TextField type="password" value={integrations["fb_app_secret"] || ""} onChange={e => updateField("fb_app_secret", e.target.value)} placeholder="Enter Facebook App Secret" label={"Facebook App Secret"} size="small" fullWidth/>
          </Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
            <FormLabel>Webhook Verify Token</FormLabel>
            <Box sx={{ display: "flex", gap: "0.5rem" }}>
              <TextField value={verifyToken} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true, "aria-label": "Input" } }} sx={{ backgroundColor: "hsl(var(--muted))", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <IconButton onClick={() => copyToClipboard(verifyToken)} aria-label={"Copy"} sx={{ flexShrink: "0" }}><Box component={Copy} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
            </Box>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Enter this token in the Facebook Developer Portal webhook configuration</Typography>
          </Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
            <FormLabel>Webhook Callback URL</FormLabel>
            <Box sx={{ display: "flex", gap: "0.5rem" }}>
              <TextField value={webhookUrl} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true, "aria-label": "Input" } }} sx={{ backgroundColor: "hsl(var(--muted))", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <IconButton onClick={() => copyToClipboard(webhookUrl)} aria-label={"Copy"} sx={{ flexShrink: "0" }}><Box component={Copy} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
            </Box>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Enter this URL in the Facebook Developer Portal → WhatsApp → Configuration → Webhook</Typography>
          </Box>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving || intSaving} variant="contained">{(saving || intSaving) ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save WhatsApp Settings</Button>

      <WhatsAppAutomationSection />
    </Box>);
}
// ─── WhatsApp Automation Settings ────────────────────────────────
const AUTOMATION_EVENTS = [
    { id: "lead_created", label: "New Lead Created", desc: "When a new lead is captured" },
    { id: "job_created", label: "Job Sheet Created", desc: "When a repair job is created" },
    { id: "job_approved", label: "Job Approved", desc: "When customer approves the job" },
    { id: "job_in_progress", label: "Repair In Progress", desc: "When repair work starts" },
    { id: "job_ready", label: "Ready for Pickup", desc: "When repair is completed" },
    { id: "job_delivered", label: "Job Delivered", desc: "When device is delivered" },
    { id: "invoice_generated", label: "Invoice Generated", desc: "When invoice is created" },
    { id: "payment_received", label: "Payment Received", desc: "When payment is confirmed" },
    { id: "quotation_sent", label: "Quotation Sent", desc: "When quotation is shared" },
    { id: "payment_reminder", label: "Payment Reminder", desc: "Overdue payment reminder" },
];
function WhatsAppAutomationSection() {
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { user } = useAuth();
    useEffect(() => {
        fetchTemplates();
    }, []);
    const fetchTemplates = async () => {
        setLoading(true);
        const { data } = await supabase.from("templates").select("*").not("event_type", "is", null);
        setTemplates(data || []);
        setLoading(false);
    };
    const getTemplateForEvent = (eventType: string) => {
        return templates.find((t: any) => t.event_type === eventType);
    };
    const createDefaultTemplate = async (eventId: string, eventLabel: string) => {
        const defaultBodies: Record<string, string> = {
            lead_created: "Hello {{customer_name}}, thank you for your interest! Our team will contact you shortly.",
            job_created: "Hello {{customer_name}}, your repair job {{job_id}} has been created. Track: {{link}}",
            job_approved: "Hello {{customer_name}}, your job {{job_id}} has been approved. We'll begin work shortly.",
            job_in_progress: "Hello {{customer_name}}, repair on {{job_id}} is now in progress. Track: {{link}}",
            job_ready: "Hello {{customer_name}}, your device ({{job_id}}) is ready for pickup! Track: {{link}}",
            job_delivered: "Hello {{customer_name}}, job {{job_id}} delivered successfully. Thank you for choosing us!",
            invoice_generated: "Hello {{customer_name}}, invoice for ₹{{amount}} has been generated. View: {{link}}",
            payment_received: "Hello {{customer_name}}, payment of ₹{{amount}} received. Thank you!",
            quotation_sent: "Hello {{customer_name}}, your quotation is ready. View: {{link}}",
            payment_reminder: "Hello {{customer_name}}, payment of ₹{{amount}} is pending. Pay now: {{link}}",
        };
        const { error } = await supabase.from("templates").insert({
            name: `WA: ${eventLabel}`,
            type: "sms" as any,
            body: defaultBodies[eventId] || `Hello {{customer_name}}, update on your job {{job_id}}: {{status}}`,
            event_type: eventId,
            created_by: user?.id,
        });
        if (error)
            toast.error(error.message);
        else {
            toast.success("Template created");
            fetchTemplates();
        }
    };
    const removeAutomation = async (templateId: string) => {
        const { error } = await supabase.from("templates").update({ event_type: null } as any).eq("id", templateId);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Automation removed");
            fetchTemplates();
        }
    };
    const testAutomation = async (eventId: string) => {
        try {
            const result = await supabase.functions.invoke("whatsapp-automation", {
                body: {
                    event_type: eventId,
                    customer_phone: "919999999999",
                    variables: {
                        customer_name: "Test Customer",
                        job_id: "JOB-2026-00001",
                        status: "test",
                        link: window.location.origin,
                        amount: "1000",
                    },
                },
            });
            if (result.data?.success)
                toast.success(`Test sent via ${result.data.channel}`);
            else if (result.data?.skipped)
                toast.info("No template configured for this event");
            else
                toast.error(result.data?.error || "Test failed");
        }
        catch (e) {
            toast.error("Failed to test automation");
        }
    };
    return (<Card sx={{ marginTop: "1.5rem" }}>
      <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
        <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}>
          <Box component={MessageSquare} sx={{ height: "1rem", width: "1rem" }}/> WhatsApp Automation
        </Typography>
        <Typography variant="body2" color="text.secondary">Auto-send WhatsApp messages on key events. Falls back to SMS if WhatsApp is unavailable.</Typography>
      </Box>
      <CardContent>
        {loading ? (<Box sx={{ display: "flex", justifyContent: "center", paddingTop: "2rem", paddingBottom: "2rem" }}><Box component={Loader2} sx={{ height: "1.25rem", width: "1.25rem", animation: "spin 1s linear infinite", color: "hsl(var(--muted-foreground))" }}/></Box>) : (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
            {AUTOMATION_EVENTS.map(evt => {
                const tpl = getTemplateForEvent(evt.id);
                return (<Box key={evt.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem", borderRadius: "0.75rem", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "color-mix(in srgb, hsl(var(--card)) 50%, transparent)" }}>
                  <Box sx={{ flex: "1 1 0%" }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{evt.label}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{evt.desc}</Typography>
                    {tpl && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--primary))", marginTop: "0.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "300px" }}>Template: {tpl.name}</Typography>}
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    {tpl ? (<>
                        <StatusChip label={"Active"} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                        <Button onClick={() => testAutomation(evt.id)} variant="text" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          <Box component={TestTube} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Test
                        </Button>
                        <Button onClick={() => removeAutomation(tpl.id)} variant="text" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--destructive))" }}>
                          <Box component={Trash2} sx={{ height: "0.75rem", width: "0.75rem" }}/>
                        </Button>
                      </>) : (<Button onClick={() => createDefaultTemplate(evt.id, evt.label)} variant="outlined" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                        <Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Enable
                      </Button>)}
                  </Box>
                </Box>);
            })}
          </Box>)}
      </CardContent>
    </Card>);
}
// ─── Razorpay Tab ───────────────────────────────────────────────
function RazorpayTab() {
    const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
    const webhookUrl = `${window.location.origin}/api/backend/functions/razorpay-webhook`;
    const copyToClipboard = (value: string) => {
        navigator.clipboard.writeText(value);
        toast.success("Copied to clipboard");
    };
    return (<Box sx={{ display: "grid", gap: "1.5rem", maxWidth: "42rem" }}>
      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
          <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={CreditCard} sx={{ height: "1rem", width: "1rem" }}/> Razorpay Payment Gateway</Typography>
          <Typography variant="body2" color="text.secondary">Configure Razorpay for accepting online payments on invoices</Typography>
        </Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={integrations["razorpay_key_id"] || ""} onChange={e => updateField("razorpay_key_id", e.target.value)} placeholder="rzp_live_xxxxxxxxxxxx" label={"Key ID"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="password" value={integrations["razorpay_key_secret"] || ""} onChange={e => updateField("razorpay_key_secret", e.target.value)} placeholder="Enter Key Secret" label={"Key Secret"} size="small" fullWidth/></Box>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="password" value={integrations["razorpay_webhook_secret"] || ""} onChange={e => updateField("razorpay_webhook_secret", e.target.value)} placeholder="Enter Webhook Secret" label={"Webhook Secret"} size="small" fullWidth/></Box>
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
          <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Globe} sx={{ height: "1rem", width: "1rem" }}/> Razorpay Dashboard Configuration</Typography>
          <Typography variant="body2" color="text.secondary">Configure this webhook URL in your Razorpay Dashboard → Settings → Webhooks</Typography>
        </Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
            <FormLabel>Webhook URL</FormLabel>
            <Box sx={{ display: "flex", gap: "0.5rem" }}>
              <TextField value={webhookUrl} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true, "aria-label": "Input" } }} sx={{ backgroundColor: "hsl(var(--muted))", fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <IconButton onClick={() => copyToClipboard(webhookUrl)} aria-label={"Copy"} sx={{ flexShrink: "0" }}><Box component={Copy} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
            </Box>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Add this URL in Razorpay Dashboard → Settings → Webhooks. Select events: <Box component="code" sx={{ fontSize: "10px", backgroundColor: "hsl(var(--muted))", paddingLeft: "0.25rem", paddingRight: "0.25rem", borderRadius: "0.25rem" }}>payment.captured</Box>, <Box component="code" sx={{ fontSize: "10px", backgroundColor: "hsl(var(--muted))", paddingLeft: "0.25rem", paddingRight: "0.25rem", borderRadius: "0.25rem" }}>payment_link.paid</Box></Typography>
          </Box>
          <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderWidth: "1px", borderColor: "hsl(var(--border))", fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
            <Typography component="p" variant="body1" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>Setup Instructions:</Typography>
            <Box component="ol" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", listStyleType: "decimal", listStylePosition: "inside", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
              <Box component="li">Go to <Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>Razorpay Dashboard</Box> → Settings → Webhooks</Box>
              <Box component="li">Click <Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>Add New Webhook</Box></Box>
              <Box component="li">Paste the Webhook URL above</Box>
              <Box component="li">Enter the same Webhook Secret you configured above</Box>
              <Box component="li">Select events: <Box component="code" sx={{ backgroundColor: "hsl(var(--background))", paddingLeft: "0.25rem", paddingRight: "0.25rem", borderRadius: "0.25rem" }}>payment.captured</Box> and <Box component="code" sx={{ backgroundColor: "hsl(var(--background))", paddingLeft: "0.25rem", paddingRight: "0.25rem", borderRadius: "0.25rem" }}>payment_link.paid</Box></Box>
              <Box component="li">Save the webhook</Box>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: "flex", gap: "0.75rem" }}>
        <Button onClick={saveIntegrations} disabled={saving} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save Razorpay Settings</Button>
        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", alignSelf: "center" }}>Note: Backend secrets (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) are configured separately as backend secrets.</Typography>
      </Box>
    </Box>);
}
// ─── Hikvision Tab ──────────────────────────────────────────────
function HikvisionTab() {
    const { integrations, updateField, saveIntegrations, saveIntegrationsSilent, saving } = useIntegrations();
    const [step, setStep] = useState(1);
    const [credentialStatus, setCredentialStatus] = useState<"idle" | "valid" | "invalid">("idle");
    const [credentialError, setCredentialError] = useState("");
    const [testingCredentials, setTestingCredentials] = useState(false);
    const [showSecretKey, setShowSecretKey] = useState(false);
    const [showWebhookSecret, setShowWebhookSecret] = useState(false);
    const [serverStatus, setServerStatus] = useState<{
        configured?: boolean;
        source?: string;
        hasEnvFallback?: boolean;
    } | null>(null);
    const [credentialInfo, setCredentialInfo] = useState<{
        areaDomain?: string;
        expireTime?: number;
    } | null>(null);
    // Step 2: Sites
    const [sites, setSites] = useState<Array<{
        id: string;
        siteName: string;
    }>>([]);
    const [loadingSites, setLoadingSites] = useState(false);
    const [selectedSiteId, setSelectedSiteId] = useState(integrations["hik_default_site_id"] || "");
    // Step 3: Devices
    const [cloudDevices, setCloudDevices] = useState<any[]>([]);
    const [loadingDevices, setLoadingDevices] = useState(false);
    const [importingDevices, setImportingDevices] = useState(false);
    const [savedDevices, setSavedDevices] = useState<any[]>([]);
    // Step 4: Sync
    const [syncingAction, setSyncingAction] = useState<string | null>(null);
    const [syncResults, setSyncResults] = useState<Record<string, any>>({});
    const [backfillStart, setBackfillStart] = useState("");
    const [backfillEnd, setBackfillEnd] = useState("");
    const refreshCredentialStatus = useCallback(async () => {
        try {
            const { data } = await supabase.functions.invoke("hikvision-sync", {
                body: { action: "credential-status" },
            });
            if (data?.success)
                setServerStatus(data);
        }
        catch {
            // Non-blocking status probe
        }
    }, []);
    useEffect(() => {
        supabase.from("hikvision_devices").select("*").order("created_at").then(({ data }) => setSavedDevices(data || []));
        refreshCredentialStatus();
    }, [refreshCredentialStatus]);
    useEffect(() => {
        if (integrations["hik_default_site_id"])
            setSelectedSiteId(integrations["hik_default_site_id"]);
    }, [integrations]);
    const hasFormKeys = Boolean((integrations["hik_partner_app_key"] || "").trim() || (integrations["hik_partner_secret_key"] || "").trim() || (integrations["hik_webhook_sign_secret"] || "").trim());
    const saveHikCredentials = async () => {
        const ok = await saveIntegrations();
        if (ok) {
            await refreshCredentialStatus();
        }
    };
    const testCredentials = async () => {
        setTestingCredentials(true);
        setCredentialStatus("idle");
        setCredentialError("");
        try {
            if (hasFormKeys) {
                const saved = await saveIntegrationsSilent();
                if (!saved) {
                    setCredentialStatus("invalid");
                    setTestingCredentials(false);
                    return;
                }
                await refreshCredentialStatus();
            }
            const { data, error } = await supabase.functions.invoke("hikvision-sync", {
                body: { action: "test-credentials" },
            });
            if (error)
                throw error;
            if (data?.success) {
                setCredentialStatus("valid");
                setCredentialInfo({ areaDomain: data.areaDomain, expireTime: data.expireTime });
                toast.success("Hik-Partner Pro credentials verified!");
                setStep(2);
            }
            else {
                setCredentialStatus("invalid");
                setCredentialError(data?.error || "Invalid credentials");
                toast.error(data?.error || "Invalid credentials");
            }
        }
        catch (e: any) {
            setCredentialStatus("invalid");
            setCredentialError(e?.message || "Credential test failed");
            toast.error(e.message || "Credential test failed");
        }
        setTestingCredentials(false);
    };
    const discoverSites = async () => {
        setLoadingSites(true);
        try {
            const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "site-search" } });
            if (error)
                throw error;
            if (data?.success) {
                setSites(data.sites || []);
                toast.success(`Found ${data.sites?.length || 0} sites`);
            }
            else
                toast.error(data?.error || "Failed");
        }
        catch (e: any) {
            toast.error(e.message);
        }
        setLoadingSites(false);
    };
    const selectSite = async (siteId: string) => {
        setSelectedSiteId(siteId);
        updateField("hik_default_site_id", siteId);
        await saveIntegrations();
        toast.success("Default site saved");
        setStep(3);
    };
    const discoverDevices = async () => {
        setLoadingDevices(true);
        try {
            const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "list-devices" } });
            if (error)
                throw error;
            if (data?.success) {
                setCloudDevices(data.devices || []);
                toast.success(`Found ${data.devices?.length || 0} devices`);
            }
            else
                toast.error(data?.error || "Failed");
        }
        catch (e: any) {
            toast.error(e.message);
        }
        setLoadingDevices(false);
    };
    const importAllDevices = async () => {
        setImportingDevices(true);
        try {
            const { data, error } = await supabase.functions.invoke("hikvision-sync", {
                body: { action: "list-cloud-devices", import_devices: true },
            });
            if (error)
                throw error;
            if (data?.success) {
                toast.success(`Imported ${data.imported || 0} devices`);
                const { data: devs } = await supabase.from("hikvision_devices").select("*").order("created_at");
                setSavedDevices(devs || []);
                setStep(4);
            }
            else
                toast.error(data?.error || "Failed");
        }
        catch (e: any) {
            toast.error(e.message);
        }
        setImportingDevices(false);
    };
    const runDeviceSync = async (deviceId: string, deviceSerial: string, action: string, extraBody?: Record<string, any>) => {
        setSyncingAction(`${deviceId}-${action}`);
        try {
            const { data, error } = await supabase.functions.invoke("hikvision-sync", {
                body: { action, device_id: deviceId, device_serial: deviceSerial, ...extraBody },
            });
            if (error)
                throw error;
            setSyncResults(prev => ({ ...prev, [`${deviceId}-${action}`]: data }));
            if (data?.success)
                toast.success(`${action.replace(/-/g, " ")} completed — ${data.records_synced || 0} records`);
            else
                toast.error(data?.error || "Failed");
        }
        catch (e: any) {
            toast.error(e.message);
        }
        setSyncingAction(null);
    };
    const functionsUrl = `${window.location.origin}/api/backend/functions`;
    const webhookUrl = `${functionsUrl}/hikvision-webhook`;
    const STEPS = [
        { num: 1, label: "Connection" },
        { num: 2, label: "Select Site" },
        { num: 3, label: "Devices" },
        { num: 4, label: "Sync & Monitor" },
    ];
    return (<Box sx={{ display: "grid", gap: "1.5rem", maxWidth: "48rem" }}>
      {/* Stepper Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {STEPS.map((s, idx) => (<Box key={s.num} sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <ButtonBase onClick={() => setStep(s.num)} type="button" sx={mergeSx({ display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", borderRadius: "9999px", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, step === s.num ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" } :
            step > s.num ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" })}>
              <Box component="span" sx={{ height: "1.25rem", width: "1.25rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--background)) 20%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700" }}>{step > s.num ? "✓" : s.num}</Box>
              {s.label}
            </ButtonBase>
            {idx < STEPS.length - 1 && <Box sx={{ width: "1.5rem", height: "1px", backgroundColor: "hsl(var(--border))" }}/>}
          </Box>))}
      </Box>

      {/* Step 1: Configure & Test Connection */}
      {step === 1 && (<Card>
          <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
            <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Cloud} sx={{ height: "1.25rem", width: "1.25rem" }}/> Hik-Partner Pro Cloud API</Typography>
            <Typography variant="body2" color="text.secondary">Enter your Hik-Partner Pro OpenAPI keys below. Keys saved here are stored encrypted in database settings for admins and take priority over server .env fallback secrets.</Typography>
          </Box>
          <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderWidth: "1px", borderColor: "hsl(var(--border))", fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
              <Typography component="p" variant="body1" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>
                {integrations["hik_partner_app_key"]?.trim() && integrations["hik_partner_secret_key"]?.trim()
                    ? "Credentials Source: Settings (Frontend Configuration)"
                    : serverStatus?.hasEnvFallback
                        ? "Credentials Source: Server Environment Fallback (.env)"
                        : "Credentials Not Configured"}
              </Typography>
              <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>
                {integrations["hik_partner_app_key"]?.trim() && integrations["hik_partner_secret_key"]?.trim()
                    ? "Using App Key and Secret Key saved in Settings. Update fields below anytime and click Test Connection."
                    : serverStatus?.hasEnvFallback
                        ? "Server environment keys are detected. You can enter keys below to override them directly from the UI."
                        : "Paste your App Key and Secret Key from the Hik-Partner Pro OpenAPI Developer Portal, then save and test the connection."}
              </Typography>
            </Box>
            <Box sx={{ display: "grid", gap: "0.875rem" }}>
              <TextField
                label="Hik-Partner App Key (HIK_PARTNER_APP_KEY)"
                value={integrations["hik_partner_app_key"] || ""}
                onChange={e => updateField("hik_partner_app_key", e.target.value)}
                placeholder="Enter App Key from Hik-Partner Pro"
                size="small"
                fullWidth
              />
              <TextField
                label="Hik-Partner Secret Key (HIK_PARTNER_SECRET_KEY)"
                type={showSecretKey ? "text" : "password"}
                value={integrations["hik_partner_secret_key"] || ""}
                onChange={e => updateField("hik_partner_secret_key", e.target.value)}
                placeholder="Enter Secret Key from Hik-Partner Pro"
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" aria-label={showSecretKey ? "Hide secret key" : "Show secret key"} onClick={() => setShowSecretKey(prev => !prev)} edge="end">
                          <Box component={showSecretKey ? EyeOff : Eye} sx={{ height: "1rem", width: "1rem" }}/>
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              <TextField
                label="Webhook Signing Secret (Optional · HIK_WEBHOOK_SIGN_SECRET)"
                type={showWebhookSecret ? "text" : "password"}
                value={integrations["hik_webhook_sign_secret"] || ""}
                onChange={e => updateField("hik_webhook_sign_secret", e.target.value)}
                placeholder="Optional HMAC secret for verifying inbound Hik-Partner webhooks"
                size="small"
                fullWidth
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" aria-label={showWebhookSecret ? "Hide webhook secret" : "Show webhook secret"} onClick={() => setShowWebhookSecret(prev => !prev)} edge="end">
                          <Box component={showWebhookSecret ? EyeOff : Eye} sx={{ height: "1rem", width: "1rem" }}/>
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Box>
            {credentialStatus !== "idle" && (<Box sx={mergeSx({ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem", borderRadius: "var(--radius)", fontSize: "0.875rem", lineHeight: "1.25rem" }, credentialStatus === "valid" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--success)) 20%, transparent)" } : { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--destructive)) 20%, transparent)" })}>
                <Box component="span" sx={mergeSx({ height: "0.625rem", width: "0.625rem", borderRadius: "9999px", flexShrink: 0 }, credentialStatus === "valid" ? { backgroundColor: "hsl(var(--success))" } : { backgroundColor: "hsl(var(--destructive))" })}/>
                {credentialStatus === "valid" ? `Connected. Area Domain: ${credentialInfo?.areaDomain || "detected"}` : (credentialError || "Connection failed. Check your App Key and Secret Key.")}
              </Box>)}
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              <Button onClick={saveHikCredentials} disabled={saving || testingCredentials} variant="outlined">
                {saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save Keys
              </Button>
              <Button onClick={testCredentials} disabled={testingCredentials || saving} variant="contained">
                {testingCredentials ? <Box component={RefreshCw} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={TestTube} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Save & Test Connection
              </Button>
              {credentialStatus === "valid" && (<Button onClick={() => setStep(2)} variant="outlined">Continue to Sites →</Button>)}
            </Box>
          </CardContent>
        </Card>)}

      {/* Step 2: Site Selection */}
      {step === 2 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Discover & Select Site</Typography>
              <Typography variant="body2" color="text.secondary">Discover all sites linked to your Hik-Partner Pro account, then select your default site.</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Button onClick={discoverSites} disabled={loadingSites} variant="contained">
                {loadingSites ? <Box component={RefreshCw} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Cloud} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Discover Sites
              </Button>
              {sites.length > 0 && (<DataTable columnsCount={3}>
                  <TableHead><TableRow><TableCell>Site Name</TableCell><TableCell>Site ID</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
                  <TableBody>
                    {sites.map(s => (<TableRow key={s.id}>
                        <TableCell sx={{ fontWeight: "500" }}>{s.siteName}</TableCell>
                        <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{s.id}</TableCell>
                        <TableCell>
                          {selectedSiteId === s.id ? (<StatusChip label={<><Box component={CheckCircle2} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Default</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }}/>) : (<Button onClick={() => selectSite(s.id)} variant="outlined" size="small">Set Default</Button>)}
                        </TableCell>
                      </TableRow>))}
                  </TableBody>
                </DataTable>)}
              {selectedSiteId && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))", borderWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--success)) 20%, transparent)", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box component={CheckCircle2} sx={{ height: "1rem", width: "1rem" }}/> Default site set: <Box component="span" sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}>{selectedSiteId}</Box>
                </Box>)}
            </CardContent>
          </Card>
          {selectedSiteId && <Button onClick={() => setStep(3)} variant="contained">Continue to Devices →</Button>}
        </Box>)}

      {/* Step 3: Device Discovery */}
      {step === 3 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Device Discovery</Typography>
              <Typography variant="body2" color="text.secondary">Discover biometric devices from your cloud account and import them.</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Box sx={{ display: "flex", gap: "0.5rem" }}>
                <Button onClick={discoverDevices} disabled={loadingDevices} variant="outlined">
                  {loadingDevices ? <Box component={RefreshCw} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Cloud} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Discover Devices
                </Button>
                {cloudDevices.length > 0 && (<Button onClick={importAllDevices} disabled={importingDevices} variant="contained">
                    {importingDevices ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}Import All Devices
                  </Button>)}
              </Box>
              {cloudDevices.length > 0 && (<DataTable columnsCount={5}>
                  <TableHead><TableRow><TableCell>Device Name</TableCell><TableCell>Serial</TableCell><TableCell>Model</TableCell><TableCell>Site</TableCell><TableCell>Status</TableCell></TableRow></TableHead>
                  <TableBody>
                    {cloudDevices.map((d: any, i: number) => (<TableRow key={i}>
                        <TableCell sx={{ fontWeight: "500" }}>{d.deviceName || d.deviceSerial}</TableCell>
                        <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}>{d.deviceSerial}</TableCell>
                        <TableCell>{d.deviceModel || "—"}</TableCell>
                        <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{d._siteName || "—"}</TableCell>
                        <TableCell>
                          <StatusChip label={String(d.deviceOnlineStatus) === "1" ? "Online" : "Offline"} sx={String(d.deviceOnlineStatus) === "1" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/>
                        </TableCell>
                      </TableRow>))}
                  </TableBody>
                </DataTable>)}
            </CardContent>
          </Card>
          {savedDevices.length > 0 && (<Card>
              <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Saved Devices ({savedDevices.length})</Typography></Box>
              <CardContent>
                <DataTable columnsCount={5}>
                  <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Serial</TableCell><TableCell>Model</TableCell><TableCell>Status</TableCell><TableCell>Last Sync</TableCell></TableRow></TableHead>
                  <TableBody>
                    {savedDevices.map(d => (<TableRow key={d.id}>
                        <TableCell sx={{ fontWeight: "500" }}>{d.name}</TableCell>
                        <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}>{d.device_serial}</TableCell>
                        <TableCell>{d.device_model || "—"}</TableCell>
                        <TableCell><StatusChip label={d.status} sx={d.status === "active" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/></TableCell>
                        <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{d.last_sync_at ? new Date(d.last_sync_at).toLocaleString() : "Never"}</TableCell>
                      </TableRow>))}
                  </TableBody>
                </DataTable>
              </CardContent>
            </Card>)}
          <Button onClick={() => setStep(4)} disabled={savedDevices.length === 0} variant="contained">Continue to Sync →</Button>
        </Box>)}

      {/* Step 4: Sync & Monitor */}
      {step === 4 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          {/* Demo Test Card */}
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={TestTube} sx={{ height: "1rem", width: "1rem" }}/> End-to-End Pipeline Test</Typography>
              <Typography variant="body2" color="text.secondary">Insert mock attendance events, process them through dedup + attendance pipeline, and verify results — no real device needed.</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <Button onClick={() => runDeviceSync(savedDevices[0]?.id || "", savedDevices[0]?.device_serial || "", "demo-test")} disabled={!!syncingAction} variant="outlined">
                {syncingAction?.includes("demo-test") ? <Box component={Loader2} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem", animation: "spin 1s linear infinite" }}/> : <Box component={TestTube} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>}
                Run Demo Test
              </Button>
              {syncResults[`${savedDevices[0]?.id || ""}-demo-test`] && (<Box sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderRadius: "var(--radius)", padding: "0.75rem", fontSize: "0.75rem", lineHeight: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" }, overflow: "auto", maxHeight: "15rem" }}>
                  <Typography component="p" variant="body1" sx={{ fontWeight: "600", color: "hsl(var(--foreground))" }}>Test Results:</Typography>
                  {syncResults[`${savedDevices[0]?.id || ""}-demo-test`].steps?.map((s: string, i: number) => (<Typography key={i} component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>• {s}</Typography>))}
                  {syncResults[`${savedDevices[0]?.id || ""}-demo-test`].errors?.length > 0 && (<Box sx={{ color: "hsl(var(--destructive))", marginTop: "0.5rem" }}>
                      <Typography component="p" variant="body1" sx={{ fontWeight: "600" }}>Errors:</Typography>
                      {syncResults[`${savedDevices[0]?.id || ""}-demo-test`].errors.map((e: string, i: number) => (<Typography key={i} component="p" variant="body1">✗ {e}</Typography>))}
                    </Box>)}
                  {syncResults[`${savedDevices[0]?.id || ""}-demo-test`].verification && (<Box sx={{ marginTop: "0.5rem", borderTopWidth: "1px", borderColor: "hsl(var(--border))", paddingTop: "0.5rem" }}>
                      <Typography component="p" variant="body1" sx={{ fontWeight: "600", color: "hsl(var(--foreground))" }}>Verification:</Typography>
                      <Typography component="p" variant="body1">Logs in DB: {syncResults[`${savedDevices[0]?.id || ""}-demo-test`].verification.logs_in_db}</Typography>
                      <Typography component="p" variant="body1">Attendance record: {syncResults[`${savedDevices[0]?.id || ""}-demo-test`].verification.attendance_record ?
                        `✓ ${syncResults[`${savedDevices[0]?.id || ""}-demo-test`].verification.attendance_record.check_in} → ${syncResults[`${savedDevices[0]?.id || ""}-demo-test`].verification.attendance_record.check_out || "pending"}` : "✗ None"}</Typography>
                    </Box>)}
                </Box>)}
            </CardContent>
          </Card>

          {/* Webhook Config Card */}
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Globe} sx={{ height: "1rem", width: "1rem" }}/> Webhook Configuration</Typography>
              <Typography variant="body2" color="text.secondary">Configure this URL in your Hik-Partner Pro webhook settings for real-time event delivery.</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <TextField value={webhookUrl} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true, "aria-label": "Input" } }} sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                <Button onClick={() => { navigator.clipboard.writeText(webhookUrl); toast.success("URL copied!"); }} variant="outlined" size="small">
                  <Box component={Copy} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                </Button>
              </Box>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                In Hik-Partner Pro → Webhook → Save Config, set this as your callback URL. Enable HMAC signing for security.
                Once configured, attendance events will be received automatically without polling.
              </Typography>
            </CardContent>
          </Card>

          {/* Curl Examples Card */}
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Code} sx={{ height: "1rem", width: "1rem" }}/> API & Curl Examples</Typography>
              <Typography variant="body2" color="text.secondary">Test each action directly via curl. Replace YOUR_JWT with your auth token.</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <Box sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderRadius: "var(--radius)", padding: "0.75rem", fontFamily: "JetBrains Mono, monospace", fontSize: "10px", lineHeight: "1.625", overflowX: "auto", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                <Box>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--foreground))", fontWeight: "600", fontSize: "0.75rem", lineHeight: "1rem", marginBottom: "0.25rem" }}># Test credentials</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", wordBreak: "break-all" }}>curl -X POST {functionsUrl}/hikvision-sync \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -H "Authorization: Bearer YOUR_JWT" \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -H "Content-Type: application/json" \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -d '{`{"action":"test-credentials"}`}'</Typography>
                </Box>
                <Box>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--foreground))", fontWeight: "600", fontSize: "0.75rem", lineHeight: "1rem", marginBottom: "0.25rem" }}># Demo test (no device needed)</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", wordBreak: "break-all" }}>curl -X POST {functionsUrl}/hikvision-sync \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -H "Authorization: Bearer YOUR_JWT" \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -H "Content-Type: application/json" \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -d '{`{"action":"demo-test"}`}'</Typography>
                </Box>
                <Box>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--foreground))", fontWeight: "600", fontSize: "0.75rem", lineHeight: "1rem", marginBottom: "0.25rem" }}># Backfill attendance (ISAPI)</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", wordBreak: "break-all" }}>curl -X POST {functionsUrl}/hikvision-sync \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -H "Authorization: Bearer YOUR_JWT" \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -H "Content-Type: application/json" \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -d '{`{"action":"backfill-attendance","device_id":"YOUR_DEVICE_ID","start_time":"2026-04-01T00:00:00","end_time":"2026-04-06T23:59:59"}`}'</Typography>
                </Box>
                <Box>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--foreground))", fontWeight: "600", fontSize: "0.75rem", lineHeight: "1rem", marginBottom: "0.25rem" }}># Test webhook (simulate Hik push)</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", wordBreak: "break-all" }}>curl -X POST {webhookUrl} \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -H "Content-Type: application/json" \</Typography>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>  -d '{`{"events":[{"deviceSerial":"DS-K1T341AM","alarmData":{"eventType":"AccessControllerEvent","dateTime":"2026-04-06T09:00:00+05:30","AccessControllerEvent":{"employeeNoString":"1001","name":"Test","attendanceStatus":"checkIn","serialNo":"999999","currentVerifyMode":"faceRecognition"}}}]}`}'</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Sync Actions per device */}
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Sync Actions</Typography>
              <Typography variant="body2" color="text.secondary">Run sync operations per device.</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              {savedDevices.length === 0 ? (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>No saved devices. Go back to Step 3.</Typography>) : (savedDevices.map(d => (<Box key={d.id} sx={{ borderWidth: "1px", borderColor: "hsl(var(--border))", borderRadius: "0.75rem", padding: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Box>
                        <Typography component="p" variant="body1" sx={{ fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{d.name}</Typography>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono, monospace" }}>{d.device_serial} · {d.device_model || "Unknown model"}</Typography>
                      </Box>
                      <StatusChip label={d.status} sx={d.status === "active" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/>
                    </Box>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {[
                    { action: "sync-employees", label: "Sync Employees (ISAPI)", icon: User },
                    { action: "sync-attendance", label: "Poll Attendance (MQ)", icon: Clock },
                    { action: "full-sync", label: "Full Sync", icon: RefreshCw },
                ].map(btn => {
                    const isRunning = syncingAction === `${d.id}-${btn.action}`;
                    const result = syncResults[`${d.id}-${btn.action}`];
                    return (<Box key={btn.action} sx={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                            <Button onClick={() => runDeviceSync(d.id, d.device_serial || d.ip_address, btn.action)} disabled={!!syncingAction} variant="outlined" size="small">
                              {isRunning ? <Box component={Loader2} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem", animation: "spin 1s linear infinite" }}/> : <Box component={btn.icon} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>}
                              {btn.label}
                            </Button>
                            {result && (<Box component="span" sx={mergeSx({ fontSize: "10px", marginTop: "0.25rem" }, result.success ? { color: "hsl(var(--success))" } : { color: "hsl(var(--destructive))" })}>
                                {result.success ? `✓ ${result.records_synced || 0} records` : `✗ ${result.error?.substring(0, 40)}`}
                              </Box>)}
                          </Box>);
                })}
                    </Box>

                    {/* Backfill Section */}
                    <Box sx={{ borderTopWidth: "1px", borderColor: "hsl(var(--border))", paddingTop: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Backfill Attendance (ISAPI)</Typography>
                      <Box sx={{ display: "flex", alignItems: "flex-end", gap: "0.5rem" }}>
                        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>

                          <TextField type="datetime-local" value={backfillStart} onChange={e => setBackfillStart(e.target.value)} label={"Start"} size="small" fullWidth sx={{ fontSize: "0.75rem", lineHeight: "1rem", height: "2rem", width: "12rem" }}/>
                        </Box>
                        <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>

                          <TextField type="datetime-local" value={backfillEnd} onChange={e => setBackfillEnd(e.target.value)} label={"End"} size="small" fullWidth sx={{ fontSize: "0.75rem", lineHeight: "1rem", height: "2rem", width: "12rem" }}/>
                        </Box>
                        <Button disabled={!!syncingAction || !backfillStart || !backfillEnd} onClick={() => {
                const start = new Date(backfillStart).toISOString();
                const end = new Date(backfillEnd).toISOString();
                runDeviceSync(d.id, d.device_serial || d.ip_address, "backfill-attendance", { start_time: start, end_time: end });
            }} variant="outlined" size="small">
                          {syncingAction === `${d.id}-backfill-attendance` ? <Box component={Loader2} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem", animation: "spin 1s linear infinite" }}/> : <Box component={Clock} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>}
                          Backfill
                        </Button>
                      </Box>
                      {syncResults[`${d.id}-backfill-attendance`] && (<Box component="span" sx={mergeSx({ fontSize: "10px" }, syncResults[`${d.id}-backfill-attendance`].success ? { color: "hsl(var(--success))" } : { color: "hsl(var(--destructive))" })}>
                          {syncResults[`${d.id}-backfill-attendance`].success ? `✓ ${syncResults[`${d.id}-backfill-attendance`].records_synced || 0} records` : `✗ ${syncResults[`${d.id}-backfill-attendance`].error?.substring(0, 40)}`}
                        </Box>)}
                    </Box>

                    {/* MQ Poll Details */}
                    {syncResults[`${d.id}-sync-attendance`]?.details && (<Box sx={{ borderTopWidth: "1px", borderColor: "hsl(var(--border))", paddingTop: "0.75rem" }}>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.25rem" }}>MQ Poll Details</Typography>
                        <Box sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderRadius: "0.25rem", padding: "0.5rem", fontSize: "10px", color: "hsl(var(--muted-foreground))", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.125rem" } }}>
                          {syncResults[`${d.id}-sync-attendance`].details.map((d: string, i: number) => <Typography key={i} component="p" variant="body1">• {d}</Typography>)}
                        </Box>
                      </Box>)}
                  </Box>)))}
            </CardContent>
          </Card>

          {/* Manual Employee Mapping */}
          <ManualEmployeeMapping savedDevices={savedDevices}/>

          {/* Sync Status Dashboard */}
          <HikvisionSyncDashboard />
        </Box>)}
    </Box>);
}
// ─── Manual Employee Mapping ────────────────────────────────────
function ManualEmployeeMapping({ savedDevices }: {
    savedDevices: Array<{
        id: string;
        name: string;
        device_serial?: string;
    }>;
}) {
    const [empCode, setEmpCode] = useState("");
    const [empName, setEmpName] = useState("");
    const [selectedDevice, setSelectedDevice] = useState("");
    const [saving, setSaving] = useState(false);
    const [mappings, setMappings] = useState<Array<{
        id: string;
        device_employee_code: string;
        device_employee_name: string | null;
        erp_employee_id: string | null;
    }>>([]);
    const loadMappings = async () => {
        const { data } = await supabase.from("hikvision_employee_mapping").select("id, device_employee_code, device_employee_name, erp_employee_id").order("created_at", { ascending: false }).limit(20);
        setMappings(data || []);
    };
    useEffect(() => { loadMappings(); if (savedDevices.length > 0)
        setSelectedDevice(savedDevices[0].id); }, [savedDevices]);
    const handleAdd = async () => {
        if (!empCode.trim()) {
            toast.error("Employee code is required");
            return;
        }
        setSaving(true);
        try {
            const { data, error } = await supabase.functions.invoke("hikvision-sync", {
                body: { action: "manual-add-employee", device_id: selectedDevice || null, employee_code: empCode.trim(), employee_name: empName.trim() || undefined },
            });
            if (error || !data?.success)
                throw new Error(data?.error || error?.message || "Failed");
            toast.success(data.message || "Employee mapped");
            setEmpCode("");
            setEmpName("");
            loadMappings();
        }
        catch (e: any) {
            toast.error(e.message);
        }
        setSaving(false);
    };
    return (<Card>
      <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
        <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Plus} sx={{ height: "1rem", width: "1rem" }}/> Manual Employee Mapping</Typography>
        <Typography variant="body2" color="text.secondary">If cloud sync isn't available, manually enter device employee codes to link with your system. You can find these codes on the biometric device's user list.</Typography>
      </Box>
      <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "0.75rem" }}>
          <Box>

            <TextField placeholder="e.g. 1001" value={empCode} onChange={e => setEmpCode(e.target.value)} label={"Employee Code (from device)"} size="small" fullWidth/>
          </Box>
          <Box>

            <TextField placeholder="e.g. Rajat" value={empName} onChange={e => setEmpName(e.target.value)} label={"Employee Name"} size="small" fullWidth/>
          </Box>
          <Box>

            <TextField value={selectedDevice} label={"Device"} select size="small" fullWidth onChange={event => setSelectedDevice(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select device"}</MenuItem>
                {savedDevices.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </TextField>
          </Box>
        </Box>
        <Button onClick={handleAdd} disabled={saving} variant="contained" size="small">
          {saving ? <Box component={Loader2} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem", animation: "spin 1s linear infinite" }}/> : <Box component={Plus} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>}
          Add Mapping
        </Button>
        {mappings.length > 0 && (<Box sx={{ borderWidth: "1px", borderColor: "hsl(var(--border))", borderRadius: "var(--radius)", overflow: "hidden" }}>
            <DataTable columnsCount={3}>
              <TableHead><TableRow><TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>Code</TableCell><TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>Name</TableCell><TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>Linked</TableCell></TableRow></TableHead>
              <TableBody>
                {mappings.map(m => (<TableRow key={m.id}>
                    <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontFamily: "JetBrains Mono, monospace" }}>{m.device_employee_code}</TableCell>
                    <TableCell sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{m.device_employee_name || "—"}</TableCell>
                    <TableCell>{m.erp_employee_id ? <Box component={CheckCircle2} sx={{ height: "0.875rem", width: "0.875rem", color: "hsl(var(--success))" }}/> : <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Not linked</Box>}</TableCell>
                  </TableRow>))}
              </TableBody>
            </DataTable>
          </Box>)}
      </CardContent>
    </Card>);
}
// ─── Hikvision Sync Dashboard ───────────────────────────────────
function HikvisionSyncDashboard() {
    const [syncLogs, setSyncLogs] = useState<Array<{
        id: string;
        action: string;
        status: string;
        records_synced: number | null;
        error_message: string | null;
        created_at: string;
    }>>([]);
    const [deviceCount, setDeviceCount] = useState(0);
    const [mappedCount, setMappedCount] = useState(0);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            const [logsRes, devRes, mapRes] = await Promise.all([
                supabase.from("hikvision_sync_log").select("*").order("created_at", { ascending: false }).limit(5),
                supabase.from("hikvision_devices").select("id", { count: "exact", head: true }),
                supabase.from("hikvision_employee_mapping").select("id", { count: "exact", head: true }),
            ]);
            setSyncLogs(logsRes.data || []);
            setDeviceCount(devRes.count || 0);
            setMappedCount(mapRes.count || 0);
            setLoading(false);
        })();
    }, []);
    if (loading)
        return null;
    const lastSync = syncLogs.length > 0 ? syncLogs[0] : null;
    return (<Card>
      <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Sync Status Dashboard</Typography></Box>
      <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.75rem" }}>
          <Box sx={{ borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", padding: "0.75rem", textAlign: "center" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{deviceCount}</Typography>
            <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Devices</Typography>
          </Box>
          <Box sx={{ borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", padding: "0.75rem", textAlign: "center" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{mappedCount}</Typography>
            <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mapped Employees</Typography>
          </Box>
          <Box sx={{ borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", padding: "0.75rem", textAlign: "center" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))" }}>{lastSync ? new Date(lastSync.created_at).toLocaleString() : "Never"}</Typography>
            <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Last Sync</Typography>
          </Box>
        </Box>

        {syncLogs.length > 0 && (<Box>
            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>Recent Sync Logs</Typography>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
              {syncLogs.map(log => (<Box key={log.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem", padding: "0.5rem", borderRadius: "0.25rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Box component="span" sx={mergeSx({ height: "0.5rem", width: "0.5rem", borderRadius: "9999px" }, log.status === "success" ? { backgroundColor: "rgb(34 197 94 / 1)" } : { backgroundColor: "rgb(239 68 68 / 1)" })}/>
                    <Box component="span" sx={{ fontWeight: "500" }}>{log.action}</Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {log.records_synced != null && <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>{log.records_synced} records</Box>}
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>{new Date(log.created_at).toLocaleString()}</Box>
                  </Box>
                </Box>))}
            </Box>
          </Box>)}
      </CardContent>
    </Card>);
}
// ─── Templates Tab ──────────────────────────────────────────────
interface Template {
    id: string;
    name: string;
    type: string;
    subject: string | null;
    body: string;
    variables: any;
    is_default: boolean;
    created_at: string;
}
const typeIcons: Record<string, any> = { email: Mail, sms: MessageSquare, invoice: FileText, quotation: File };
const typeColors = { email: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" }, sms: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }, invoice: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }, quotation: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent))" } };
const variablesList = ["{{customer_name}}", "{{invoice_number}}", "{{quotation_number}}", "{{amount}}", "{{date}}", "{{company_name}}", "{{repair_status}}"];
function TemplatesTab() {
    const { user } = useAuth();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("all");
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", type: "email", subject: "", body: "" });
    const fetchTemplates = async () => {
        setLoading(true);
        let query = supabase.from("templates").select("*").order("created_at", { ascending: false });
        if (tab !== "all")
            query = query.eq("type", tab as any);
        const { data } = await query;
        setTemplates(data || []);
        setLoading(false);
    };
    useEffect(() => { fetchTemplates(); }, [tab]);
    const openNew = () => { setEditId(null); setForm({ name: "", type: "email", subject: "", body: "" }); setSheetOpen(true); };
    const openEdit = (t: Template) => { setEditId(t.id); setForm({ name: t.name, type: t.type, subject: t.subject || "", body: t.body }); setSheetOpen(true); };
    const handleSave = async () => {
        if (!form.name || !form.body) {
            toast.error("Name and body are required");
            return;
        }
        const payload = { name: form.name, type: form.type as any, subject: form.subject || null, body: form.body, created_by: user?.id };
        if (editId) {
            const { error } = await supabase.from("templates").update(payload).eq("id", editId);
            if (error)
                toast.error(error.message);
            else
                toast.success("Template updated");
        }
        else {
            const { error } = await supabase.from("templates").insert(payload);
            if (error)
                toast.error(error.message);
            else
                toast.success("Template created");
        }
        setSheetOpen(false);
        fetchTemplates();
    };
    const handleDelete = async (id: string) => {
        if (!await confirmAction("Delete this template?"))
            return;
        const { error } = await supabase.from("templates").delete().eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Deleted");
            fetchTemplates();
        }
    };
    const insertVariable = (v: string) => setForm(p => ({ ...p, body: p.body + v }));
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, gap: "1rem" }}>
        <Box>
          <Typography component="h2" variant="h2" sx={{ fontSize: "1.125rem", lineHeight: "1.75rem", fontWeight: "600" }}>Templates</Typography>
          <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>Manage email, SMS, and document templates</Typography>
        </Box>
        <Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Template</Button>
      </Box>

      <TabView value={tab} onChange={setTab}>
        <TabBar>
          <Tab value="all" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>All</Box>}/>
          <Tab value="email" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Email</Box>}/>
          <Tab value="sms" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>SMS</Box>}/>
          <Tab value="invoice" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Invoice</Box>}/>
          <Tab value="quotation" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Quotation</Box>}/>
        </TabBar>
      </TabView>

      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : templates.length === 0 ? (<Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>No templates yet. Create your first one!</Typography>) : (<Box sx={{ display: "grid", gap: "0.75rem" }}>
          {templates.map(t => {
                const Icon = typeIcons[t.type] || File;
                return (<Card key={t.id}>
                <CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                  <Box sx={mergeSx({ padding: "0.625rem", borderRadius: "var(--radius)" }, typeColors[t.type] || { backgroundColor: "hsl(var(--muted))" })}><Box component={Icon} sx={{ height: "1.25rem", width: "1.25rem" }}/></Box>
                  <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                    <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{t.name}</Typography>
                    {t.subject && <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</Typography>}
                  </Box>
                  <StatusChip label={t.type} variant="outlined" sx={{ textTransform: "capitalize" }}/>
                  <Box sx={{ display: "flex", gap: "0.25rem" }}>
                    <IconButton onClick={() => openEdit(t)} aria-label={"Pencil"}><Box component={Pencil} sx={{ height: "1rem", width: "1rem" }}/></IconButton>
                    <IconButton onClick={() => handleDelete(t.id)} aria-label={"Trash2"}><Box component={Trash2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--destructive))" }}/></IconButton>
                  </Box>
                </CardContent>
              </Card>);
            })}
        </Box>)}

      <FormDialog open={sheetOpen} onClose={() => setSheetOpen(false)} title={editId ? "Edit Template" : "New Template"} description={"Create reusable message templates with variables"} paperSx={{ overflowY: "auto" }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Name *"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.type} label={"Type"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="email">Email</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                  <MenuItem value="invoice">Invoice</MenuItem>
                  <MenuItem value="quotation">Quotation</MenuItem>
                </TextField>
            </Box>
            {form.type === "email" && <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} label={"Subject"} size="small" fullWidth/></Box>}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={8} label={"Body *"} size="small" fullWidth multiline/>
              {form.type === "sms" && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{form.body.length}/160 characters</Typography>}
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
              <FormLabel>Insert Variable</FormLabel>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                {variablesList.map(v => <Button key={v} onClick={() => insertVariable(v)} variant="outlined" size="small" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{v}</Button>)}
              </Box>
            </Box>
            <Button onClick={handleSave} variant="contained" sx={{ width: "100%" }}>{editId ? "Update" : "Create"} Template</Button>
          </Box>
        </FormDialog>
    </Box>);
}
// ─── Service Categories Tab ─────────────────────────────────────
function ServiceCategoriesTab() {
    const [categories, setCategories] = useState<{
        id: string;
        name: string;
        default_charge: number;
    }[]>([]);
    const [loading, setLoading] = useState(true);
    const [editId, setEditId] = useState<string | null>(null);
    const [form, setForm] = useState({ name: "", default_charge: "" });
    const [saving, setSaving] = useState(false);
    const fetchCategories = async () => {
        setLoading(true);
        const { data } = await supabase.from("service_charge_categories").select("*").order("name");
        if (data)
            setCategories(data);
        setLoading(false);
    };
    useEffect(() => { fetchCategories(); }, []);
    const save = async () => {
        setSaving(true);
        const payload = { name: form.name, default_charge: parseFloat(form.default_charge) || 0 };
        if (editId) {
            const { error } = await supabase.from("service_charge_categories").update(payload).eq("id", editId);
            if (error)
                toast.error(error.message);
            else {
                toast.success("Category updated");
                setEditId(null);
                setForm({ name: "", default_charge: "" });
                fetchCategories();
            }
        }
        else {
            const { error } = await supabase.from("service_charge_categories").insert(payload);
            if (error)
                toast.error(error.message);
            else {
                toast.success("Category added");
                setForm({ name: "", default_charge: "" });
                fetchCategories();
            }
        }
        setSaving(false);
    };
    const deleteCategory = async (id: string) => {
        const { error } = await supabase.from("service_charge_categories").delete().eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Deleted");
            fetchCategories();
        }
    };
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" }, maxWidth: "42rem" }}>
      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>{editId ? "Edit Category" : "Add Service Category"}</Typography><Typography variant="body2" color="text.secondary">Set default service charges per device type</Typography></Box>
        <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "1rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField placeholder="e.g. iPhone" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Category Name"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" placeholder="e.g. 750" value={form.default_charge} onChange={e => setForm(p => ({ ...p, default_charge: e.target.value }))} label={"Default Charge (\u20B9)"} size="small" fullWidth/></Box>
          </Box>
          <Box sx={{ display: "flex", gap: "0.5rem" }}>
            <Button onClick={save} disabled={saving || !form.name} variant="contained">{saving ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}{editId ? "Update" : "Add Category"}</Button>
            {editId && <Button onClick={() => { setEditId(null); setForm({ name: "", default_charge: "" }); }} variant="outlined">Cancel</Button>}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={{ fontSize: "1rem", fontWeight: 650 }}>Existing Categories</Typography></Box>
        <CardContent>
          {loading ? <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))", paddingTop: "1rem", paddingBottom: "1rem", textAlign: "center", fontSize: "0.875rem", lineHeight: "1.25rem" }}>Loading...</Typography> : (<DataTable columnsCount={3}>
              <TableHead>
                <TableRow><TableCell>Device Category</TableCell><TableCell>Default Charge</TableCell><TableCell sx={{ width: "6rem" }}>Actions</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {categories.map(c => (<TableRow key={c.id}>
                    <TableCell sx={{ fontWeight: "500" }}>{c.name}</TableCell>
                    <TableCell>₹{c.default_charge.toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", gap: "0.25rem" }}>
                        <IconButton onClick={() => { setEditId(c.id); setForm({ name: c.name, default_charge: String(c.default_charge) }); }} aria-label={"Pencil"} sx={{ height: "1.75rem", width: "1.75rem" }}><Box component={Pencil} sx={{ height: "0.875rem", width: "0.875rem" }}/></IconButton>
                        <IconButton onClick={() => deleteCategory(c.id)} aria-label={"Trash2"} sx={{ height: "1.75rem", width: "1.75rem", color: "hsl(var(--destructive))", "&:hover": { color: "hsl(var(--destructive))" } }}><Box component={Trash2} sx={{ height: "0.875rem", width: "0.875rem" }}/></IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </DataTable>)}
        </CardContent>
      </Card>
    </Box>);
}
