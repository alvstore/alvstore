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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, RotateCcw, Trash2, CheckCircle } from "lucide-react";
import { toast } from "sonner";

interface ReturnItem {
  product_name: string; quantity: number; unit_price: number; total: number;
  product_id?: string | null;
}

export default function PurchaseReturns() {
  const { user } = useAuth();
  const [returns, setReturns] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", reason: "", notes: "", bill_id: "" });
  const [items, setItems] = useState<ReturnItem[]>([{ product_name: "", quantity: 1, unit_price: 0, total: 0 }]);

  const fetchReturns = async () => {
    setLoading(true);
    let q = supabase.from("purchase_returns").select("*, suppliers(name)").order("created_at", { ascending: false });
    if (search) q = q.ilike("return_number", `%${search}%`);
    const { data } = await q;
    setReturns(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchReturns();
    (async () => {
      const [{ data: s }, { data: p }] = await Promise.all([
        supabase.from("suppliers").select("id, name").eq("status", "active"),
        supabase.from("products").select("id, name, selling_price"),
      ]);
      setSuppliers(s || []);
      setProducts(p || []);
    })();
  }, [search]);

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const u = [...prev];
      u[idx] = { ...u[idx], [field]: value };
      u[idx].total = u[idx].quantity * u[idx].unit_price;
      return u;
    });
  };

  const addItem = () => setItems(prev => [...prev, { product_name: "", quantity: 1, unit_price: 0, total: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!form.supplier_id) { toast.error("Select a supplier"); return; }
    setSaving(true);
    const subtotal = items.reduce((s, i) => s + i.total, 0);

    const { data: ret, error } = await supabase.from("purchase_returns").insert({
      supplier_id: form.supplier_id, bill_id: form.bill_id || null,
      reason: form.reason || null, notes: form.notes || null,
      subtotal, total: subtotal, created_by: user?.id,
    } as any).select().single();

    if (error || !ret) { toast.error(error?.message || "Failed"); setSaving(false); return; }

    await supabase.from("purchase_return_items").insert(
      items.map(i => ({
        return_id: ret.id, product_name: i.product_name, product_id: i.product_id || null,
        quantity: i.quantity, unit_price: i.unit_price, total: i.total,
      } as any))
    );

    toast.success("Return created");
    setSaving(false);
    setSheetOpen(false);
    setForm({ supplier_id: "", reason: "", notes: "", bill_id: "" });
    setItems([{ product_name: "", quantity: 1, unit_price: 0, total: 0 }]);
    fetchReturns();
  };

  const confirmReturn = async (ret: any) => {
    await supabase.from("purchase_returns").update({ status: "confirmed" } as any).eq("id", ret.id);

    const { data: retItems } = await supabase.from("purchase_return_items").select("*").eq("return_id", ret.id);
    if (retItems) {
      for (const item of retItems) {
        if (item.product_id) {
          await supabase.from("stock_movements").insert({
            product_id: item.product_id, quantity: item.quantity, type: "out",
            reference: `PR: ${ret.return_number}`, notes: `Purchase return ${ret.return_number}`,
            created_by: user?.id,
          } as any);
        }
      }
    }

    // Reduce supplier outstanding
    if (ret.supplier_id) {
      const { data: supplier } = await supabase.from("suppliers").select("outstanding_balance").eq("id", ret.supplier_id).single();
      if (supplier) {
        await supabase.from("suppliers").update({
          outstanding_balance: Math.max(0, (supplier.outstanding_balance || 0) - (ret.total || 0)),
          updated_at: new Date().toISOString(),
        } as any).eq("id", ret.supplier_id);
      }
    }

    toast.success("Return confirmed, stock adjusted");
    fetchReturns();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Returns</h1>
          <p className="text-muted-foreground">Return items to suppliers and adjust inventory</p>
        </div>
        <Button onClick={() => { setForm({ supplier_id: "", reason: "", notes: "", bill_id: "" }); setItems([{ product_name: "", quantity: 1, unit_price: 0, total: 0 }]); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Return
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><RotateCcw className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{returns.length}</p><p className="text-xs text-muted-foreground">Total Returns</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><RotateCcw className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{returns.filter(r => r.status === "draft").length}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">₹{returns.filter(r => r.status === "confirmed").reduce((s, r) => s + (r.total || 0), 0).toLocaleString()}</p><p className="text-xs text-muted-foreground">Credited</p></div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search return number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Return #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
              <TableHead>Total</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="w-28">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {returns.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase returns</TableCell></TableRow>
              ) : returns.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-sm font-medium">{r.return_number}</TableCell>
                  <TableCell>{r.suppliers?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono">₹{(r.total || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[150px] truncate">{r.reason || "—"}</TableCell>
                  <TableCell><Badge variant={r.status === "confirmed" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
                  <TableCell>
                    {r.status === "draft" && (
                      <Button variant="outline" size="sm" onClick={() => confirmReturn(r)}>Confirm</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>New Purchase Return</SheetTitle>
            <SheetDescription>Return items to supplier</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label>Supplier *</Label>
              <Select value={form.supplier_id} onValueChange={v => setForm(p => ({ ...p, supplier_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                <SelectContent>{suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Reason</Label><Input value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} placeholder="Defective, Wrong item, etc." /></div>

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
                        if (prod) {
                          setItems(prev => { const u = [...prev]; u[idx] = { ...u[idx], product_id: v, product_name: prod.name, unit_price: prod.selling_price || 0, total: (u[idx].quantity) * (prod.selling_price || 0) }; return u; });
                        }
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                      </Select>
                      {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeItem(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Qty</Label><Input type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} /></div>
                      <div><Label className="text-xs">Price</Label><Input type="number" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} /></div>
                      <div><Label className="text-xs">Total</Label><Input value={`₹${item.total.toFixed(2)}`} readOnly className="bg-muted" /></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <p className="text-lg font-bold">Total: ₹{items.reduce((s, i) => s + i.total, 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Return"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
