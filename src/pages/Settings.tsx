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
  Camera, FileText, Save, Loader2, Plus, Pencil, Trash2, File, Clock,
  Cloud, TestTube, RefreshCw, CreditCard, Globe, Copy, CheckCircle2, Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account, organization, and integrations</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Vertical Sidebar Navigation */}
        <div className="lg:w-64 shrink-0">
          <Card className="sticky top-4">
            <CardContent className="p-2">
              {groups.map(group => (
                <div key={group} className="mb-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-3 py-2">{group}</p>
                  {visibleSections.filter(s => s.group === group).map(section => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        onClick={() => setActiveSection(section.id)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors text-left",
                          activeSection === section.id
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {section.label}
                      </button>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {renderContent()}
        </div>
      </div>
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
interface EmployeeLink { id: string; name: string; designation: string | null; role: string | null; }

function UsersTab() {
  const [users, setUsers] = useState<(UserWithRole & { employee?: EmployeeLink | null })[]>([]);
  const [loading, setLoading] = useState(true);

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
      return {
        profile: p,
        role: (roles.find(r => r.user_id === p.user_id)?.role || "staff") as AppRole,
        employee: emp ? { id: emp.id, name: emp.name, designation: emp.designation, role: emp.role } : null,
      };
    }));
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
      <CardHeader><CardTitle>User Management</CardTitle><CardDescription>Manage user accounts and roles. Auth role determines access level. Employee link shows HR record.</CardDescription></CardHeader>
      <CardContent>
        {loading ? <p className="text-muted-foreground py-6 text-center">Loading...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Auth Role</TableHead><TableHead>Employee Link</TableHead><TableHead>Change Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.profile.user_id}>
                  <TableCell className="font-medium">{u.profile.full_name || "—"}</TableCell>
                  <TableCell>{u.profile.phone || "—"}</TableCell>
                  <TableCell><Badge className={roleColors[u.role]}>{u.role}</Badge></TableCell>
                  <TableCell>
                    {u.employee ? (
                      <div className="text-xs">
                        <span className="font-medium text-foreground">{u.employee.designation || u.employee.role || "Employee"}</span>
                        <span className="text-muted-foreground ml-1">({u.employee.name})</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Not linked</span>
                    )}
                  </TableCell>
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

        <Separator className="my-4" />
        <h3 className="text-sm font-semibold text-foreground">Bank Details</h3>
        <p className="text-xs text-muted-foreground mb-2">Displayed on quotations and invoices for customer payment</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5"><Label>Bank Name</Label><Input value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} placeholder="e.g. HDFC Bank" /></div>
          <div className="space-y-1.5"><Label>Account Number</Label><Input value={form.bank_account_number} onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>IFSC Code</Label><Input value={form.bank_ifsc} onChange={e => setForm(p => ({ ...p, bank_ifsc: e.target.value }))} /></div>
          <div className="space-y-1.5"><Label>Branch</Label><Input value={form.bank_branch} onChange={e => setForm(p => ({ ...p, bank_branch: e.target.value }))} /></div>
        </div>
        <div className="space-y-1.5"><Label>UPI ID</Label><Input value={form.bank_upi_id} onChange={e => setForm(p => ({ ...p, bank_upi_id: e.target.value }))} placeholder="e.g. business@upi" /></div>
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
      gst_number: form.gst_number, gst_state_code: form.gst_state_code, gst_type: form.gst_type,
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
    if (!files || files.length === 0) return;
    setUploading(true);
    const file = files[0];
    const ext = file.name.split(".").pop();
    const path = `signatures/signature_${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("uploads").upload(path, file);
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
    setSignatureUrl(urlData.publicUrl);
    setUploading(false);
    toast.success("Signature uploaded");
  };

  const saveSettings = async () => {
    if (!settingsId) return;
    setSaving(true);
    const { data: current } = await supabase.from("business_settings").select("integrations").eq("id", settingsId).single();
    const existing = (current?.integrations as Record<string, any>) || {};
    const updated = { ...existing, signature_url: signatureUrl, show_signature_quotations: showOnQuotations, show_signature_invoices: showOnInvoices };
    const { error } = await supabase.from("business_settings").update({ integrations: updated }).eq("id", settingsId);
    if (error) toast.error(error.message); else toast.success("Document settings saved");
    setSaving(false);
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Signature Settings</CardTitle><CardDescription>Upload a signature image for documents</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {signatureUrl && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <img src={signatureUrl} alt="Signature" className="max-h-20 w-auto" />
            </div>
          )}
          <div>
            <Label>Upload Signature Image</Label>
            <label className="mt-2 flex items-center gap-2 text-sm text-primary cursor-pointer">
              <Camera className="h-4 w-4" /> {uploading ? "Uploading..." : "Choose file"}
              <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files)} disabled={uploading} />
            </label>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Show on Quotations</Label>
              <input type="checkbox" checked={showOnQuotations} onChange={e => setShowOnQuotations(e.target.checked)} className="h-4 w-4 rounded border-border" />
            </div>
            <div className="flex items-center justify-between">
              <Label>Show on Invoices</Label>
              <input type="checkbox" checked={showOnInvoices} onChange={e => setShowOnInvoices(e.target.checked)} className="h-4 w-4 rounded border-border" />
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Document Settings</Button>
        </CardContent>
      </Card>
    </div>
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
  fields: { key: string; label: string; type?: string; placeholder?: string; readOnly?: boolean; copyable?: boolean }[];
  integrations: Record<string, string>;
  updateField: (k: string, v: string) => void;
}) {
  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle><CardDescription>{description}</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {fields.map(f => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}</Label>
            <div className="flex gap-2">
              <Input
                type={f.type || "text"}
                placeholder={f.placeholder || `Enter ${f.label.toLowerCase()}`}
                value={integrations[f.key] || ""}
                onChange={e => updateField(f.key, e.target.value)}
                readOnly={f.readOnly}
                className={f.readOnly ? "bg-muted" : ""}
              />
              {f.copyable && (
                <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(integrations[f.key] || "")}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
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
  const { integrations, updateField, saveIntegrations, saving: intSaving } = useIntegrations();
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`;
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
      if (error) toast.error(error.message); else toast.success("WhatsApp settings saved");
    }
    // Also save integrations (for webhook verify token, fb app id/secret)
    await saveIntegrations();
    setSaving(false);
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Facebook Developer Portal</CardTitle>
          <CardDescription>Configure these settings for webhook verification in your Facebook App</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Facebook App ID</Label>
            <Input value={integrations["fb_app_id"] || ""} onChange={e => updateField("fb_app_id", e.target.value)} placeholder="Enter Facebook App ID" />
          </div>
          <div className="space-y-1.5">
            <Label>Facebook App Secret</Label>
            <Input type="password" value={integrations["fb_app_secret"] || ""} onChange={e => updateField("fb_app_secret", e.target.value)} placeholder="Enter Facebook App Secret" />
          </div>
          <div className="space-y-1.5">
            <Label>Webhook Verify Token</Label>
            <div className="flex gap-2">
              <Input value={verifyToken} readOnly className="bg-muted font-mono text-xs" />
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(verifyToken)}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Enter this token in the Facebook Developer Portal webhook configuration</p>
          </div>
          <div className="space-y-1.5">
            <Label>Webhook Callback URL</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="bg-muted font-mono text-xs" />
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(webhookUrl)}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Enter this URL in the Facebook Developer Portal → WhatsApp → Configuration → Webhook</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving || intSaving}>{(saving || intSaving) ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save WhatsApp Settings</Button>

      <WhatsAppAutomationSection />
    </div>
  );
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
    if (error) toast.error(error.message);
    else { toast.success("Template created"); fetchTemplates(); }
  };

  const removeAutomation = async (templateId: string) => {
    const { error } = await supabase.from("templates").update({ event_type: null } as any).eq("id", templateId);
    if (error) toast.error(error.message);
    else { toast.success("Automation removed"); fetchTemplates(); }
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
      if (result.data?.success) toast.success(`Test sent via ${result.data.channel}`);
      else if (result.data?.skipped) toast.info("No template configured for this event");
      else toast.error(result.data?.error || "Test failed");
    } catch (e) {
      toast.error("Failed to test automation");
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" /> WhatsApp Automation
        </CardTitle>
        <CardDescription>Auto-send WhatsApp messages on key events. Falls back to SMS if WhatsApp is unavailable.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="space-y-3">
            {AUTOMATION_EVENTS.map(evt => {
              const tpl = getTemplateForEvent(evt.id);
              return (
                <div key={evt.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{evt.label}</p>
                    <p className="text-xs text-muted-foreground">{evt.desc}</p>
                    {tpl && <p className="text-xs text-primary mt-1 truncate max-w-[300px]">Template: {tpl.name}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {tpl ? (
                      <>
                        <Badge className="bg-success/10 text-success text-xs">Active</Badge>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => testAutomation(evt.id)}>
                          <TestTube className="h-3 w-3 mr-1" /> Test
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => removeAutomation(tpl.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => createDefaultTemplate(evt.id, evt.label)}>
                        <Plus className="h-3 w-3 mr-1" /> Enable
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Razorpay Tab ───────────────────────────────────────────────
function RazorpayTab() {
  const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-webhook`;

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="grid gap-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><CreditCard className="h-4 w-4" /> Razorpay Payment Gateway</CardTitle>
          <CardDescription>Configure Razorpay for accepting online payments on invoices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Key ID</Label><Input value={integrations["razorpay_key_id"] || ""} onChange={e => updateField("razorpay_key_id", e.target.value)} placeholder="rzp_live_xxxxxxxxxxxx" /></div>
          <div className="space-y-1.5"><Label>Key Secret</Label><Input type="password" value={integrations["razorpay_key_secret"] || ""} onChange={e => updateField("razorpay_key_secret", e.target.value)} placeholder="Enter Key Secret" /></div>
          <div className="space-y-1.5"><Label>Webhook Secret</Label><Input type="password" value={integrations["razorpay_webhook_secret"] || ""} onChange={e => updateField("razorpay_webhook_secret", e.target.value)} placeholder="Enter Webhook Secret" /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Razorpay Dashboard Configuration</CardTitle>
          <CardDescription>Configure this webhook URL in your Razorpay Dashboard → Settings → Webhooks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Webhook URL</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="bg-muted font-mono text-xs" />
              <Button variant="outline" size="icon" className="shrink-0" onClick={() => copyToClipboard(webhookUrl)}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground">Add this URL in Razorpay Dashboard → Settings → Webhooks. Select events: <code className="text-[10px] bg-muted px-1 rounded">payment.captured</code>, <code className="text-[10px] bg-muted px-1 rounded">payment_link.paid</code></p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-1">
            <p className="font-medium text-foreground">Setup Instructions:</p>
            <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
              <li>Go to <span className="font-medium text-foreground">Razorpay Dashboard</span> → Settings → Webhooks</li>
              <li>Click <span className="font-medium text-foreground">Add New Webhook</span></li>
              <li>Paste the Webhook URL above</li>
              <li>Enter the same Webhook Secret you configured above</li>
              <li>Select events: <code className="bg-background px-1 rounded">payment.captured</code> and <code className="bg-background px-1 rounded">payment_link.paid</code></li>
              <li>Save the webhook</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={saveIntegrations} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Save Razorpay Settings</Button>
        <p className="text-xs text-muted-foreground self-center">Note: Backend secrets (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET) are configured separately as backend secrets.</p>
      </div>
    </div>
  );
}

// ─── Hikvision Tab ──────────────────────────────────────────────
function HikvisionTab() {
  const { integrations, updateField, saveIntegrations, saving } = useIntegrations();
  const [step, setStep] = useState(1);
  const [appKey, setAppKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showAppKey, setShowAppKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [credentialStatus, setCredentialStatus] = useState<"idle" | "valid" | "invalid">("idle");
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialInfo, setCredentialInfo] = useState<{ areaDomain?: string } | null>(null);

  // Step 2: Sites
  const [sites, setSites] = useState<Array<{ id: string; siteName: string; deviceCount?: number }>>([]);
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

  useEffect(() => {
    // Load saved devices from DB
    supabase.from("hikvision_devices").select("*").order("created_at").then(({ data }) => setSavedDevices(data || []));
    // Auto-advance if credentials already set
    if (integrations["hik_default_site_id"]) setSelectedSiteId(integrations["hik_default_site_id"]);
  }, [integrations]);

  const saveAndTestCredentials = async () => {
    if (!appKey || !secretKey) { toast.error("Both App Key and Secret Key are required"); return; }
    setSavingCredentials(true);
    setCredentialStatus("idle");
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "save-credentials", appKey, secretKey },
      });
      if (error) throw error;
      if (data?.success) {
        setCredentialStatus("valid");
        setCredentialInfo({ areaDomain: data.areaDomain });
        toast.success("Credentials validated! Proceed to select your site.");
        setStep(2);
      } else {
        setCredentialStatus("invalid");
        toast.error(data?.error || "Invalid credentials");
      }
    } catch (e: any) {
      setCredentialStatus("invalid");
      toast.error(e.message || "Credential validation failed");
    }
    setSavingCredentials(false);
  };

  const discoverSites = async () => {
    setLoadingSites(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", { body: { action: "site-search" } });
      if (error) throw error;
      if (data?.success) {
        setSites(data.sites || []);
        toast.success(`Found ${data.sites?.length || 0} sites`);
      } else toast.error(data?.error || "Failed to discover sites");
    } catch (e: any) { toast.error(e.message); }
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
      if (error) throw error;
      if (data?.success) {
        setCloudDevices(data.devices || []);
        toast.success(`Found ${data.devices?.length || 0} devices`);
      } else toast.error(data?.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    setLoadingDevices(false);
  };

  const importAllDevices = async () => {
    setImportingDevices(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "list-cloud-devices", import_devices: true },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success(`Imported ${data.imported || 0} devices`);
        const { data: devs } = await supabase.from("hikvision_devices").select("*").order("created_at");
        setSavedDevices(devs || []);
        setStep(4);
      } else toast.error(data?.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    setImportingDevices(false);
  };

  const runDeviceSync = async (deviceId: string, deviceSerial: string, action: string) => {
    setSyncingAction(`${deviceId}-${action}`);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action, device_id: deviceId, device_serial: deviceSerial },
      });
      if (error) throw error;
      setSyncResults(prev => ({ ...prev, [`${deviceId}-${action}`]: data }));
      if (data?.success) toast.success(`${action.replace(/-/g, " ")} completed — ${data.records_synced || 0} records`);
      else toast.error(data?.error || "Failed");
    } catch (e: any) { toast.error(e.message); }
    setSyncingAction(null);
  };

  const STEPS = [
    { num: 1, label: "Credentials" },
    { num: 2, label: "Select Site" },
    { num: 3, label: "Devices" },
    { num: 4, label: "Sync" },
  ];

  return (
    <div className="grid gap-6 max-w-3xl">
      {/* Stepper Header */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, idx) => (
          <div key={s.num} className="flex items-center gap-2">
            <button
              onClick={() => setStep(s.num)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                step === s.num ? "bg-primary text-primary-foreground" :
                step > s.num ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
              )}
            >
              <span className="h-5 w-5 rounded-full bg-background/20 flex items-center justify-center text-[10px] font-bold">{step > s.num ? "✓" : s.num}</span>
              {s.label}
            </button>
            {idx < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 1: Credentials */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5" /> Hik-Partner Pro Cloud API</CardTitle>
            <CardDescription>Enter your App Key and Secret Key from the Hik-Partner Pro developer portal. These are stored as backend secrets.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>App Key</Label>
                <div className="relative">
                  <Input type={showAppKey ? "text" : "password"} value={appKey} onChange={e => setAppKey(e.target.value)} placeholder="Enter App Key" />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowAppKey(!showAppKey)}>
                    {showAppKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Secret Key</Label>
                <div className="relative">
                  <Input type={showSecretKey ? "text" : "password"} value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="Enter Secret Key" />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground" onClick={() => setShowSecretKey(!showSecretKey)}>
                    {showSecretKey ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
            {credentialStatus !== "idle" && (
              <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${credentialStatus === "valid" ? "bg-success/10 text-success border border-success/20" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
                <span className={`h-2.5 w-2.5 rounded-full ${credentialStatus === "valid" ? "bg-success" : "bg-destructive"}`} />
                {credentialStatus === "valid" ? `Credentials valid. Area Domain: ${credentialInfo?.areaDomain || "detected"}` : "Invalid credentials. Check your App Key and Secret Key."}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={saveAndTestCredentials} disabled={savingCredentials || !appKey || !secretKey}>
                {savingCredentials ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <TestTube className="h-4 w-4 mr-2" />}Validate & Continue
              </Button>
              {credentialStatus === "valid" && (
                <Button variant="outline" onClick={() => setStep(2)}>Skip to Sites →</Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Note: API keys are already stored as backend secrets (HIK_PARTNER_APP_KEY, HIK_PARTNER_SECRET_KEY). This validates them before proceeding.</p>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Site Selection */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Discover & Select Site</CardTitle>
              <CardDescription>Discover all sites linked to your Hik-Partner Pro account, then select your default site.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={discoverSites} disabled={loadingSites}>
                {loadingSites ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}Discover Sites
              </Button>

              {sites.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Site Name</TableHead><TableHead>Site ID</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {sites.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.siteName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{s.id}</TableCell>
                        <TableCell>
                          {selectedSiteId === s.id ? (
                            <Badge className="bg-success/10 text-success"><CheckCircle2 className="h-3 w-3 mr-1" />Default</Badge>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => selectSite(s.id)}>Set Default</Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {selectedSiteId && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success border border-success/20 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  Default site set: <span className="font-mono text-xs">{selectedSiteId}</span>
                </div>
              )}
            </CardContent>
          </Card>
          {selectedSiteId && (
            <Button onClick={() => setStep(3)}>Continue to Devices →</Button>
          )}
        </div>
      )}

      {/* Step 3: Device Discovery */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Device Discovery</CardTitle>
              <CardDescription>Discover biometric devices from your cloud account and import them.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={discoverDevices} disabled={loadingDevices} variant="outline">
                  {loadingDevices ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Cloud className="h-4 w-4 mr-2" />}Discover Devices
                </Button>
                {cloudDevices.length > 0 && (
                  <Button onClick={importAllDevices} disabled={importingDevices}>
                    {importingDevices ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Import All Devices
                  </Button>
                )}
              </div>

              {cloudDevices.length > 0 && (
                <Table>
                  <TableHeader><TableRow><TableHead>Device Name</TableHead><TableHead>Serial</TableHead><TableHead>Model</TableHead><TableHead>Site</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {cloudDevices.map((d: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{d.deviceName || d.deviceSerial}</TableCell>
                        <TableCell className="font-mono text-xs">{d.deviceSerial}</TableCell>
                        <TableCell>{d.deviceModel || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d._siteName || "—"}</TableCell>
                        <TableCell>
                          <Badge className={String(d.deviceOnlineStatus) === "1" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                            {String(d.deviceOnlineStatus) === "1" ? "Online" : "Offline"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Saved Devices */}
          {savedDevices.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Saved Devices ({savedDevices.length})</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Serial</TableHead><TableHead>Model</TableHead><TableHead>Status</TableHead><TableHead>Last Sync</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {savedDevices.map(d => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">{d.name}</TableCell>
                        <TableCell className="font-mono text-xs">{d.device_serial}</TableCell>
                        <TableCell>{d.device_model || "—"}</TableCell>
                        <TableCell><Badge className={d.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{d.status}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{d.last_sync_at ? new Date(d.last_sync_at).toLocaleString() : "Never"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Button onClick={() => setStep(4)} disabled={savedDevices.length === 0}>Continue to Sync →</Button>
        </div>
      )}

      {/* Step 4: Sync Actions */}
      {step === 4 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sync Actions</CardTitle>
              <CardDescription>Run sync operations per device. Select a device and choose the sync action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {savedDevices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No saved devices. Go back to Step 3 to import devices first.</p>
              ) : (
                savedDevices.map(d => (
                  <div key={d.id} className="border border-border rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{d.device_serial} · {d.device_model || "Unknown model"}</p>
                      </div>
                      <Badge className={d.status === "active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>{d.status}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { action: "sync-employees", label: "Sync Employees", icon: User },
                        { action: "sync-attendance", label: "Sync Attendance", icon: Clock },
                        { action: "sync-departments", label: "Sync Departments", icon: Building2 },
                        { action: "full-sync", label: "Full Sync", icon: RefreshCw },
                      ].map(btn => {
                        const isRunning = syncingAction === `${d.id}-${btn.action}`;
                        const result = syncResults[`${d.id}-${btn.action}`];
                        return (
                          <div key={btn.action} className="flex flex-col items-start">
                            <Button
                              size="sm" variant="outline"
                              onClick={() => runDeviceSync(d.id, d.device_serial || d.ip_address, btn.action)}
                              disabled={!!syncingAction}
                            >
                              {isRunning ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <btn.icon className="h-3.5 w-3.5 mr-1.5" />}
                              {btn.label}
                            </Button>
                            {result && (
                              <span className={`text-[10px] mt-1 ${result.success ? "text-success" : "text-destructive"}`}>
                                {result.success ? `✓ ${result.records_synced || 0} records` : `✗ ${result.error?.substring(0, 40)}`}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Manual Employee Mapping */}
          <ManualEmployeeMapping savedDevices={savedDevices} />

          {/* Sync Status Dashboard */}
          <HikvisionSyncDashboard />
        </div>
      )}
    </div>
  );
}

// ─── Manual Employee Mapping ────────────────────────────────────
function ManualEmployeeMapping({ savedDevices }: { savedDevices: Array<{ id: string; name: string; device_serial?: string }> }) {
  const [empCode, setEmpCode] = useState("");
  const [empName, setEmpName] = useState("");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [saving, setSaving] = useState(false);
  const [mappings, setMappings] = useState<Array<{ id: string; device_employee_code: string; device_employee_name: string | null; erp_employee_id: string | null }>>([]);

  const loadMappings = async () => {
    const { data } = await supabase.from("hikvision_employee_mapping").select("id, device_employee_code, device_employee_name, erp_employee_id").order("created_at", { ascending: false }).limit(20);
    setMappings(data || []);
  };

  useEffect(() => { loadMappings(); if (savedDevices.length > 0) setSelectedDevice(savedDevices[0].id); }, [savedDevices]);

  const handleAdd = async () => {
    if (!empCode.trim()) { toast.error("Employee code is required"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("hikvision-sync", {
        body: { action: "manual-add-employee", device_id: selectedDevice || null, employee_code: empCode.trim(), employee_name: empName.trim() || undefined },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || "Failed");
      toast.success(data.message || "Employee mapped");
      setEmpCode(""); setEmpName("");
      loadMappings();
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><Plus className="h-4 w-4" /> Manual Employee Mapping</CardTitle>
        <CardDescription>If cloud sync isn't available, manually enter device employee codes to link with your system. You can find these codes on the biometric device's user list.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Employee Code (from device)</Label>
            <Input placeholder="e.g. 1001" value={empCode} onChange={e => setEmpCode(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Employee Name</Label>
            <Input placeholder="e.g. Rajat" value={empName} onChange={e => setEmpName(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Device</Label>
            <Select value={selectedDevice} onValueChange={setSelectedDevice}>
              <SelectTrigger><SelectValue placeholder="Select device" /></SelectTrigger>
              <SelectContent>
                {savedDevices.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
          Add Mapping
        </Button>
        {mappings.length > 0 && (
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Name</TableHead><TableHead className="text-xs">Linked</TableHead></TableRow></TableHeader>
              <TableBody>
                {mappings.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-mono">{m.device_employee_code}</TableCell>
                    <TableCell className="text-xs">{m.device_employee_name || "—"}</TableCell>
                    <TableCell>{m.erp_employee_id ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <span className="text-xs text-muted-foreground">Not linked</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Hikvision Sync Dashboard ───────────────────────────────────
function HikvisionSyncDashboard() {
  const [syncLogs, setSyncLogs] = useState<Array<{ id: string; action: string; status: string; records_synced: number | null; error_message: string | null; created_at: string }>>([]);
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

  if (loading) return null;

  const lastSync = syncLogs.length > 0 ? syncLogs[0] : null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Sync Status Dashboard</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{deviceCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Devices</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{mappedCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Mapped Employees</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-sm font-medium text-foreground">{lastSync ? new Date(lastSync.created_at).toLocaleString() : "Never"}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Last Sync</p>
          </div>
        </div>

        {syncLogs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Sync Logs</p>
            <div className="space-y-1.5">
              {syncLogs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${log.status === "success" ? "bg-green-500" : "bg-red-500"}`} />
                    <span className="font-medium">{log.action}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.records_synced != null && <span className="text-muted-foreground">{log.records_synced} records</span>}
                    <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Templates Tab ──────────────────────────────────────────────
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

// ─── Service Categories Tab ─────────────────────────────────────
function ServiceCategoriesTab() {
  const [categories, setCategories] = useState<{ id: string; name: string; default_charge: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", default_charge: "" });
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    setLoading(true);
    const { data } = await supabase.from("service_charge_categories").select("*").order("name");
    if (data) setCategories(data);
    setLoading(false);
  };

  useEffect(() => { fetchCategories(); }, []);

  const save = async () => {
    setSaving(true);
    const payload = { name: form.name, default_charge: parseFloat(form.default_charge) || 0 };
    if (editId) {
      const { error } = await supabase.from("service_charge_categories").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else { toast.success("Category updated"); setEditId(null); setForm({ name: "", default_charge: "" }); fetchCategories(); }
    } else {
      const { error } = await supabase.from("service_charge_categories").insert(payload);
      if (error) toast.error(error.message); else { toast.success("Category added"); setForm({ name: "", default_charge: "" }); fetchCategories(); }
    }
    setSaving(false);
  };

  const deleteCategory = async (id: string) => {
    const { error } = await supabase.from("service_charge_categories").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchCategories(); }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader><CardTitle>{editId ? "Edit Category" : "Add Service Category"}</CardTitle><CardDescription>Set default service charges per device type</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>Category Name</Label><Input placeholder="e.g. iPhone" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Default Charge (₹)</Label><Input type="number" placeholder="e.g. 750" value={form.default_charge} onChange={e => setForm(p => ({ ...p, default_charge: e.target.value }))} /></div>
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving || !form.name}>{saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}{editId ? "Update" : "Add Category"}</Button>
            {editId && <Button variant="outline" onClick={() => { setEditId(null); setForm({ name: "", default_charge: "" }); }}>Cancel</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Existing Categories</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground py-4 text-center text-sm">Loading...</p> : (
            <Table>
              <TableHeader>
                <TableRow><TableHead>Device Category</TableHead><TableHead>Default Charge</TableHead><TableHead className="w-24">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {categories.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>₹{c.default_charge.toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditId(c.id); setForm({ name: c.name, default_charge: String(c.default_charge) }); }}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteCategory(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
