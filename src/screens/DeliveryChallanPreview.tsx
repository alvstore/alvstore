"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { AnimatedPage, PageHeader, SideDrawer, StatusChip, toast } from "@/components/mui";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  ArrowLeft,
  Car,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  PackageCheck,
  Pencil,
  Printer,
  Receipt,
  RotateCcw,
  Send,
  Truck,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { SignaturePad } from "@/components/documents/SignaturePad";
import { SendDocumentDrawer } from "@/components/documents/SendDocumentDrawer";
import { downloadDocumentPdf } from "@/lib/document-pdf-client";

const MILESTONE_STEPS = [
  { key: "packed", label: "Packed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

function resolveStepIndex(status: string): number {
  const norm = status === "sent" ? "dispatched" : status;
  const idx = MILESTONE_STEPS.findIndex((s) => s.key === norm);
  return idx >= 0 ? idx + 1 : status === "invoiced" ? MILESTONE_STEPS.length : 0;
}

export default function DeliveryChallanPreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [challan, setChallan] = useState<any>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [linkedInvoiceNumber, setLinkedInvoiceNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [transitioning, setTransitioning] = useState(false);

  const [sendDrawerOpen, setSendDrawerOpen] = useState(false);
  const [podDrawerOpen, setPodDrawerOpen] = useState(false);
  const [podName, setPodName] = useState("");
  const [podPhone, setPodPhone] = useState("");
  const [podSignature, setPodSignature] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data: ch } = await (supabase as any)
      .from("delivery_challans")
      .select("*, customers(name, email, phone, address, gst_number)")
      .eq("id", id)
      .single();
    setChallan(ch || null);
    if (ch?.invoice_id) {
      const { data: inv } = await supabase
        .from("invoices")
        .select("invoice_number")
        .eq("id", ch.invoice_id)
        .maybeSingle();
      setLinkedInvoiceNumber(inv?.invoice_number || null);
    } else {
      setLinkedInvoiceNumber(null);
    }
    const { data: itms } = await (supabase as any)
      .from("delivery_challan_items")
      .select("*")
      .eq("challan_id", id)
      .order("sort_order", { ascending: true });
    setItems(
      (itms || []).map((i: any, idx: number) => ({
        id: i.id,
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
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const transitionStatus = async (targetStatus: string, extra?: Record<string, unknown>) => {
    if (!id || transitioning) return;
    setTransitioning(true);
    try {
      const { data, error } = await supabase.functions.invoke("challan-transition", {
        body: { challan_id: id, target_status: targetStatus, ...extra },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Status transition failed");
      }
      toast.success(`Challan marked as ${targetStatus.replace(/_/g, " ")}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setTransitioning(false);
    }
  };

  const submitStaffPod = async () => {
    if (!podName.trim() || !podSignature) {
      toast.error("Receiver name and digital signature are required.");
      return;
    }
    await transitionStatus("delivered", {
      note: `Staff POD recorded from ${podName.trim()}`,
      receiver_name: podName.trim(),
      receiver_phone: podPhone.trim() || null,
      receiver_signature: podSignature,
    });
    setPodDrawerOpen(false);
  };

  const [converting, setConverting] = useState(false);

  const convertToInvoice = async () => {
    if (!challan || challan.invoice_id || converting) return;
    setConverting(true);
    try {
      const { data: inv, error } = await supabase
        .from("invoices")
        .insert({
          customer_id: challan.customer_id || null,
          quotation_id: challan.quotation_id || null,
          subtotal: Number(challan.subtotal || 0),
          gst_amount: Number(challan.gst_amount || 0),
          total: Number(challan.total || 0),
          gst_inclusive: Boolean(challan.gst_inclusive),
          discount_type: challan.discount_type || "percentage",
          discount_value: Number(challan.discount_value || 0),
          deduct_stock: true,
          notes: `Converted from ${challan.challan_number}`,
          created_by: user?.id,
        } as any)
        .select()
        .single();
      if (error || !inv) throw new Error(error?.message || "Failed to create invoice");

      if (items.length > 0) {
        const { error: itemsErr } = await supabase.from("invoice_items").insert(
          items.map((i, idx) => ({
            invoice_id: inv.id,
            product_id: i.product_id,
            product_name: i.product_name,
            description: i.description || null,
            hsn_code: i.hsn_code || null,
            quantity: i.quantity,
            unit_price: i.unit_price,
            discount_type: i.discount_type,
            discount_value: i.discount_value,
            gst_percentage: i.gst_percentage,
            total: i.total,
            sort_order: i.sort_order ?? idx,
          }))
        );
        if (itemsErr) throw new Error(itemsErr.message);
      }

      // Link invoice_id BEFORE document-stock so linked challan stock deduction is respected atomically
      const { error: linkErr } = await (supabase as any)
        .from("delivery_challans")
        .update({ invoice_id: inv.id })
        .eq("id", challan.id);
      if (linkErr) throw new Error(linkErr.message);

      const { error: stockErr } = await supabase.functions.invoke("document-stock", {
        body: { doc_type: "invoice", doc_id: inv.id, note: `Converted from ${challan.challan_number}` },
      });
      if (stockErr) throw new Error(stockErr.message);

      setChallan((prev: any) => (prev ? { ...prev, invoice_id: inv.id } : prev));
      setLinkedInvoiceNumber(inv.invoice_number);
      toast.success(`Invoice created — ${inv.invoice_number}`);
      navigate(`/invoices/${inv.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setConverting(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
          Loading delivery challan...
        </Typography>
      </AnimatedPage>
    );
  }
  if (!challan) {
    return (
      <AnimatedPage>
        <Typography color="text.secondary" sx={{ textAlign: "center", py: 6 }}>
          Delivery challan not found.
        </Typography>
      </AnimatedPage>
    );
  }

  const customer = challan.customers;
  const timeline: any[] = Array.isArray(challan.timeline) ? challan.timeline : [];
  const showConvertToInvoice =
    !challan.invoice_id &&
    !challan.job_sheet_id &&
    !["returnable", "sales_return"].includes(challan.challan_type || "") &&
    !["cancelled", "returned"].includes(challan.status) &&
    ["sent", "dispatched", "in_transit", "out_for_delivery", "delivered"].includes(challan.status);

  const trackingUrl = challan.public_token
    ? `${window.location.origin}/challan/public/${challan.public_token}`
    : null;

  return (
    <AnimatedPage>
      <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        <PageHeader
          title={challan.challan_number}
          subtitle="2026 Delivery Challan, Live Tracking & Proof of Delivery"
          actions={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <IconButton onClick={() => navigate("/challans")} aria-label="Back to Challans">
                <Box component={ArrowLeft} sx={{ height: "1.25rem", width: "1.25rem" }} />
              </IconButton>
              {challan.challan_type && (
                <Chip size="small" variant="outlined" label={String(challan.challan_type).replace(/_/g, " ").toUpperCase()} />
              )}
              {challan.invoice_id && (
                <Chip
                  size="small"
                  color="primary"
                  label={`Linked Invoice: ${linkedInvoiceNumber || "View"}`}
                  onClick={() => navigate(`/invoices/${challan.invoice_id}`)}
                />
              )}
              <StatusChip label={challan.status.replace(/_/g, " ")} sx={{ textTransform: "capitalize" }} />
            </Stack>
          }
        />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(12, minmax(0, 1fr))" }, gap: 3 }}>
          {/* Main Document View */}
          <Box data-print-area sx={{ minWidth: 0, gridColumn: { lg: "span 8 / span 8" } }}>
            <Card>
              <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
                <Stack spacing={3}>
                  <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, justifyContent: "space-between", gap: 2 }}>
                    <BusinessHeader compact />
                    <Box sx={{ textAlign: { md: "right" } }}>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {challan.challan_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        Issued {format(new Date(challan.created_at), "dd MMM yyyy")}
                      </Typography>
                      {challan.expected_delivery_at && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          ETA {format(new Date(challan.expected_delivery_at), "dd MMM yyyy")}
                        </Typography>
                      )}
                      {challan.stock_deducted_at && !challan.stock_reversed_at && (
                        <Chip size="small" color="success" variant="outlined" label="Inventory Deducted" sx={{ mt: 0.75 }} />
                      )}
                      {challan.stock_reversed_at && (
                        <Chip size="small" color="warning" variant="outlined" label="Inventory Restored" sx={{ mt: 0.75 }} />
                      )}
                    </Box>
                  </Box>

                  {/* Interactive 2026 Milestone Stepper */}
                  {challan.status !== "cancelled" && challan.status !== "returned" ? (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                      <Stepper activeStep={resolveStepIndex(challan.status)} alternativeLabel>
                        {MILESTONE_STEPS.map((st) => (
                          <Step key={st.key}>
                            <StepLabel>{st.label}</StepLabel>
                          </Step>
                        ))}
                      </Stepper>
                    </Paper>
                  ) : (
                    <Alert severity={challan.status === "cancelled" ? "error" : "warning"}>
                      Challan status is <strong>{challan.status.toUpperCase()}</strong>.
                    </Alert>
                  )}

                  <Divider />

                  {/* Customer + Logistics Metadata */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                    {customer && (
                      <Box>
                        <Typography variant="overline" color="text.secondary">
                          Deliver To
                        </Typography>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {customer.name}
                        </Typography>
                        {customer.phone && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{customer.phone}</Typography>}
                        {customer.email && <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>{customer.email}</Typography>}
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {challan.shipping_address || customer.address}
                        </Typography>
                        {customer.gst_number && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace" }}>
                            GSTIN: {customer.gst_number}
                          </Typography>
                        )}
                      </Box>
                    )}

                    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: 2 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="overline" color="text.secondary">
                          Carrier &amp; Logistics
                        </Typography>
                        {challan.courier_name && (
                          <Typography variant="caption">
                            Courier: <strong>{challan.courier_name}</strong>
                          </Typography>
                        )}
                        {challan.tracking_number && (
                          <Typography variant="caption">
                            AWB / Tracking: <strong>{challan.tracking_number}</strong>
                          </Typography>
                        )}
                        {challan.tracking_url && (
                          <Button
                            size="small"
                            component="a"
                            href={challan.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<ExternalLink size={12} />}
                            sx={{ alignSelf: "flex-start", p: 0 }}
                          >
                            Track on Carrier Site
                          </Button>
                        )}
                        {challan.eway_bill_number && (
                          <Typography variant="caption">
                            e-Way Bill: <strong>{challan.eway_bill_number}</strong>
                          </Typography>
                        )}
                        {challan.delivery_person && (
                          <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <User size={12} /> {challan.delivery_person}
                          </Typography>
                        )}
                        {challan.vehicle_number && (
                          <Typography variant="caption" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Car size={12} /> {challan.vehicle_number}
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  </Box>

                  <ItemsTable
                    items={items}
                    onItemsChange={() => {}}
                    products={[]}
                    showImages={challan.show_item_images !== false}
                    hidePricing={!challan.show_pricing}
                    readOnly
                  />

                  {challan.show_pricing && (
                    <TotalsPanel
                      items={items}
                      gstInclusive={Boolean(challan.gst_inclusive)}
                      globalDiscountType={(challan.discount_type as "percentage" | "fixed") || "percentage"}
                      globalDiscountValue={Number(challan.discount_value || 0)}
                      readOnly
                    />
                  )}

                  {challan.notes && (
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Notes
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
                        {challan.notes}
                      </Typography>
                    </Box>
                  )}

                  {(challan.receiver_signature || challan.pod_photo_url || challan.receiver_name) && (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "color-mix(in srgb, hsl(var(--success)) 5%, transparent)" }}>
                      <Typography variant="overline" color="text.secondary">
                        Captured Proof of Delivery
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        Received by {challan.receiver_name || "Customer"}
                        {challan.receiver_phone ? ` · ${challan.receiver_phone}` : ""}
                        {challan.delivered_at ? ` · ${new Date(challan.delivered_at).toLocaleString("en-IN")}` : ""}
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                        {challan.receiver_signature && (
                          <Box
                            component="img"
                            src={challan.receiver_signature}
                            alt="Receiver Signature"
                            sx={{ height: 64, bgcolor: "#FFFFFF", p: 0.5, borderRadius: 1, border: "1px solid", borderColor: "divider" }}
                          />
                        )}
                        {challan.pod_photo_url && (
                          <Box
                            component="img"
                            src={challan.pod_photo_url}
                            alt="Delivery Photo"
                            sx={{ height: 84, borderRadius: 1, border: "1px solid", borderColor: "divider", objectFit: "cover" }}
                          />
                        )}
                      </Stack>
                    </Paper>
                  )}

                  {timeline.length > 0 && (
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Milestone Audit Log
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                        {timeline.map((ev, i) => (
                          <Box key={i} sx={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "text.secondary" }}>
                            <Box component="span">
                              <Box component="strong">{ev.label || ev.status}</Box>
                              {ev.note ? ` — ${ev.note}` : ""}
                            </Box>
                            <Box component="span">{ev.at ? new Date(ev.at).toLocaleString("en-IN") : ""}</Box>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* Right Sidebar */}
          <Box sx={{ gridColumn: { lg: "span 4 / span 4" }, "@media print": { display: "none" } }}>
            <Stack spacing={2} sx={{ position: { lg: "sticky" }, top: 24 }}>
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack spacing={1}>
                    <Button variant="contained" onClick={() => setSendDrawerOpen(true)} startIcon={<Send size={16} />}>
                      Email / Share Challan
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={() =>
                        void downloadDocumentPdf({
                          docType: "challan",
                          id: challan.id,
                          filename: `${challan.challan_number}.pdf`,
                        })
                          .then(() => toast.success(`Downloaded ${challan.challan_number}.pdf`))
                          .catch((e) => toast.error((e as Error).message))
                      }
                      startIcon={<Download size={16} />}
                    >
                      Download Branded PDF
                    </Button>
                    {trackingUrl && (
                      <Button
                        variant="outlined"
                        onClick={() => {
                          void navigator.clipboard.writeText(trackingUrl);
                          toast.success("Tracking & POD link copied");
                        }}
                        startIcon={<Copy size={16} />}
                      >
                        Copy Tracking Link
                      </Button>
                    )}

                    <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
                      <Button variant="outlined" size="small" onClick={() => window.print()} startIcon={<Printer size={14} />}>
                        Print
                      </Button>
                      <Button variant="outlined" size="small" onClick={() => navigate(`/challans/${id}/edit`)} startIcon={<Pencil size={14} />}>
                        Edit
                      </Button>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>

              {/* Workflow Milestones */}
              <Card>
                <CardContent sx={{ p: 2.5 }}>
                  <Stack spacing={1}>
                    <Typography variant="overline" color="text.secondary">
                      Dispatch Progression
                    </Typography>
                    {challan.status === "draft" && (
                      <Button
                        variant="contained"
                        disabled={transitioning}
                        onClick={() => void transitionStatus("packed")}
                        startIcon={<PackageCheck size={16} />}
                      >
                        Mark Packed
                      </Button>
                    )}
                    {["draft", "packed"].includes(challan.status) && (
                      <Button
                        variant="contained"
                        color="primary"
                        disabled={transitioning}
                        onClick={() => void transitionStatus("dispatched")}
                        startIcon={<Truck size={16} />}
                      >
                        Mark Dispatched
                      </Button>
                    )}
                    {["sent", "dispatched"].includes(challan.status) && (
                      <Button
                        variant="outlined"
                        disabled={transitioning}
                        onClick={() => void transitionStatus("in_transit")}
                        startIcon={<Truck size={16} />}
                      >
                        Mark In Transit
                      </Button>
                    )}
                    {["sent", "dispatched", "in_transit"].includes(challan.status) && (
                      <Button
                        variant="outlined"
                        disabled={transitioning}
                        onClick={() => void transitionStatus("out_for_delivery")}
                        startIcon={<Truck size={16} />}
                      >
                        Out for Delivery
                      </Button>
                    )}
                    {["sent", "dispatched", "in_transit", "out_for_delivery"].includes(challan.status) && (
                      <Button
                        variant="contained"
                        color="success"
                        disabled={transitioning}
                        onClick={() => {
                          setPodName(customer?.name || "");
                          setPodPhone(customer?.phone || "");
                          setPodDrawerOpen(true);
                        }}
                        startIcon={<CheckCircle2 size={16} />}
                      >
                        Capture POD / Delivered
                      </Button>
                    )}
                    {!["returned", "cancelled", "invoiced"].includes(challan.status) && (
                      <Button
                        variant="text"
                        color="warning"
                        size="small"
                        disabled={transitioning}
                        onClick={() => void transitionStatus("returned", { note: "Marked returned to showroom" })}
                        startIcon={<RotateCcw size={14} />}
                      >
                        Mark Returned &amp; Restore Stock
                      </Button>
                    )}
                    {showConvertToInvoice && (
                      <>
                        <Divider />
                        <Button
                          variant="contained"
                          color="secondary"
                          disabled={converting}
                          onClick={() => void convertToInvoice()}
                          startIcon={<Receipt size={16} />}
                        >
                          {converting ? "Converting..." : "Convert to Invoice"}
                        </Button>
                      </>
                    )}
                    {challan.invoice_id && (
                      <Button
                        variant="outlined"
                        onClick={() => navigate(`/invoices/${challan.invoice_id}`)}
                        startIcon={<FileText size={16} />}
                      >
                        Open Linked Invoice
                      </Button>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Box>
        </Box>

        <SendDocumentDrawer
          open={sendDrawerOpen}
          onClose={() => setSendDrawerOpen(false)}
          docType="challan"
          docId={challan.id}
          docNumber={challan.challan_number}
          customerName={customer?.name}
          defaultEmail={customer?.email}
          defaultPhone={customer?.phone}
          publicUrl={trackingUrl}
          totalLabel={challan.show_pricing ? `₹${Number(challan.total || 0).toLocaleString("en-IN")}` : undefined}
        />

        <SideDrawer
          open={podDrawerOpen}
          onClose={() => setPodDrawerOpen(false)}
          title={`Capture POD — ${challan.challan_number}`}
          description="Record receiver details and digital signature on delivery."
          width={460}
          footer={
            <Stack direction="row" spacing={1}>
              <Button variant="outlined" onClick={() => setPodDrawerOpen(false)}>
                Cancel
              </Button>
              <Button variant="contained" color="success" disabled={transitioning} onClick={() => void submitStaffPod()}>
                Confirm Delivered
              </Button>
            </Stack>
          }
        >
          <Stack spacing={2}>
            <TextField
              size="small"
              fullWidth
              label="Receiver Phone (optional)"
              value={podPhone}
              onChange={(e) => setPodPhone(e.target.value)}
            />
            <SignaturePad
              onSignature={(sig, name) => {
                setPodSignature(sig);
                if (name) setPodName(name);
              }}
              existingName={podName}
            />
          </Stack>
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}
