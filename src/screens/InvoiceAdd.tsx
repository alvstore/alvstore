"use client";

import {
    Autocomplete, Box, Button, Card, CardContent, Divider, FormLabel,
    IconButton, MenuItem, Switch, TableBody, TableCell, TableHead,
    TableRow, TextField, Tooltip, Typography, createFilterOptions
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatedPage, DataTable, PageHeader, toast } from "@/components/mui";
import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Send, Eye, Save, Trash2, Plus, UserPlus } from "lucide-react";
import { type DocumentItem, calcItemTotal } from "@/components/documents/ItemsTable";
import { calculateTotals } from "@/components/documents/TotalsPanel";
import { CustomerQuickDialog, type CustomerData } from "@/components/customers/CustomerQuickDialog";
interface Product {
    id: string;
    name: string;
    description: string | null;
    selling_price: number | null;
    gst_percentage: number | null;
}
interface Customer {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gst_number: string | null;
}
interface BusinessSettings {
    company_name: string | null;
    company_address: string | null;
    company_phone: string | null;
    company_email: string | null;
    gst_number: string | null;
    logo_url: string | null;
}
export default function InvoiceAdd() {
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
    // Form state
    const [customerId, setCustomerId] = useState("");
    const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);
    const [customerSearchInput, setCustomerSearchInput] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [dateIssued] = useState(new Date().toISOString().split("T")[0]);
    const [notes, setNotes] = useState("");
    const [salesperson, setSalesperson] = useState("");
    const [paymentTerms, setPaymentTerms] = useState("");
    const [items, setItems] = useState<DocumentItem[]>([]);
    const [gstInclusive, setGstInclusive] = useState(false);
    const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
    const [discountValue, setDiscountValue] = useState(0);
    // Toggles
    const [showPaymentTerms, setShowPaymentTerms] = useState(true);
    const [showClientNotes, setShowClientNotes] = useState(true);

    const customerFilter = useMemo(
      () =>
        createFilterOptions<Customer>({
          stringify: (option) =>
            [option.name, option.phone, option.email, option.gst_number].filter(Boolean).join(" "),
        }),
      []
    );

    useEffect(() => {
        if (editId) return;
        const paramId = searchParams?.get("customerId") || searchParams?.get("customer_id");
        if (paramId && !customerId) {
            setCustomerId(paramId);
        }
    }, [searchParams, editId, customerId]);
    useEffect(() => {
        Promise.all([
            supabase.from("customers").select("id, name, email, phone, address, gst_number").order("name"),
            supabase.from("products").select("id, name, description, selling_price, gst_percentage").order("name"),
            supabase.from("business_settings").select("company_name, company_address, company_phone, company_email, gst_number, logo_url").limit(1).single(),
            supabase.from("employees").select("id, name").in("role", ["admin", "staff"]).eq("status", "active").order("name"),
        ]).then(([c, p, b, e]) => {
            setCustomers(c.data || []);
            setProducts(p.data || []);
            if (b.data)
                setBusiness(b.data);
            setEmployees(e.data || []);
        });
    }, []);
    // Load existing invoice for editing
    useEffect(() => {
        if (!editId)
            return;
        const loadInvoice = async () => {
            const { data: inv } = await supabase.from("invoices").select("*").eq("id", editId).single();
            if (inv) {
                setCustomerId(inv.customer_id || "");
                setDueDate(inv.due_date || "");
                setNotes(inv.notes || "");
                setGstInclusive(inv.gst_inclusive || false);
                setDiscountType((inv.discount_type as "percentage" | "fixed") || "percentage");
                setDiscountValue(inv.discount_value || 0);
            }
            const { data: itms } = await supabase.from("invoice_items").select("*").eq("invoice_id", editId);
            if (itms) {
                setItems(itms.map((i: any) => ({
                    id: i.id, product_id: i.product_id, product_name: i.product_name,
                    description: i.description || "", hsn_code: i.hsn_code || "",
                    quantity: i.quantity, unit_price: i.unit_price,
                    discount_type: i.discount_type || "percentage", discount_value: i.discount_value || 0,
                    gst_percentage: i.gst_percentage || 18, gst_enabled: true, total: i.total,
                })));
            }
        };
        loadInvoice();
    }, [editId]);
    const selectedCustomer = customerId ? customers.find(c => c.id === customerId) : null;
    const totals = calculateTotals(items, gstInclusive, discountType, discountValue);
    const addItem = (productId: string) => {
        const product = products.find(p => p.id === productId);
        if (!product)
            return;
        const newItem: DocumentItem = {
            product_id: product.id, product_name: product.name,
            description: product.description || "", hsn_code: "",
            quantity: 1, unit_price: product.selling_price || 0,
            discount_type: "percentage", discount_value: 0,
            gst_percentage: product.gst_percentage || 18, gst_enabled: true,
            total: product.selling_price || 0,
        };
        setItems([...items, newItem]);
    };
    const updateItem = (idx: number, updates: Partial<DocumentItem>) => {
        setItems(items.map((item, i) => {
            if (i !== idx)
                return item;
            const updated = { ...item, ...updates };
            updated.total = calcItemTotal(updated);
            return updated;
        }));
    };
    const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
    const handleSave = async () => {
        if (!customerId) {
            toast.error("Select a customer");
            return;
        }
        if (items.length === 0) {
            toast.error("Add at least one item");
            return;
        }
        setSaving(true);
        if (isEditing) {
            const { error: invErr } = await supabase.from("invoices").update({
                customer_id: customerId, subtotal: totals.itemSubtotal, gst_amount: totals.gstAmount,
                total: totals.grandTotal, notes: notes || null, due_date: dueDate || null,
                discount_type: discountType, discount_value: discountValue, gst_inclusive: gstInclusive,
            }).eq("id", editId);
            if (invErr) {
                toast.error(invErr.message);
                setSaving(false);
                return;
            }
            await supabase.from("invoice_items").delete().eq("invoice_id", editId);
            const invItems = items.map(i => ({
                invoice_id: editId, product_id: i.product_id, product_name: i.product_name,
                quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage, total: i.total,
                description: i.description || null, hsn_code: i.hsn_code || null,
                discount_type: i.discount_type, discount_value: i.discount_value,
            }));
            await supabase.from("invoice_items").insert(invItems);
            setSaving(false);
            toast.success("Invoice updated");
            navigate(`/invoices/${editId}`);
        }
        else {
            const { data: inv, error: invErr } = await supabase.from("invoices").insert({
                customer_id: customerId, subtotal: totals.itemSubtotal, gst_amount: totals.gstAmount,
                total: totals.grandTotal, notes: notes || null, due_date: dueDate || null,
                discount_type: discountType, discount_value: discountValue,
                gst_inclusive: gstInclusive, created_by: user?.id,
            }).select().single();
            if (invErr) {
                toast.error(invErr.message);
                setSaving(false);
                return;
            }
            const invItems = items.map(i => ({
                invoice_id: inv.id, product_id: i.product_id, product_name: i.product_name,
                quantity: i.quantity, unit_price: i.unit_price, gst_percentage: i.gst_percentage, total: i.total,
                description: i.description || null, hsn_code: i.hsn_code || null,
                discount_type: i.discount_type, discount_value: i.discount_value,
            }));
            const { error: iErr } = await supabase.from("invoice_items").insert(invItems);
            setSaving(false);
            if (iErr)
                toast.error(iErr.message);
            else {
                toast.success("Invoice created — " + inv.invoice_number);
                navigate(`/invoices/${inv.id}`);
            }
        }
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Header */}
      <PageHeader title={isEditing ? "Edit Invoice" : "Add Invoice"} subtitle={isEditing ? "Update invoice details" : "Create a new GST invoice"} actions={<><IconButton onClick={() => navigate("/invoices")} aria-label={"Arrow Left"}>
          <Box component={ArrowLeft} sx={{ height: "1.25rem", width: "1.25rem" }}/>
        </IconButton></>}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(12, minmax(0, 1fr))" }, gap: "1.5rem" }}>
        {/* Left Column - Invoice Form (70%) */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 8 / span 8" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
            <CardContent sx={{ padding: "1.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              {/* Business Header + Invoice Info */}
              <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, justifyContent: "space-between", gap: "1rem" }}>
                <Box>
                  {business?.logo_url && <Box src={business.logo_url} alt="Logo" component="img" sx={{ height: "2.5rem", marginBottom: "0.5rem" }}/>}
                  <Typography component="p" variant="body1" sx={{ fontWeight: "700", color: "hsl(var(--foreground))" }}>{business?.company_name || "Your Company"}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{business?.company_address}</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{business?.company_phone} · {business?.company_email}</Typography>
                  {business?.gst_number && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>GSTIN: {business.gst_number}</Typography>}
                </Box>
                <Box sx={{ textAlign: "right", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                  <Typography component="h2" variant="h2" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", color: "hsl(var(--primary))" }}>Invoice</Typography>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}># Auto-generated</Typography>
                </Box>
              </Box>

              <Divider />

              {/* Date + Customer */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1.5rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField type="date" value={dateIssued} label={"Date Issued"} size="small" fullWidth slotProps={{ htmlInput: { readOnly: true }, inputLabel: { shrink: true } }} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}/>
                  </Box>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} label={"Due Date"} size="small" fullWidth slotProps={{ inputLabel: { shrink: true } }}/>
                  </Box>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                        Invoice To *
                      </Typography>
                      <Button
                        size="small"
                        variant="text"
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
                  {selectedCustomer && (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)", padding: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.125rem" } }}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", color: "hsl(var(--foreground))" }}>{selectedCustomer.name}</Typography>
                      {selectedCustomer.phone && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.phone}</Typography>}
                      {selectedCustomer.email && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.email}</Typography>}
                      {selectedCustomer.address && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{selectedCustomer.address}</Typography>}
                      {selectedCustomer.gst_number && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>GSTIN: {selectedCustomer.gst_number}</Typography>}
                    </Box>)}
                </Box>
              </Box>

              <Divider />

              {/* Items Table - Materialize style */}
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>

                  <TextField label={"Line Items"} select size="small" fullWidth value="" onChange={event => addItem(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "200px", fontSize: "0.75rem", lineHeight: "1rem" }}><MenuItem value="" disabled>{"+ Add Item"}</MenuItem>
                      {products.map(p => (<MenuItem key={p.id} value={p.id} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{p.name} — ₹{p.selling_price}</MenuItem>))}
                    </TextField>
                </Box>

                {items.length === 0 ? (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "2px", borderStyle: "dashed", borderColor: "hsl(var(--border))", padding: "2rem", textAlign: "center" }}>
                    <Box component={Plus} sx={{ height: "2rem", width: "2rem", marginLeft: "auto", marginRight: "auto", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 40%, transparent)", marginBottom: "0.5rem" }}/>
                    <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>Add items to your invoice</Typography>
                  </Box>) : (<Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", borderColor: "hsl(var(--border))", overflow: "hidden" }}>
                    <DataTable columnsCount={5} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                      <TableHead>
                        <TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderBottomWidth: "1px", borderColor: "hsl(var(--border))" }}>
                          <TableCell sx={{ textAlign: "left", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em" }}>Item</TableCell>
                          <TableCell sx={{ textAlign: "right", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", width: "6rem" }}>Cost</TableCell>
                          <TableCell sx={{ textAlign: "right", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", width: "5rem" }}>Qty</TableCell>
                          <TableCell sx={{ textAlign: "right", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "600", color: "hsl(var(--muted-foreground))", textTransform: "uppercase", letterSpacing: "0.05em", width: "6rem" }}>Price</TableCell>
                          <TableCell sx={{ width: "2.5rem" }}/>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {items.map((item, idx) => (<TableRow key={idx} sx={{ borderBottomWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "&:last-child": { borderWidth: "0px" } }}>
                            <TableCell sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}>
                              <Typography component="p" variant="body1" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{item.product_name}</Typography>
                              <TextField placeholder="Description" value={item.description} onChange={e => updateItem(idx, { description: e.target.value })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Description" } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem", marginTop: "0.25rem", borderWidth: "0px", paddingLeft: "0px", paddingRight: "0px", backgroundColor: "transparent", "--alv-shadow": "0 0 #0000", "--alv-shadow-colored": "0 0 #0000", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "&:focus-visible": { "--alv-ring-offset-shadow": "var(--alv-ring-inset) 0 0 0 var(--alv-ring-offset-width) var(--alv-ring-offset-color)", "--alv-ring-shadow": "var(--alv-ring-inset) 0 0 0 calc(0px + var(--alv-ring-offset-width)) var(--alv-ring-color)", boxShadow: "var(--alv-ring-offset-shadow), var(--alv-ring-shadow), var(--alv-shadow, 0 0 #0000)" } }}/>
                            </TableCell>
                            <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}>
                              <TextField type="number" value={item.unit_price} onChange={e => updateItem(idx, { unit_price: parseFloat(e.target.value) || 0 })} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem", textAlign: "right" }}/>
                            </TableCell>
                            <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}>
                              <TextField type="number" value={item.quantity} onChange={e => updateItem(idx, { quantity: parseInt(e.target.value) || 0 })} size="small" fullWidth slotProps={{ htmlInput: { min: "1", "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.875rem", lineHeight: "1.25rem", textAlign: "right" }}/>
                            </TableCell>
                            <TableCell sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.75rem", paddingBottom: "0.75rem", textAlign: "right", fontWeight: "600", color: "hsl(var(--foreground))" }}>
                              ₹{item.total.toFixed(2)}
                            </TableCell>
                            <TableCell sx={{ paddingRight: "0.5rem", paddingTop: "0.75rem", paddingBottom: "0.75rem" }}>
                              <IconButton onClick={() => removeItem(idx)} aria-label={"Trash2"} sx={{ height: "1.75rem", width: "1.75rem", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--destructive))" } }}>
                                <Box component={Trash2} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                              </IconButton>
                            </TableCell>
                          </TableRow>))}
                      </TableBody>
                    </DataTable>
                  </Box>)}
              </Box>

              <Divider />

              {/* Salesperson + Message */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={salesperson} label={"Salesperson"} select size="small" fullWidth onChange={event => setSalesperson(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select salesperson"}</MenuItem>
                      {employees.map(e => <MenuItem key={e.id} value={e.name}>{e.name}</MenuItem>)}
                    </TextField>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={paymentTerms} label={"Payment Terms"} select size="small" fullWidth onChange={event => setPaymentTerms(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select terms"}</MenuItem>
                      <MenuItem value="due_on_receipt">Due on Receipt</MenuItem>
                      <MenuItem value="net_7">Net 7</MenuItem>
                      <MenuItem value="net_15">Net 15</MenuItem>
                      <MenuItem value="net_30">Net 30</MenuItem>
                      <MenuItem value="net_45">Net 45</MenuItem>
                      <MenuItem value="net_60">Net 60</MenuItem>
                    </TextField>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField placeholder="Thanks for your business!" value={notes} onChange={e => setNotes(e.target.value)} rows={2} label={"Message / Thanks"} size="small" fullWidth multiline/>
                </Box>
              </Box>

              {/* Totals - right aligned */}
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Box sx={{ width: "100%", maxWidth: "20rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Subtotal</Box>
                    <Box component="span" sx={{ fontWeight: "500" }}>₹{totals.itemSubtotal.toFixed(2)}</Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>Discount</Box>
                    <Box sx={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                      <TextField type="number" value={discountValue} onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "1.75rem", width: "4rem", fontSize: "0.75rem", lineHeight: "1rem", textAlign: "right" }}/>
                      <TextField value={discountType} select size="small" fullWidth onChange={event => (v => setDiscountType(v as "percentage" | "fixed"))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "1.75rem", width: "3rem", fontSize: "0.75rem", lineHeight: "1rem", paddingLeft: "0.25rem", paddingRight: "0.25rem" }}>
                          <MenuItem value="percentage" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>%</MenuItem>
                          <MenuItem value="fixed" sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>₹</MenuItem>
                        </TextField>
                    </Box>
                  </Box>
                  {totals.globalDiscount > 0 && (<Box sx={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--success))" }}>
                      <Box component="span">Discount</Box>
                      <Box component="span">-₹{totals.globalDiscount.toFixed(2)}</Box>
                    </Box>)}
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>CGST</Box>
                    <Box component="span">₹{totals.cgst.toFixed(2)}</Box>
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", lineHeight: "1rem" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>SGST</Box>
                    <Box component="span">₹{totals.sgst.toFixed(2)}</Box>
                  </Box>
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Box component="span" sx={{ fontWeight: "600", color: "hsl(var(--foreground))" }}>Total</Box>
                    <Box component="span" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700", color: "hsl(var(--foreground))" }}>₹{totals.grandTotal.toFixed(2)}</Box>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Box>

        {/* Right Column - Action Sidebar (30%) */}
        <Box sx={{ "@media (min-width: 1024px)": { gridColumn: "span 4 / span 4" }, "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
          <Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", position: "sticky", top: "1.5rem" }}>
            <CardContent sx={{ padding: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              <Button onClick={handleSave} disabled={saving} variant="contained" sx={{ width: "100%" }}>
                <Box component={Send} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>{saving ? "Saving..." : "Send Invoice"}
              </Button>
              <Button onClick={() => navigate("/invoices")} variant="outlined" sx={{ width: "100%" }}>
                <Box component={Eye} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Preview
              </Button>
              <Button onClick={handleSave} disabled={saving} variant="outlined" sx={{ width: "100%" }}>
                <Box component={Save} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>Save
              </Button>

              <Divider />

              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>GST Inclusive</FormLabel>
                  <Switch checked={gstInclusive} onChange={(event, checked) => setGstInclusive(checked)}/>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Payment Terms</FormLabel>
                  <Switch checked={showPaymentTerms} onChange={(event, checked) => setShowPaymentTerms(checked)}/>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <FormLabel sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Client Notes</FormLabel>
                  <Switch checked={showClientNotes} onChange={(event, checked) => setShowClientNotes(checked)}/>
                </Box>
              </Box>
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
    </Box></AnimatedPage>;
}
