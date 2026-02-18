import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  User, Shield, Building2, Receipt, Mail, MessageSquare, Phone,
  Camera, FileText, Save, Loader2, Plus, Pencil, Trash2, File,
  Cloud, TestTube, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";

type AppRole = "admin" | "staff" | "technician" | "customer";

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

export default function Settings() {
  const { user, hasRole } = useAuth();
  const isAdmin = hasRole("admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and system settings</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1.5" />Profile</TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><Shield className="h-4 w-4 mr-1.5" />Users</TabsTrigger>}
          {isAdmin && <TabsTrigger value="business"><Building2 className="h-4 w-4 mr-1.5" />Business</TabsTrigger>}
          {isAdmin && <TabsTrigger value="gst"><Receipt className="h-4 w-4 mr-1.5" />GST</TabsTrigger>}
          {isAdmin && <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1.5" />Email/SMTP</TabsTrigger>}
          {isAdmin && <TabsTrigger value="sms"><MessageSquare className="h-4 w-4 mr-1.5" />SMS</TabsTrigger>}
          {isAdmin && <TabsTrigger value="whatsapp"><Phone className="h-4 w-4 mr-1.5" />WhatsApp</TabsTrigger>}
          {isAdmin && <TabsTrigger value="hikvision"><Camera className="h-4 w-4 mr-1.5" />Hikvision</TabsTrigger>}
          {isAdmin && <TabsTrigger value="templates"><FileText className="h-4 w-4 mr-1.5" />Templates</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        {isAdmin && <TabsContent value="users"><UsersTab /></TabsContent>}
        {isAdmin && <TabsContent value="business"><BusinessTab /></TabsContent>}
        {isAdmin && <TabsContent value="gst"><GSTTab /></TabsContent>}
        {isAdmin && <TabsContent value="email"><EmailTab /></TabsContent>}
        {isAdmin && <TabsContent value="sms"><SMSTab /></TabsContent>}
        {isAdmin && <TabsContent value="whatsapp"><WhatsAppTab /></TabsContent>}
        {isAdmin && <TabsContent value="hikvision"><HikvisionTab /></TabsContent>}
        {isAdmin && <TabsContent value="templates"><TemplatesTab /></TabsContent>}
      </Tabs>
    </div>
  );
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
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single().then(({ data }) => {
      if (data) { setFullName(data.full_name || ""); setPhone(data.phone || ""); }
    });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName, phone }).eq("user_id", user.id);
    if (error) toast.error(error.message); else toast.success("Profile updated");
    setSaving(false);
  };

  const changePassword = async () => {
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return; }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) toast.error(error.message); else { toast.success("Password updated"); setPassword(""); setConfirmPassword(""); }
    setSaving(false);
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Profile Information</CardTitle><CardDescription>Update your personal details</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Email</Label><Input value={user?.email || ""} disabled /></div>
          <div className="space-y-1.5"><Label>Full Name</Label><Input value={fullName} onChange={e => setFullName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <Button onClick={saveProfile} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Change Password</CardTitle><CardDescription>Update your account password</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>New Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Confirm Password</Label><Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} /></div>
          <Button onClick={changePassword} disabled={saving}>Update Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    if (profiles && roles) {
      setUsers(profiles.map(p => ({
        profile: p,
        role: (roles.find(r => r.user_id === p.user_id)?.role || "staff") as AppRole,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateRole = async (userId: string, newRole: AppRole) => {
    const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", userId);
    if (error) toast.error(error.message); else { toast.success("Role updated"); fetchUsers(); }
  };

  const roleColors: Record<AppRole, string> = {
    admin: "bg-destructive/10 text-destructive",
    staff: "bg-primary/10 text-primary",
    technician: "bg-warning/10 text-warning",
    customer: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardHeader><CardTitle>User Management</CardTitle><CardDescription>Manage user accounts and roles</CardDescription></CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground py-6 text-center">Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Current Role</TableHead><TableHead>Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.profile.user_id}>
                  <TableCell className="font-medium">{u.profile.full_name || "—"}</TableCell>
                  <TableCell>{u.profile.phone || "—"}</TableCell>
                  <TableCell><Badge className={roleColors[u.role]}>{u.role}</Badge></TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => updateRole(u.profile.user_id, v as AppRole)}>
                      <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="staff">Staff</SelectItem>
                        <SelectItem value="technician">Technician</SelectItem>
                        <SelectItem value="customer">Customer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Business Tab ───────────────────────────────────────────────
function BusinessTab() {
  const [form, setForm] = useState({
    company_name: "", company_address: "", company_phone: "",
    company_email: "", logo_url: "", invoice_prefix: "INV-", quotation_prefix: "QT-",
    timezone: "Asia/Kolkata",
  });
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  useEffect(() => {
    supabase.from("business_settings").select("*").limit(1).single().then(({ data }) => {
      if (data) {
        setSettingsId(data.id);
        setForm({
          company_name: data.company_name || "",
          company_address: data.company_address || "",
          company_phone: data.company_phone || "",
          company_email: data.company_email || "",
          logo_url: data.logo_url || "",
          invoice_prefix: data.invoice_prefix || "INV-",
          quotation_prefix: data.quotation_prefix || "QT-",
          timezone: (data as any).timezone || "Asia/Kolkata",
        });
      }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update(form as any).eq("id", settingsId);
      if (error) toast.error(error.message); else toast.success("Settings saved");
    } else {
      const { data, error } = await supabase.from("business_settings").insert(form as any).select().single();
      if (error) toast.error(error.message); else { toast.success("Settings saved"); setSettingsId(data.id); }
    }
    setSaving(false);
  };

  const timezones = ["Asia/Kolkata", "Asia/Dubai", "America/New_York", "America/Chicago", "America/Los_Angeles", "Europe/London", "Europe/Berlin", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];

  return (
    <Card>
      <CardHeader><CardTitle>Business Settings</CardTitle><CardDescription>Company information, logo, address, and timezone</CardDescription></CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div className="space-y-1.5"><Label>Company Name</Label><Input value={form.company_name} onChange={e => setForm(p => ({ ...p, company_name: e.target.value }))} /></div>
        <div className="space-y-1.5"><Label>Address</Label><Textarea value={form.company_address} onChange={e => setForm(p => ({ ...p, company_address: e.target.value }))} rows={3} /></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Phone</Label><Input value={form.company_phone} onChange={e => setForm(p => ({ ...p, company_phone: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input value={form.company_email} onChange={e => setForm(p => ({ ...p, company_email: e.target.value }))} /></div>
        </div>
        <div className="space-y-1.5"><Label>Logo URL</Label><Input value={form.logo_url} onChange={e => setForm(p => ({ ...p, logo_url: e.target.value }))} placeholder="https://example.com/logo.png" /></div>
        {form.logo_url && <img src={form.logo_url} alt="Logo preview" className="h-16 w-auto rounded border border-border" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Invoice Prefix</Label><Input value={form.invoice_prefix} onChange={e => setForm(p => ({ ...p, invoice_prefix: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Quotation Prefix</Label><Input value={form.quotation_prefix} onChange={e => setForm(p => ({ ...p, quotation_prefix: e.target.value }))} /></div>
        </div>
        <div className="space-y-1.5">
          <Label>Timezone</Label>
          <Select value={form.timezone} onValueChange={v => setForm(p => ({ ...p, timezone: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{timezones.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Settings</Button>
      </CardContent>
    </Card>
  );
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
      gst_number: form.gst_number,
      gst_state_code: form.gst_state_code,
      gst_type: form.gst_type,
      default_cgst_rate: parseFloat(form.default_cgst_rate) || 9,
      default_sgst_rate: parseFloat(form.default_sgst_rate) || 9,
      default_igst_rate: parseFloat(form.default_igst_rate) || 18,
      hsn_default: form.hsn_default,
    };
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update(payload as any).eq("id", settingsId);
      if (error) toast.error(error.message); else toast.success("GST settings saved");
    } else {
      const { data, error } = await supabase.from("business_settings").insert(payload as any).select().single();
      if (error) toast.error(error.message); else { toast.success("GST settings saved"); setSettingsId(data.id); }
    }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader><CardTitle>GST Settings</CardTitle><CardDescription>Configure GST rates and tax information</CardDescription></CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>GST Number (GSTIN)</Label><Input value={form.gst_number} onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))} placeholder="22AAAAA0000A1Z5" /></div>
          <div className="space-y-1.5"><Label>State Code</Label><Input value={form.gst_state_code} onChange={e => setForm(p => ({ ...p, gst_state_code: e.target.value }))} placeholder="27" /></div>
        </div>
        <div className="space-y-1.5">
          <Label>GST Type</Label>
          <Select value={form.gst_type} onValueChange={v => setForm(p => ({ ...p, gst_type: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">Regular</SelectItem>
              <SelectItem value="composition">Composition</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5"><Label>Default CGST Rate (%)</Label><Input type="number" value={form.default_cgst_rate} onChange={e => setForm(p => ({ ...p, default_cgst_rate: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Default SGST Rate (%)</Label><Input type="number" value={form.default_sgst_rate} onChange={e => setForm(p => ({ ...p, default_sgst_rate: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Default IGST Rate (%)</Label><Input type="number" value={form.default_igst_rate} onChange={e => setForm(p => ({ ...p, default_igst_rate: e.target.value }))} /></div>
        </div>
        <div className="space-y-1.5"><Label>Default HSN/SAC Code</Label><Input value={form.hsn_default} onChange={e => setForm(p => ({ ...p, hsn_default: e.target.value }))} placeholder="9987" /></div>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save GST Settings</Button>
      </CardContent>
    </Card>
  );
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

  const saveIntegrations = async () => {
    setSaving(true);
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update({ integrations }).eq("id", settingsId);
      if (error) toast.error(error.message); else toast.success("Settings saved");
    } else {
      const { data, error } = await supabase.from("business_settings").insert({ integrations } as any).select().single();
      if (error) toast.error(error.message); else { toast.success("Settings saved"); setSettingsId(data.id); }
    }
    setSaving(false);
  };

  return { integrations, updateField, saveIntegrations, saving };
}

function IntegrationFieldGroup({ title, description, fields, integrations, updateField }: {
  title: string; description: string;
  fields: { key: string; label: string; type?: string; placeholder?: string }[];
  integrations: Record<string, string>;
  updateField: (k: string, v: string) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {fields.map(f => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Input type={f.type || "text"} placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`} value={integrations[f.key] || ""} onChange={e => updateField(f.key, e.target.value)} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Email/SMTP Tab ─────────────────────────────────────────────
function EmailTab() {
  const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
  return (
    <div className="grid gap-6 max-w-2xl">
      <IntegrationFieldGroup
        title="SMTP Configuration" description="Configure your email sending settings"
        fields={[
          { key: "smtp_host", label: "SMTP Host", placeholder: "smtp.example.com" },
          { key: "smtp_port", label: "SMTP Port", placeholder: "587" },
          { key: "smtp_user", label: "Username" },
          { key: "smtp_pass", label: "Password", type: "password" },
          { key: "smtp_from_name", label: "From Name", placeholder: "My Company" },
          { key: "smtp_from_email", label: "From Email", placeholder: "noreply@example.com" },
        ]}
        integrations={integrations} updateField={updateField}
      />
      <Button onClick={saveIntegrations} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Email Settings</Button>
    </div>
  );
}

// ─── SMS Tab ────────────────────────────────────────────────────
function SMSTab() {
  const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
  return (
    <div className="grid gap-6 max-w-2xl">
      <IntegrationFieldGroup
        title="SMS API Configuration" description="DLT-compliant SMS gateway settings"
        fields={[
          { key: "sms_api_url", label: "API Endpoint", placeholder: "https://api.sms-provider.com/send" },
          { key: "sms_api_key", label: "API Key", type: "password" },
          { key: "sms_sender_id", label: "Sender ID", placeholder: "MYCOMP" },
          { key: "sms_dlt_entity_id", label: "DLT Entity ID" },
        ]}
        integrations={integrations} updateField={updateField}
      />
      <Button onClick={saveIntegrations} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save SMS Settings</Button>
    </div>
  );
}

// ─── WhatsApp Tab ───────────────────────────────────────────────
function WhatsAppTab() {
  const [form, setForm] = useState({ whatsapp_api_url: "", whatsapp_api_key: "", whatsapp_phone_id: "" });
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

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
  }, []);

  const save = async () => {
    setSaving(true);
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update(form as any).eq("id", settingsId);
      if (error) toast.error(error.message); else toast.success("WhatsApp settings saved");
    }
    setSaving(false);
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle className="text-base">WhatsApp Business API</CardTitle><CardDescription>Configure WhatsApp messaging integration</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>API URL</Label><Input value={form.whatsapp_api_url} onChange={e => setForm(p => ({ ...p, whatsapp_api_url: e.target.value }))} placeholder="https://graph.facebook.com/v17.0" /></div>
          <div className="space-y-1.5"><Label>API Key / Access Token</Label><Input type="password" value={form.whatsapp_api_key} onChange={e => setForm(p => ({ ...p, whatsapp_api_key: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Phone Number ID</Label><Input value={form.whatsapp_phone_id} onChange={e => setForm(p => ({ ...p, whatsapp_phone_id: e.target.value }))} /></div>
        </CardContent>
      </Card>
      <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save WhatsApp Settings</Button>
    </div>
  );
}

// ─── Hikvision Tab ──────────────────────────────────────────────
function HikvisionTab() {
  const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "connected" | "error">("idle");
  const [discoveredSites, setDiscoveredSites] = useState<Array<{ siteId: string; siteName: string; deviceCount: number; isCustomerSite?: boolean }>>([]);
  const [totalDevices, setTotalDevices] = useState(0);

  const testConnection = async () => {
    setTesting(true);
    setConnectionStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "list-devices" } });
      if (error) throw error;
      if (data?.success) {
        setConnectionStatus("connected");
        setDiscoveredSites(data.sites || []);
        setTotalDevices(data.devices?.length || 0);
        toast.success(`Connected — ${data.sites?.length || 0} sites, ${data.devices?.length || 0} devices found`);
      } else {
        setConnectionStatus("error");
        toast.error(data?.error || "Connection failed");
      }
    } catch (e: any) {
      setConnectionStatus("error");
      toast.error(e.message || "Connection test failed");
    }
    setTesting(false);
  };

  const setDefaultSite = (siteId: string) => {
    updateField("hik_default_site_id", siteId);
    toast.info("Default site set. Click Save to persist.");
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Hik-Partner Pro Cloud API
          </CardTitle>
          <CardDescription>Cloud API credentials are securely stored as backend secrets. Use "Test Connection" to verify.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${connectionStatus === "connected" ? "bg-green-500" : connectionStatus === "error" ? "bg-red-500" : "bg-muted-foreground/30"}`} />
            <span className="text-sm font-medium">
              {connectionStatus === "connected" ? `Connected — ${discoveredSites.length} sites, ${totalDevices} devices` :
               connectionStatus === "error" ? "Connection failed" : "Not tested yet"}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>App Key</Label>
              <Input value="••••••••••••••••" disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Stored as HIK_PARTNER_APP_KEY secret</p>
            </div>
            <div className="space-y-1.5">
              <Label>API Secret</Label>
              <Input value="••••••••••••••••" disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Stored as HIK_PARTNER_SECRET_KEY secret</p>
            </div>
          </div>
          <Button onClick={testConnection} disabled={testing} variant="outline">
            {testing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}
            Test Connection
          </Button>
        </CardContent>
      </Card>

      {/* Discovered Sites */}
      {discoveredSites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discovered Sites</CardTitle>
            <CardDescription>Sites found in your Hik-Partner Pro account. Click a site to set as default.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Site Name</TableHead>
                  <TableHead>Site ID</TableHead>
                  <TableHead>Devices</TableHead>
                  <TableHead>Default</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {discoveredSites.map(s => (
                  <TableRow key={s.siteId} className="cursor-pointer hover:bg-muted/50" onClick={() => setDefaultSite(s.siteId)}>
                    <TableCell className="font-medium">{s.siteName}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.siteId}</TableCell>
                    <TableCell>{s.deviceCount}</TableCell>
                    <TableCell>
                      {integrations["hik_default_site_id"] === s.siteId && (
                        <Badge className="bg-primary/10 text-primary">Default</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Sync Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sync Settings</CardTitle>
          <CardDescription>Configure default site and sync behavior</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Default Site ID</Label>
            <Input value={integrations["hik_default_site_id"] || ""} onChange={e => updateField("hik_default_site_id", e.target.value)} placeholder="Enter or select from discovered sites above" />
            <p className="text-xs text-muted-foreground">When set, device operations are filtered to this site</p>
          </div>
          <div className="space-y-1.5">
            <Label>Sync Mode</Label>
            <Select value={integrations["hik_sync_mode"] || "manual"} onValueChange={v => updateField("hik_sync_mode", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="auto">Automatic</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Auto-Sync Interval (minutes)</Label>
            <Input type="number" value={integrations["hik_sync_interval"] || "30"} onChange={e => updateField("hik_sync_interval", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={saveIntegrations} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Hikvision Settings
      </Button>
    </div>
  );
}

// ─── Templates Tab (merged from Templates page) ────────────────
interface Template {
  id: string; name: string; type: string; subject: string | null;
  body: string; variables: any; is_default: boolean; created_at: string;
}

const typeIcons: Record<string, any> = { email: Mail, sms: MessageSquare, invoice: FileText, quotation: File };
const typeColors: Record<string, string> = { email: "bg-primary/10 text-primary", sms: "bg-success/10 text-success", invoice: "bg-warning/10 text-warning", quotation: "bg-accent/10 text-accent" };
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
    if (tab !== "all") query = query.eq("type", tab as any);
    const { data } = await query;
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [tab]);

  const openNew = () => { setEditId(null); setForm({ name: "", type: "email", subject: "", body: "" }); setSheetOpen(true); };
  const openEdit = (t: Template) => { setEditId(t.id); setForm({ name: t.name, type: t.type, subject: t.subject || "", body: t.body }); setSheetOpen(true); };

  const handleSave = async () => {
    if (!form.name || !form.body) { toast.error("Name and body are required"); return; }
    const payload = { name: form.name, type: form.type as any, subject: form.subject || null, body: form.body, created_by: user?.id };
    if (editId) {
      const { error } = await supabase.from("templates").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Template updated");
    } else {
      const { error } = await supabase.from("templates").insert(payload);
      if (error) toast.error(error.message); else toast.success("Template created");
    }
    setSheetOpen(false); fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchTemplates(); }
  };

  const insertVariable = (v: string) => setForm(p => ({ ...p, body: p.body + v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Templates</h2>
          <p className="text-sm text-muted-foreground">Manage email, SMS, and document templates</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Template</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="quotation">Quotation</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : templates.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No templates yet. Create your first one!</p>
      ) : (
        <div className="grid gap-3">
          {templates.map(t => {
            const Icon = typeIcons[t.type] || File;
            return (
              <Card key={t.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg ${typeColors[t.type] || "bg-muted"}`}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t.name}</p>
                    {t.subject && <p className="text-sm text-muted-foreground truncate">{t.subject}</p>}
                  </div>
                  <Badge variant="outline" className="capitalize">{t.type}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Template" : "New Template"}</SheetTitle>
            <SheetDescription>Create reusable message templates with variables</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "email" && <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></div>}
            <div className="space-y-1.5">
              <Label>Body *</Label>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={8} />
              {form.type === "sms" && <p className="text-xs text-muted-foreground">{form.body.length}/160 characters</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Insert Variable</Label>
              <div className="flex flex-wrap gap-1">
                {variablesList.map(v => <Button key={v} variant="outline" size="sm" className="text-xs" onClick={() => insertVariable(v)}>{v}</Button>)}
              </div>
            </div>
            <Button className="w-full" onClick={handleSave}>{editId ? "Update" : "Create"} Template</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
