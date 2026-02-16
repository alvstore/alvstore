import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Eye, Copy, ShoppingCart, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Quotation {
  id: string;
  quotation_number: string;
  status: string;
  subtotal: number;
  gst_amount: number;
  total: number;
  notes: string | null;
  terms: string | null;
  valid_until: string | null;
  public_token: string;
  customer_id: string | null;
  created_at: string;
  customers?: { name: string } | null;
}

interface QuotationItem {
  id?: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  gst_percentage: number;
  total: number;
  notes: string;
}

interface Product {
  id: string;
  name: string;
  selling_price: number;
  gst_percentage: number;
}

interface Customer {
  id: string;
  name: string;
}

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-warning/10 text-warning",
};

export default function Sales() {
  const { user } = useAuth();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Form
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formTerms, setFormTerms] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formItems, setFormItems] = useState<QuotationItem[]>([]);

  const fetchQuotations = async () => {
    setLoading(true);
    let query = supabase.from("quotations").select("*, customers(name)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (search) query = query.ilike("quotation_number", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setQuotations(data || []);
    setLoading(false);
  };

  const fetchMeta = async () => {
    const [custRes, prodRes] = await Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("products").select("id, name, selling_price, gst_percentage").order("name"),
    ]);
    setCustomers(custRes.data || []);
    setProducts(prodRes.data || []);
  };

  useEffect(() => { fetchQuotations(); }, [search, statusFilter]);
  useEffect(() => { fetchMeta(); }, []);

  const openNew = () => {
    setFormCustomerId("");
    setFormNotes("");
    setFormTerms("1. Prices are inclusive of GST.\n2. Quotation valid for 30 days.");
    setFormValidUntil("");
    setFormItems([]);
    setSheetOpen(true);
  };

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    const qty = 1;
    const unitPrice = product.selling_price;
    const gst = product.gst_percentage;
    const total = qty * unitPrice;
    setFormItems(prev => [...prev, {
      product_id: product.id, product_name: product.name,
      quantity: qty, unit_price: unitPrice, gst_percentage: gst, total, notes: "",
    }]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setFormItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [field]: value };
      if (field === "quantity" || field === "unit_price") {
        updated.total = (updated.quantity || 0) * (updated.unit_price || 0);
      }
      return updated;
    }));
  };

  const removeItem = (idx: number) => setFormItems(prev => prev.filter((_, i) => i !== idx));

  const calcSubtotal = () => formItems.reduce((sum, i) => sum + i.total, 0);
  const calcGst = () => formItems.reduce((sum, i) => sum + (i.total * i.gst_percentage / 100), 0);

  const handleSave = async () => {
    if (!formCustomerId) { toast.error("Select a customer"); return; }
    if (formItems.length === 0) { toast.error("Add at least one item"); return; }

    const subtotal = calcSubtotal();
    const gstAmount = calcGst();
    const total = subtotal + gstAmount;

    const { data: q, error: qErr } = await supabase.from("quotations").insert({
      quotation_number: "",
      customer_id: formCustomerId,
      subtotal, gst_amount: gstAmount, total,
      notes: formNotes || null, terms: formTerms || null,
      valid_until: formValidUntil || null,
      created_by: user?.id,
    }).select().single();

    if (qErr) { toast.error(qErr.message); return; }

    const items = formItems.map(i => ({
      quotation_id: q.id, product_id: i.product_id,
      product_name: i.product_name, quantity: i.quantity,
      unit_price: i.unit_price, gst_percentage: i.gst_percentage, total: i.total,
    }));

    const { error: iErr } = await supabase.from("quotation_items").insert(items);
    if (iErr) toast.error(iErr.message);
    else toast.success("Quotation created");
    setSheetOpen(false);
    fetchQuotations();
  };

  const copyPublicLink = (token: string) => {
    const url = `${window.location.origin}/sales/public/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Public link copied to clipboard");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales & Quotations</h1>
          <p className="text-muted-foreground">Create and manage quotations</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Quotation</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead className="hidden sm:table-cell">Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : quotations.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto mb-2 opacity-30" />No quotations yet
              </TableCell></TableRow>
            ) : quotations.map(q => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.quotation_number}</TableCell>
                <TableCell className="hidden sm:table-cell">{q.customers?.name || "—"}</TableCell>
                <TableCell>
                  <Badge className={statusColors[q.status] || ""}>{q.status}</Badge>
                </TableCell>
                <TableCell className="text-right font-medium">₹{q.total}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {new Date(q.created_at).toLocaleDateString("en-IN")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1 items-center">
                    <Select value={q.status} onValueChange={async (v) => {
                      const { error } = await supabase.from("quotations").update({ status: v as any }).eq("id", q.id);
                      if (error) toast.error(error.message);
                      else { toast.success("Status updated"); fetchQuotations(); }
                    }}>
                      <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["draft", "sent", "accepted", "rejected", "expired"].map(s => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={() => copyPublicLink(q.public_token)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" asChild title="View">
                      <a href={`/sales/public/${q.public_token}`} target="_blank"><Eye className="h-4 w-4" /></a>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Quotation Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New Quotation</SheetTitle>
            <SheetDescription>Create a new quotation for your customer</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Valid Until</Label>
              <Input type="date" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} />
            </div>

            {/* Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Items</Label>
                <Select onValueChange={addItem}>
                  <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="+ Add product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.selling_price}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {formItems.length === 0 && <p className="text-sm text-muted-foreground">No items added yet.</p>}
              {formItems.map((item, idx) => (
                <div key={idx} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{item.product_name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeItem(idx)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><Label className="text-xs">Qty</Label>
                      <Input type="number" min="1" className="h-8 text-sm" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Price</Label>
                      <Input type="number" className="h-8 text-sm" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">GST %</Label>
                      <Input type="number" className="h-8 text-sm" value={item.gst_percentage} onChange={e => updateItem(idx, "gst_percentage", parseFloat(e.target.value) || 0)} /></div>
                  </div>
                  <p className="text-xs text-right text-muted-foreground">Line total: ₹{item.total.toFixed(2)}</p>
                </div>
              ))}
              {formItems.length > 0 && (
                <div className="text-right space-y-1 text-sm border-t pt-3">
                  <p>Subtotal: ₹{calcSubtotal().toFixed(2)}</p>
                  <p>GST: ₹{calcGst().toFixed(2)}</p>
                  <p className="font-bold text-base">Total: ₹{(calcSubtotal() + calcGst()).toFixed(2)}</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Terms & Conditions</Label>
              <Textarea value={formTerms} onChange={e => setFormTerms(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" onClick={handleSave}>Create Quotation</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
