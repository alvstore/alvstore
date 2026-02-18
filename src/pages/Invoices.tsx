import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Receipt, FileText, TrendingUp, AlertCircle, CheckCircle, Copy, Eye } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel, calculateTotals } from "@/components/documents/TotalsPanel";
import { ActionButtons } from "@/components/documents/ActionButtons";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { CustomerCard } from "@/components/documents/CustomerCard";

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
  discount_type: string | null;
  discount_value: number | null;
  gst_inclusive: boolean | null;
  public_token: string | null;
  signature_data: string | null;
  signature_name: string | null;
  quotation_id: string | null;
  customers?: { name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null } | null;
}

interface Product { id: string; name: string; description: string | null; selling_price: number | null; gst_percentage: number | null; }
interface Customer { id: string; name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null; }

export default function Invoices() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState<Invoice | null>(null);
  const [detailItems, setDetailItems] = useState<DocumentItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Form
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formItems, setFormItems] = useState<DocumentItem[]>([]);
  const [formGstInclusive, setFormGstInclusive] = useState(false);
  const [formDiscountType, setFormDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState(0);

  // Payment
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");

  const fetchInvoices = async () => {
    setLoading(true);
    let query = supabase.from("invoices").select("*, customers(name, email, phone, address, gst_number)").order("created_at", { ascending: false });
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
      supabase.from("customers").select("id, name, email, phone, address, gst_number").order("name"),
      supabase.from("products").select("id, name, description, selling_price, gst_percentage").order("name"),
    ]).then(([c, p]) => { setCustomers(c.data || []); setProducts(p.data || []); });
  }, []);

  // KPIs
  const totalInvoices = invoices.length;
  const paidCount = invoices.filter(i => i.payment_status === "paid").length;
  const unpaidCount = invoices.filter(i => i.payment_status === "unpaid").length;
  const totalRevenue = invoices.filter(i => i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0);

  const openNew = () => {
    setFormCustomerId(""); setFormNotes(""); setFormDueDate(""); setFormItems([]);
    setFormGstInclusive(false); setFormDiscountType("percentage"); setFormDiscountValue(0);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formCustomerId) { toast.error("Select a customer"); return; }
    if (formItems.length === 0) { toast.error("Add at least one item"); return; }

    const totals = calculateTotals(formItems, formGstInclusive, formDiscountType, formDiscountValue);

    const { data: inv, error: invErr } = await supabase.from("invoices").insert({
      customer_id: formCustomerId, subtotal: totals.itemSubtotal, gst_amount: totals.gstAmount,
      total: totals.grandTotal, notes: formNotes || null, due_date: formDueDate || null,
      discount_type: formDiscountType, discount_value: formDiscountValue,
      gst_inclusive: formGstInclusive, created_by: user?.id,
    }).select().single();

    if (invErr) { toast.error(invErr.message); return; }

    const items = formItems.map(i => ({
      invoice_id: inv.id, product_id: i.product_id, product_name: i.product_name,
      quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage, total: i.total,
      description: i.description || null, hsn_code: i.hsn_code || null,
      discount_type: i.discount_type, discount_value: i.discount_value,
    }));

    const { error: iErr } = await supabase.from("invoice_items").insert(items);
    if (iErr) toast.error(iErr.message);
    else toast.success("Invoice created — " + inv.invoice_number);
    setSheetOpen(false);
    fetchInvoices();
  };

  const openDetail = async (inv: Invoice) => {
    setDetailSheet(inv);
    const { data } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id);
    setDetailItems((data || []).map((i: any) => ({
      id: i.id, product_id: i.product_id, product_name: i.product_name,
      description: i.description || "", hsn_code: i.hsn_code || "",
      quantity: i.quantity, unit_price: i.unit_price,
      discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
      gst_percentage: i.gst_percentage || 18, gst_enabled: true, total: i.total,
    })));
  };

  const openPayment = (inv: Invoice) => {
    setPayInvoice(inv);
    setPayAmount(String((inv.total - inv.paid_amount).toFixed(2)));
    setPayMethod("cash");
    setPaySheetOpen(true);
  };

  const recordPayment = async () => {
    if (!payInvoice) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) { toast.error("Enter a valid amount"); return; }
    const newPaid = payInvoice.paid_amount + amount;
    const paymentStatus = newPaid >= payInvoice.total ? "paid" : "partial";
    const status = paymentStatus === "paid" ? "paid" : payInvoice.status;
    const { error } = await supabase.from("invoices").update({ paid_amount: newPaid, payment_status: paymentStatus, status }).eq("id", payInvoice.id);
    if (error) toast.error(error.message);
    else toast.success("Payment recorded");
    setPaySheetOpen(false);
    setDetailSheet(null);
    fetchInvoices();
  };

  const copyPublicLink = (token: string | null) => {
    if (!token) { toast.error("No public link available"); return; }
    navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${token}`);
    toast.success("Link copied");
  };

  const selectedCustomer = formCustomerId ? customers.find(c => c.id === formCustomerId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground">Create and manage GST invoices</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Invoice</Button>
      </div>

      {/* KPIs - Materialize style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: totalInvoices, icon: FileText, bg: "bg-primary/10", iconColor: "text-primary" },
          { label: "Paid", value: paidCount, icon: CheckCircle, bg: "bg-success/10", iconColor: "text-success" },
          { label: "Unpaid", value: unpaidCount, icon: AlertCircle, bg: "bg-destructive/10", iconColor: "text-destructive" },
          { label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, icon: TrendingUp, bg: "bg-accent/10", iconColor: "text-accent" },
        ].map(kpi => (
          <Card key={kpi.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
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
          <Input placeholder="Search invoices..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table - Materialize inspired */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#ID</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issued Date</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : invoices.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No invoices found</p>
              </TableCell></TableRow>
            ) : invoices.map(inv => (
              <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/30 border-border/50 transition-colors" onClick={() => navigate(`/invoices/${inv.id}`)}>
                <TableCell className="font-semibold text-sm text-primary">{inv.invoice_number}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-primary">
                        {(inv.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{inv.customers?.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate hidden sm:block">{inv.customers?.email || ""}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="font-semibold text-sm text-foreground">₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell>
                  {inv.payment_status === "paid" ? (
                    <StatusBadge status="paid" />
                  ) : (
                    <div className="space-y-1">
                      <span className="text-sm font-medium text-destructive">
                        ₹{((inv.total || 0) - (inv.paid_amount || 0)).toLocaleString("en-IN")}
                      </span>
                      {inv.paid_amount > 0 && (
                        <Progress value={(inv.paid_amount / (inv.total || 1)) * 100} className="h-1.5 w-20" />
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1 items-center justify-end">
                    {inv.payment_status !== "paid" && (
                      <Button variant="outline" size="sm" className="h-7 text-xs font-medium" onClick={() => openPayment(inv)}>Pay</Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => copyPublicLink(inv.public_token)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => openDetail(inv)} title="View">
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Create Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-xl w-full">
          <SheetHeader>
            <SheetTitle>New Invoice</SheetTitle>
            <SheetDescription>Create a GST invoice</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Customer *</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {selectedCustomer && <CustomerCard name={selectedCustomer.name} email={selectedCustomer.email} phone={selectedCustomer.phone} address={selectedCustomer.address} gstNumber={selectedCustomer.gst_number} compact />}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Due Date</Label>
              <Input type="date" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
            </div>

            <ItemsTable items={formItems} onItemsChange={setFormItems} products={products} />

            {formItems.length > 0 && (
              <TotalsPanel
                items={formItems} gstInclusive={formGstInclusive}
                globalDiscountType={formDiscountType} globalDiscountValue={formDiscountValue}
                onGstInclusiveChange={setFormGstInclusive}
                onGlobalDiscountTypeChange={setFormDiscountType}
                onGlobalDiscountValueChange={setFormDiscountValue}
              />
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Notes</Label>
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} />
            </div>
            <Button className="w-full" onClick={handleSave}>Create Invoice</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <Sheet open={!!detailSheet} onOpenChange={v => !v && setDetailSheet(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-xl w-full">
          {detailSheet && (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>{detailSheet.invoice_number}</SheetTitle>
                  <div className="flex gap-1.5">
                    <StatusBadge status={detailSheet.status} />
                    <StatusBadge status={detailSheet.payment_status} />
                  </div>
                </div>
                <SheetDescription>Created {new Date(detailSheet.created_at).toLocaleDateString("en-IN")}</SheetDescription>
              </SheetHeader>
              <div className="space-y-5 mt-6">
                {detailSheet.customers && (
                  <div className="rounded-lg border border-border p-3 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Customer</p>
                    <CustomerCard name={detailSheet.customers.name} email={detailSheet.customers.email} phone={detailSheet.customers.phone} address={detailSheet.customers.address} gstNumber={detailSheet.customers.gst_number} compact />
                  </div>
                )}

                {/* Payment Progress */}
                {detailSheet.total > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Paid</span>
                      <span className="font-medium">₹{detailSheet.paid_amount.toLocaleString("en-IN")} / ₹{detailSheet.total.toLocaleString("en-IN")}</span>
                    </div>
                    <Progress value={(detailSheet.paid_amount / detailSheet.total) * 100} className="h-2" />
                  </div>
                )}

                <ItemsTable items={detailItems} onItemsChange={() => {}} products={[]} readOnly />

                <TotalsPanel
                  items={detailItems} gstInclusive={detailSheet.gst_inclusive || false}
                  globalDiscountType={(detailSheet.discount_type as any) || "percentage"}
                  globalDiscountValue={detailSheet.discount_value || 0}
                  readOnly
                />

                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">Status:</Label>
                  <Select value={detailSheet.status} onValueChange={async v => {
                    const { error } = await supabase.from("invoices").update({ status: v }).eq("id", detailSheet.id);
                    if (error) toast.error(error.message);
                    else { toast.success("Updated"); setDetailSheet({ ...detailSheet, status: v }); fetchInvoices(); }
                  }}>
                    <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["draft", "sent", "paid", "cancelled"].map(s => (
                        <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ActionButtons
                  onPreview={() => setPreviewOpen(true)}
                  onDownload={() => window.print()}
                  onCopyLink={() => copyPublicLink(detailSheet.public_token)}
                  onSendEmail={() => toast.info("Email integration coming soon")}
                  onSendWhatsApp={() => toast.info("WhatsApp integration coming soon")}
                  compact
                />

                {detailSheet.payment_status !== "paid" && (
                  <Button className="w-full" onClick={() => openPayment(detailSheet)}>Record Payment</Button>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Payment Sheet */}
      <Sheet open={paySheetOpen} onOpenChange={setPaySheetOpen}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
            <SheetDescription>
              {payInvoice?.invoice_number} — Balance: ₹{((payInvoice?.total || 0) - (payInvoice?.paid_amount || 0)).toFixed(2)}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label className="text-xs">Amount</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "card", "upi", "online"].map(m => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={recordPayment}>Record Payment</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview */}
      {detailSheet && (
        <DocumentPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          type="invoice"
          number={detailSheet.invoice_number}
          status={detailSheet.status}
          customer={detailSheet.customers ? {
            name: detailSheet.customers.name,
            email: detailSheet.customers.email,
            phone: detailSheet.customers.phone,
            address: detailSheet.customers.address,
            gstNumber: detailSheet.customers.gst_number,
          } : null}
          items={detailItems}
          gstInclusive={detailSheet.gst_inclusive || false}
          globalDiscountType={(detailSheet.discount_type as any) || "percentage"}
          globalDiscountValue={detailSheet.discount_value || 0}
          notes={detailSheet.notes}
          dueDate={detailSheet.due_date}
          createdAt={detailSheet.created_at}
          signatureData={detailSheet.signature_data}
          signatureName={detailSheet.signature_name}
        />
      )}
    </div>
  );
}
