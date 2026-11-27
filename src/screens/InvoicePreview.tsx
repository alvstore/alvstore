"use client";

import { Box, Button, Card, CardContent, Divider, MenuItem, TextField, Typography } from "@mui/material";
import { AnimatedPage, SideDrawer, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { SendDocumentDrawer } from "@/components/documents/SendDocumentDrawer";
import { downloadDocumentPdf } from "@/lib/document-pdf-client";
import { computePaymentUpdate } from "@/lib/invoice-metrics";
import { localDateKey, syncFinanceEvent } from "@/lib/finance-sync";
import { ArrowLeft, Send, Download, Printer, Pencil, CreditCard, Copy, Link, Loader2, Truck } from "lucide-react";
export default function InvoicePreview() {
    const { id } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [invoice, setInvoice] = useState<any>(null);
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
    // Payment
    const [paySheetOpen, setPaySheetOpen] = useState(false);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("cash");
    const [sendingLink, setSendingLink] = useState(false);
    useEffect(() => {
        if (!id)
            return;
        const load = async () => {
            setLoading(true);
            const { data: inv } = await supabase
                .from("invoices")
                .select("*, customers(name, email, phone, address, gst_number)")
                .eq("id", id)
                .single();
            if (inv)
                setInvoice(inv);
            const { data: itms } = await supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order", { ascending: true });
            setItems((itms || []).map((i: any, idx: number) => ({
                id: i.id, product_id: i.product_id, product_name: i.product_name,
                description: i.description || "", hsn_code: i.hsn_code || "",
                quantity: i.quantity, unit_price: i.unit_price,
                discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
                gst_percentage: i.gst_percentage ?? 18, gst_enabled: true, total: i.total,
                sort_order: i.sort_order ?? idx,
            })));
            setLoading(false);
        };
        load();
    }, [id]);
    const [cancelling, setCancelling] = useState(false);
    const cancelInvoiceAndRestoreStock = async () => {
        if (!invoice || cancelling || invoice.status === "cancelled")
            return;
        setCancelling(true);
        try {
            const { error: uErr } = await supabase.from("invoices").update({ status: "cancelled" }).eq("id", invoice.id);
            if (uErr)
                throw new Error(uErr.message);
            let reversedAt = invoice.stock_reversed_at || null;
            if (invoice.stock_deducted_at && !invoice.stock_reversed_at) {
                const { data: sData, error: sErr } = await supabase.functions.invoke("document-stock", {
                    body: {
                        doc_type: "invoice",
                        doc_id: invoice.id,
                        target_status: "cancelled",
                        mode: "reverse",
                        note: `Invoice ${invoice.invoice_number} cancelled`,
                    },
                });
                if (sErr)
                    throw new Error(sErr.message);
                if (sData?.action === "restore_in") {
                    reversedAt = new Date().toISOString();
                }
            }
            setInvoice({ ...invoice, status: "cancelled", stock_reversed_at: reversedAt });
            toast.success(reversedAt ? "Invoice cancelled and stock restored" : "Invoice cancelled");
        }
        catch (err: any) {
            toast.error(err?.message || "Failed to cancel invoice");
        }
        finally {
            setCancelling(false);
        }
    };
    const recordPayment = async () => {
        if (!invoice)
            return;
        const amount = parseFloat(payAmount) || 0;
        const currentPaid = Number(invoice.paid_amount || 0);
        const computation = computePaymentUpdate(Number(invoice.total || 0), currentPaid, amount);
        if (!computation.valid) {
            toast.error(computation.error || "Enter a valid amount");
            return;
        }
        const status = computation.invoiceStatus === "paid" ? "paid" : invoice.status === "draft" ? "sent" : invoice.status;
        const { error } = await supabase.from("invoices").update({
            paid_amount: computation.nextPaid,
            payment_status: computation.paymentStatus,
            status,
        }).eq("id", invoice.id);
        if (error)
            toast.error(error.message);
        else {
            await syncFinanceEvent({
                entry_source: "invoice",
                source_id: `inv:${invoice.id}:${Math.round(currentPaid * 100)}-to-${Math.round(computation.nextPaid * 100)}`,
                type: "income",
                amount,
                date: localDateKey(),
                payment_mode: payMethod,
                category_name: "Invoice Sales",
                customer_id: invoice.customer_id || null,
                reference: invoice.invoice_number,
                description: `Invoice payment received (${invoice.invoice_number})`,
                staff_name: user?.email || null,
            });
            toast.success("Payment recorded");
            setInvoice({ ...invoice, paid_amount: computation.nextPaid, payment_status: computation.paymentStatus, status });
        }
        setPaySheetOpen(false);
    };
    const copyPublicLink = () => {
        if (!invoice?.public_token)
            return;
        navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${invoice.public_token}`);
        toast.success("Link copied");
    };
    const sendPaymentLink = async () => {
        if (!invoice)
            return;
        const bal = (invoice.total || 0) - (invoice.paid_amount || 0);
        if (bal <= 0) {
            toast.error("No balance due");
            return;
        }
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
            if (error)
                throw error;
            if (data?.success) {
                toast.success("Payment link sent!", { description: data.payment_link_url });
                navigator.clipboard.writeText(data.payment_link_url);
            }
            else {
                throw new Error(data?.error || "Failed to create link");
            }
        }
        catch (err: any) {
            toast.error(err.message || "Failed to create payment link");
        }
        finally {
            setSendingLink(false);
        }
    };
    if (loading) {
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}>
        <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Loading invoice...</Typography>
      </Box></AnimatedPage>;
    }
    if (!invoice) {
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}>
        <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Invoice not found</Typography>
      </Box></AnimatedPage>;
    }
    const customer = invoice.customers;
    const balance = (invoice.total || 0) - (invoice.paid_amount || 0);
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Back button */}
      <Button onClick={() => navigate("/invoices")} variant="text" size="small" sx={{ color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
        <Box component={ArrowLeft} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Back to Invoices
      </Button>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        {/* Document - Left Column */}
        <Box data-print-area sx={{ minWidth: 0, "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" } }}>
          <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
            <CardContent sx={{ padding: "1.5rem", "@media (min-width: 768px)": { padding: "2rem" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              {/* Header row: Business + Invoice info */}
              <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 768px)": { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, gap: "1rem" }}>
                <BusinessHeader compact/>
                <Box sx={{ textAlign: "right", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                  <Typography component="h2" variant="h2" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{invoice.invoice_number}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                    Date: {new Date(invoice.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </Typography>
                  {invoice.due_date && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                      Due: {new Date(invoice.due_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Typography>)}
                  <StatusBadge status={invoice.status === "cancelled" ? "cancelled" : (invoice.payment_status || "unpaid")}/>
                </Box>
              </Box>

              <Divider />

              {/* Invoice To */}
              {customer && (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1.5rem" }}>
                  <Box>
                    <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Invoice To:</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>{customer.name}</Typography>
                    {customer.address && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>{customer.address}</Typography>}
                    {customer.phone && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{customer.phone}</Typography>}
                    {customer.email && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{customer.email}</Typography>}
                    {customer.gst_number && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>GSTIN: {customer.gst_number}</Typography>}
                  </Box>
                  <Box sx={{ "@media (min-width: 768px)": { textAlign: "right" } }}>
                    <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Payment Info:</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))" }}>Total: <Box component="span" sx={{ fontWeight: "700" }}>₹{(invoice.total || 0).toLocaleString("en-IN")}</Box></Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))" }}>Paid: <Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--success))" }}>₹{(invoice.paid_amount || 0).toLocaleString("en-IN")}</Box></Typography>
                    {balance > 0 && (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--destructive))", fontWeight: "600" }}>Balance: ₹{balance.toLocaleString("en-IN")}</Typography>)}
                  </Box>
                </Box>)}

              {/* Items Table */}
              <ItemsTable items={items} onItemsChange={() => { }} products={[]} showImages={false} readOnly/>

              {/* Totals */}
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Box sx={{ width: "100%", maxWidth: "20rem" }}>
                  <TotalsPanel items={items} gstInclusive={invoice.gst_inclusive || false} globalDiscountType={(invoice.discount_type as "percentage" | "fixed") || "percentage"} globalDiscountValue={invoice.discount_value || 0} readOnly/>
                </Box>
              </Box>

              {/* Notes */}
              {invoice.notes && (<Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Notes</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap" }}>{invoice.notes}</Typography>
                </Box>)}

              {/* Signature */}
              {invoice.signature_data && (<Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Signature</Typography>
                  <Box src={invoice.signature_data} alt="Signature" component="img" sx={{ height: "4rem", borderWidth: "1px", borderColor: "hsl(var(--border))", borderRadius: "0.25rem" }}/>
                  {invoice.signature_name && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>{invoice.signature_name}</Typography>}
                </Box>)}
            </CardContent>
          </Card>
        </Box>

        {/* Right Action Sidebar */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 4 / span 4" }, "@media print": { display: "none" } }}>
          <Box sx={{ "@media (min-width: 1024px)": { position: "sticky", top: "1.5rem" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
              <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                <Button onClick={() => setSendDrawerOpen(true)} variant="contained" sx={{ width: "100%", backgroundColor: "hsl(var(--primary))", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 90%, transparent)" } }}>
                  <Box component={Send} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Send Invoice
                </Button>

                <Button onClick={() => void downloadDocumentPdf({ docType: "invoice", id: invoice.id, filename: `${invoice.invoice_number}.pdf` }).then(() => toast.success(`Downloaded ${invoice.invoice_number}.pdf`)).catch((e) => toast.error((e as Error).message))} variant="outlined" sx={{ width: "100%" }}>
                  <Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Download Branded PDF
                </Button>

                <Button onClick={copyPublicLink} variant="outlined" sx={{ width: "100%" }}>
                  <Box component={Copy} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Copy Customer Link
                </Button>

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                  <Button onClick={() => window.print()} variant="outlined" size="small">
                    <Box component={Printer} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Print
                  </Button>
                  <Button onClick={() => navigate(`/invoices/${id}/edit`)} variant="outlined" size="small">
                    <Box component={Pencil} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Edit
                  </Button>
                </Box>

                <Button onClick={() => navigate(`/challans/new?invoiceId=${invoice.id}`)} variant="outlined" sx={{ width: "100%" }}>
                  <Box component={Truck} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Create Delivery Challan
                </Button>

                {invoice.status !== "cancelled" && (<Button variant="text" color="error" size="small" disabled={cancelling} onClick={() => void cancelInvoiceAndRestoreStock()} sx={{ width: "100%" }}>
                    {cancelling
                ? "Cancelling..."
                : invoice.stock_deducted_at && !invoice.stock_reversed_at
                    ? "Cancel Invoice & Restore Stock"
                    : "Cancel Invoice"}
                  </Button>)}
              </CardContent>
            </Card>

            {invoice.status !== "cancelled" && invoice.payment_status !== "paid" && (<Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Accept Payment</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
                    Balance due: <Box component="span" sx={{ fontWeight: "700", color: "hsl(var(--foreground))" }}>₹{balance.toLocaleString("en-IN")}</Box>
                  </Typography>
                  <Button onClick={() => {
            setPayAmount(String(balance.toFixed(2)));
            setPayMethod("cash");
            setPaySheetOpen(true);
        }} variant="contained" sx={{ width: "100%", backgroundColor: "hsl(var(--success))", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 90%, transparent)" }, color: "hsl(var(--success-foreground))" }}>
                    <Box component={CreditCard} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Add Payment
                  </Button>
                  <Button onClick={sendPaymentLink} disabled={sendingLink} variant="outlined" sx={{ width: "100%", borderColor: "color-mix(in srgb, hsl(var(--primary)) 30%, transparent)", color: "hsl(var(--primary))", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" } }}>
                    {sendingLink ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Link} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}
                    {sendingLink ? "Creating..." : "Send Razorpay Link"}
                  </Button>
                </CardContent>
              </Card>)}

            {/* Quick Info */}
            <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
              <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Details</Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Status</Box>
                  <StatusBadge status={invoice.status || "draft"}/>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Payment</Box>
                  <StatusBadge status={invoice.status === "cancelled" ? "cancelled" : (invoice.payment_status || "unpaid")}/>
                </Box>
                {invoice.quotation_id && (<Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>From Quotation</Box>
                    <Box component="span" sx={{ color: "hsl(var(--primary))", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }}>Yes</Box>
                  </Box>)}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Payment Sheet */}
      <SideDrawer
        open={paySheetOpen}
        onClose={() => setPaySheetOpen(false)}
        title={"Record Payment"}
        width={420}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPaySheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={recordPayment} variant="contained" sx={{ minHeight: 36 }}>Record Payment</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} label={"Amount"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={payMethod} label={"Payment Method"} select size="small" fullWidth onChange={event => setPayMethod(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  <MenuItem value="cash">Cash</MenuItem>
                  <MenuItem value="card">Card</MenuItem>
                  <MenuItem value="upi">UPI</MenuItem>
                  <MenuItem value="online">Online</MenuItem>
                </TextField>
            </Box>
          </Box>
        </SideDrawer>

      <SendDocumentDrawer
        open={sendDrawerOpen}
        onClose={() => setSendDrawerOpen(false)}
        docType="invoice"
        docId={invoice.id}
        docNumber={invoice.invoice_number}
        customerName={customer?.name}
        defaultEmail={customer?.email}
        defaultPhone={customer?.phone}
        publicUrl={invoice.public_token ? `${window.location.origin}/invoice/public/${invoice.public_token}` : null}
        totalLabel={`₹${Number(invoice.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
      />
    </Box></AnimatedPage>;
}
