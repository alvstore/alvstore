import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { User, Shield, Building2, Plug, Save, Loader2 } from "lucide-react";
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
        <TabsList>
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1.5" />Profile</TabsTrigger>
          {isAdmin && <TabsTrigger value="users"><Shield className="h-4 w-4 mr-1.5" />Users</TabsTrigger>}
          {isAdmin && <TabsTrigger value="business"><Building2 className="h-4 w-4 mr-1.5" />Business</TabsTrigger>}
          {isAdmin && <TabsTrigger value="integrations"><Plug className="h-4 w-4 mr-1.5" />Integrations</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile"><ProfileTab /></TabsContent>
        {isAdmin && <TabsContent value="users"><UsersTab /></TabsContent>}
        {isAdmin && <TabsContent value="business"><BusinessTab /></TabsContent>}
        {isAdmin && <TabsContent value="integrations"><IntegrationsTab /></TabsContent>}
      </Tabs>
    </div>
  );
}

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
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Update your personal details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={user?.email || ""} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <Button onClick={saveProfile} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>New Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm Password</Label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
          </div>
          <Button onClick={changePassword} disabled={saving}>Update Password</Button>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    if (profiles && roles) {
      const mapped = profiles.map(p => ({
        profile: p,
        role: (roles.find(r => r.user_id === p.user_id)?.role || "staff") as AppRole,
      }));
      setUsers(mapped);
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
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Manage user accounts and roles</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground py-6 text-center">Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Current Role</TableHead>
                <TableHead>Change Role</TableHead>
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

function BusinessTab() {
  const [form, setForm] = useState({
    company_name: "", company_address: "", company_phone: "",
    company_email: "", gst_number: "", invoice_prefix: "INV-", quotation_prefix: "QT-",
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
          gst_number: data.gst_number || "",
          invoice_prefix: data.invoice_prefix || "INV-",
          quotation_prefix: data.quotation_prefix || "QT-",
        });
      }
    });
  }, []);

  const save = async () => {
    setSaving(true);
    if (settingsId) {
      const { error } = await supabase.from("business_settings").update(form).eq("id", settingsId);
      if (error) toast.error(error.message); else toast.success("Settings saved");
    } else {
      const { data, error } = await supabase.from("business_settings").insert(form).select().single();
      if (error) toast.error(error.message);
      else { toast.success("Settings saved"); setSettingsId(data.id); }
    }
    setSaving(false);
  };

  const fields = [
    { key: "company_name", label: "Company Name" },
    { key: "company_address", label: "Address" },
    { key: "company_phone", label: "Phone" },
    { key: "company_email", label: "Email" },
    { key: "gst_number", label: "GST Number" },
    { key: "invoice_prefix", label: "Invoice Prefix" },
    { key: "quotation_prefix", label: "Quotation Prefix" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Business Settings</CardTitle>
        <CardDescription>Company information and preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-2xl">
        {fields.map(f => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <Input value={(form as any)[f.key]} onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
          </div>
        ))}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Settings
        </Button>
      </CardContent>
    </Card>
  );
}

function IntegrationsTab() {
  const [integrations, setIntegrations] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("business_settings").select("integrations").limit(1).single().then(({ data }) => {
      if (data?.integrations && typeof data.integrations === "object") {
        setIntegrations(data.integrations as Record<string, string>);
      }
    });
  }, []);

  const updateField = (key: string, value: string) => {
    setIntegrations(prev => ({ ...prev, [key]: value }));
  };

  const saveIntegrations = async () => {
    setSaving(true);
    const { data: existing } = await supabase.from("business_settings").select("id").limit(1).single();
    if (existing) {
      const { error } = await supabase.from("business_settings").update({ integrations }).eq("id", existing.id);
      if (error) toast.error(error.message); else toast.success("Integration settings saved");
    } else {
      const { error } = await supabase.from("business_settings").insert({ integrations }).select().single();
      if (error) toast.error(error.message); else toast.success("Integration settings saved");
    }
    setSaving(false);
  };

  const integrationGroups = [
    { title: "Payment Gateway (Razorpay)", fields: [{ key: "razorpay_api_key", label: "API Key" }, { key: "razorpay_secret", label: "Secret Key" }] },
    { title: "Payment Gateway (CCAvenue)", fields: [{ key: "ccavenue_merchant_id", label: "Merchant ID" }, { key: "ccavenue_access_code", label: "Access Code" }, { key: "ccavenue_working_key", label: "Working Key" }] },
    { title: "Payment Gateway (PhonePe)", fields: [{ key: "phonepe_merchant_id", label: "Merchant ID" }, { key: "phonepe_salt_key", label: "Salt Key" }, { key: "phonepe_salt_index", label: "Salt Index" }] },
    { title: "SMS API", fields: [{ key: "sms_api_url", label: "API Endpoint" }, { key: "sms_api_key", label: "API Key" }, { key: "sms_sender_id", label: "Sender ID" }, { key: "sms_dlt_entity_id", label: "DLT Entity ID" }] },
    { title: "Email (SMTP)", fields: [{ key: "smtp_host", label: "SMTP Host" }, { key: "smtp_port", label: "SMTP Port" }, { key: "smtp_user", label: "Username" }, { key: "smtp_pass", label: "Password" }] },
    { title: "Biometric (Hikvision)", fields: [{ key: "hik_device_ip", label: "Device IP" }, { key: "hik_username", label: "Username" }, { key: "hik_password", label: "Password" }] },
  ];

  return (
    <div className="grid gap-6 max-w-2xl">
      {integrationGroups.map(integration => (
        <Card key={integration.title}>
          <CardHeader>
            <CardTitle className="text-base">{integration.title}</CardTitle>
            <CardDescription>Configure credentials for this integration</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {integration.fields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label>{field.label}</Label>
                <Input
                  type="password"
                  placeholder={`Enter ${field.label.toLowerCase()}`}
                  value={integrations[field.key] || ""}
                  onChange={e => updateField(field.key, e.target.value)}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <Button onClick={saveIntegrations} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save All Integrations
      </Button>
    </div>
  );
}
