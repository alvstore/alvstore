"use client";

import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  createFilterOptions,
} from "@mui/material";
import { AnimatedPage, PageHeader, toast } from "@/components/mui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Eye, Save, Send, Truck } from "lucide-react";
import { type DocumentItem } from "@/components/documents/ItemsTable";
import { DocumentItemAdder } from "@/components/documents/DocumentItemAdder";
import { calculateTotals } from "@/components/documents/TotalsPanel";
import {
  SortableLineItemsEditor,
  computeLineTotal,
  type EditableLineItem,
} from "@/components/documents/SortableLineItemsEditor";
import { DocumentPreview } from "@/components/documents/DocumentPreview";
import { CustomerQuickDialog } from "@/components/customers/CustomerQuickDialog";
import { recordSystemAudit } from "@/lib/audit";

interface ProductOption {
  id: string;
  name: string;
  description: string | null;
  selling_price: number | null;
  gst_percentage: number | null;
  image_url?: string | null;
}

interface CustomerOption {
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

function formatShippingAddress(c?: CustomerOption | null): string {
  if (!c) return "";
  if (c.shipping_address) {
    return [c.shipping_address, c.shipping_city, c.shipping_state, c.shipping_pincode].filter(Boolean).join(", ");
  }
  return c.address || "";
}

export default function DeliveryChallanAdd() {
  const { user } = useAuth();
  const { id: editId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const isEditing = Boolean(editId);
  const quotationIdParam = searchParams?.get("quotationId") || "";
  const invoiceIdParam = searchParams?.get("invoiceId") || "";
  const jobIdParam = searchParams?.get("jobId") || "";
  const duplicateFrom = searchParams?.get("duplicateFrom") || "";

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [saving, setSaving] = useState(false);

  const [challanNumber, setChallanNumber] = useState("");
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [challanStatus, setChallanStatus] = useState("draft");
  const [customerId, setCustomerId] = useState("");
  const [customerSearchInput, setCustomerSearchInput] = useState("");
  const [quickCustomerOpen, setQuickCustomerOpen] = useState(false);

  const [linkedQuotationId, setLinkedQuotationId] = useState<string | null>(null);
  const [linkedInvoiceId, setLinkedInvoiceId] = useState<string | null>(null);
  const [linkedJobSheetId, setLinkedJobSheetId] = useState<string | null>(null);
  const [invoiceAlreadyDeducted, setInvoiceAlreadyDeducted] = useState(false);
  const [stockDeductedAt, setStockDeductedAt] = useState<string | null>(null);

  const [challanType, setChallanType] = useState("delivery");
  const [showPricing, setShowPricing] = useState(true);
  const [showItemImages, setShowItemImages] = useState(false);
  const [deductStock, setDeductStock] = useState(true);
  const [gstInclusive, setGstInclusive] = useState(false);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [discountValue, setDiscountValue] = useState(0);

  const [shippingAddress, setShippingAddress] = useState("");
  const [courierName, setCourierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [ewayBillNumber, setEwayBillNumber] = useState("");
  const [deliveryPerson, setDeliveryPerson] = useState("");
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [expectedDeliveryAt, setExpectedDeliveryAt] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<DocumentItem[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  const customerFilter = useMemo(
    () =>
      createFilterOptions<CustomerOption>({
        stringify: (o) => [o.name, o.phone, o.email, o.gst_number].filter(Boolean).join(" "),
      }),
    []
  );

  useEffect(() => {
    void Promise.all([
      supabase
        .from("customers")
        .select("id, name, email, phone, address, gst_number, shipping_address, shipping_city, shipping_state, shipping_pincode")
        .order("name"),
      supabase
        .from("products")
        .select("id, name, description, selling_price, gst_percentage, image_url")
        .order("name"),
    ]).then(([c, p]) => {
      setCustomers((c.data || []) as CustomerOption[]);
      setProducts((p.data || []) as ProductOption[]);
    });
  }, []);

  // Load existing challan for edit or duplicate, or prefill from quotationId / invoiceId / jobId
  useEffect(() => {
    const sourceChallanId = editId || duplicateFrom;
    if (sourceChallanId) {
      void (async () => {
        const { data: ch } = await (supabase as any).from("delivery_challans").select("*").eq("id", sourceChallanId).single();
        if (ch) {
          setCustomerId(ch.customer_id || "");
          setLinkedQuotationId(ch.quotation_id || null);
          setLinkedInvoiceId(editId ? (ch.invoice_id || null) : null);
          setLinkedJobSheetId(ch.job_sheet_id || null);
          setChallanType(ch.challan_type || "delivery");
          setShowPricing(ch.show_pricing !== false);
          setShowItemImages(ch.show_item_images !== false);
          setDeductStock(ch.job_sheet_id ? false : ch.deduct_stock !== false);
          setGstInclusive(Boolean(ch.gst_inclusive));
          setDiscountType((ch.discount_type as "percentage" | "fixed") || "percentage");
          setDiscountValue(Number(ch.discount_value || 0));
          setShippingAddress(ch.shipping_address || "");
          setCourierName(ch.courier_name || "");
          setTrackingNumber(ch.tracking_number || "");
          setTrackingUrl(ch.tracking_url || "");
          setEwayBillNumber(ch.eway_bill_number || "");
          setDeliveryPerson(ch.delivery_person || "");
          setVehicleNumber(ch.vehicle_number || "");
          setExpectedDeliveryAt(ch.expected_delivery_at ? String(ch.expected_delivery_at).slice(0, 10) : "");
          setNotes(ch.notes || "");
          if (editId) {
            setChallanNumber(ch.challan_number || "");
            setPublicToken(ch.public_token || null);
            setChallanStatus(ch.status || "draft");
            setStockDeductedAt(ch.stock_deducted_at || null);
          }
          if (ch.invoice_id) {
            const { data: inv } = await supabase
              .from("invoices")
              .select("stock_deducted_at")
              .eq("id", ch.invoice_id)
              .maybeSingle();
            setInvoiceAlreadyDeducted(Boolean(inv?.stock_deducted_at));
          }
        }
        const { data: itms } = await (supabase as any)
          .from("delivery_challan_items")
          .select("*")
          .eq("challan_id", sourceChallanId)
          .order("sort_order", { ascending: true });
        if (itms) {
          setItems(
            itms.map((i: any, idx: number) => ({
              id: editId ? i.id : undefined,
              product_id: i.product_id,
              product_name: i.product_name,
              description: i.description || "",
              hsn_code: i.hsn_code || "",
              quantity: Number(i.quantity || 1),
              unit_price: Number(i.unit_price || 0),
              discount_type: (i.discount_type as "percentage" | "fixed") || "percentage",
              discount_value: Number(i.discount_value || 0),
              gst_percentage: Number(i.gst_percentage ?? 18),
              gst_enabled: true,
              total: Number(i.total || 0),
              image_url: i.image_url || null,
              sort_order: i.sort_order ?? idx,
            }))
          );
        }
      })();
      return;
    }

    if (quotationIdParam) {
      void (async () => {
        const { data: q } = await supabase
          .from("quotations")
          .select("*, customers(id, address, shipping_address, shipping_city, shipping_state, shipping_pincode)")
          .eq("id", quotationIdParam)
          .single();
        if (q) {
          setLinkedQuotationId(q.id);
          setCustomerId(q.customer_id || "");
          setShippingAddress(formatShippingAddress((q as any).customers));
          setGstInclusive(Boolean(q.gst_inclusive));
          setDiscountType((q.discount_type as "percentage" | "fixed") || "percentage");
          setDiscountValue(Number(q.discount_value || 0));
          setShowItemImages(q.show_item_images !== false);
          setNotes(q.notes || `Dispatch against Quotation ${q.quotation_number}`);
        }
        const { data: qItems } = await supabase
          .from("quotation_items")
          .select("*")
          .eq("quotation_id", quotationIdParam)
          .order("sort_order", { ascending: true });
        if (qItems) {
          setItems(
            qItems.map((i: any, idx: number) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              description: i.description || "",
              hsn_code: i.hsn_code || "",
              quantity: Number(i.quantity || 1),
              unit_price: Number(i.unit_price || 0),
              discount_type: (i.discount_type as "percentage" | "fixed") || "percentage",
              discount_value: Number(i.discount_value || 0),
              gst_percentage: Number(i.gst_percentage ?? 18),
              gst_enabled: true,
              total: Number(i.total || 0),
              image_url: i.image_url || null,
              sort_order: i.sort_order ?? idx,
            }))
          );
        }
      })();
      return;
    }

    if (invoiceIdParam) {
      void (async () => {
        const { data: inv } = await supabase
          .from("invoices")
          .select("*, customers(id, address, shipping_address, shipping_city, shipping_state, shipping_pincode)")
          .eq("id", invoiceIdParam)
          .single();
        if (inv) {
          setLinkedInvoiceId(inv.id);
          setLinkedQuotationId(inv.quotation_id || null);
          setCustomerId(inv.customer_id || "");
          setShippingAddress(formatShippingAddress((inv as any).customers));
          setGstInclusive(Boolean(inv.gst_inclusive));
          setDiscountType((inv.discount_type as "percentage" | "fixed") || "percentage");
          setDiscountValue(Number(inv.discount_value || 0));
          setInvoiceAlreadyDeducted(Boolean(inv.stock_deducted_at));
          if (inv.stock_deducted_at) setDeductStock(false);
          setNotes(inv.notes || `Dispatch against Invoice ${inv.invoice_number}`);
        }
        const { data: invItems } = await supabase
          .from("invoice_items")
          .select("*")
          .eq("invoice_id", invoiceIdParam)
          .order("sort_order", { ascending: true });
        if (invItems) {
          setItems(
            invItems.map((i: any, idx: number) => ({
              product_id: i.product_id,
              product_name: i.product_name,
              description: i.description || "",
              hsn_code: i.hsn_code || "",
              quantity: Number(i.quantity || 1),
              unit_price: Number(i.unit_price || 0),
              discount_type: (i.discount_type as "percentage" | "fixed") || "percentage",
              discount_value: Number(i.discount_value || 0),
              gst_percentage: Number(i.gst_percentage ?? 18),
              gst_enabled: true,
              total: Number(i.total || 0),
              image_url: null,
              sort_order: i.sort_order ?? idx,
            }))
          );
        }
      })();
      return;
    }

    if (jobIdParam) {
      void (async () => {
        const { data: job } = await supabase
          .from("job_sheets")
          .select("*, customers(id, address, shipping_address, shipping_city, shipping_state, shipping_pincode)")
          .eq("id", jobIdParam)
          .single();
        if (job) {
          setLinkedJobSheetId(job.id);
          setLinkedInvoiceId(job.invoice_id || null);
          setCustomerId(job.customer_id || "");
          setShippingAddress(formatShippingAddress((job as any).customers));
          setChallanType("delivery");
          setShowPricing(false);
          setDeductStock(false);
          setNotes(`Customer repaired device return handover for Job ${job.job_number}`);
          const deviceLabel = [job.device_brand, job.device_model].filter(Boolean).join(" ") || "Repaired Device";
          const specLine = [
            job.serial_number ? `Serial: ${job.serial_number}` : "",
            job.imei ? `IMEI: ${job.imei}` : "",
            job.problem_description || "",
          ]
            .filter(Boolean)
            .join(" · ");
          setItems([
            {
              product_id: null,
              product_name: deviceLabel,
              description: specLine,
              hsn_code: "",
              quantity: 1,
              unit_price: 0,
              discount_type: "percentage",
              discount_value: 0,
              gst_percentage: 0,
              gst_enabled: false,
              total: 0,
              image_url: null,
              sort_order: 0,
            },
          ]);
        }
      })();
    }
  }, [editId, duplicateFrom, quotationIdParam, invoiceIdParam, jobIdParam]);

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId) || null, [customers, customerId]);
  const totals = calculateTotals(items, gstInclusive, discountType, discountValue);

