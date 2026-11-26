"use client";

import { Box, Button, Card, CardContent, Divider, LinearProgress, Typography } from "@mui/material";
import { AnimatedPage, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Download, CreditCard } from "lucide-react";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { CustomerCard } from "@/components/documents/CustomerCard";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { downloadDocumentPdf } from "@/lib/document-pdf-client";
interface InvoiceData {
    id: string;
    invoice_number: string;
    status: string;
    payment_status: string;
    subtotal: number;
    gst_amount: number;
    total: number;
    paid_amount: number;
    notes: string | null;
    due_date: string | null;
    created_at: string;
    discount_type: string | null;
    discount_value: number | null;
    gst_inclusive: boolean | null;
    signature_data: string | null;
    signature_name: string | null;
    customers: {
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        gst_number: string | null;
    } | null;
}
export default function PublicInvoice() {
    const { token } = useParams<{
        token: string;
    }>();
    const [invoice, setInvoice] = useState<InvoiceData | null>(null);
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const load = async () => {
            if (!token)
                return;
            const { data: inv } = await supabase.from("invoices").select("*, customers(name, email, phone, address, gst_number)").eq("public_token", token).single();
            if (inv) {
                setInvoice(inv as any);
                const { data: itemsData } = await supabase.from("invoice_items").select("*").eq("invoice_id", inv.id).order("sort_order", { ascending: true });
                setItems((itemsData || []).map((i: any, idx: number) => ({
                    product_id: i.product_id, product_name: i.product_name,
                    description: i.description || "", hsn_code: i.hsn_code || "",
                    quantity: i.quantity, unit_price: i.unit_price,
                    discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
                    gst_percentage: i.gst_percentage ?? 18, gst_enabled: true, total: i.total,
                    sort_order: i.sort_order ?? idx,
                })));
            }
            setLoading(false);
        };
        load();
    }, [token]);
    if (loading)
        return <AnimatedPage><Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))" }}><Box sx={{ animation: "spin 1s linear infinite", height: "2rem", width: "2rem", borderWidth: "4px", borderColor: "hsl(var(--primary))", borderTopColor: "transparent", borderRadius: "9999px" }}/></Box></AnimatedPage>;
    if (!invoice)
        return <AnimatedPage><Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))", color: "hsl(var(--muted-foreground))" }}><Typography component="p" variant="body1">Invoice not found.</Typography></Box></AnimatedPage>;
    const balance = invoice.total - invoice.paid_amount;
    return <AnimatedPage><Box sx={{ minHeight: "100vh", backgroundColor: "hsl(var(--background))", padding: "1rem", "@media (min-width: 768px)": { padding: "2rem" } }}>
      <Box sx={{ maxWidth: "48rem", marginLeft: "auto", marginRight: "auto", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        <Card data-print-area sx={{ borderColor: "hsl(var(--border))", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
          <CardContent sx={{ padding: "1.5rem", "@media (min-width: 768px)": { padding: "2rem" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
            <BusinessHeader />
            <Divider />

            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
              <Box>
                <Typography component="h2" variant="h2" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{invoice.invoice_number}</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>
                  {new Date(invoice.created_at).toLocaleDateString("en-IN")}
                  {invoice.due_date && ` · Due: ${new Date(invoice.due_date).toLocaleDateString("en-IN")}`}
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: "0.375rem" }}>
                <StatusBadge status={invoice.status}/>
                <StatusBadge status={invoice.payment_status}/>
              </Box>
            </Box>

            {invoice.customers && (<>
                <Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Bill To</Typography>
                  <CustomerCard name={invoice.customers.name} email={invoice.customers.email} phone={invoice.customers.phone} address={invoice.customers.address} gstNumber={invoice.customers.gst_number}/>
                </Box>
                <Divider />
              </>)}

            {/* Payment Progress */}
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Payment Progress</Box>
                <Box component="span" sx={{ fontWeight: "500" }}>₹{invoice.paid_amount.toLocaleString("en-IN")} / ₹{invoice.total.toLocaleString("en-IN")}</Box>
              </Box>
              <LinearProgress value={(invoice.paid_amount / (invoice.total || 1)) * 100} variant="determinate" sx={{ height: "0.5rem" }}/>
              {balance > 0 && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--destructive))", fontWeight: "500" }}>Balance Due: ₹{balance.toLocaleString("en-IN")}</Typography>}
            </Box>

            <ItemsTable items={items} onItemsChange={() => { }} products={[]} showImages={false} readOnly/>

            <TotalsPanel items={items} gstInclusive={invoice.gst_inclusive || false} globalDiscountType={(invoice.discount_type as any) || "percentage"} globalDiscountValue={invoice.discount_value || 0} readOnly/>

            {invoice.notes && (<Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", marginBottom: "0.25rem" }}>Notes</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-line" }}>{invoice.notes}</Typography></Box>)}

            {invoice.signature_data && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", padding: "1rem", textAlign: "center", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)" }}>
                <Box src={invoice.signature_data} alt="Signature" component="img" sx={{ height: "4rem", marginLeft: "auto", marginRight: "auto" }}/>
                {invoice.signature_name && <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", marginTop: "0.25rem" }}>{invoice.signature_name}</Typography>}
              </Box>)}

            <Box sx={{ display: "flex", gap: "0.75rem" }}>
              {balance > 0 && (<Button onClick={() => toast.info("Online payment coming soon")} variant="contained" sx={{ flex: "1 1 0%" }}>
                  <Box component={CreditCard} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Pay Now
                </Button>)}
              <Button onClick={() => token && void downloadDocumentPdf({ docType: "invoice", token, filename: `${invoice.invoice_number}.pdf` })} variant="outlined" color="secondary" sx={balance > 0 ? { flex: "1 1 0%" } : { width: "100%" }}>
                <Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Download Branded PDF
              </Button>
            </Box>
          </CardContent>
        </Card>
        <Typography component="p" variant="body1" sx={{ textAlign: "center", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>ALVStore · Authentic Apple &amp; Custom Studio Gear</Typography>
      </Box>
    </Box></AnimatedPage>;
}
