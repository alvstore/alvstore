import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Search, Wrench, Pencil, ShieldCheck, AlertTriangle, Users, CheckCircle2, Clock, IndianRupee, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/AvatarUpload";
import { Textarea } from "@/components/ui/textarea";

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
  const { hasRole, user } = useAuth();
  const isAdmin = hasRole("admin");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [activeJobs, setActiveJobs] = useState<Record<string, number>>({});

  // Ledger state
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerTech, setLedgerTech] = useState<Technician | null>(null);
  const [ledgerPayments, setLedgerPayments] = useState<any[]>([]);
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", notes: "", payment_mode: "cash", job_sheet_id: "" });
  const [techJobSheets, setTechJobSheets] = useState<any[]>([]);

  const fetchTechnicians = async () => {
    setLoading(true);
    let query = supabase.from("employees").select("*").eq("role", "technician").order("created_at", { ascending: false });
    if (search) query = query.ilike("name", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setTechnicians((data || []) as Technician[]);

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

  // Ledger functions
  const openLedger = async (t: Technician) => {
    setLedgerTech(t);
    const techId = t.user_id || t.id;
    const { data } = await supabase.from("technician_payments").select("*").eq("technician_id", techId).order("created_at", { ascending: false });
    setLedgerPayments(data || []);

    // Get unpaid job sheets for this technician
    const { data: js } = await supabase.from("job_sheets").select("id, job_number, technician_payment, technician_payment_status")
      .eq("assigned_technician_id", techId)
      .eq("technician_payment_status", "pending");
    setTechJobSheets(js || []);
    setLedgerOpen(true);
  };

  const markAsPaid = async (payment: any) => {
    // Create finance expense transaction
    const { data: accounts } = await supabase.from("finance_accounts").select("id").limit(1);
    let finTxnId: string | null = null;
    if (accounts && accounts.length > 0) {
      const { data: txn } = await supabase.from("finance_transactions").insert({
        type: "expense", amount: payment.amount, account_id: accounts[0].id,
        description: `Tech payment: ${ledgerTech?.name}`, reference: `TP-${payment.id.slice(0, 8)}`,
        created_by: user?.id,
      } as any).select().single();
      finTxnId = txn?.id || null;
    }

    await supabase.from("technician_payments").update({
      status: "paid", payment_date: new Date().toISOString().split("T")[0],
      finance_transaction_id: finTxnId,
    } as any).eq("id", payment.id);

    toast.success("Payment marked as paid & synced to Finance");
    openLedger(ledgerTech!);
  };

  const addPaymentRecord = async () => {
    if (!paymentForm.amount || parseFloat(paymentForm.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    const techId = ledgerTech?.user_id || ledgerTech?.id;
    await supabase.from("technician_payments").insert({
      technician_id: techId, amount: parseFloat(paymentForm.amount),
      notes: paymentForm.notes || null, payment_mode: paymentForm.payment_mode,
      job_sheet_id: paymentForm.job_sheet_id || null, created_by: user?.id,
    } as any);

    // Update job sheet tech payment status if linked
    if (paymentForm.job_sheet_id) {
      await supabase.from("job_sheets").update({ technician_payment_status: "recorded" } as any).eq("id", paymentForm.job_sheet_id);
    }

    toast.success("Payment record added");
    setPaymentSheetOpen(false);
    setPaymentForm({ amount: "", notes: "", payment_mode: "cash", job_sheet_id: "" });
    openLedger(ledgerTech!);
  };

  const stats = {
    total: technicians.length,
    active: technicians.filter(t => t.status === "active").length,
    withLogin: technicians.filter(t => t.user_id).length,
    totalActiveJobs: Object.values(activeJobs).reduce((s, v) => s + v, 0),
  };

  const ledgerTotals = {
    total: ledgerPayments.reduce((s, p) => s + (p.amount || 0), 0),
    paid: ledgerPayments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0),
    unpaid: ledgerPayments.filter(p => p.status === "unpaid").reduce((s, p) => s + (p.amount || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Technicians</h1>
          <p className="text-muted-foreground">Manage repair technicians & payment ledger</p>
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
              <TableHead className="w-28">Actions</TableHead>
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
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openLedger(t)} title="Ledger"><BookOpen className="h-4 w-4" /></Button>
                      {isAdmin && <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Technician Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Technician" : "Add Technician"}</SheetTitle>
            <SheetDescription>Manage technician details and login</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="flex items-center gap-4">
              <AvatarUpload
                currentUrl={editId ? technicians.find(t => t.id === editId)?.avatar_url : undefined}
                name={form.name}
                folder="technicians"
                entityId={editId || undefined}
                onUploaded={async (url) => {
                  if (editId) {
                    await supabase.from("employees").update({ avatar_url: url } as any).eq("id", editId);
                    fetchTechnicians();
                  }
                }}
              />
              <div className="flex-1 space-y-1.5"><Label>Full Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            </div>
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

      {/* Payment Ledger Dialog */}
      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" /> Payment Ledger — {ledgerTech?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Earnings</p>
                <p className="text-xl font-bold">₹{ledgerTotals.total.toLocaleString()}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="text-xl font-bold text-success">₹{ledgerTotals.paid.toLocaleString()}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Unpaid</p>
                <p className="text-xl font-bold text-destructive">₹{ledgerTotals.unpaid.toLocaleString()}</p>
              </CardContent></Card>
            </div>

            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-sm">Payment Records</h3>
              <Button size="sm" onClick={() => setPaymentSheetOpen(true)}><Plus className="h-3 w-3 mr-1" />Add Record</Button>
            </div>

            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead>
                <TableHead>Notes</TableHead><TableHead>Status</TableHead><TableHead className="w-24">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ledgerPayments.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No payment records</TableCell></TableRow>
                ) : ledgerPayments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono font-medium">₹{(p.amount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm capitalize">{p.payment_mode || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{p.notes || "—"}</TableCell>
                    <TableCell><Badge variant={p.status === "paid" ? "default" : "destructive"}>{p.status}</Badge></TableCell>
                    <TableCell>
                      {p.status === "unpaid" && (
                        <Button variant="outline" size="sm" onClick={() => markAsPaid(p)}>Pay</Button>
                      )}
                      {p.status === "paid" && p.finance_transaction_id && (
                        <span className="text-[10px] text-success">✓ Synced</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Payment Record Sheet */}
      <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Add Payment Record</SheetTitle>
            <SheetDescription>Record a technician payment for {ledgerTech?.name}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            {techJobSheets.length > 0 && (
              <div className="space-y-1.5">
                <Label>Link to Job Sheet (optional)</Label>
                <Select value={paymentForm.job_sheet_id} onValueChange={v => {
                  const js = techJobSheets.find(j => j.id === v);
                  setPaymentForm(p => ({ ...p, job_sheet_id: v, amount: js?.technician_payment ? String(js.technician_payment) : p.amount }));
                }}>
                  <SelectTrigger><SelectValue placeholder="Select job sheet" /></SelectTrigger>
                  <SelectContent>{techJobSheets.map(j => <SelectItem key={j.id} value={j.id}>{j.job_number} — ₹{j.technician_payment || 0}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5"><Label>Amount *</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Payment Mode</Label>
              <Select value={paymentForm.payment_mode} onValueChange={v => setPaymentForm(p => ({ ...p, payment_mode: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={addPaymentRecord}>Add Payment Record</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