  const addItem = (productId: string) => {
    const p = products.find((pr) => pr.id === productId);
    if (!p) return;
    setItems([
      ...items,
      {
        product_id: p.id,
        product_name: p.name,
        description: p.description || "",
        hsn_code: "",
        quantity: 1,
        unit_price: Number(p.selling_price || 0),
        discount_type: "percentage",
        discount_value: 0,
        gst_percentage: p.gst_percentage ?? 18,
        gst_enabled: true,
        total: Number(p.selling_price || 0),
        image_url: p.image_url || null,
        sort_order: items.length,
      },
    ]);
  };

  const addCustomItem = () => {
    setItems([
      ...items,
      {
        product_id: null,
        product_name: "Custom Item",
        description: "",
        hsn_code: "",
        quantity: 1,
        unit_price: 0,
        discount_type: "percentage",
        discount_value: 0,
        gst_percentage: 18,
        gst_enabled: true,
        total: 0,
        image_url: null,
        sort_order: items.length,
      },
    ]);
  };

  const handleEditorItemsChange = (nextItems: EditableLineItem[]) => {
    setItems(
      nextItems.map((it, idx) => {
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
        docItem.total = computeLineTotal(docItem);
        return docItem;
      })
    );
  };

  const saveChallan = async (dispatchNow = false) => {
    if (!customerId) {
      toast.error("Select a customer");
      return;
    }
    if (items.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    setSaving(true);
    try {
      const effectiveDeductStock = linkedJobSheetId ? false : deductStock;
      const basePayload: Record<string, unknown> = {
        customer_id: customerId,
        quotation_id: linkedQuotationId,
        invoice_id: linkedInvoiceId,
        job_sheet_id: linkedJobSheetId,
        challan_type: challanType,
        show_pricing: showPricing,
        show_item_images: showItemImages,
        deduct_stock: effectiveDeductStock,
        gst_inclusive: gstInclusive,
        discount_type: discountType,
        discount_value: discountValue,
        subtotal: totals.itemSubtotal,
        gst_amount: totals.gstAmount,
        total: totals.grandTotal,
        shipping_address: shippingAddress.trim() || null,
        courier_name: courierName.trim() || null,
        tracking_number: trackingNumber.trim() || null,
        tracking_url: trackingUrl.trim() || null,
        eway_bill_number: ewayBillNumber.trim() || null,
        delivery_person: deliveryPerson.trim() || null,
        vehicle_number: vehicleNumber.trim() || null,
        expected_delivery_at: expectedDeliveryAt ? new Date(expectedDeliveryAt).toISOString() : null,
        notes: notes.trim() || null,
      };

      let savedId = editId || "";
      let savedNumber = challanNumber;

      if (isEditing && editId) {
        const { error: uErr } = await (supabase as any).from("delivery_challans").update(basePayload).eq("id", editId);
        if (uErr) throw new Error(uErr.message);
        await (supabase as any).from("delivery_challan_items").delete().eq("challan_id", editId);
      } else {
        const { data: created, error: cErr } = await (supabase as any)
          .from("delivery_challans")
          .insert({
            challan_number: "",
            status: "draft",
            created_by: user?.id,
            timeline: [
              {
                status: "draft",
                label: "Draft Created",
                at: new Date().toISOString(),
                by: user?.email || "Staff",
              },
            ],
            ...basePayload,
          })
          .select()
          .single();
        if (cErr || !created) throw new Error(cErr?.message || "Failed to create delivery challan");
        savedId = created.id;
        savedNumber = created.challan_number;
      }

      const itemRows = items.map((i, idx) => {
        const gstPct = Number(i.gst_percentage ?? 18);
        const gstAmt = gstInclusive
          ? (i.total * gstPct) / (100 + gstPct)
          : (i.total * gstPct) / 100;
        return {
          challan_id: savedId,
          product_id: i.product_id,
          product_name: i.product_name,
          description: i.description || null,
          hsn_code: i.hsn_code || null,
          quantity: i.quantity,
          unit_price: i.unit_price,
          discount_type: i.discount_type,
          discount_value: i.discount_value,
          gst_percentage: gstPct,
          gst_amount: Math.round(gstAmt * 100) / 100,
          total: i.total,
          image_url: i.image_url || null,
          sort_order: i.sort_order ?? idx,
        };
      });
      const { error: iErr } = await (supabase as any).from("delivery_challan_items").insert(itemRows);
      if (iErr) throw new Error(iErr.message);

      if (dispatchNow) {
        const { data: tr, error: trErr } = await supabase.functions.invoke("challan-transition", {
          body: {
            challan_id: savedId,
            target_status: "dispatched",
            note: courierName ? `Dispatched via ${courierName}${trackingNumber ? ` (${trackingNumber})` : ""}` : "Marked dispatched",
          },
        });
        if (trErr || !tr?.success) {
          throw new Error(trErr?.message || tr?.error || "Saved challan, but dispatch transition failed");
        }
      }

      await recordSystemAudit({
        action: isEditing ? "challan_updated" : "challan_created",
        module: "sales",
        entityType: "delivery_challan",
        entityId: savedId,
        details: `${isEditing ? "Updated" : "Created"} challan ${savedNumber} (${challanType}, ${items.length} items)`,
      });

      toast.success(dispatchNow ? `${savedNumber} saved & dispatched` : `${savedNumber} saved`);
      navigate(`/challans/${savedId}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatedPage>
      <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        <PageHeader
          title={isEditing ? `Edit Delivery Challan${challanNumber ? ` · ${challanNumber}` : ""}` : "New Delivery Challan"}
          subtitle="2026 GST Rule 55 dispatch tracking, item thumbnails, reordering, and POD readiness"
          actions={
            <IconButton onClick={() => navigate("/challans")} aria-label="Back to Challans">
              <Box component={ArrowLeft} sx={{ height: "1.25rem", width: "1.25rem" }} />
            </IconButton>
          }
        />

        {linkedJobSheetId && (
          <Alert severity="info">
            Customer repair return handover: pricing &amp; showroom stock deduction are automatically disabled by default.
          </Alert>
        )}
        {invoiceAlreadyDeducted && (
          <Alert severity="info">
            Linked invoice has already deducted showroom stock — dispatching this challan will NOT double-deduct inventory.
          </Alert>
        )}

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(12, minmax(0, 1fr))" }, gap: 3 }}>
          <Box sx={{ gridColumn: { lg: "span 8 / span 8" } }}>
            <Stack spacing={3}>
              {/* Customer & Logistics Header */}
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Stack spacing={2.5}>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                      <Box>
                        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.75 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            Customer *
                          </Typography>
                          <Button size="small" onClick={() => setQuickCustomerOpen(true)}>
                            + Quick Add
                          </Button>
                        </Box>
                        <Autocomplete<CustomerOption>
                          size="small"
                          options={customers}
                          filterOptions={customerFilter}
                          value={selectedCustomer}
                          isOptionEqualToValue={(option, val) => option.id === val.id}
                          onInputChange={(_, val, reason) => {
                            if (reason === "input") setCustomerSearchInput(val);
                            else if (reason === "reset" || reason === "clear") setCustomerSearchInput("");
                          }}
                          getOptionLabel={(o) => o.name || ""}
                          onChange={(_, val) => {
                            setCustomerId(val?.id || "");
                            if (val && !shippingAddress) {
                              setShippingAddress(formatShippingAddress(val));
                            }
                          }}
                          renderOption={(props, opt) => (
                            <Box component="li" {...props} key={opt.id}>
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {opt.name}
                                </Typography>
                                {(opt.phone || opt.email) && (
                                  <Typography variant="caption" color="text.secondary">
                                    {[opt.phone, opt.email].filter(Boolean).join(" · ")}
                                  </Typography>
                                )}
                              </Box>
                            </Box>
                          )}
                          renderInput={(params) => (
                            <TextField {...params} placeholder="Search name, phone, GSTIN..." />
                          )}
                        />
                      </Box>

                      <TextField
                        select
                        size="small"
                        fullWidth
                        label="Challan Type"
                        value={challanType}
                        onChange={(e) => setChallanType(e.target.value)}
                      >
                        <MenuItem value="delivery">Standard Delivery</MenuItem>
                        <MenuItem value="approval_demo">Approval / Demo Unit</MenuItem>
                        <MenuItem value="job_work">Job Work / Repair Handover</MenuItem>
                        <MenuItem value="returnable">Returnable Gate Pass</MenuItem>
                        <MenuItem value="sales_return">Sales Return</MenuItem>
                      </TextField>
                    </Box>

                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      label="Shipping / Delivery Address"
                      placeholder="Full delivery street, floor, city & PIN code..."
                      value={shippingAddress}
                      onChange={(e) => setShippingAddress(e.target.value)}
                    />

                    <Divider />

                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 0.75 }}>
                      <Truck size={14} /> Carrier, AWB &amp; Compliance Metadata
                    </Typography>

                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" }, gap: 1.5 }}>
                      <TextField
                        size="small"
                        label="Courier / Carrier"
                        placeholder="BlueDart, Delhivery, Self"
                        value={courierName}
                        onChange={(e) => setCourierName(e.target.value)}
                      />
                      <TextField
                        size="small"
                        label="AWB / Tracking Number"
                        placeholder="AWB123456789"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                      />
                      <TextField
                        size="small"
                        type="date"
                        label="Expected Delivery"
                        value={expectedDeliveryAt}
                        onChange={(e) => setExpectedDeliveryAt(e.target.value)}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                      <TextField
                        size="small"
                        label="Carrier Tracking URL"
                        placeholder="https://..."
                        value={trackingUrl}
                        onChange={(e) => setTrackingUrl(e.target.value)}
                      />
                      <TextField
                        size="small"
                        label="e-Way Bill Number"
                        placeholder="12-digit EWB"
                        value={ewayBillNumber}
                        onChange={(e) => setEwayBillNumber(e.target.value)}
                        helperText={
                          totals.grandTotal >= 50000 && showPricing && !ewayBillNumber.trim()
                            ? "GST e-Way Bill recommended for consignment ≥ ₹50,000"
                            : undefined
                        }
                      />
                      <TextField
                        size="small"
                        label="Vehicle Number"
                        placeholder="MH-12-AB-1234"
                        value={vehicleNumber}
                        onChange={(e) => setVehicleNumber(e.target.value)}
                      />
                      <TextField
                        size="small"
                        label="Delivery Person / Driver"
                        placeholder="Executive name"
                        value={deliveryPerson}
                        onChange={(e) => setDeliveryPerson(e.target.value)}
                        sx={{ gridColumn: { sm: "1 / -1" } }}
                      />
                    </Box>

                    <Divider />

                    <DocumentItemAdder
                      products={products}
                      onSelectProduct={addItem}
                      onAddCustomItem={addCustomItem}
                      selectLabel="Dispatch Items"
                      emptyPlaceholder="+ Add Product / Serial"
                    />

                    <SortableLineItemsEditor
                      items={items}
                      onChange={handleEditorItemsChange}
                      allowImages
                      showImages={showItemImages}
                      hidePricing={!showPricing}
                      uploadFolder="challan-items"
                    />

                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={2}
                      label="Delivery Instructions / Condition Notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />

                    {showPricing && (
                      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                        <Box sx={{ width: 260 }}>
                          <Stack spacing={0.5}>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2" color="text.secondary">Subtotal</Typography>
                              <Typography variant="body2">₹{totals.itemSubtotal.toFixed(2)}</Typography>
                            </Box>
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="body2" color="text.secondary">GST</Typography>
                              <Typography variant="body2">₹{totals.gstAmount.toFixed(2)}</Typography>
                            </Box>
                            <Divider />
                            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Declared Value</Typography>
                              <Typography variant="subtitle1" color="primary.main" sx={{ fontWeight: 700 }}>
                                ₹{totals.grandTotal.toFixed(2)}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      </Box>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>

          {/* Right Sidebar */}
          <Box sx={{ gridColumn: { lg: "span 4 / span 4" } }}>
            <Card sx={{ position: "sticky", top: 24 }}>
              <CardContent sx={{ p: 2.5 }}>
                <Stack spacing={1.25}>
                  <Button variant="contained" disabled={saving} onClick={() => void saveChallan(true)} startIcon={<Send size={16} />}>
                    {saving ? "Saving..." : "Save & Mark Dispatched"}
                  </Button>
                  <Button variant="outlined" disabled={saving} onClick={() => void saveChallan(false)} startIcon={<Save size={16} />}>
                    Save Draft
                  </Button>
                  <Button variant="outlined" onClick={() => setPreviewOpen(true)} startIcon={<Eye size={16} />}>
                    Preview Challan
                  </Button>
                  <Button variant="text" onClick={() => navigate("/challans")}>
                    Cancel
                  </Button>

                  <Divider />

                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <FormLabel sx={{ fontSize: 12 }}>Show Item Images</FormLabel>
                    <Switch checked={showItemImages} onChange={(_, c) => setShowItemImages(c)} />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <FormLabel sx={{ fontSize: 12 }}>Show Pricing on Challan &amp; PDF</FormLabel>
                    <Switch checked={showPricing} onChange={(_, c) => setShowPricing(c)} />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <FormLabel sx={{ fontSize: 12 }}>
                      Deduct Stock on Dispatch {stockDeductedAt ? "(Done)" : ""}
                    </FormLabel>
                    <Switch
                      checked={linkedJobSheetId ? false : deductStock}
                      disabled={Boolean(linkedJobSheetId) || Boolean(stockDeductedAt) || invoiceAlreadyDeducted}
                      onChange={(_, c) => setDeductStock(c)}
                    />
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <FormLabel sx={{ fontSize: 12 }}>GST Inclusive</FormLabel>
                    <Switch checked={gstInclusive} disabled={!showPricing} onChange={(_, c) => setGstInclusive(c)} />
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
            setCustomers((prev) => [newCust as CustomerOption, ...prev]);
            setCustomerId(newCust.id);
            setCustomerSearchInput("");
          }}
        />

        <DocumentPreview
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          type="challan"
          docId={editId || null}
          publicToken={publicToken}
          number={challanNumber || "Draft"}
          status={challanStatus}
          customer={
            selectedCustomer
              ? {
                  name: selectedCustomer.name,
                  email: selectedCustomer.email,
                  phone: selectedCustomer.phone,
                  address: shippingAddress || selectedCustomer.address,
                  gstNumber: selectedCustomer.gst_number,
                }
              : null
          }
          items={items}
          showImages={showItemImages}
          hidePricing={!showPricing}
          gstInclusive={gstInclusive}
          globalDiscountType={discountType}
          globalDiscountValue={discountValue}
          notes={notes}
          challanMeta={{
            challan_type: challanType,
            courier_name: courierName,
            tracking_number: trackingNumber,
            tracking_url: trackingUrl,
            eway_bill_number: ewayBillNumber,
            shipping_address: shippingAddress,
            delivery_person: deliveryPerson,
            vehicle_number: vehicleNumber,
          }}
        />
      </Box>
    </AnimatedPage>
  );
}
