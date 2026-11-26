"use client";

import { Alert, Box, Button, Card, CardContent, Chip, Divider, Typography } from "@mui/material";
import { AnimatedPage, toast } from "@/components/mui";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { SendDocumentDrawer } from "@/components/documents/SendDocumentDrawer";
import { downloadDocumentPdf } from "@/lib/document-pdf-client";
import { recordSystemAudit } from "@/lib/audit";
import { ArrowLeft, Send, Download, Printer, Pencil, ArrowRightLeft, Copy, Link, Loader2, Truck, FileText } from "lucide-react";
export default function QuotationPreview() {
    const { id } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [quotation, setQuotation] = useState<any>(null);
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
    const [duplicating, setDuplicating] = useState(false);
    const [converting, setConverting] = useState(false);
    const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
    const [bankDetails, setBankDetails] = useState<{
        bank_name?: string;
        bank_account_number?: string;
        bank_ifsc?: string;
        bank_branch?: string;
        bank_upi_id?: string;
    } | null>(null);
    const load = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        const { data: q } = await supabase
            .from("quotations")
            .select("*, customers(name, email, phone, address, gst_number, shipping_address, shipping_city, shipping_state, shipping_pincode)")
            .eq("id", id)
            .single();
        if (q)
            setQuotation(q);
        const { data: itms } = await supabase
            .from("quotation_items")
            .select("*")
            .eq("quotation_id", id)
            .order("sort_order", { ascending: true });
        setItems((itms || []).map((i: any, idx: number) => ({
            id: i.id, product_id: i.product_id, product_name: i.product_name,
            description: i.description || "", hsn_code: i.hsn_code || "",
            quantity: i.quantity, unit_price: i.unit_price,
            discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
            gst_percentage: i.gst_percentage ?? 18, gst_enabled: true, total: i.total,
            image_url: i.image_url || null, sort_order: i.sort_order ?? idx,
        })));
        const { data: bs } = await supabase.from("business_settings").select("bank_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id").limit(1).single();
        if (bs)
            setBankDetails(bs as any);
        setLoading(false);
    }, [id]);
    useEffect(() => {
        void load();
    }, [load]);
    const copyPublicLink = () => {
        if (!quotation?.public_token)
            return;
        navigator.clipboard.writeText(`${window.location.origin}/sales/public/${quotation.public_token}`);
        toast.success("Public quotation link copied");
    };
    const handleDownloadPdf = async () => {
        if (!quotation?.id) return;
        try {
            await downloadDocumentPdf({
                docType: "quotation",
                id: quotation.id,
                filename: `${quotation.quotation_number || "quotation"}.pdf`,
            });
            toast.success(`Downloaded ${quotation.quotation_number}.pdf`);
        } catch (err) {
            toast.error((err as Error).message || "Failed to download PDF");
        }
    };
    const duplicateAsNew = async () => {
        if (!quotation || duplicating) return;
        setDuplicating(true);
        try {
            const { data: newQ, error: qErr } = await supabase.from("quotations").insert({
                quotation_number: "",
                customer_id: quotation.customer_id,
                status: "draft",
                subtotal: quotation.subtotal,
                gst_amount: quotation.gst_amount,
                total: quotation.total,
                notes: quotation.notes,
                terms: quotation.terms,
                valid_until: quotation.valid_until,
                discount_type: quotation.discount_type,
                discount_value: quotation.discount_value,
                gst_inclusive: quotation.gst_inclusive,
                payment_terms: quotation.payment_terms,
                salesperson_id: quotation.salesperson_id,
                show_item_images: quotation.show_item_images,
                created_by: user?.id,
            } as any).select().single();
            if (qErr || !newQ) throw new Error(qErr?.message || "Failed to duplicate");
            if (items.length > 0) {
                await supabase.from("quotation_items").insert(items.map((i, idx) => ({
                    quotation_id: newQ.id,
                    product_id: i.product_id,
                    product_name: i.product_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    gst_percentage: i.gst_percentage,
                    total: i.total,
                    description: i.description || null,
                    hsn_code: i.hsn_code || null,
                    discount_type: i.discount_type,
                    discount_value: i.discount_value,
                    image_url: i.image_url || null,
                    sort_order: i.sort_order ?? idx,
                })));
            }
            await recordSystemAudit({
                action: "quotation_duplicated",
                module: "sales",
                entityType: "quotation",
                entityId: newQ.id,
                details: `Duplicated ${quotation.quotation_number} as new quotation ${newQ.quotation_number}`,
            });
            toast.success(`Created new draft ${newQ.quotation_number}`);
            navigate(`/sales/${newQ.id}/edit`);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setDuplicating(false);
        }
    };
    const sendPaymentLink = async () => {
        if (!quotation)
            return;
        setSendingPaymentLink(true);
        try {
            const customer = quotation.customers;
            const { data, error } = await supabase.functions.invoke("create-payment-link", {
                body: {
                    amount: quotation.total || 0,
                    customer_name: customer?.name,
                    customer_email: customer?.email,
                    customer_phone: customer?.phone,
                    description: `Payment for ${quotation.quotation_number}`,
                },
            });
            if (error)
                throw error;
            if (data?.success) {
                navigator.clipboard.writeText(data.payment_link_url);
                toast.success("Payment link created & copied!");
            }
            else {
                toast.error(data?.error || "Failed to create payment link");
            }
        }
        catch (err: any) {
            toast.error(err.message);
        }
        finally {
            setSendingPaymentLink(false);
        }
    };
    const convertToInvoice = async () => {
        if (!quotation?.customer_id) {
            toast.error("No customer on quotation");
            return;
        }
        if (converting) return;
        setConverting(true);
        try {
            const { data: qItems } = await supabase
                .from("quotation_items")
                .select("*")
                .eq("quotation_id", quotation.id)
                .order("sort_order", { ascending: true });
            const { data: inv, error: invErr } = await supabase.from("invoices").insert({
                invoice_number: "",
                customer_id: quotation.customer_id,
                subtotal: quotation.subtotal,
                gst_amount: quotation.gst_amount,
                total: quotation.total,
                notes: quotation.notes,
                quotation_id: quotation.id,
                discount_type: quotation.discount_type,
                discount_value: quotation.discount_value,
                gst_inclusive: quotation.gst_inclusive,
                salesperson_id: quotation.salesperson_id,
                payment_terms: quotation.payment_terms,
                deduct_stock: true,
                created_by: user?.id,
            } as any).select().single();
            if (invErr || !inv) {
                toast.error(invErr?.message || "Failed to create invoice");
                return;
            }
            if (qItems && qItems.length > 0) {
                const invItems = qItems.map((i: any, idx: number) => ({
                    invoice_id: inv.id,
                    product_id: i.product_id,
                    product_name: i.product_name,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    gst_percentage: i.gst_percentage,
                    total: i.total,
                    description: i.description,
                    hsn_code: i.hsn_code,
                    discount_type: i.discount_type,
                    discount_value: i.discount_value,
                    sort_order: i.sort_order ?? idx,
                }));
                await supabase.from("invoice_items").insert(invItems);
            }
            await supabase.functions.invoke("document-stock", {
                body: { doc_type: "invoice", doc_id: inv.id, note: `Converted from quotation ${quotation.quotation_number}` },
            });
            const qPatch = quotation.status === "accepted"
                ? { converted_invoice_id: inv.id }
                : { converted_invoice_id: inv.id, status: "accepted" as any };
            await supabase.from("quotations").update(qPatch).eq("id", quotation.id);
            toast.success("Converted to Invoice — " + inv.invoice_number);
            navigate(`/invoices/${inv.id}`);
        } finally {
            setConverting(false);
        }
    };
    if (loading) {
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Loading quotation...</Typography></Box></AnimatedPage>;
    }
    if (!quotation) {
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "16rem" }}><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Quotation not found</Typography></Box></AnimatedPage>;
    }
    const customer = quotation.customers;
    const canConvert = !quotation.converted_invoice_id && quotation.status !== "rejected" && quotation.status !== "expired";
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <Button onClick={() => navigate("/sales")} variant="text" size="small" sx={{ color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
        <Box component={ArrowLeft} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Back to Quotations
      </Button>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        {/* Document */}
        <Box data-print-area sx={{ minWidth: 0, "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" } }}>
          <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
            <CardContent sx={{ padding: "1.5rem", "@media (min-width: 768px)": { padding: "2rem" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 768px)": { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, gap: "1rem" }}>
                <BusinessHeader compact/>
                <Box sx={{ textAlign: "right", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                  <Typography component="h2" variant="h2" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{quotation.quotation_number}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                    Date: {new Date(quotation.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </Typography>
                  {quotation.valid_until && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>
                      Valid Until: {new Date(quotation.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </Typography>)}
                  <StatusBadge status={quotation.status}/>
                </Box>
              </Box>

              {quotation.status === "rejected" && quotation.rejection_reason && (
                <Alert severity="error">
                  Customer declined quotation: <strong>{quotation.rejection_reason}</strong>
                </Alert>
              )}

              <Divider />

              {customer && (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                  <Box>
                    <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Bill To:</Typography>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>{customer.name}</Typography>
                    {customer.address && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>{customer.address}</Typography>}
                    {customer.phone && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{customer.phone}</Typography>}
                    {customer.email && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{customer.email}</Typography>}
                    {customer.gst_number && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>GSTIN: {customer.gst_number}</Typography>}
                  </Box>
                  <Box>
                    <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Ship To:</Typography>
                    {customer.shipping_address ? (<>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>{customer.name}</Typography>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>{customer.shipping_address}</Typography>
                        {customer.shipping_city && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{customer.shipping_city}{customer.shipping_state ? `, ${customer.shipping_state}` : ""} {customer.shipping_pincode || ""}</Typography>}
                      </>) : (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>Same as billing address</Typography>)}
                  </Box>
                </Box>)}

              {(quotation as any).payment_terms && (<Box sx={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                  <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontWeight: "500" }}>Payment Terms:</Box>
                  <Box component="span" sx={{ fontWeight: "600", color: "hsl(var(--foreground))" }}>{(quotation as any).payment_terms?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</Box>
                  {quotation.valid_until && <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", marginLeft: "auto" }}>Valid Until: {new Date(quotation.valid_until).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</Box>}
                </Box>)}

              <ItemsTable items={items} onItemsChange={() => { }} products={[]} showImages={quotation.show_item_images !== false} readOnly/>

              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Box sx={{ width: "100%", maxWidth: "20rem" }}>
                  <TotalsPanel items={items} gstInclusive={quotation.gst_inclusive || false} globalDiscountType={(quotation.discount_type as "percentage" | "fixed") || "percentage"} globalDiscountValue={quotation.discount_value || 0} readOnly/>
                </Box>
              </Box>

              {quotation.notes && (<Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Notes</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap" }}>{quotation.notes}</Typography>
                </Box>)}

              {quotation.terms && (<Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Terms & Conditions</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-wrap" }}>{quotation.terms}</Typography>
                </Box>)}

              {quotation.signature_data && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", p: 1.5, bgcolor: "color-mix(in srgb, hsl(var(--success)) 5%, transparent)" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Customer Digital Signature & Audit Trail</Typography>
                  <Box src={quotation.signature_data} alt="Signature" component="img" sx={{ height: "4rem", borderWidth: "1px", borderColor: "hsl(var(--border))", borderRadius: "0.25rem", bgcolor: "#FFFFFF", p: 0.5 }}/>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.5rem" }}>
                    Signed by <strong>{quotation.signature_name || "Customer"}</strong>
                    {quotation.signed_at ? ` · ${new Date(quotation.signed_at).toLocaleString("en-IN")}` : ""}
                    {quotation.signed_ip ? ` · IP ${quotation.signed_ip}` : ""}
                  </Typography>
                </Box>)}

              {bankDetails?.bank_name && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)", padding: "1rem" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Bank Details for Payment</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "1.5rem", rowGap: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Bank</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{bankDetails.bank_name}</Box>
                    {bankDetails.bank_account_number && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Account No.</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{bankDetails.bank_account_number}</Box></>}
                    {bankDetails.bank_ifsc && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>IFSC</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{bankDetails.bank_ifsc}</Box></>}
                    {bankDetails.bank_branch && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Branch</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{bankDetails.bank_branch}</Box></>}
                    {bankDetails.bank_upi_id && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>UPI ID</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{bankDetails.bank_upi_id}</Box></>}
                  </Box>
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
                  <Box component={Send} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Send Quotation
                </Button>

                <Button onClick={() => void handleDownloadPdf()} variant="outlined" sx={{ width: "100%" }}>
                  <Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Download Branded PDF
                </Button>

                <Button onClick={copyPublicLink} variant="outlined" sx={{ width: "100%" }}>
                  <Box component={Copy} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Copy Customer Link
                </Button>

                <Button onClick={sendPaymentLink} disabled={sendingPaymentLink} variant="outlined" sx={{ width: "100%" }}>
                  {sendingPaymentLink ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={Link} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}
                  Create Payment Link
                </Button>

                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                  <Button onClick={() => window.print()} variant="outlined" size="small">
                    <Box component={Printer} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Print
                  </Button>
                  {quotation.status !== "accepted" ? (
                    <Button onClick={() => navigate(`/sales/${id}/edit`)} variant="outlined" size="small">
                      <Box component={Pencil} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Edit
                    </Button>
                  ) : (
                    <Button onClick={() => void duplicateAsNew()} disabled={duplicating} variant="outlined" size="small">
                      <Box component={Copy} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/> Duplicate
                    </Button>
                  )}
                </Box>

                {quotation.status !== "accepted" && (
                  <Button onClick={() => void duplicateAsNew()} disabled={duplicating} variant="text" size="small" sx={{ width: "100%" }}>
                    <Box component={Copy} sx={{ height: "0.95rem", width: "0.95rem", marginRight: "0.375rem" }}/> Duplicate as New Quotation
                  </Button>
                )}
              </CardContent>
            </Card>

            {(canConvert || quotation.converted_invoice_id || (quotation.status !== "rejected" && quotation.status !== "expired")) && (
              <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                <CardContent sx={{ padding: "1.25rem", display: "flex", flexDirection: "column", gap: 1 }}>
                  {canConvert && (
                    <Button onClick={() => void convertToInvoice()} disabled={converting} variant="contained" sx={{ width: "100%", backgroundColor: "hsl(var(--accent))", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 90%, transparent)" }, color: "hsl(var(--accent-foreground))" }}>
                      <Box component={ArrowRightLeft} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> {converting ? "Converting..." : "Convert to Invoice"}
                    </Button>
                  )}
                  {quotation.converted_invoice_id && (
                    <Button onClick={() => navigate(`/invoices/${quotation.converted_invoice_id}`)} variant="outlined" sx={{ width: "100%" }}>
                      <Box component={FileText} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Open Linked Invoice
                    </Button>
                  )}
                  {quotation.status !== "rejected" && quotation.status !== "expired" && (
                    <Button onClick={() => navigate(`/challans/new?quotationId=${quotation.id}`)} variant="outlined" sx={{ width: "100%" }}>
                      <Box component={Truck} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Create Delivery Challan
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            <Card sx={{ "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
              <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Details</Typography>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Status</Box>
                  <StatusBadge status={quotation.status}/>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Views</Box>
                  <Chip size="small" label={quotation.view_count || 0} />
                </Box>
                {quotation.converted_invoice_id && (<Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Converted</Box>
                    <Box component="span" sx={{ color: "hsl(var(--success))", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }}>Yes</Box>
                  </Box>)}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      <SendDocumentDrawer
        open={sendDrawerOpen}
        onClose={() => setSendDrawerOpen(false)}
        docType="quotation"
        docId={quotation.id}
        docNumber={quotation.quotation_number}
        customerName={customer?.name}
        defaultEmail={customer?.email}
        defaultPhone={customer?.phone}
        publicUrl={quotation.public_token ? `${window.location.origin}/sales/public/${quotation.public_token}` : null}
        totalLabel={`₹${Number(quotation.total || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        onEmailSent={() => void load()}
      />
    </Box></AnimatedPage>;
}
