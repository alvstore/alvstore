import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, Building2, Phone, Mail, IndianRupee, TrendingDown, Users, Eye } from "lucide-react";
import { toast } from "sonner";

interface Supplier {
  id: string; name: string; gst_number: string | null; phone: string | null;
  email: string | null; address: string | null; outstanding_balance: number;
  status: string; created_at: string;
}

const emptyForm = { name: "", gst_number: "", phone: "", email: "", address: "" };

export default function Suppliers() {
  const { user } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [ledgerSupplier, setLedgerSupplier] = useState<Supplier | null>(null);
  const [ledgerBills, setLedgerBills] = useState<any[]>([]);

  const fetchSuppliers = async () => {
    setLoading(true);
    let q = supabase.from("suppliers").select("*").order("created_at", { ascending: false });
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setSuppliers((data || []) as Supplier[]);
    setLoading(false);
  };

  useEffect(() => { fetchSuppliers(); }, [search]);

  const openNew = () => { setEditId(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (s: Supplier) => {
    setEditId(s.id);
    setForm({ name: s.name, gst_number: s.gst_number || "", phone: s.phone || "", email: s.email || "", address: s.address || "" });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = { name: form.name, gst_number: form.gst_number || null, phone: form.phone || null, email: form.email || null, address: form.address || null };
    if (editId) {
      const { error } = await supabase.from("suppliers").update({ ...payload, updated_at: new Date().toISOString() } as any).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Supplier updated");
    } else {
      const { error } = await supabase.from("suppliers").insert({ ...payload, created_by: user?.id } as any);
      if (error) toast.error(error.message); else toast.success("Supplier created");
    }
    setSaving(false);
    setSheetOpen(false);
    fetchSuppliers();
  };

  const openLedger = async (s: Supplier) => {
    setLedgerSupplier(s);
    const { data } = await supabase.from("purchase_bills").select("*").eq("supplier_id", s.id).order("created_at", { ascending: false });
    setLedgerBills(data || []);
    setLedgerOpen(true);
  };

  const totalOutstanding = suppliers.reduce((s, v) => s + (v.outstanding_balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground">Manage your suppliers and vendor relationships</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Add Supplier</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{suppliers.length}</p><p className="text-xs text-muted-foreground">Total Suppliers</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><Building2 className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">{suppliers.filter(s => s.status === "active").length}</p><p className="text-xs text-muted-foreground">Active</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><TrendingDown className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-2xl font-bold">₹{totalOutstanding.toLocaleString()}</p><p className="text-xs text-muted-foreground">Outstanding</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><IndianRupee className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{suppliers.filter(s => (s.outstanding_balance || 0) > 0).length}</p><p className="text-xs text-muted-foreground">With Dues</p></div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search suppliers..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Supplier</TableHead>
              <TableHead className="hidden sm:table-cell">Contact</TableHead>
              <TableHead>GST</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No suppliers found</TableCell></TableRow>
              ) : suppliers.map(s => (
                <TableRow key={s.id}>
                  <TableCell><span className="font-medium">{s.name}</span></TableCell>
                  <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      {s.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{s.phone}</span>}
                      {s.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{s.email}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{s.gst_number || "—"}</TableCell>
                  <TableCell>
                    <span className={`font-mono font-medium ${(s.outstanding_balance || 0) > 0 ? "text-destructive" : "text-success"}`}>
                      ₹{(s.outstanding_balance || 0).toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell><Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openLedger(s)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(s)}>Edit</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add/Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Supplier" : "Add Supplier"}</SheetTitle>
            <SheetDescription>Manage supplier details</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>GST Number</Label><Input value={form.gst_number} onChange={e => setForm(p => ({ ...p, gst_number: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Address</Label><Textarea value={form.address} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} rows={3} /></div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : editId ? "Update" : "Create Supplier"}</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Supplier Ledger Dialog */}
      <Dialog open={ledgerOpen} onOpenChange={setLedgerOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Supplier Ledger — {ledgerSupplier?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Total Bills</p>
                <p className="text-lg font-bold">{ledgerBills.length}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="text-lg font-bold text-success">₹{ledgerBills.reduce((s, b) => s + (b.paid_amount || 0), 0).toLocaleString()}</p>
              </CardContent></Card>
              <Card><CardContent className="p-3 text-center">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-lg font-bold text-destructive">₹{(ledgerSupplier?.outstanding_balance || 0).toLocaleString()}</p>
              </CardContent></Card>
            </div>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Bill #</TableHead><TableHead>Date</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ledgerBills.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No bills found</TableCell></TableRow>
                ) : ledgerBills.map(b => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-sm">{b.bill_number}</TableCell>
                    <TableCell className="text-sm">{b.bill_date}</TableCell>
                    <TableCell className="font-mono">₹{(b.total || 0).toLocaleString()}</TableCell>
                    <TableCell className="font-mono">₹{(b.paid_amount || 0).toLocaleString()}</TableCell>
                    <TableCell><Badge variant={b.payment_status === "paid" ? "default" : "destructive"}>{b.payment_status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
