"use client";

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import { AnimatedPage, toast } from "@/components/mui";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  ImagePlus,
  MapPin,
  PackageCheck,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { BusinessHeader } from "@/components/documents/BusinessHeader";
import { CustomerCard } from "@/components/documents/CustomerCard";
import { ItemsTable, type DocumentItem } from "@/components/documents/ItemsTable";
import { TotalsPanel } from "@/components/documents/TotalsPanel";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { SignaturePad } from "@/components/documents/SignaturePad";
import { downloadDocumentPdf, normalizeImageForPdfUpload } from "@/lib/document-pdf-client";

const TRACK_STEPS = [
  { key: "packed", label: "Packed" },
  { key: "dispatched", label: "Dispatched" },
  { key: "in_transit", label: "In Transit" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

function resolveActiveStep(status: string): number {
  const normalized = status === "sent" ? "dispatched" : status;
  const idx = TRACK_STEPS.findIndex((s) => s.key === normalized);
  if (idx >= 0) return idx + 1;
  return status === "delivered" ? TRACK_STEPS.length : 0;
}

function pickPodPhoto(onFile: (file: File) => void) {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = "image/png,image/jpeg,image/webp";
  picker.onchange = () => {
    const f = picker.files?.[0];
    if (f) onFile(f);
  };
  picker.click();
}

export default function PublicChallan() {
  const { token } = useParams<{ token: string }>();
  const [challan, setChallan] = useState<any>(null);
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [receiverSignature, setReceiverSignature] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [podPhotoUrl, setPodPhotoUrl] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    const { data: ch } = await (supabase as any)
      .from("delivery_challans")
      .select("*, customers(name, email, phone, address, gst_number, shipping_address, shipping_city, shipping_state, shipping_pincode)")
      .eq("public_token", token)
      .maybeSingle();
    if (ch) {
      setChallan(ch);
      setReceiverName((prev) => prev || ch.receiver_name || ch.customers?.name || "");
      setReceiverPhone((prev) => prev || ch.receiver_phone || ch.customers?.phone || "");
      const { data: itms } = await (supabase as any)
        .from("delivery_challan_items")
        .select("*")
        .eq("challan_id", ch.id)
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
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePhotoUpload = async (file: File) => {
    if (!token) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Photo must be 5 MB or smaller");
      return;
    }
    setUploadingPhoto(true);
    try {
      const normalized = await normalizeImageForPdfUpload(file);
      const form = new FormData();
      form.append("token", token);
      form.append("file", normalized);
      const res = await fetch("/api/backend/functions/public-challan-pod-upload", {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        throw new Error(json?.error || "Failed to upload POD photo");
      }
      setPodPhotoUrl(json.url);
      toast.success("Delivery photo uploaded");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const submitPod = async () => {
    if (!token) return;
    if (!receiverName.trim()) {
      toast.error("Please enter the receiver's full name");
      return;
    }
    if (!receiverSignature) {
      toast.error("Please draw your signature to confirm delivery");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-challan-pod", {
        body: {
          token,
          receiver_name: receiverName.trim(),
          receiver_phone: receiverPhone.trim() || undefined,
          receiver_signature: receiverSignature,
          pod_photo_url: podPhotoUrl || undefined,
        },
      });
      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || "Could not record delivery confirmation");
      }
      toast.success("Delivery confirmed — Thank you!");
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography color="text.secondary">Loading dispatch tracking...</Typography>
        </Box>
      </AnimatedPage>
    );
  }

  if (!challan) {
    return (
      <AnimatedPage>
        <Box sx={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography color="text.secondary">Delivery challan not found.</Typography>
        </Box>
      </AnimatedPage>
    );
  }

  const canSignPod = ["sent", "dispatched", "in_transit", "out_for_delivery"].includes(challan.status);
  const timeline: any[] = Array.isArray(challan.timeline) ? challan.timeline : [];

  return (
    <AnimatedPage>
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: { xs: 2, md: 4 } }}>
        <Box sx={{ maxWidth: 840, mx: "auto" }}>
          <Stack spacing={3}>
            <Card data-print-area>
              <CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
                <Stack spacing={3}>
                  <BusinessHeader />
                  <Divider />

                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 2 }}>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700 }}>
                        Delivery Challan · {challan.challan_number}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Issued {new Date(challan.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                        {challan.expected_delivery_at
                          ? ` · Expected ${new Date(challan.expected_delivery_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}`
                          : ""}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      {challan.challan_type && (
                        <Chip size="small" label={String(challan.challan_type).replace(/_/g, " ").toUpperCase()} />
                      )}
                      <StatusBadge status={challan.status} />
                    </Stack>
                  </Box>

                  {/* 2026 Milestone Tracker */}
                  {challan.status !== "cancelled" && challan.status !== "returned" ? (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.default" }}>
                      <Stepper activeStep={resolveActiveStep(challan.status)} alternativeLabel>
                        {TRACK_STEPS.map((st) => (
                          <Step key={st.key}>
                            <StepLabel>{st.label}</StepLabel>
                          </Step>
                        ))}
                      </Stepper>
                    </Paper>
                  ) : (
                    <Alert severity={challan.status === "cancelled" ? "error" : "warning"}>
                      This dispatch is currently marked as <strong>{challan.status.toUpperCase()}</strong>.
                    </Alert>
                  )}

                  {challan.status === "delivered" && (
                    <Alert severity="success" icon={<PackageCheck size={18} />}>
                      Delivered{challan.delivered_at ? ` on ${new Date(challan.delivered_at).toLocaleString("en-IN")}` : ""}
                      {challan.receiver_name ? ` · Received by ${challan.receiver_name}` : ""}.
                    </Alert>
                  )}

                  {/* Carrier & Destination */}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 2 }}>
                    {challan.customers && (
                      <Box>
                        <Typography variant="overline" color="text.secondary">
                          Deliver To
                        </Typography>
                        <CustomerCard
                          name={challan.customers.name}
                          phone={challan.customers.phone}
                          email={challan.customers.email}
                          address={challan.shipping_address || challan.customers.shipping_address || challan.customers.address}
                          gstNumber={challan.customers.gst_number}
                        />
                      </Box>
                    )}

                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                      <Stack spacing={0.75}>
                        <Typography variant="overline" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                          <Truck size={14} /> Dispatch Details
                        </Typography>
                        {challan.courier_name && (
                          <Typography variant="body2">
                            Courier: <strong>{challan.courier_name}</strong>
                          </Typography>
                        )}
                        {challan.tracking_number && (
                          <Typography variant="body2">
                            AWB / Tracking: <strong>{challan.tracking_number}</strong>
                          </Typography>
                        )}
                        {challan.tracking_url && (
                          <Button
                            size="small"
                            variant="outlined"
                            component="a"
                            href={challan.tracking_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            startIcon={<ExternalLink size={14} />}
                            sx={{ alignSelf: "flex-start" }}
                          >
                            Track Courier Live
                          </Button>
                        )}
                        {challan.eway_bill_number && (
                          <Typography variant="body2">
                            e-Way Bill: <strong>{challan.eway_bill_number}</strong>
                          </Typography>
                        )}
                        {challan.delivery_person && (
                          <Typography variant="body2">
                            Executive: <strong>{challan.delivery_person}</strong>
                            {challan.vehicle_number ? ` (${challan.vehicle_number})` : ""}
                          </Typography>
                        )}
                        {challan.shipping_address && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: "flex", alignItems: "flex-start", gap: 0.5 }}>
                            <MapPin size={13} /> {challan.shipping_address}
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

                  {timeline.length > 0 && (
                    <Box>
                      <Typography variant="overline" color="text.secondary">
                        Activity Timeline
                      </Typography>
                      <Stack spacing={0.75} sx={{ mt: 0.75 }}>
                        {timeline.map((entry, idx) => (
                          <Paper key={idx} variant="outlined" sx={{ p: 1.25, borderRadius: 1.5, display: "flex", justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
                            <Typography variant="body2">
                              <strong>{entry.label || entry.status}</strong>
                              {entry.note ? ` — ${entry.note}` : ""}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {entry.at ? new Date(entry.at).toLocaleString("en-IN") : ""}
                            </Typography>
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  )}

                  {/* Existing POD */}
                  {(challan.receiver_signature || challan.pod_photo_url) && (
                    <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "color-mix(in srgb, hsl(var(--success)) 5%, transparent)" }}>
                      <Typography variant="overline" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        <ShieldCheck size={14} /> Proof of Delivery
                      </Typography>
                      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mt: 1, alignItems: "center" }}>
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

                  {/* Contactless POD Form */}
                  {canSignPod && (
                    <>
                      <Divider />
                      <Stack spacing={2}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          Confirm Contactless Delivery (POD)
                        </Typography>
                        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                          <TextField
                            size="small"
                            fullWidth
                            label="Receiver Phone (optional)"
                            placeholder="+91 ..."
                            value={receiverPhone}
                            onChange={(e) => setReceiverPhone(e.target.value)}
                          />
                          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Button
                              variant="outlined"
                              size="small"
                              disabled={uploadingPhoto}
                              startIcon={<ImagePlus size={15} />}
                              onClick={() => pickPodPhoto((f) => void handlePhotoUpload(f))}
                            >
                              {uploadingPhoto ? "Uploading Photo..." : podPhotoUrl ? "Replace Photo" : "Upload Delivery Photo"}
                            </Button>
                            {podPhotoUrl && <Chip size="small" color="success" label="Photo attached" />}
                          </Stack>
                        </Box>

                        <SignaturePad
                          onSignature={(sig, name) => {
                            setReceiverSignature(sig);
                            if (name) setReceiverName(name);
                          }}
                          existingName={receiverName}
                        />

                        <Button
                          variant="contained"
                          color="success"
                          size="large"
                          disabled={submitting}
                          startIcon={<CheckCircle2 size={18} />}
                          onClick={() => void submitPod()}
                        >
                          {submitting ? "Confirming Delivery..." : "Confirm Receipt & Submit POD"}
                        </Button>
                      </Stack>
                    </>
                  )}

                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() =>
                      token && void downloadDocumentPdf({ docType: "challan", token, filename: `${challan.challan_number}.pdf` })
                    }
                    startIcon={<Download size={16} />}
                  >
                    Download Branded Delivery Challan PDF
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              ALVStore · Authentic Apple &amp; Custom Studio Gear
            </Typography>
          </Stack>
        </Box>
      </Box>
    </AnimatedPage>
  );
}
