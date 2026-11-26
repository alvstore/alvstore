"use client";

import {
    Alert, Autocomplete, Box, Button, Card, CardContent, Divider, FormLabel,
    IconButton, MenuItem, Stack, Switch, TextField, Tooltip, Typography, createFilterOptions
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatedPage, PageHeader, toast } from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Send, Eye, Save, Copy, Plus, UserPlus } from "lucide-react";
import { type DocumentItem, calcItemTotal } from "@/components/documents/ItemsTable";
import { DocumentItemAdder } from "@/components/documents/DocumentItemAdder";
import { calculateTotals } from "@/components/documents/TotalsPanel";
import { SortableLineItemsEditor, type EditableLineItem } from "@/components/documents/SortableLineItemsEditor";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { SendDocumentDrawer } from "@/components/documents/SendDocumentDrawer";
import { CustomerQuickDialog } from "@/components/customers/CustomerQuickDialog";
import { recordSystemAudit } from "@/lib/audit";
interface Product {
    id: string;
    name: string;
    description: string | null;
    selling_price: number | null;
    gst_percentage: number | null;
    image_url?: string | null;
}
interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gst_number: string | null;
    shipping_address?: string | null;
    shipping_city?: string | null;
    shipping_state?: string | null;
    shipping_pincode?: string | null;
}
interface BusinessSettings {
    company_name: string | null;
    company_address: string | null;
    company_phone: string | null;
    company_email: string | null;
    gst_number: string | null;
    logo_url: string | null;
    bank_name?: string | null;
    bank_account_number?: string | null;
    bank_ifsc?: string | null;
    bank_branch?: string | null;
    bank_upi_id?: string | null;
}
export default function QuotationAdd() {
    const { user } = useAuth();
    const { id: editId } = useParams<{
        id: string;
    }>();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [employees, setEmployees] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [business, setBusiness] = useState<BusinessSettings | null>(null);
    const [saving, setSaving] = useState(false);
    const isEditing = !!editId;
    const [quotationStatus, setQuotationStatus] = useState<string>("draft");
    const [quotationNumber, setQuotationNumber] = useState<string>("");
    const [quotationPublicToken, setQuotationPublicToken] = useState<string | null>(null);
    const [customerId, setCustomerId] = useState("");
    const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
    const [customerSearchInput, setCustomerSearchInput] = useState("");
    const [validUntil, setValidUntil] = useState("");
    const [dateIssued] = useState(new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [terms, setTerms] = useState("1. Prices are inclusive of GST.\n2. Quotation valid for 30 days.");
    const [salesperson, setSalesperson] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [gstInclusive, setGstInclusive] = useState(false);
    const [showItemImages, setShowItemImages] = useState(true);
    const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
    const [discountValue, setDiscountValue] = useState(0);
    const [showTerms, setShowTerms] = useState(true);
    const [showClientNotes, setShowClientNotes] = useState(true);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [sendDrawerTarget, setSendDrawerTarget] = useState<{
        id: string;
        docNumber: string;
        publicToken: string | null;
    } | null>(null);

    const isLockedAccepted = isEditing && quotationStatus === "accepted";
    const willResetApproval = isEditing && (quotationStatus === "rejected" || quotationStatus === "expired");

    const customerFilter = useMemo(
      () =>
        createFilterOptions<Customer>({
          stringify: (option) =>
            [option.name, option.phone, option.email, option.gst_number].filter(Boolean).join(" "),
        }),
      []
    );

    // Pick up customerId from query params if creating a new quote
    useEffect(() => {
        if (editId) return;
        const paramId = searchParams?.get("customerId") || searchParams?.get("customer_id");
        if (paramId && !customerId) {
            setCustomerId(paramId);
        }
    }, [searchParams, editId, customerId]);
    useEffect(() => {
        Promise.all([
            supabase.from("customers").select("id, name, email, phone, address, gst_number, shipping_address, shipping_city, shipping_state, shipping_pincode").order("name"),
            supabase.from("products").select("id, name, description, selling_price, gst_percentage, image_url").order("name"),
            supabase.from("business_settings").select("company_name, company_address, company_phone, company_email, gst_number, logo_url, bank_name, bank_account_number, bank_ifsc, bank_branch, bank_upi_id").limit(1).single(),
            supabase.from("employees").select("id, name").in("role", ["admin", "staff", "technician"]).eq("status", "active").order("name"),
        ]).then(([c, p, b, e]) => {
            setCustomers(c.data || []);
            setProducts(p.data || []);
            if (b.data)
                setBusiness(b.data);
            setEmployees(e.data || []);
        });
    }, []);
    // Load existing quotation for editing or cloning via ?duplicateFrom=
    const sourceQuoteId = editId || searchParams?.get("duplicateFrom") || "";
    useEffect(() => {
        if (!sourceQuoteId)
            return;
        const loadQuotation = async () => {
            const { data: q } = await supabase.from("quotations").select("*").eq("id", sourceQuoteId).single();
            if (q) {
                setCustomerId(q.customer_id || "");
                setValidUntil(q.valid_until || "");
                setNotes(q.notes || "");
                setTerms(q.terms || "1. Prices are inclusive of GST.\n2. Quotation valid for 30 days.");
                setGstInclusive(q.gst_inclusive || false);
                setDiscountType((q.discount_type as "percentage" | "fixed") || "percentage");
                setDiscountValue(q.discount_value || 0);
                setSalesperson(q.salesperson_id || "");
                setPaymentTerms(q.payment_terms || "");
                setShowItemImages(q.show_item_images !== false);
                if (editId) {
                    setQuotationStatus(q.status || "draft");
                    setQuotationNumber(q.quotation_number || "");
                    setQuotationPublicToken(q.public_token || null);
                }
            }
            const { data: itms } = await supabase
                .from("quotation_items")
                .select("*")
                .eq("quotation_id", sourceQuoteId)
                .order("sort_order", { ascending: true });
            if (itms) {
                setItems(itms.map((i: any, idx: number) => ({
                    id: editId ? i.id : undefined,
                    product_id: i.product_id,
                    product_name: i.product_name,
                    description: i.description || "",
                    hsn_code: i.hsn_code || "",
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    discount_type: (i.discount_type as "percentage" | "fixed") || "percentage",
                    discount_value: i.discount_value || 0,
                    gst_percentage: i.gst_percentage ?? 18,
                    gst_enabled: true,
                    total: i.total,
                    image_url: i.image_url || null,
                    sort_order: i.sort_order ?? idx,
                })));
            }
        };
        loadQuotation();
    }, [sourceQuoteId, editId]);
    const selectedCustomer = customerId ? customers.find(c => c.id === customerId) : null;
    const totals = calculateTotals(items, gstInclusive, discountType, discountValue);
    const addItem = (productId: string) => {
        if (isLockedAccepted) return;
        const product = products.find(p => p.id === productId);
        if (!product)
            return;
        setItems([...items, {
                product_id: product.id, product_name: product.name,
                description: product.description || "", hsn_code: "",
                quantity: 1, unit_price: product.selling_price || 0,
                discount_type: "percentage", discount_value: 0,
                gst_percentage: product.gst_percentage ?? 18, gst_enabled: true,
                total: product.selling_price || 0,
                image_url: product.image_url || null,
                sort_order: items.length,
            }]);
    };
    const addCustomItem = () => {
        if (isLockedAccepted) return;
        setItems([...items, {
                product_id: null, product_name: "Custom Service / Item",
                description: "", hsn_code: "",
                quantity: 1, unit_price: 0,
                discount_type: "percentage", discount_value: 0,
                gst_percentage: 18, gst_enabled: true,
                total: 0,
                image_url: null,
                sort_order: items.length,
            }]);
    };
    const handleEditorItemsChange = (nextItems: EditableLineItem[]) => {
        setItems(nextItems.map((it, idx) => {
            const docItem: DocumentItem = {
                product_id: it.product_id,
                product_name: it.product_name,
                description: it.description,
                hsn_code: it.hsn_code,
                quantity: Number(it.quantity || 1),
                unit_price: Number(it.unit_price || 0),
                discount_type: it.discount_type === "fixed" ? "fixed" : "percentage",
                discount_value: Number(it.discount_value || 0),
                gst_percentage: Number(it.gst_percentage ?? 18),
                gst_enabled: true,
                total: 0,
                image_url: it.image_url || null,
                sort_order: it.sort_order ?? idx,
            };
            docItem.total = calcItemTotal(docItem);
            return docItem;
        }));
    };
    const persistQuotation = async (openSendAfter = false) => {
        if (isLockedAccepted) {
            toast.error("Accepted quotations are locked. Duplicate as a new quotation to make changes.");
            return;
        }
        if (!customerId) {
            toast.error("Select a customer");
            return;
        }
        if (items.length === 0) {
            toast.error("Add at least one item");
            return;
        }
        setSaving(true);
        const targetId = isEditing ? editId : sendDrawerTarget?.id;
        if (targetId) {
            const updatePayload: Record<string, unknown> = {
                customer_id: customerId,
                subtotal: totals.itemSubtotal,
                gst_amount: totals.gstAmount,
                total: totals.grandTotal,
                notes: showClientNotes ? (notes || null) : null,
                terms: showTerms ? (terms || null) : null,
                valid_until: validUntil || null,
                discount_type: discountType,
                discount_value: discountValue,
                gst_inclusive: gstInclusive,
                payment_terms: paymentTerms || null,
                salesperson_id: salesperson || null,
                show_item_images: showItemImages,
            };
            if (willResetApproval) {
                updatePayload.status = "draft";
                updatePayload.rejection_reason = null;
                updatePayload.responded_at = null;
                updatePayload.signature_data = null;
                updatePayload.signature_name = null;
                updatePayload.signed_at = null;
                updatePayload.signed_ip = null;
            }
            const { data: updatedQ, error: qErr } = await supabase
                .from("quotations")
                .update(updatePayload as any)
                .eq("id", targetId)
                .select("id, quotation_number, public_token, status")
                .single();
            if (qErr) {
                toast.error(qErr.message);
                setSaving(false);
                return;
            }
            await supabase.from("quotation_items").delete().eq("quotation_id", targetId);
            const qItems = items.map((i, idx) => ({
                quotation_id: targetId, product_id: i.product_id, product_name: i.product_name,
                quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
                total: i.total, description: i.description || null, hsn_code: i.hsn_code || null,
                discount_type: i.discount_type, discount_value: i.discount_value,
                image_url: i.image_url || null, sort_order: i.sort_order ?? idx,
            }));
            const { error: iErr } = await supabase.from("quotation_items").insert(qItems);
            if (iErr) {
                toast.error(iErr.message);
                setSaving(false);
                return;
            }
            await recordSystemAudit({
                action: "quotation_updated",
                module: "sales",
                entityType: "quotation",
                entityId: targetId,
                details: `Updated quotation (${items.length} items, ₹${totals.grandTotal.toFixed(2)})`,
            });
            setSaving(false);
            if (updatedQ) {
                setQuotationStatus(updatedQ.status || "draft");
                setQuotationNumber(updatedQ.quotation_number || quotationNumber);
                setQuotationPublicToken(updatedQ.public_token || quotationPublicToken);
            }
            if (openSendAfter) {
                setSendDrawerTarget({
                    id: targetId,
                    docNumber: updatedQ?.quotation_number || quotationNumber || "Quotation",
                    publicToken: updatedQ?.public_token || quotationPublicToken,
                });
                return;
            }
            toast.success(willResetApproval ? "Quotation updated and reset to Draft" : "Quotation updated");
            navigate(`/sales/${targetId}`);
        }
        else {
            const { data: q, error: qErr } = await supabase.from("quotations").insert({
                quotation_number: "", customer_id: customerId,
                subtotal: totals.itemSubtotal, gst_amount: totals.gstAmount, total: totals.grandTotal,
                notes: showClientNotes ? (notes || null) : null,
                terms: showTerms ? (terms || null) : null,
                valid_until: validUntil || null,
                discount_type: discountType, discount_value: discountValue,
                gst_inclusive: gstInclusive, created_by: user?.id,
                payment_terms: paymentTerms || null,
                salesperson_id: salesperson || null,
                show_item_images: showItemImages,
            } as any).select().single();
            if (qErr) {
                toast.error(qErr.message);
                setSaving(false);
                return;
            }
            const qItems = items.map((i, idx) => ({
                quotation_id: q.id, product_id: i.product_id, product_name: i.product_name,
                quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
                total: i.total, description: i.description || null, hsn_code: i.hsn_code || null,
                discount_type: i.discount_type, discount_value: i.discount_value,
                image_url: i.image_url || null, sort_order: i.sort_order ?? idx,
            }));
            const { error: iErr } = await supabase.from("quotation_items").insert(qItems);
            if (!iErr) {
                await recordSystemAudit({
                    action: "quotation_created",
                    module: "sales",
                    entityType: "quotation",
                    entityId: q.id,
                    details: `Created quotation ${q.quotation_number} (${items.length} items, ₹${totals.grandTotal.toFixed(2)})`,
                });
            }
            setSaving(false);
            if (iErr) {
                toast.error(iErr.message);
                return;
            }
            setQuotationNumber(q.quotation_number);
            setQuotationPublicToken(q.public_token || null);
            setQuotationStatus(q.status || "draft");
            if (openSendAfter) {
                toast.success("Quotation saved — " + q.quotation_number);
                setSendDrawerTarget({
                    id: q.id,
                    docNumber: q.quotation_number,
                    publicToken: q.public_token || null,
                });
                return;
            }
            toast.success("Quotation created — " + q.quotation_number);
            navigate(`/sales/${q.id}`);
        }
    };
    const handleDuplicateAsNew = async () => {
        if (!customerId || items.length === 0) return;
        setSaving(true);
        const { data: q, error: qErr } = await supabase.from("quotations").insert({
            quotation_number: "", customer_id: customerId, status: "draft",
            subtotal: totals.itemSubtotal, gst_amount: totals.gstAmount, total: totals.grandTotal,
            notes: showClientNotes ? (notes || null) : null,
            terms: showTerms ? (terms || null) : null,
            valid_until: validUntil || null,
            discount_type: discountType, discount_value: discountValue,
            gst_inclusive: gstInclusive, created_by: user?.id,
            payment_terms: paymentTerms || null,
            salesperson_id: salesperson || null,
            show_item_images: showItemImages,
        } as any).select().single();
        if (qErr || !q) {
            toast.error(qErr?.message || "Failed to duplicate quotation");
            setSaving(false);
            return;
        }
        const qItems = items.map((i, idx) => ({
            quotation_id: q.id, product_id: i.product_id, product_name: i.product_name,
            quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage,
            total: i.total, description: i.description || null, hsn_code: i.hsn_code || null,
            discount_type: i.discount_type, discount_value: i.discount_value,
            image_url: i.image_url || null, sort_order: i.sort_order ?? idx,
        }));
        await supabase.from("quotation_items").insert(qItems);
        await recordSystemAudit({
            action: "quotation_duplicated",
            module: "sales",
            entityType: "quotation",
            entityId: q.id,
            details: `Duplicated ${quotationNumber || editId} as fresh quotation ${q.quotation_number}`,
        });
        setSaving(false);
        toast.success(`Duplicated as new quotation ${q.quotation_number}`);
        navigate(`/sales/${q.id}/edit`);
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={isEditing ? `Edit Quotation${quotationNumber ? ` · ${quotationNumber}` : ""}` : "Add Quotation"} subtitle={isLockedAccepted ? "Accepted by customer — signed audit trail locked" : isEditing ? "Update quotation details, line item order, or thumbnails" : "Create a detailed quotation with optional product images"} actions={<><IconButton onClick={() => navigate("/sales")} aria-label={"Arrow Left"}>
          <Box component={ArrowLeft} sx={{ height: "1.25rem", width: "1.25rem" }}/>
        </IconButton></>}/>

      {isLockedAccepted && (
        <Alert
          severity="info"
          action={
            <Button
              size="small"
              variant="contained"
              disabled={saving}
              onClick={() => void handleDuplicateAsNew()}
              startIcon={<Copy size={14} />}
            >
              Duplicate as New Quotation
            </Button>
          }
        >
          This quotation has already been accepted and digitally signed by the customer. Edits are disabled to protect the signed audit trail.
        </Alert>
      )}
      {willResetApproval && (
        <Alert severity="warning">
          This quotation is currently marked <strong>{quotationStatus}</strong>. Saving edits resets it to <strong>Draft</strong> so it can be sent again cleanly.
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        {/* Left Column */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <CardContent sx={{ padding: "1.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, justifyContent: "space-between", gap: "1rem" }}>
                <Box>
                  {business?.logo_url && <Box src={business.logo_url} alt="Logo" component="img" sx={{ height: "2.5rem", marginBottom: "0.5rem" }}/>}
                  <Typography component="p" variant="body1" sx={{ fontWeight: "700", color: "hsl(var(--foreground))" }}>{business?.company_name || "Your Company"}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{business?.company_address}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{business?.company_phone} · {business?.company_email}</Typography>
                  {business?.gst_number && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>GSTIN: {business.gst_number}</Typography>}
                </Box>
                <Box sx={{ textAlign: "right", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                  <Typography component="h2" variant="h2" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", color: "hsl(var(--primary))" }}>Quotation</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}># Auto-generated</Typography>
                </Box>
              </Box>

              <Divider />

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1.5rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField type="date" value={dateIssued} label={"Date Issued"} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true }, inputLabel: { shrink: true } }} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}/>
                  </Box>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} disabled={isLockedAccepted} label={"Valid Until"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/>
                  </Box>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                        Quotation To *
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
                        disabled={isLockedAccepted}
                        startIcon={<Box component={UserPlus} sx={{ width: 14, height: 14 }} />}
                        onClick={() => setQuickCustomerOpen(true)}
                        sx={{ fontSize: "11px", py: 0, px: 0.75, minHeight: "auto", fontWeight: 600 }}
                      >
                        + Add New Customer
                      </Button>
                    </Box>
                    <Autocomplete
                      size="small"
                      fullWidth
                      disabled={isLockedAccepted}
                      options={customers}
                      value={selectedCustomer}
                      getOptionLabel={(option) => {
                        if (typeof option === "string") return option;
                        return option?.name || "";
                      }}
                      isOptionEqualToValue={(option, val) => !!option?.id && !!val?.id && option.id === val.id}
                      onInputChange={(_, newInputValue, reason) => {
                        if (reason === "input") {
                          setCustomerSearchInput(newInputValue);
                        } else if (reason === "reset" || reason === "clear") {
                          setCustomerSearchInput("");
                        }
                      }}
                      onChange={(_, newValue) => {
                        if (!newValue) {
                          setCustomerId("");
                          setCustomerSearchInput("");
                          return;
                        }
                        if ((newValue as any).isAddNew) {
                          const typed = (newValue as any).typedName || customerSearchInput.trim();
                          setCustomerSearchInput(typed);
                          setQuickCustomerOpen(true);
                          return;
                        }
                        setCustomerId(newValue.id);
                        setCustomerSearchInput("");
                      }}
                      filterOptions={(options, params) => {
                        const filtered = customerFilter(options, params);
                        const { inputValue } = params;
                        const trimmed = inputValue.trim();
                        const exists = options.some(
                          (o) => o.name.toLowerCase() === trimmed.toLowerCase()
                        );
                        const actionItems: any[] = [];
                        if (trimmed !== "" && !exists) {
                          actionItems.push({
                            id: "__add_new_typed__",
                            name: `+ Add "${trimmed}" as new customer`,
                            typedName: trimmed,
                            isAddNew: true,
                            isNotFound: filtered.length === 0,
                          });
                        } else {
                          actionItems.push({
                            id: "__add_new_general__",
                            name: "+ Add new customer",
                            typedName: "",
                            isAddNew: true,
                            isNotFound: false,
                          });
                        }
                        return [...actionItems, ...filtered];
                      }}
                      renderOption={(props, option) => {
                        const { key, ...otherProps } = props;
                        const isAction = (option as any).isAddNew;
                        if (isAction) {
                          return (
                            <Box
                              key={key}
                              component="li"
                              {...otherProps}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.25,
                                py: 1,
                                px: 2,
                                color: "primary.main",
                                fontWeight: 600,
                                borderBottom: (t) => `1px dashed ${t.palette.divider}`,
                                backgroundColor: (t) => alpha(t.palette.primary.main, 0.05),
                                "&:hover": { backgroundColor: (t) => alpha(t.palette.primary.main, 0.12) },
                                cursor: "pointer",
                              }}
                            >
                              <Box component={UserPlus} sx={{ width: 16, height: 16, flexShrink: 0 }} />
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: "primary.main" }}>
                                  {option.name}
                                </Typography>
                                {(option as any).isNotFound && (
                                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "11px" }}>
                                    No existing customer found matching "{(option as any).typedName}". Click or press Enter to create.
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          );
                        }
                        return (
                          <Box key={key} component="li" {...otherProps} sx={{ py: 0.75, px: 2 }}>
                            <Box sx={{ width: "100%" }}>
                              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {option.name}
                                </Typography>
                                {option.gst_number && (
                                  <Box component="span" sx={{ fontSize: "10px", fontFamily: "monospace", px: 0.5, py: 0.125, borderRadius: 0.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.08), color: "primary.main", fontWeight: 600 }}>
                                    GST
                                  </Box>
                                )}
                              </Box>
                              {(option.phone || option.email) && (
                                <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "11px", display: "block" }}>
                                  {[option.phone, option.email].filter(Boolean).join(" · ")}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Search or select customer..."
                          slotProps={{
                            ...params.slotProps,
                            inputLabel: { shrink: true },
                            input: {
                              ...params.slotProps?.input,
                              endAdornment: (
                                <>
                                  {params.slotProps?.input?.endAdornment}
                                  <Tooltip title="Add new customer">
                                    <IconButton
                                      size="small"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setQuickCustomerOpen(true);
                                      }}
                                      edge="end"
                                      aria-label="Add new customer"
                                      sx={{ mr: 0.5 }}
                                    >
                                      <Box component={Plus} sx={{ width: 16, height: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                </>
                              ),
                            },
                          }}
                        />
                      )}
                      noOptionsText={
                        <Box sx={{ py: 1, textAlign: "center" }}>
                          <Typography variant="body2" sx={{ color: "text.secondary", mb: 1, fontSize: "0.8125rem" }}>
                            No customer found matching "{customerSearchInput}"
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<Box component={UserPlus} sx={{ width: 14, height: 14 }} />}
                            onClick={() => setQuickCustomerOpen(true)}
                          >
                            + Add New Customer
                          </Button>
                        </Box>
                      }
                    />
                  </Box>
                  {selectedCustomer && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)", padding: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.125rem" } }}>
                        <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>Bill To</Typography>
                        <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))" }}>{selectedCustomer.name}</Typography>
                        {selectedCustomer.phone && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.phone}</Typography>}
                        {selectedCustomer.email && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.email}</Typography>}
                        {selectedCustomer.address && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.address}</Typography>}
                        {selectedCustomer.gst_number && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>GSTIN: {selectedCustomer.gst_number}</Typography>}
                      </Box>
                      <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)", padding: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.125rem" } }}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                          <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Ship To</Typography>
                          {!selectedCustomer.shipping_address && (<Button type="button" onClick={() => {
                toast.success("Shipping = Billing address");
            }} variant="text" size="small" sx={{ height: "1.5rem", fontSize: "10px", gap: "0.25rem", paddingLeft: "0.5rem", paddingRight: "0.5rem" }}>
                              <Box component={Copy} sx={{ height: "0.75rem", width: "0.75rem" }}/> Same as Billing
                            </Button>)}
                        </Box>
                        {selectedCustomer.shipping_address ? (<>
                            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.shipping_address}</Typography>
                            {selectedCustomer.shipping_city && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.shipping_city}{selectedCustomer.shipping_state ? `, ${selectedCustomer.shipping_state}` : ""} {selectedCustomer.shipping_pincode || ""}</Typography>}
                          </>) : (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontStyle: "italic" }}>Same as billing address</Typography>)}
                      </Box>
                    </Box>)}
                </Box>
              </Box>

              <Divider />

              {/* Items */}
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                {!isLockedAccepted && (
                  <DocumentItemAdder
                    products={products}
                    onSelectProduct={addItem}
                    onAddCustomItem={addCustomItem}
                    selectLabel="Line Items"
                    emptyPlaceholder="+ Add Item"
                  />
                )}

                <SortableLineItemsEditor
                  items={items}
                  onChange={handleEditorItemsChange}
                  allowImages
                  showImages={showItemImages}
                  readOnly={isLockedAccepted}
                  uploadFolder="quotation-items"
                />
              </Box>

              <Divider />

              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={salesperson} label={"Salesperson"} select size="small" fullWidth disabled={isLockedAccepted} onChange={event => setSalesperson(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="">{"Unassigned"}</MenuItem>
                      {employees.map(e => <MenuItem key={e.id} value={e.id}>{e.name}</MenuItem>)}
                    </TextField>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={paymentTerms} label={"Payment Terms"} select size="small" fullWidth disabled={isLockedAccepted} onChange={event => setPaymentTerms(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select terms"}</MenuItem>
                      <MenuItem value="due_on_receipt">Due on Receipt</MenuItem>
                      <MenuItem value="net_7">Net 7</MenuItem>
                      <MenuItem value="net_15">Net 15</MenuItem>
                      <MenuItem value="net_30">Net 30</MenuItem>
                      <MenuItem value="net_45">Net 45</MenuItem>
                      <MenuItem value="net_60">Net 60</MenuItem>
                    </TextField>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField placeholder="Internal notes..." value={notes} disabled={isLockedAccepted} onChange={e => setNotes(e.target.value)} rows={2} label={"Notes"} size="small" fullWidth multiline/>
                </Box>
              </Box>

              {showTerms && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={terms} disabled={isLockedAccepted} onChange={e => setTerms(e.target.value)} rows={3} label={"Terms & Conditions"} size="small" fullWidth multiline/>
                </Box>)}

              {/* Totals */}
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Box sx={{ width: "100%", maxWidth: "20rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Subtotal</Box>
                    <Box component="span" sx={{ fontWeight: "500" }}>₹{totals.itemSubtotal.toFixed(2)}</Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>Discount</Box>
                    <Box sx={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                      <TextField type="number" disabled={isLockedAccepted} value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "1.75rem", width: "4rem", fontSize: "0.75rem", lineHeight: "1rem", textAlign: "right" }}/>
                      <TextField value={discountType} disabled={isLockedAccepted} select size="small" fullWidth onChange={event => (v => setDiscountType(v as "percentage" | "fixed"))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "1.75rem", width: "3rem", fontSize: "0.75rem", lineHeight: "1rem", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                          <MenuItem value="percentage" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>%</MenuItem>
                          <MenuItem value="fixed" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>₹</MenuItem>
                        </TextField>
                    </Box>
                  </Box>
                  {totals.globalDiscount > 0 && (<Box sx={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--success))" }}>
                      <Box component="span">Discount</Box><Box component="span">-₹{totals.globalDiscount.toFixed(2)}</Box>
                    </Box>)}
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>CGST</Box><Box component="span">₹{totals.cgst.toFixed(2)}</Box></Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>SGST</Box><Box component="span">₹{totals.sgst.toFixed(2)}</Box></Box>
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Box component="span" sx={{ fontWeight: "600", color: "hsl(var(--foreground))" }}>Total</Box>
                    <Box component="span" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>₹{totals.grandTotal.toFixed(2)}</Box>
                  </Box>
                </Box>
              </Box>

              {/* Bank Details */}
              {business?.bank_name && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)", padding: "1rem" }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "10px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", marginBottom: "0.5rem" }}>Bank Details for Payment</Typography>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "1.5rem", rowGap: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Bank</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{business.bank_name}</Box>
                    {business.bank_account_number && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Account No.</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{business.bank_account_number}</Box></>}
                    {business.bank_ifsc && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>IFSC</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{business.bank_ifsc}</Box></>}
                    {business.bank_branch && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Branch</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{business.bank_branch}</Box></>}
                    {business.bank_upi_id && <><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>UPI ID</Box><Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{business.bank_upi_id}</Box></>}
                  </Box>
                </Box>)}
            </CardContent>
          </Card>
        </Box>

        {/* Right Sidebar */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 4 / span 4" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", position: "sticky", top: "1.5rem" }}>
            <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              {!isLockedAccepted ? (
                <>
                  <Button onClick={() => void persistQuotation(true)} disabled={saving} variant="contained" sx={{ width: "100%" }}>
                    <Box component={Send} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>{saving ? "Saving..." : "Send Quotation"}
                  </Button>
                  <Button onClick={() => setPreviewOpen(true)} variant="outlined" sx={{ width: "100%" }}>
                    <Box component={Eye} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Preview
                  </Button>
                  <Button onClick={() => void persistQuotation(false)} disabled={saving} variant="outlined" sx={{ width: "100%" }}>
                    <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>{isEditing ? "Save Changes" : "Save Draft"}
                  </Button>
                </>
              ) : (
                <>
                  <Button onClick={() => void handleDuplicateAsNew()} disabled={saving} variant="contained" sx={{ width: "100%" }}>
                    <Box component={Copy} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Duplicate as New Quotation
                  </Button>
                  <Button onClick={() => setPreviewOpen(true)} variant="outlined" sx={{ width: "100%" }}>
                    <Box component={Eye} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Preview
                  </Button>
                </>
              )}

              <Divider />

              <Stack spacing={0.75}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Show Item Images</FormLabel>
                  <Switch checked={showItemImages} disabled={isLockedAccepted} onChange={(_, checked) => setShowItemImages(checked)}/>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>GST Inclusive</FormLabel>
                  <Switch checked={gstInclusive} disabled={isLockedAccepted} onChange={(_, checked) => setGstInclusive(checked)}/>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Terms & Conditions</FormLabel>
                  <Switch checked={showTerms} disabled={isLockedAccepted} onChange={(_, checked) => setShowTerms(checked)}/>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Client Notes</FormLabel>
                  <Switch checked={showClientNotes} disabled={isLockedAccepted} onChange={(_, checked) => setShowClientNotes(checked)}/>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <CustomerQuickDialog
        open={quickCustomerOpen}
        onClose={() => setQuickCustomerOpen(false)}
        initialName={customerSearchInput}
        onCustomerCreated={(newCust) => {
          setCustomers((prev) => [newCust as any, ...prev]);
          setCustomerId(newCust.id);
          setCustomerSearchInput("");
        }}
      />

      <DocumentPreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        type="quotation"
        docId={editId || sendDrawerTarget?.id || null}
        publicToken={quotationPublicToken}
        number={quotationNumber || "Draft"}
        status={quotationStatus}
        customer={selectedCustomer ? {
          name: selectedCustomer.name,
          email: selectedCustomer.email,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address,
          gstNumber: selectedCustomer.gst_number,
        } : null}
        items={items}
        showImages={showItemImages}
        gstInclusive={gstInclusive}
        globalDiscountType={discountType}
        globalDiscountValue={discountValue}
        notes={showClientNotes ? notes : null}
        terms={showTerms ? terms : null}
        validUntil={validUntil || null}
        paymentTerms={paymentTerms || null}
        salespersonName={employees.find((e) => e.id === salesperson)?.name || null}
        createdAt={dateIssued}
        onSendClick={isLockedAccepted ? undefined : () => {
          setPreviewOpen(false);
          void persistQuotation(true);
        }}
      />

      {sendDrawerTarget && (
        <SendDocumentDrawer
          open={Boolean(sendDrawerTarget)}
          onClose={() => {
            const savedId = sendDrawerTarget.id;
            setSendDrawerTarget(null);
            navigate(`/sales/${savedId}`);
          }}
          docType="quotation"
          docId={sendDrawerTarget.id}
          docNumber={sendDrawerTarget.docNumber}
          customerName={selectedCustomer?.name}
          defaultEmail={selectedCustomer?.email}
          defaultPhone={selectedCustomer?.phone}
          publicUrl={
            sendDrawerTarget.publicToken
              ? `${window.location.origin}/sales/public/${sendDrawerTarget.publicToken}`
              : null
          }
          totalLabel={`₹${totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          onEmailSent={() => setQuotationStatus((s) => (s === "draft" ? "sent" : s))}
        />
      )}
    </Box></AnimatedPage>;
}
