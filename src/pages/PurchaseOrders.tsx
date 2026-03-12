import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Plus, Search, ShoppingCart, FileText, Trash2, Package } from "lucide-react";
import { toast } from "sonner";

interface PO {
  id: string; po_number: string; supplier_id: string | null; status: string;
  subtotal: number; gst_amount: number; total: number; notes: string | null;
  expected_date: string | null; created_at: string;
  suppliers?: { name: string } | null;
}

interface POItem {
  id?: string; product_name: string; quantity: number; unit_price: number;
  gst_percentage: number; total: number; product_id?: string | null;
}

const statusColors: Record<string, string> = {
  draft: "secondary", sent: "default", approved: "default",
  partially_received: "outline", completed: "default", cancelled: "destructive",
};

export default function PurchaseOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<PO[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ supplier_id: "", notes: "", expected_date: "" });
  const [items, setItems] = useState<POItem[]>([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);

  const fetchOrders = async () => {
    setLoading(true);
    let q = supabase.from("purchase_orders").select("*, suppliers(name)").order("created_at", { ascending: false });
    if (search) q = q.ilike("po_number", `%${search}%`);
    const { data } = await q;
    setOrders((data || []) as PO[]);
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

  useEffect(() => { fetchOrders(); fetchMasters(); }, [search]);

  const calcItem = (item: POItem): POItem => {
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

  const selectProduct = (idx: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setItems(prev => {
        const updated = [...prev];
        updated[idx] = calcItem({
          ...updated[idx],
          product_name: product.name,
          product_id: product.id,
          unit_price: product.selling_price || 0,
          gst_percentage: product.gst_percentage || 18,
        });
        return updated;
      });
    }
  };

  const handleSave = async () => {
    if (!form.supplier_id) { toast.error("Select a supplier"); return; }
    if (items.some(i => !i.product_name)) { toast.error("All items need a name"); return; }
    setSaving(true);
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const gst_amount = items.reduce((s, i) => s + i.quantity * i.unit_price * (i.gst_percentage / 100), 0);

    const { data: po, error } = await supabase.from("purchase_orders").insert({
      supplier_id: form.supplier_id, notes: form.notes || null,
      expected_date: form.expected_date || null,
      subtotal, gst_amount, total: subtotal + gst_amount,
      created_by: user?.id,
    } as any).select().single();

    if (error || !po) { toast.error(error?.message || "Failed"); setSaving(false); return; }

    await supabase.from("purchase_order_items").insert(
      items.map(i => ({
        po_id: po.id, product_name: i.product_name, product_id: i.product_id || null,
        quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
        total: i.total,
      } as any))
    );

    toast.success(`PO created`);
    setSaving(false);
    setSheetOpen(false);
    setForm({ supplier_id: "", notes: "", expected_date: "" });
    setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]);
    fetchOrders();
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("purchase_orders").update({ status, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); fetchOrders(); }
  };

  const convertToBill = async (po: PO) => {
    const { data: poItems } = await supabase.from("purchase_order_items").select("*").eq("po_id", po.id);
    // Navigate to purchase bills with PO data in state
    navigate("/purchase-bills", { state: { fromPO: po, items: poItems } });
  };

  const stats = {
    total: orders.length,
    draft: orders.filter(o => o.status === "draft").length,
    pending: orders.filter(o => ["sent", "approved"].includes(o.status)).length,
    value: orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.total || 0), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <p className="text-muted-foreground">Create and manage purchase orders for suppliers</p>
        </div>
        <Button onClick={() => { setForm({ supplier_id: "", notes: "", expected_date: "" }); setItems([{ product_name: "", quantity: 1, unit_price: 0, gst_percentage: 18, total: 0 }]); setSheetOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New PO
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><FileText className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total POs</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><ShoppingCart className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{stats.draft}</p><p className="text-xs text-muted-foreground">Drafts</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><Package className="h-5 w-5 text-info" /></div>
          <div><p className="text-2xl font-bold">{stats.pending}</p><p className="text-xs text-muted-foreground">Pending</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><ShoppingCart className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">₹{stats.value.toLocaleString()}</p><p className="text-xs text-muted-foreground">Total Value</p></div>
        </CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search PO number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>PO #</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead>
              <TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="w-32">Actions</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {orders.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No purchase orders</TableCell></TableRow>
              ) : orders.map(o => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-sm font-medium">{o.po_number}</TableCell>
                  <TableCell>{o.suppliers?.name || "—"}</TableCell>
                  <TableCell className="text-sm">{new Date(o.created_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono">₹{(o.total || 0).toLocaleString()}</TableCell>
                  <TableCell><Badge variant={statusColors[o.status] as any || "secondary"}>{o.status.replace(/_/g, " ")}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {o.status === "draft" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus(o.id, "sent")}>Send</Button>
                      )}
                      {o.status === "approved" && (
                        <Button variant="outline" size="sm" onClick={() => convertToBill(o)}>→ Bill</Button>
                      )}
                      {o.status === "sent" && (
                        <Button variant="outline" size="sm" onClick={() => updateStatus(o.id, "approved")}>Approve</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create PO Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>New Purchase Order</SheetTitle>
            <SheetDescription>Create a purchase order for a supplier</SheetDescription>
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
              <div className="space-y-1.5"><Label>Expected Date</Label><Input type="date" value={form.expected_date} onChange={e => setForm(p => ({ ...p, expected_date: e.target.value }))} /></div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Items</Label>
                <Button variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              <div className="space-y-3">
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 rounded-lg border space-y-2">
                    <div className="flex gap-2">
                      <Select onValueChange={v => selectProduct(idx, v)}>
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
                  </div>
                ))}
              </div>
              <div className="mt-3 text-right">
                <p className="text-lg font-bold">Total: ₹{items.reduce((s, i) => s + i.total, 0).toFixed(2)}</p>
              </div>
            </div>

            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} /></div>
            <Button className="w-full" onClick={handleSave} disabled={saving}>{saving ? "Creating..." : "Create Purchase Order"}</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
