import { useState, useEffect } from "react";
import { useLocation } from "@/lib/router-compat";
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Receipt, Trash2, CheckCircle, IndianRupee } from "lucide-react";
import { toast } from "sonner";

interface BillItem {
  product_name: string; quantity: number; unit_price: number;
  gst_percentage: number; total: number; product_id?: string | null;
  serial_numbers?: string; batch_number?: string; expiry_date?: string;
}

export default function PurchaseBills() {
  const { user } = useAuth();
  const location = useLocation();
  const [bills, setBills] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", notes: "", bill_date: new Date().toISOString().split("T")[0], due_date: "", po_id: "" });
  const [items, setItems] = useState<BillItem[]>([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);

  const fetchBills = async () => {
    setLoading(true);
    let q = supabase.from("purchase_bills").select("*, suppliers(name)").order("created_at", { ascending: false });
    if (search) q = q.ilike("bill_number", `%${search}%`);
    const { data } = await q;
    setBills(data || []);
    setLoading(false);
  };

  const fetchMasters = async () => {
    const [{ data: s }, { data: p }] = await Promise.all([
      supabase.from("suppliers").select("id, name").eq("status", "active"),
      supabase.from("products").select("id, name, selling_price, gst_percentage"),
    ]);
    setSuppliers(s || []);
    setProducts(p || []);
  };

  useEffect(() => { fetchBills(); fetchMasters(); }, [search]);

  // Handle PO conversion
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromPO) {
      setForm(f => ({ ...f, supplier_id: state.fromPO.supplier_id || "", po_id: state.fromPO.id }));
      if (state.items) {
        setItems(state.items.map((i: any) => ({
          product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price,
          gst_percentage: i.gst_percentage, total: i.total, product_id: i.product_id,
        })));
      }
      setSheetOpen(true);
    }
  }, [location.state]);

  const calcItem = (item: BillItem): BillItem => {
    const base = item.quantity * item.unit_price;
    const gst = base * (item.gst_percentage / 100);
    return { ...item, total: base + gst };
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[idx] = calcItem({ ...updated[idx], [field]: value });
      return updated;
    });
  };

  const addItem = () => setItems(prev => [...prev, { product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.supplier_id) { toast.error("Select a supplier"); return; }
    if (items.some(i => !i.product_name)) { toast.error("All items need a name"); return; }
    setSaving(true);
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const gst_amount = items.reduce((s, i) => s + i.quantity * i.unit_price * (i.gst_percentage / 100), 0);

    const { data: bill, error } = await supabase.from("purchase_bills").insert({
      supplier_id: form.supplier_id, po_id: form.po_id || null,
      notes: form.notes || null, bill_date: form.bill_date, due_date: form.due_date || null,
      subtotal, gst_amount, total: subtotal + gst_amount, created_by: user?.id,
    } as any).select().single();

    if (error || !bill) { toast.error(error?.message || "Failed"); setSaving(false); return; }

    await supabase.from("purchase_bill_items").insert(
      items.map(i => ({
        bill_id: bill.id, product_name: i.product_name, product_id: i.product_id || null,
        quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
        total: i.total, serial_numbers: i.serial_numbers ? i.serial_numbers.split(",").map(s => s.trim()) : null,
        batch_number: i.batch_number || null, expiry_date: i.expiry_date || null,
      } as any))
    );

    // Update PO status if from PO
    if (form.po_id) {
      await supabase.from("purchase_orders").update({ status: "completed", updated_at: new Date().toISOString() } as any).eq("id", form.po_id);
    }

    toast.success("Purchase bill created");
    setSaving(false);
    setSheetOpen(false);
    setForm({ supplier_id: "", notes: "", bill_date: new Date().toISOString().split("T")[0], due_date: "", po_id: "" });
    setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
    fetchBills();
  };

  const confirmBill = async (bill: any) => {
    // 1. Update bill status
    await supabase.from("purchase_bills").update({ status: "confirmed" } as any).eq("id", bill.id);

    // 2. Get bill items and create stock movements
    const { data: billItems } = await supabase.from("purchase_bill_items").select("*").eq("bill_id", bill.id);
    if (billItems) {
      for (const item of billItems) {
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: item.quantity, type: "in",
            reference: `PB: ${bill.bill_number}`, notes: `Purchase bill ${bill.bill_number}`,
            created_by: user?.id,
          } as any);
        }
      }
    }

    // 3. Update supplier outstanding balance
    await supabase.from("suppliers").update({
      outstanding_balance: (bill.suppliers?.outstanding_balance || 0) + (bill.total || 0),
      updated_at: new Date().toISOString(),
    } as any).eq("id", bill.supplier_id);

    // 4. Create finance expense transaction
    const { data: accounts } = await supabase.from("finance_accounts").select("id").limit(1);
    if (accounts && accounts.length > 0) {
      await supabase.from("finance_transactions").insert({
        type: "expense", amount: bill.total || 0, account_id: accounts[0].id,
        description: `Purchase Bill: ${bill.bill_number}`, reference: bill.bill_number,
        date: bill.bill_date, created_by: user?.id,
      } as any);
    }

    toast.success("Bill confirmed, stock updated");
    fetchBills();
  };

  const totalValue = bills.filter(b => b.status !== "cancelled").reduce((s, b) => s + (b.total || 0), 0);
  const totalUnpaid = bills.filter(b => b.payment_status === "unpaid" && b.status !== "cancelled").reduce((s, b) => s + ((b.total || 0) - (b.paid_amount || 0)), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Bills</h1>
          <p className="text-muted-foreground">Manage purchase bills and stock entries</p>
        </div>
        <Button onClick={() => { setForm({ supplier_id: "", notes: "", bill_date: new Date().toISOString().split("T")[0], due_date: "", po_id: "" }); setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Bill
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><Receipt className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{bills.length}</p><p className="text-xs text-muted-foreground">Total Bills</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">{bills.filter(b => b.status === "confirmed").length}</p><p className="text-xs text-muted-foreground">Confirmed</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><IndianRupee className="h-5 w-5 text-info" /></div>
          <div><p className="text-2xl font-bold">₹{totalValue.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Value</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-destructive/10"><IndianRupee className="h-5 w-5 text-destructive" /></div>
          <div><p className="text-2xl font-bold">₹{totalUnpaid.toLocaleString()}</p><p className="text-xs text-muted-foreground">Unpaid</p></div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search bill number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Bill #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
              <TableHead>Total</TableHead><TableHead>Payment</TableHead><TableHead>Status</TableHead><TableHead className="w-28">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {bills.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase bills</TableCell></TableRow>
              ) : bills.map(b => (
                <TableRow key={b.id}>
                  <TableCell className="font-mono text-sm font-medium">{b.bill_number}</TableCell>
                  <TableCell>{b.suppliers?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{b.bill_date}</TableCell>
                  <TableCell className="font-mono">₹{(b.total || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={b.payment_status === "paid" ? "default" : "destructive"}>{b.payment_status}</Badge></TableCell>
                  <TableCell><Badge variant={b.status === "confirmed" ? "default" : "secondary"}>{b.status}</Badge></TableCell>
                  <TableCell>
                    {b.status === "draft" && (
                      <Button variant="outline" size="sm" onClick={() => confirmBill(b)}>Confirm</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Bill Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>New Purchase Bill</SheetTitle>
            <SheetDescription>Record a purchase bill and update stock</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Supplier *</Label>
                <Select value={form.supplier_id} onValueChange={v => setForm(p => ({ ...p, supplier_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Bill Date</Label><Input type="date" value={form.bill_date} onChange={e => setForm(p => ({ ...p, bill_date: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5"><Label>Due Date</Label><Input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))} /></div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Items</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border space-y-2">
                    <div className="flex gap-2">
                      <Select onValueChange={v => {
                        const prod = products.find(p => p.id === v);
                        if (prod) updateItem(idx, "product_name", prod.name);
                        setItems(prev => { const u = [...prev]; u[idx] = calcItem({ ...u[idx], product_id: v, product_name: prod?.name || "", unit_price: prod?.selling_price || 0, gst_percentage: prod?.gst_percentage || 18 }); return u; });
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                    <Input placeholder="Item name" value={item.product_name} onChange={e => updateItem(idx, "product_name", e.target.value)} />
                    <div className="grid grid-cols-4 gap-2">
                      <div><Label className="text-xs">Qty</Label><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} /></div>
                      <div><Label className="text-xs">Price</Label><Input type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} /></div>
                      <div><Label className="text-xs">GST %</Label><Input type="number" value={item.gst_percentage} onChange={e => updateItem(idx, "gst_percentage", parseFloat(e.target.value) || 0)} /></div>
                      <div><Label className="text-xs">Total</Label><Input value={`₹${item.total.toFixed(2)}`} readOnly className="bg-muted" /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Serial #s</Label><Input placeholder="Comma separated" value={item.serial_numbers || ""} onChange={e => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], serial_numbers: e.target.value }; return u; })} /></div>
                      <div><Label className="text-xs">Batch</Label><Input value={item.batch_number || ""} onChange={e => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], batch_number: e.target.value }; return u; })} /></div>
                      <div><Label className="text-xs">Expiry</Label><Input type="date" value={item.expiry_date || ""} onChange={e => setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], expiry_date: e.target.value }; return u; })} /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <p className="text-lg font-bold">Total: ₹{items.reduce((s, i) => s + i.total, 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Purchase Bill"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
