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
import { Switch } from "@/components/ui/switch";
import { Plus, Search, ShoppingCart, Copy, Eye, FileText, TrendingUp, Clock, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ItemsTable, type DocumentItem, calcItemTotal } from "@/components/documents/ItemsTable";
import { TotalsPanel, calculateTotals } from "@/components/documents/TotalsPanel";
import { ActionButtons } from "@/components/documents/ActionButtons";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { CustomerCard } from "@/components/documents/CustomerCard";

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
  discount_type: string | null;
  discount_value: number | null;
  gst_inclusive: boolean | null;
  view_count: number | null;
  converted_invoice_id: string | null;
  signature_data: string | null;
  signature_name: string | null;
  customers?: { name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null } | null;
}

interface Product { id: string; name: string; description: string | null; selling_price: number | null; gst_percentage: number | null; }
interface Customer { id: string; name: string; email: string | null; phone: string | null; address: string | null; gst_number: string | null; }

export default function Sales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailSheet, setDetailSheet] = useState<Quotation | null>(null);
  const [detailItems, setDetailItems] = useState<DocumentItem[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewQuotation, setPreviewQuotation] = useState<Quotation | null>(null);
  const [previewItems, setPreviewItems] = useState<DocumentItem[]>([]);

  // Form state
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formTerms, setFormTerms] = useState("");
  const [formValidUntil, setFormValidUntil] = useState("");
  const [formItems, setFormItems] = useState<DocumentItem[]>([]);
  const [formGstInclusive, setFormGstInclusive] = useState(false);
  const [formDiscountType, setFormDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState(0);

  const fetchQuotations = async () => {
    setLoading(true);
    let query = supabase.from("quotations").select("*, customers(name, email, phone, address, gst_number)").order("created_at", { ascending: false });
    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (search) query = query.ilike("quotation_number", `%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setQuotations((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchQuotations(); }, [search, statusFilter]);
  useEffect(() => {
    Promise.all([
      supabase.from("customers").select("id, name, email, phone, address, gst_number").order("name"),
      supabase.from("products").select("id, name, description, selling_price, gst_percentage").order("name"),
    ]).then(([c, p]) => { setCustomers(c.data || []); setProducts(p.data || []); });
  }, []);

  // KPI calculations
  const totalQuotations = quotations.length;
  const acceptedCount = quotations.filter(q => q.status === "accepted").length;
  const pendingCount = quotations.filter(q => q.status === "sent" || q.status === "draft").length;
  const totalValue = quotations.reduce((sum, q) => sum + (q.total || 0), 0);

  const openNew = () => {
    setFormCustomerId(""); setFormNotes(""); setFormTerms("1. Prices are inclusive of GST.\n2. Quotation valid for 30 days.");
    setFormValidUntil(""); setFormItems([]); setFormGstInclusive(false);
    setFormDiscountType("percentage"); setFormDiscountValue(0);
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!formCustomerId) { toast.error("Select a customer"); return; }
    if (formItems.length === 0) { toast.error("Add at least one item"); return; }

    const totals = calculateTotals(formItems, formGstInclusive, formDiscountType, formDiscountValue);

    const { data: q, error: qErr } = await supabase.from("quotations").insert({
      quotation_number: "", customer_id: formCustomerId,
      subtotal: totals.itemSubtotal, gst_amount: totals.gstAmount, total: totals.grandTotal,
      notes: formNotes || null, terms: formTerms || null, valid_until: formValidUntil || null,
      discount_type: formDiscountType, discount_value: formDiscountValue,
      gst_inclusive: formGstInclusive, created_by: user?.id,
    }).select().single();

    if (qErr) { toast.error(qErr.message); return; }

    const items = formItems.map(i => ({
      quotation_id: q.id, product_id: i.product_id, product_name: i.product_name,
      quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
      total: i.total, description: i.description || null, hsn_code: i.hsn_code || null,
      discount_type: i.discount_type, discount_value: i.discount_value,
    }));

    const { error: iErr } = await supabase.from("quotation_items").insert(items);
    if (iErr) toast.error(iErr.message);
    else toast.success("Quotation created — " + q.quotation_number);
    setSheetOpen(false);
    fetchQuotations();
  };

  const openDetail = async (q: Quotation) => {
    setDetailSheet(q);
    const { data } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id);
    const mapped: DocumentItem[] = (data || []).map((i: any) => ({
      id: i.id, product_id: i.product_id, product_name: i.product_name,
      description: i.description || "", hsn_code: i.hsn_code || "",
      quantity: i.quantity, unit_price: i.unit_price,
      discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
      gst_percentage: i.gst_percentage || 18, gst_enabled: true,
      total: i.total,
    }));
    setDetailItems(mapped);
  };

  const openPreview = (q: Quotation, items: DocumentItem[]) => {
    setPreviewQuotation(q);
    setPreviewItems(items);
    setPreviewOpen(true);
  };

  const copyPublicLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/sales/public/${token}`);
    toast.success("Link copied");
  };

  const convertToInvoice = async (q: Quotation) => {
    if (!q.customer_id) { toast.error("No customer on quotation"); return; }
    const { data: items } = await supabase.from("quotation_items").select("*").eq("quotation_id", q.id);

    const { data: inv, error: invErr } = await supabase.from("invoices").insert({
      customer_id: q.customer_id, subtotal: q.subtotal, gst_amount: q.gst_amount, total: q.total,
      notes: q.notes, quotation_id: q.id, discount_type: q.discount_type, discount_value: q.discount_value,
      gst_inclusive: q.gst_inclusive, created_by: user?.id,
    }).select().single();

    if (invErr) { toast.error(invErr.message); return; }

    if (items && items.length > 0) {
      const invItems = items.map((i: any) => ({
        invoice_id: inv.id, product_id: i.product_id, product_name: i.product_name,
        quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage, total: i.total,
        description: i.description, hsn_code: i.hsn_code, discount_type: i.discount_type, discount_value: i.discount_value,
      }));
      await supabase.from("invoice_items").insert(invItems);
    }

    await supabase.from("quotations").update({ converted_invoice_id: inv.id, status: "accepted" as any }).eq("id", q.id);
    toast.success("Converted to Invoice — " + inv.invoice_number);
    setDetailSheet(null);
    fetchQuotations();
  };

  const selectedCustomer = formCustomerId ? customers.find(c => c.id === formCustomerId) : null;
  const detailCustomer = detailSheet?.customers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Sales & Quotations</h1>
          <p className="text-sm text-muted-foreground">Create, manage and convert quotations</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> New Quotation</Button>
      </div>

      {/* KPI Cards - Materialize style */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Quotations", value: totalQuotations, icon: FileText, bg: "bg-primary/10", iconColor: "text-primary" },
          { label: "Accepted", value: acceptedCount, icon: CheckCircle, bg: "bg-success/10", iconColor: "text-success" },
          { label: "Pending", value: pendingCount, icon: Clock, bg: "bg-warning/10", iconColor: "text-warning" },
          { label: "Total Value", value: `₹${totalValue.toLocaleString("en-IN")}`, icon: TrendingUp, bg: "bg-accent/10", iconColor: "text-accent" },
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
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search quotations..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table - Materialize inspired */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border/50">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">#ID</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Total</TableHead>
              <TableHead className="hidden md:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Issued Date</TableHead>
              <TableHead className="hidden lg:table-cell text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-center">Views</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : quotations.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                <ShoppingCart className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No quotations found</p>
              </TableCell></TableRow>
            ) : quotations.map(q => (
              <TableRow key={q.id} className="cursor-pointer hover:bg-muted/30 border-border/50 transition-colors" onClick={() => navigate(`/sales/${q.id}`)}>
                <TableCell className="font-semibold text-sm text-primary">{q.quotation_number}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-[11px] font-semibold text-primary">
                        {(q.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{q.customers?.name || "—"}</p>
                      <p className="text-[11px] text-muted-foreground truncate hidden sm:block">{q.customers?.email || ""}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={q.status} /></TableCell>
                <TableCell className="text-right font-semibold text-sm text-foreground">₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {new Date(q.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{q.view_count || 0}</span>
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <div className="flex gap-1 items-center justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => copyPublicLink(q.public_token)} title="Copy link">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild title="View">
                      <a href={`/sales/public/${q.public_token}`} target="_blank"><Eye className="h-4 w-4" /></a>
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
            <SheetTitle>New Quotation</SheetTitle>
            <SheetDescription>Create a professional quotation</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Customer *</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                <SelectContent>{customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {selectedCustomer && (
              <CustomerCard name={selectedCustomer.name} email={selectedCustomer.email} phone={selectedCustomer.phone} address={selectedCustomer.address} gstNumber={selectedCustomer.gst_number} compact />
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Valid Until</Label>
                <Input type="date" value={formValidUntil} onChange={e => setFormValidUntil(e.target.value)} />
              </div>
              <div className="flex items-end gap-2 pb-0.5">
                <Switch checked={formGstInclusive} onCheckedChange={setFormGstInclusive} />
                <Label className="text-xs">GST Inclusive</Label>
              </div>
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
              <Textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} rows={2} placeholder="Internal notes..." />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Terms & Conditions</Label>
              <Textarea value={formTerms} onChange={e => setFormTerms(e.target.value)} rows={3} />
            </div>
            <Button className="w-full" onClick={handleSave}>Create Quotation</Button>
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
                  <SheetTitle>{detailSheet.quotation_number}</SheetTitle>
                  <StatusBadge status={detailSheet.status} />
                </div>
                <SheetDescription>
                  Created {new Date(detailSheet.created_at).toLocaleDateString("en-IN")}
                  {detailSheet.view_count ? ` · ${detailSheet.view_count} views` : ""}
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-5 mt-6">
                {detailCustomer && (
                  <div className="rounded-lg border border-border p-3 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Customer</p>
                    <CustomerCard name={detailCustomer.name} email={detailCustomer.email} phone={detailCustomer.phone} address={detailCustomer.address} gstNumber={detailCustomer.gst_number} compact />
                  </div>
                )}

                <ItemsTable items={detailItems} onItemsChange={() => {}} products={[]} readOnly />

                <TotalsPanel
                  items={detailItems} gstInclusive={detailSheet.gst_inclusive || false}
                  globalDiscountType={(detailSheet.discount_type as any) || "percentage"}
                  globalDiscountValue={detailSheet.discount_value || 0}
                  readOnly
                />

                {detailSheet.notes && (
                  <div><p className="text-xs font-semibold mb-1">Notes</p><p className="text-xs text-muted-foreground whitespace-pre-line">{detailSheet.notes}</p></div>
                )}
                {detailSheet.terms && (
                  <div><p className="text-xs font-semibold mb-1">Terms</p><p className="text-xs text-muted-foreground whitespace-pre-line">{detailSheet.terms}</p></div>
                )}

                {detailSheet.signature_data && (
                  <div className="rounded-lg border border-border p-3 text-center">
                    <img src={detailSheet.signature_data} alt="Signature" className="h-14 mx-auto" />
                    {detailSheet.signature_name && <p className="text-sm font-medium mt-1">{detailSheet.signature_name}</p>}
                  </div>
                )}

                {/* Status change */}
                <div className="flex items-center gap-2">
                  <Label className="text-xs shrink-0">Status:</Label>
                  <Select value={detailSheet.status} onValueChange={async v => {
                    const { error } = await supabase.from("quotations").update({ status: v as any }).eq("id", detailSheet.id);
                    if (error) toast.error(error.message);
                    else { toast.success("Status updated"); setDetailSheet({ ...detailSheet, status: v }); fetchQuotations(); }
                  }}>
                    <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["draft", "sent", "accepted", "rejected", "expired"].map(s => (
                        <SelectItem key={s} value={s} className="capitalize text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <ActionButtons
                  onPreview={() => openPreview(detailSheet, detailItems)}
                  onDownload={() => window.print()}
                  onCopyLink={() => copyPublicLink(detailSheet.public_token)}
                  onSendEmail={() => toast.info("Email integration coming soon")}
                  onSendWhatsApp={() => toast.info("WhatsApp integration coming soon")}
                  showConvert={detailSheet.status === "accepted" && !detailSheet.converted_invoice_id}
                  onConvertToInvoice={() => convertToInvoice(detailSheet)}
                  compact
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Preview */}
      {previewQuotation && (
        <DocumentPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          type="quotation"
          number={previewQuotation.quotation_number}
          status={previewQuotation.status}
          customer={previewQuotation.customers ? {
            name: previewQuotation.customers.name,
            email: previewQuotation.customers.email,
            phone: previewQuotation.customers.phone,
            address: previewQuotation.customers.address,
            gstNumber: previewQuotation.customers.gst_number,
          } : null}
          items={previewItems}
          gstInclusive={previewQuotation.gst_inclusive || false}
          globalDiscountType={(previewQuotation.discount_type as any) || "percentage"}
          globalDiscountValue={previewQuotation.discount_value || 0}
          notes={previewQuotation.notes}
          terms={previewQuotation.terms}
          validUntil={previewQuotation.valid_until}
          createdAt={previewQuotation.created_at}
          signatureData={previewQuotation.signature_data}
          signatureName={previewQuotation.signature_name}
        />
      )}
    </div>
  );
}
