import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { ArrowLeft, Send, Download, Printer, Pencil, CreditCard, Copy, Eye, Link, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function InvoicePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment
  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [sendingLink, setSendingLink] = useState(false);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const { data: inv } = await supabase
        .from("invoices")
        .select("*, customers(name, email, phone, address, gst_number)")
        .eq("id", id)
        .single();
      if (inv) setInvoice(inv);

      const { data: itms } = await supabase.from("invoice_items").select("*").eq("invoice_id", id);
      setItems(
        (itms || []).map((i: any) => ({
          id: i.id, product_id: i.product_id, product_name: i.product_name,
          description: i.description || "", hsn_code: i.hsn_code || "",
          quantity: i.quantity, unit_price: i.unit_price,
          discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
          gst_percentage: i.gst_percentage || 18, gst_enabled: true, total: i.total,
        }))
      );
      setLoading(false);
    };
    load();
  }, [id]);

  const recordPayment = async () => {
    if (!invoice) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) { toast.error("Enter a valid amount"); return; }
    const newPaid = (invoice.paid_amount || 0) + amount;
    const paymentStatus = newPaid >= invoice.total ? "paid" : "partial";
    const status = paymentStatus === "paid" ? "paid" : invoice.status;
    const { error } = await supabase.from("invoices").update({ paid_amount: newPaid, payment_status: paymentStatus, status }).eq("id", invoice.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Payment recorded");
      setInvoice({ ...invoice, paid_amount: newPaid, payment_status: paymentStatus, status });
    }
    setPaySheetOpen(false);
  };

  const copyPublicLink = () => {
    if (!invoice?.public_token) return;
    navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${invoice.public_token}`);
    toast.success("Link copied");
  };

  const sendPaymentLink = async () => {
    if (!invoice) return;
    const bal = (invoice.total || 0) - (invoice.paid_amount || 0);
    if (bal <= 0) { toast.error("No balance due"); return; }
    setSendingLink(true);
    try {
      const customer = invoice.customers;
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: {
          amount: bal,
          customer_name: customer?.name || "",
          customer_email: customer?.email || "",
          customer_phone: customer?.phone || "",
          invoice_id: invoice.id,
          description: `Payment for ${invoice.invoice_number}`,
        },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success("Payment link sent!", { description: data.payment_link_url });
        navigator.clipboard.writeText(data.payment_link_url);
      } else {
        throw new Error(data?.error || "Failed to create link");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to create payment link");
    } finally {
      setSendingLink(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Invoice not found</p>
      </div>
    );
  }

  const customer = invoice.customers;
  const balance = (invoice.total || 0) - (invoice.paid_amount || 0);

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate("/invoices")} className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Invoices
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Document - Left Column */}
        <div className="lg:col-span-8 print-area">
          <Card className="shadow-sm border-border/50">
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Header row: Business + Invoice info */}
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                <BusinessHeader compact />
                <div className="text-right space-y-1">
                  <h2 className="text-xl font-bold text-foreground">{invoice.invoice_number}</h2>
                  <p className="text-xs text-muted-foreground">
                    Date: {new Date(invoice.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                  {invoice.due_date && (
                    <p className="text-xs text-muted-foreground">
                      Due: {new Date(invoice.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                  )}
                  <StatusBadge status={invoice.payment_status || "unpaid"} />
                </div>
              </div>

              <Separator />

              {/* Invoice To */}
              {customer && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Invoice To:</p>
                    <p className="text-sm font-semibold text-foreground">{customer.name}</p>
                    {customer.address && <p className="text-xs text-muted-foreground mt-0.5">{customer.address}</p>}
                    {customer.phone && <p className="text-xs text-muted-foreground">{customer.phone}</p>}
                    {customer.email && <p className="text-xs text-muted-foreground">{customer.email}</p>}
                    {customer.gst_number && <p className="text-xs text-muted-foreground mt-1">GSTIN: {customer.gst_number}</p>}
                  </div>
                  <div className="md:text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Payment Info:</p>
                    <p className="text-sm text-foreground">Total: <span className="font-bold">₹{(invoice.total || 0).toLocaleString("en-IN")}</span></p>
                    <p className="text-sm text-foreground">Paid: <span className="font-medium text-success">₹{(invoice.paid_amount || 0).toLocaleString("en-IN")}</span></p>
                    {balance > 0 && (
                      <p className="text-sm text-destructive font-semibold">Balance: ₹{balance.toLocaleString("en-IN")}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Items Table */}
              <ItemsTable items={items} onItemsChange={() => {}} products={[]} readOnly />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-full max-w-xs">
                  <TotalsPanel
                    items={items}
                    gstInclusive={invoice.gst_inclusive || false}
                    globalDiscountType={(invoice.discount_type as "percentage" | "fixed") || "percentage"}
                    globalDiscountValue={invoice.discount_value || 0}
                    readOnly
                  />
                </div>
              </div>

              {/* Notes */}
              {invoice.notes && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p>
                </div>
              )}

              {/* Signature */}
              {invoice.signature_data && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Signature</p>
                  <img src={invoice.signature_data} alt="Signature" className="h-16 border border-border rounded" />
                  {invoice.signature_name && <p className="text-xs text-muted-foreground mt-1">{invoice.signature_name}</p>}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Action Sidebar */}
        <div className="lg:col-span-4 no-print">
          <div className="lg:sticky lg:top-6 space-y-4">
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-5 space-y-3">
                <Button className="w-full bg-primary hover:bg-primary/90" onClick={copyPublicLink}>
                  <Send className="h-4 w-4 mr-2" /> Send Invoice
                </Button>

                <Button variant="outline" className="w-full" onClick={() => window.print()}>
                  <Download className="h-4 w-4 mr-2" /> Download
                </Button>

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => window.print()}>
                    <Printer className="h-4 w-4 mr-1.5" /> Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => navigate(`/invoices/${id}/edit`)}>
                    <Pencil className="h-4 w-4 mr-1.5" /> Edit
                  </Button>
                </div>
              </CardContent>
            </Card>

            {invoice.payment_status !== "paid" && (
              <Card className="shadow-sm border-border/50">
                <CardContent className="p-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Accept Payment</p>
                  <p className="text-sm text-muted-foreground">
                    Balance due: <span className="font-bold text-foreground">₹{balance.toLocaleString("en-IN")}</span>
                  </p>
                  <Button
                    className="w-full bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => {
                      setPayAmount(String(balance.toFixed(2)));
                      setPayMethod("cash");
                      setPaySheetOpen(true);
                    }}
                  >
                    <CreditCard className="h-4 w-4 mr-2" /> Add Payment
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-primary/30 text-primary hover:bg-primary/5"
                    onClick={sendPaymentLink}
                    disabled={sendingLink}
                  >
                    {sendingLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Link className="h-4 w-4 mr-2" />}
                    {sendingLink ? "Creating..." : "Send Razorpay Link"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Info */}
            <Card className="shadow-sm border-border/50">
              <CardContent className="p-5 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Details</p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={invoice.status || "draft"} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payment</span>
                  <StatusBadge status={invoice.payment_status || "unpaid"} />
                </div>
                {invoice.quotation_id && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">From Quotation</span>
                    <span className="text-primary text-xs font-medium">Yes</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Sheet */}
      <Sheet open={paySheetOpen} onOpenChange={setPaySheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Record Payment</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Amount</Label>
              <Input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="online">Online</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={recordPayment}>Record Payment</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
