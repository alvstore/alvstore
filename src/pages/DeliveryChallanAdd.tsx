import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, Save, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Product { id: string; name: string; selling_price: number | null; }
interface Customer { id: string; name: string; phone: string | null; address: string | null; }
interface ChallanItem { product_id: string | null; product_name: string; quantity: number; unit_price: number; total: number; }

export default function DeliveryChallanAdd() {
  const { user } = useAuth();
  const { id: editId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const isEditing = !!editId;

  const [customerId, setCustomerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ChallanItem[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("id, name, phone, address").order("name"),
      supabase.from("products").select("id, name, selling_price").order("name"),
    ]).then(([c, p]) => {
      setCustomers(c.data || []);
      setProducts(p.data || []);
    });
  }, []);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data: ch } = await (supabase as any).from("delivery_challans").select("*").eq("id", editId).single();
      if (ch) { setCustomerId((ch as any).customer_id || ""); setNotes((ch as any).notes || ""); }
      const { data: itms } = await (supabase as any).from("delivery_challan_items").select("*").eq("challan_id", editId);
      if (itms) setItems(itms.map((i: any) => ({ product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total })));
    })();
  }, [editId]);

  const addItem = (productId: string) => {
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    setItems([...items, { product_id: p.id, product_name: p.name, quantity: 1, unit_price: p.selling_price || 0, total: p.selling_price || 0 }]);
  };

  const updateItem = (idx: number, updates: Partial<ChallanItem>) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      const u = { ...item, ...updates };
      u.total = u.quantity * u.unit_price;
      return u;
    }));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const grandTotal = items.reduce((s, i) => s + i.total, 0);

  const handleSave = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);
    try {
      if (isEditing) {
        await supabase.from("delivery_challans").update({ customer_id: customerId, notes: notes || null } as any).eq("id", editId);
        await supabase.from("delivery_challan_items").delete().eq("challan_id", editId);
        await supabase.from("delivery_challan_items").insert(items.map(i => ({ challan_id: editId, product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total })));
        toast.success("Challan updated");
        navigate(`/challans/${editId}`);
      } else {
        const { data: ch, error } = await supabase.from("delivery_challans").insert({
          challan_number: "", customer_id: customerId, notes: notes || null, created_by: user?.id,
        } as any).select().single();
        if (error) throw error;
        await supabase.from("delivery_challan_items").insert(items.map(i => ({ challan_id: (ch as any).id, product_id: i.product_id, product_name: i.product_name, quantity: i.quantity, unit_price: i.unit_price, total: i.total })));
        toast.success("Challan created — " + (ch as any).challan_number);
        navigate(`/challans/${(ch as any).id}`);
      }
    } catch (err: any) { toast.error(err.message); }
    setSaving(false);
  };

  const selectedCustomer = customers.find(c => c.id === customerId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/challans")}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEditing ? "Edit Delivery Challan" : "New Delivery Challan"}</h1>
          <p className="text-sm text-muted-foreground">Items to be delivered before invoicing</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border/50">
            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Customer *</Label>
                  <Select value={customerId} onValueChange={setCustomerId}>
                    <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                    <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {selectedCustomer && (
                  <div className="rounded-lg border bg-muted/20 p-3 space-y-0.5">
                    <p className="text-sm font-medium">{selectedCustomer.name}</p>
                    {selectedCustomer.phone && <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>}
                    {selectedCustomer.address && <p className="text-xs text-muted-foreground">{selectedCustomer.address}</p>}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Items</Label>
                  <Select onValueChange={addItem}>
                    <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue placeholder="+ Add Item" /></SelectTrigger>
                    <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name} — ₹{p.selling_price}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                    <Plus className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Add items to the delivery challan</p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/50 border-b">
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase">Item</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase w-24">Rate</th>
                        <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase w-20">Qty</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase w-24">Total</th>
                        <th className="w-10"></th>
                      </tr></thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/50 last:border-0">
                            <td className="px-4 py-3 font-medium">{item.product_name}</td>
                            <td className="px-3 py-3"><Input type="number" className="h-8 text-sm text-right" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} /></td>
                            <td className="px-3 py-3"><Input type="number" min="1" className="h-8 text-sm text-right" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })} /></td>
                            <td className="px-4 py-3 text-right font-semibold">₹{item.total.toFixed(2)}</td>
                            <td className="pr-2 py-3"><Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Delivery instructions..." />
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-xs">
                  <Separator className="mb-3" />
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold">Total</span>
                    <span className="text-xl font-bold">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4">
          <Card className="border-border/50 sticky top-6">
            <CardContent className="p-5 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Challan"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/challans")}>Cancel</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
