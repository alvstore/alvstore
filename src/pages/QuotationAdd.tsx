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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Send, Eye, Save, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { type DocumentItem, calcItemTotal } from "@/components/documents/ItemsTable";
import { calculateTotals } from "@/components/documents/TotalsPanel";

interface Product { id: string; name: string; description: string | null; selling_price: number | null; gst_percentage: number | null; }
interface Customer { id: string; name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null; }
interface BusinessSettings { company_name: string | null; company_address: string | null; company_phone: string | null; company_email: string | null; gst_number: string | null; logo_url: string | null; }

export default function QuotationAdd() {
  const { user } = useAuth();
  const { id: editId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [business, setBusiness] = useState<BusinessSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const isEditing = !!editId;

  const [customerId, setCustomerId] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [dateIssued] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("1. Prices are inclusive of GST.\n2. Quotation valid for 30 days.");
  const [salesperson, setSalesperson] = useState("");
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [gstInclusive, setGstInclusive] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(0);
  const [showTerms, setShowTerms] = useState(true);
  const [showClientNotes, setShowClientNotes] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("id, name, email, phone, address, gst_number").order("name"),
      supabase.from("products").select("id, name, description, selling_price, gst_percentage").order("name"),
      supabase.from("business_settings").select("company_name, company_address, company_phone, company_email, gst_number, logo_url").limit(1).single(),
    ]).then(([c, p, b]) => {
      setCustomers(c.data || []);
      setProducts(p.data || []);
      if (b.data) setBusiness(b.data);
    });
  }, []);

  // Load existing quotation for editing
  useEffect(() => {
    if (!editId) return;
    const loadQuotation = async () => {
      const { data: q } = await supabase.from("quotations").select("*").eq("id", editId).single();
      if (q) {
        setCustomerId(q.customer_id || "");
        setValidUntil(q.valid_until || "");
        setNotes(q.notes || "");
        setTerms(q.terms || "1. Prices are inclusive of GST.\n2. Quotation valid for 30 days.");
        setGstInclusive(q.gst_inclusive || false);
        setDiscountType((q.discount_type as "percentage" | "fixed") || "percentage");
        setDiscountValue(q.discount_value || 0);
      }
      const { data: itms } = await supabase.from("quotation_items").select("*").eq("quotation_id", editId);
      if (itms) {
        setItems(itms.map((i: any) => ({
          id: i.id, product_id: i.product_id, product_name: i.product_name,
          description: i.description || "", hsn_code: i.hsn_code || "",
          quantity: i.quantity, unit_price: i.unit_price,
          discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
          gst_percentage: i.gst_percentage || 18, gst_enabled: true, total: i.total,
        })));
      }
    };
    loadQuotation();
  }, [editId]);

  const selectedCustomer = customerId ? customers.find(c => c.id === customerId) : null;
  const totals = calculateTotals(items, gstInclusive, discountType, discountValue);

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems([...items, {
      product_id: product.id, product_name: product.name,
      description: product.description || "", hsn_code: "",
      quantity: 1, unit_price: product.selling_price || 0,
      discount_type: "percentage", discount_value: 0,
      gst_percentage: product.gst_percentage || 18, gst_enabled: true,
      total: product.selling_price || 0,
    }]);
  };

  const updateItem = (idx: number, updates: Partial<DocumentItem>) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, ...updates };
      updated.total = calcItemTotal(updated);
      return updated;
    }));
  };

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!customerId) { toast.error("Select a customer"); return; }
    if (items.length === 0) { toast.error("Add at least one item"); return; }
    setSaving(true);

    if (isEditing) {
      // Update existing quotation
      const { error: qErr } = await supabase.from("quotations").update({
        customer_id: customerId, subtotal: totals.itemSubtotal,
        gst_amount: totals.gstAmount, total: totals.grandTotal,
        notes: notes || null, terms: terms || null, valid_until: validUntil || null,
        discount_type: discountType, discount_value: discountValue, gst_inclusive: gstInclusive,
      }).eq("id", editId);
      if (qErr) { toast.error(qErr.message); setSaving(false); return; }

      // Delete old items and insert new
      await supabase.from("quotation_items").delete().eq("quotation_id", editId);
      const qItems = items.map(i => ({
        quotation_id: editId, product_id: i.product_id, product_name: i.product_name,
        quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
        total: i.total, description: i.description || null, hsn_code: i.hsn_code || null,
        discount_type: i.discount_type, discount_value: i.discount_value,
      }));
      await supabase.from("quotation_items").insert(qItems);
      setSaving(false);
      toast.success("Quotation updated");
      navigate(`/sales/${editId}`);
    } else {
      // Create new
      const { data: q, error: qErr } = await supabase.from("quotations").insert({
        quotation_number: "", customer_id: customerId,
        subtotal: totals.itemSubtotal, gst_amount: totals.gstAmount, total: totals.grandTotal,
        notes: notes || null, terms: terms || null, valid_until: validUntil || null,
        discount_type: discountType, discount_value: discountValue,
        gst_inclusive: gstInclusive, created_by: user?.id,
      }).select().single();
      if (qErr) { toast.error(qErr.message); setSaving(false); return; }

      const qItems = items.map(i => ({
        quotation_id: q.id, product_id: i.product_id, product_name: i.product_name,
        quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
        total: i.total, description: i.description || null, hsn_code: i.hsn_code || null,
        discount_type: i.discount_type, discount_value: i.discount_value,
      }));
      const { error: iErr } = await supabase.from("quotation_items").insert(qItems);
      setSaving(false);
      if (iErr) toast.error(iErr.message);
      else { toast.success("Quotation created — " + q.quotation_number); navigate(`/sales/${q.id}`); }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/sales")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{isEditing ? "Edit Quotation" : "Add Quotation"}</h1>
          <p className="text-sm text-muted-foreground">{isEditing ? "Update quotation details" : "Create a professional quotation"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  {business?.logo_url && <img src={business.logo_url} alt="Logo" className="h-10 mb-2" />}
                  <p className="font-bold text-foreground">{business?.company_name || "Your Company"}</p>
                  <p className="text-xs text-muted-foreground">{business?.company_address}</p>
                  <p className="text-xs text-muted-foreground">{business?.company_phone} · {business?.company_email}</p>
                  {business?.gst_number && <p className="text-xs text-muted-foreground">GSTIN: {business.gst_number}</p>}
                </div>
                <div className="text-right space-y-2">
                  <h2 className="text-2xl font-bold text-primary">Quotation</h2>
                  <p className="text-xs text-muted-foreground"># Auto-generated</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Date Issued</Label>
                    <Input type="date" value={dateIssued} readOnly className="bg-muted/30" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Valid Until</Label>
                    <Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Quotation To</Label>
                    <Select value={customerId} onValueChange={setCustomerId}>
                      <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                      <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  {selectedCustomer && (
                    <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-0.5">
                      <p className="text-sm font-medium text-foreground">{selectedCustomer.name}</p>
                      {selectedCustomer.phone && <p className="text-xs text-muted-foreground">{selectedCustomer.phone}</p>}
                      {selectedCustomer.email && <p className="text-xs text-muted-foreground">{selectedCustomer.email}</p>}
                      {selectedCustomer.address && <p className="text-xs text-muted-foreground">{selectedCustomer.address}</p>}
                      {selectedCustomer.gst_number && <p className="text-xs text-muted-foreground">GSTIN: {selectedCustomer.gst_number}</p>}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-foreground">Line Items</Label>
                  <Select onValueChange={addItem}>
                    <SelectTrigger className="w-[200px] h-9 text-xs">
                      <SelectValue placeholder="+ Add Item" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map(p => (
                        <SelectItem key={p.id} value={p.id} className="text-xs">{p.name} — ₹{p.selling_price}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {items.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed border-border p-8 text-center">
                    <Plus className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="text-sm text-muted-foreground">Add items to your quotation</p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 border-b border-border">
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Item</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Cost</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">Qty</th>
                          <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Price</th>
                          <th className="w-10"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/50 last:border-0">
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{item.product_name}</p>
                              <Input placeholder="Description" value={item.description} onChange={e => updateItem(idx, { description: e.target.value })}
                                className="h-7 text-xs mt-1 border-0 px-0 bg-transparent shadow-none focus-visible:ring-0" />
                            </td>
                            <td className="px-3 py-3">
                              <Input type="number" className="h-8 text-sm text-right" value={item.unit_price}
                                onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} />
                            </td>
                            <td className="px-3 py-3">
                              <Input type="number" min="1" className="h-8 text-sm text-right" value={item.quantity}
                                onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })} />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-foreground">₹{item.total.toFixed(2)}</td>
                            <td className="pr-2 py-3">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => removeItem(idx)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Salesperson</Label>
                  <Input placeholder="Enter salesperson name" value={salesperson} onChange={e => setSalesperson(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Notes</Label>
                  <Textarea placeholder="Internal notes..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
                </div>
              </div>

              {showTerms && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Terms & Conditions</Label>
                  <Textarea value={terms} onChange={e => setTerms(e.target.value)} rows={3} />
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">₹{totals.itemSubtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-xs">Discount</span>
                    <div className="flex gap-1 items-center">
                      <Input type="number" className="h-7 w-16 text-xs text-right" value={discountValue}
                        onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} />
                      <Select value={discountType} onValueChange={v => setDiscountType(v as "percentage" | "fixed")}>
                        <SelectTrigger className="h-7 w-12 text-xs px-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage" className="text-xs">%</SelectItem>
                          <SelectItem value="fixed" className="text-xs">₹</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {totals.globalDiscount > 0 && (
                    <div className="flex justify-between text-success">
                      <span>Discount</span><span>-₹{totals.globalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">CGST</span><span>₹{totals.cgst.toFixed(2)}</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">SGST</span><span>₹{totals.sgst.toFixed(2)}</span></div>
                  <Separator />
                  <div className="flex justify-between items-baseline">
                    <span className="font-semibold text-foreground">Total</span>
                    <span className="text-xl font-bold text-foreground">₹{totals.grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          <Card className="border-border/50 shadow-sm sticky top-6">
            <CardContent className="p-5 space-y-3">
              <Button className="w-full" onClick={handleSave} disabled={saving}>
                <Send className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Send Quotation"}
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/sales")}>
                <Eye className="h-4 w-4 mr-2" />Preview
              </Button>
              <Button variant="outline" className="w-full" onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />Save
              </Button>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">GST Inclusive</Label>
                  <Switch checked={gstInclusive} onCheckedChange={setGstInclusive} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Terms & Conditions</Label>
                  <Switch checked={showTerms} onCheckedChange={setShowTerms} />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Client Notes</Label>
                  <Switch checked={showClientNotes} onCheckedChange={setShowClientNotes} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
