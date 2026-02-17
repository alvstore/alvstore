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
import { Plus, Search, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  subtotal: number;
  gst_amount: number;
  total: number;
  paid_amount: number;
  payment_status: string;
  status: string;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  customers?: { name: string } | null;
}

interface InvoiceItemForm {
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  gst_percentage: number;
  total: number;
}

interface Product { id: string; name: string; selling_price: number | null; gst_percentage: number | null; }
interface Customer { id: string; name: string; }

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const paymentColors: Record<string, string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
};

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [formCustomerId, setFormCustomerId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formItems, setFormItems] = useState<InvoiceItemForm[]>([]);

  // Payment recording
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase.from("invoices").select("*, customers(name)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (search) query = query.ilike("invoice_number", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setInvoices((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchInvoices(); }, [search, statusFilter]);
  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("id, name").order("name"),
      supabase.from("products").select("id, name, selling_price, gst_percentage").order("name"),
    ]).then(([c, p]) => {
      setCustomers(c.data || []);
      setProducts(p.data || []);
    });
  }, []);

  const openNew = () => {
    setFormCustomerId(""); setFormNotes(""); setFormDueDate(""); setFormItems([]);
    setSheetOpen(true);
  };

  const addItem = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setFormItems(prev => [...prev, {
      product_id: product.id, product_name: product.name,
      quantity: 1, unit_price: product.selling_price || 0,
      gst_percentage: product.gst_percentage || 18,
      total: product.selling_price || 0,
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

    const { data: inv, error: invErr } = await supabase.from("invoices").insert({
      customer_id: formCustomerId, subtotal, gst_amount: gstAmount, total,
      notes: formNotes || null, due_date: formDueDate || null,
      created_by: user?.id,
    }).select().single();

    if (invErr) { toast.error(invErr.message); return; }

    const items = formItems.map(i => ({
      invoice_id: inv.id, product_id: i.product_id,
      product_name: i.product_name, quantity: i.quantity,
      unit_price: i.unit_price, gst_percentage: i.gst_percentage, total: i.total,
    }));

    const { error: iErr } = await supabase.from("invoice_items").insert(items);
    if (iErr) toast.error(iErr.message);
    else toast.success("Invoice created — " + inv.invoice_number);
    setSheetOpen(false);
    fetchInvoices();
  };

  const openPayment = (inv: Invoice) => {
    setPayInvoice(inv);
    setPayAmount(String(inv.total - inv.paid_amount));
    setPaySheetOpen(true);
  };

  const recordPayment = async () => {
    if (!payInvoice) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) { toast.error("Enter a valid amount"); return; }
    const newPaid = payInvoice.paid_amount + amount;
    const paymentStatus = newPaid >= payInvoice.total ? "paid" : "partial";
    const status = paymentStatus === "paid" ? "paid" : payInvoice.status;
    const { error } = await supabase.from("invoices").update({
      paid_amount: newPaid, payment_status: paymentStatus, status,
    }).eq("id", payInvoice.id);
    if (error) toast.error(error.message);
    else toast.success("Payment recorded");
    setPaySheetOpen(false);
    fetchInvoices();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Create and manage GST invoices</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Invoice</Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by number..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead className="hidden sm:table-cell">Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell">Date</TableHead>
              <TableHead className="w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-2 opacity-30" />No invoices yet
              </TableCell></TableRow>
            ) : invoices.map(inv => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.invoice_number}</TableCell>
                <TableCell className="hidden sm:table-cell">{inv.customers?.name || "—"}</TableCell>
                <TableCell><Badge className={statusColors[inv.status] || ""}>{inv.status}</Badge></TableCell>
                <TableCell><Badge className={paymentColors[inv.payment_status] || ""}>{inv.payment_status}</Badge></TableCell>
                <TableCell className="text-right font-medium">₹{inv.total}</TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                  {new Date(inv.created_at).toLocaleDateString("en-IN")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Select value={inv.status} onValueChange={async (v) => {
                      const { error } = await supabase.from("invoices").update({ status: v }).eq("id", inv.id);
                      if (error) toast.error(error.message); else { toast.success("Updated"); fetchInvoices(); }
                    }}>
                      <SelectTrigger className="h-7 w-[90px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["draft", "sent", "paid", "cancelled"].map(s => (
                          <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {inv.payment_status !== "paid" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => openPayment(inv)}>Pay</Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create Invoice Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>New Invoice</SheetTitle>
            <SheetDescription>Create a GST invoice from inventory products</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label>Customer *</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
            </div>

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
                    <div><Label className="text-xs">Qty</Label><Input type="number" min="1" className="h-8 text-sm" value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">Price</Label><Input type="number" className="h-8 text-sm" value={item.unit_price} onChange={e => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} /></div>
                    <div><Label className="text-xs">GST %</Label><Input type="number" className="h-8 text-sm" value={item.gst_percentage} onChange={e => updateItem(idx, "gst_percentage", parseFloat(e.target.value) || 0)} /></div>
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

            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} /></div>
            <Button className="w-full" onClick={handleSave}>Create Invoice</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Record Payment Sheet */}
      <Sheet open={paySheetOpen} onOpenChange={setPaySheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
            <SheetDescription>{payInvoice?.invoice_number} — Balance: ₹{((payInvoice?.total || 0) - (payInvoice?.paid_amount || 0)).toFixed(2)}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} /></div>
            <Button className="w-full" onClick={recordPayment}>Record Payment</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
