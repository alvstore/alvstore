"use client";

import { Alert, Box, Button, Card, CardContent, Divider, TextField, Typography } from "@mui/material";
import { AnimatedPage, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Download } from "lucide-react";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { CustomerCard } from "@/components/documents/CustomerCard";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { SignaturePad } from "@/components/documents/SignaturePad";
import { downloadDocumentPdf } from "@/lib/document-pdf-client";
interface QuotationData {
    id: string;
    quotation_number: string;
    status: string;
    subtotal: number;
    gst_amount: number;
    total: number;
    notes: string | null;
    terms: string | null;
    valid_until: string | null;
    created_at: string;
    discount_type: string | null;
    discount_value: number | null;
    gst_inclusive: boolean | null;
    show_item_images?: boolean | null;
    rejection_reason?: string | null;
    responded_at?: string | null;
    signed_at?: string | null;
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
export default function PublicQuotation() {
    const { token } = useParams<{
        token: string;
    }>();
    const [quotation, setQuotation] = useState<QuotationData | null>(null);
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [responding, setResponding] = useState(false);
    const [signatureData, setSignatureData] = useState("");
    const [signatureName, setSignatureName] = useState("");
    const [rejectionReason, setRejectionReason] = useState("");
    const [showRejectBox, setShowRejectBox] = useState(false);
    const [bankDetails, setBankDetails] = useState<{
        bank_name?: string;
        bank_account_number?: string;
        bank_ifsc?: string;
        bank_branch?: string;
        bank_upi_id?: string;
    } | null>(null);
    useEffect(() => {
        const load = async () => {
            if (!token)
                return;
            const { data: q } = await supabase.from("quotations").select("*, customers(name, email, phone, address, gst_number)").eq("public_token", token).single();
            if (q) {
                setQuotation(q as any);
                void supabase.functions.invoke("public-quotation-view", { body: { token } });
                const { data: itemsData } = await supabase
                    .from("quotation_items")
                    .select("*")
                    .eq("quotation_id", q.id)
                    .order("sort_order", { ascending: true });
                setItems((itemsData || []).map((i: any, idx: number) => ({
                    product_id: i.product_id, product_name: i.product_name,
                    description: i.description || "", hsn_code: i.hsn_code || "",
                    quantity: i.quantity, unit_price: i.unit_price,
                    discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
                    gst_percentage: i.gst_percentage ?? 18, gst_enabled: true, total: i.total,
                    image_url: i.image_url || null, sort_order: i.sort_order ?? idx,
                })));
                const { data: bs } = await supabase.from("business_settings").select("bank_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id").limit(1).single();
                if (bs)
                    setBankDetails(bs as any);
            }
            setLoading(false);
        };
        load();
    }, [token]);
    const isExpired = Boolean(
        quotation?.valid_until &&
        String(quotation.valid_until).slice(0, 10) < new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date())
    );
    const respond = async (action: "accept" | "reject") => {
        if (!quotation || !token)
            return;
        if (action === "accept" && (!signatureName.trim() || !signatureData)) {
            toast.error("Please enter your full name and draw your signature before accepting.");
            return;
        }
        setResponding(true);
        try {
            const { data, error } = await supabase.functions.invoke("public-quotation-respond", {
                body: {
                    token,
                    action,
                    signature_name: action === "accept" ? signatureName.trim() : undefined,
                    signature_data: action === "accept" ? signatureData : undefined,
                    rejection_reason: action === "reject" ? rejectionReason.trim() || undefined : undefined,
                },
            });
            if (error || !data?.success) {
                throw new Error(error?.message || data?.error || "Could not submit response");
            }
            const nextStatus = action === "accept" ? "accepted" : "rejected";
            toast.success(action === "accept" ? "Quotation accepted — thank you!" : "Quotation response recorded");
            setQuotation((prev) =>
                prev
                    ? {
                          ...prev,
                          status: nextStatus,
                          signature_name: action === "accept" ? signatureName.trim() : prev.signature_name,
                          signature_data: action === "accept" ? signatureData : prev.signature_data,
                          signed_at: data.signed_at ?? prev.signed_at,
                          responded_at: data.responded_at ?? prev.responded_at,
                          rejection_reason: action === "reject" ? rejectionReason.trim() || null : null,
                      }
                    : null
            );
            setShowRejectBox(false);
        } catch (err) {
            toast.error((err as Error).message);
        } finally {
            setResponding(false);
        }
    };
    if (loading)
        return <AnimatedPage><Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))" }}><Box sx={{ animation: "spin 1s linear infinite", height: "2rem", width: "2rem", borderWidth: "4px", borderColor: "hsl(var(--primary))", borderTopColor: "transparent", borderRadius: "9999px" }}/></Box></AnimatedPage>;
    if (!quotation)
        return <AnimatedPage><Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "hsl(var(--background))", color: "hsl(var(--muted-foreground))" }}><Typography component="p" variant="body1">Quotation not found.</Typography></Box></AnimatedPage>;
    const canRespond = (quotation.status === "sent" || quotation.status === "draft") && !isExpired;
    return <AnimatedPage><Box sx={{ minHeight: "100vh", backgroundColor: "hsl(var(--background))", padding: "1rem", "@media (min-width: 768px)": { padding: "2rem" } }}>
      <Box sx={{ maxWidth: "52rem", marginLeft: "auto", marginRight: "auto", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        <Card data-print-area sx={{ borderColor: "hsl(var(--border))", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
          <CardContent sx={{ padding: "1.5rem", "@media (min-width: 768px)": { padding: "2rem" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
            <BusinessHeader />
            <Divider />

            {isExpired && (quotation.status === "draft" || quotation.status === "sent") && (
              <Alert severity="warning">
                This quotation expired on <strong>{new Date(quotation.valid_until!).toLocaleDateString("en-IN")}</strong>. Please contact ALVStore for an updated quotation.
              </Alert>
            )}
            {quotation.status === "accepted" && (
              <Alert severity="success">
                Accepted & digitally signed{quotation.signature_name ? ` by ${quotation.signature_name}` : ""}.
              </Alert>
            )}
            {quotation.status === "rejected" && (
              <Alert severity="error">
                Quotation declined{quotation.rejection_reason ? `: ${quotation.rejection_reason}` : "."}
              </Alert>
            )}

            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem" }}>
              <Box>
                <Typography component="h2" variant="h2" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>{quotation.quotation_number}</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>
                  {new Date(quotation.created_at).toLocaleDateString("en-IN")}
                  {quotation.valid_until && ` · Valid until ${new Date(quotation.valid_until).toLocaleDateString("en-IN")}`}
                </Typography>
              </Box>
              <StatusBadge status={isExpired && (quotation.status === "draft" || quotation.status === "sent") ? "expired" : quotation.status}/>
            </Box>

            {quotation.customers && (<>
                <Box>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Bill To</Typography>
                  <CustomerCard name={quotation.customers.name} email={quotation.customers.email} phone={quotation.customers.phone} address={quotation.customers.address} gstNumber={quotation.customers.gst_number}/>
                </Box>
                <Divider />
              </>)}

            <ItemsTable items={items} onItemsChange={() => { }} products={[]} showImages={quotation.show_item_images !== false} readOnly/>

            <TotalsPanel items={items} gstInclusive={quotation.gst_inclusive || false} globalDiscountType={(quotation.discount_type as any) || "percentage"} globalDiscountValue={quotation.discount_value || 0} readOnly/>

            {quotation.notes && (<Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", marginBottom: "0.25rem" }}>Notes</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-line" }}>{quotation.notes}</Typography></Box>)}
            {quotation.terms && (<Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", marginBottom: "0.25rem" }}>Terms & Conditions</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", whiteSpace: "pre-line" }}>{quotation.terms}</Typography></Box>)}

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
            {quotation.signature_data && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", padding: "1rem", textAlign: "center", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)" }}>
                <Box src={quotation.signature_data} alt="Signature" component="img" sx={{ height: "4rem", marginLeft: "auto", marginRight: "auto", bgcolor: "#FFFFFF", p: 0.75, borderRadius: 1 }}/>
                {quotation.signature_name && <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", marginTop: "0.25rem" }}>{quotation.signature_name}</Typography>}
                <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>Customer Digital Signature</Typography>
              </Box>)}

            {canRespond && (<>
                <Divider />
                <SignaturePad onSignature={(data, name) => { setSignatureData(data); setSignatureName(name); }} existingSignature={quotation.signature_data} existingName={quotation.signature_name}/>
                {showRejectBox && (
                  <TextField
                    fullWidth
                    size="small"
                    multiline
                    minRows={2}
                    label="Reason for declining (optional)"
                    placeholder="Let us know what we can adjust (price, specs, timeline)..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                )}
                <Box sx={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <Button onClick={() => void respond("accept")} disabled={responding} variant="contained" sx={{ flex: "1 1 200px" }}>
                    <Box component={Check} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Accept Quotation
                  </Button>
                  {!showRejectBox ? (
                    <Button onClick={() => setShowRejectBox(true)} disabled={responding} variant="outlined" color="error" sx={{ flex: "1 1 140px" }}>
                      <Box component={X} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Decline
                    </Button>
                  ) : (
                    <Button onClick={() => void respond("reject")} disabled={responding} variant="contained" color="error" sx={{ flex: "1 1 160px" }}>
                      <Box component={X} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Confirm Decline
                    </Button>
                  )}
                </Box>
              </>)}

            <Button onClick={() => void downloadDocumentPdf({ docType: "quotation", token, filename: `${quotation.quotation_number}.pdf` })} variant="outlined" color="secondary" sx={{ width: "100%" }}>
              <Box component={Download} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Download Branded PDF
            </Button>
          </CardContent>
        </Card>
        <Typography component="p" variant="body1" sx={{ textAlign: "center", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>ALVStore · Authentic Apple &amp; Custom Studio Gear</Typography>
      </Box>
    </Box></AnimatedPage>;
}
