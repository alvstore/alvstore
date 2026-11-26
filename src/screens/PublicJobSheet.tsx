"use client";

import { Box, Button, Card, CardContent, Divider, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Loader2, ClipboardList, Smartphone, User, IndianRupee, PowerOff } from "lucide-react";
import { computeRepairBillingSummary } from "@/lib/repair-billing";
import { isDevicePoweredOffChecklist, resolveColorSwatchHex, summarizeChecklist } from "@/lib/repair-catalog";
const statusColors = {
    created: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
    pending_approval: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    approved: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    rejected: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
    assigned: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    in_progress: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    waiting_parts: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    repair_completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
    quality_check: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent-foreground))" },
    invoice_generated: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
    delivered: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
};
function fmt(n: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}
export default function PublicJobSheet() {
    const { token } = useParams();
    const [job, setJob] = useState<any>(null);
    const [images, setImages] = useState<any[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [responding, setResponding] = useState(false);
    useEffect(() => {
        if (!token)
            return;
        const load = async () => {
            const { data, error } = await supabase
                .from("job_sheets")
                .select("*, customers(name, phone, email)")
                .eq("public_token", token)
                .single();
            if (error || !data) {
                setLoading(false);
                return;
            }
            setJob(data);
            const [imgRes, partsRes] = await Promise.all([
                supabase.from("job_sheet_images").select("*").eq("job_sheet_id", data.id),
                supabase.from("repair_parts").select("*").eq("job_sheet_id", data.id),
            ]);
            setImages(imgRes.data || []);
            setParts(partsRes.data || []);
            setLoading(false);
        };
        load();
    }, [token]);
    const respond = async (status: "approved" | "rejected") => {
        if (!job)
            return;
        setResponding(true);
        const { error } = await supabase.from("job_sheets").update({
            approval_status: status,
            approval_timestamp: new Date().toISOString(),
            status: (status === "approved" ? "approved" : "rejected") as any,
        }).eq("id", job.id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("job_sheet_audit_log").insert({
                job_sheet_id: job.id,
                action: status === "approved" ? "customer_approved" : "customer_rejected",
                details: `Customer ${status} the repair`,
                user_role: "customer",
            });
            await supabase.functions.invoke("notify-job-event", {
                body: {
                    job_id: job.id,
                    public_token: token,
                    event: status === "approved" ? "customer_approved" : "customer_rejected",
                    details: `Customer ${status} repair estimate on portal`,
                },
            }).catch(() => undefined);
            toast.success(`Repair ${status}`);
            setJob((prev: any) => ({ ...prev, approval_status: status, status: status === "approved" ? "approved" : "rejected" }));
        }
        setResponding(false);
    };
    if (loading)
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><Box component={Loader2} sx={{ height: "2rem", width: "2rem", animation: "spin 1s linear infinite", color: "hsl(var(--primary))" }}/></Box></AnimatedPage>;
    if (!job)
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "hsl(var(--muted-foreground))" }}>Job sheet not found</Box></AnimatedPage>;
    const checklist = (job.pre_repair_checklist as any[]) || [];
    const categories = [...new Set(checklist.map((c: any) => c.category))];
    const canRespond = job.status === "pending_approval" && !job.approval_status;
    // Billing calculations
    const serviceItems = (job.service_items as any[]) || [];
    const billing = computeRepairBillingSummary({
        serviceCharge: job.service_charge,
        gstAmount: job.gst_amount,
        totalAmount: job.total_amount,
        gstMode: job.gst_mode,
        repairParts: parts,
    });
    const serviceCharge = billing.serviceCharge;
    const partsTotal = billing.partsSubtotal;
    const gstAmount = billing.combinedGst;
    const discountVal = Number(job.discount_value) || 0;
    const totalAmount = billing.grandTotal;
    const hasBilling = serviceCharge > 0 || serviceItems.length > 0 || partsTotal > 0;
    return <AnimatedPage><Box sx={{ minHeight: "100vh", backgroundColor: "hsl(var(--background))" }}>
      <Box data-print-area sx={{ maxWidth: "42rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "2rem", paddingBottom: "2rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        <PageHeader title={job.job_number} actions={<><StatusChip label={job.status.replace(/_/g, " ")} variant="filled" sx={statusColors[job.status] || {}}/></>}/>

        {/* Customer */}
        <Card>
          <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={User} sx={{ height: "1rem", width: "1rem" }}/> Customer</Typography></Box>
          <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>
            <Typography component="p" variant="body1">{job.customers?.name} · {job.customers?.phone || "No phone"}</Typography>
          </CardContent>
        </Card>

        {/* Device */}
        <Card>
          <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Smartphone} sx={{ height: "1rem", width: "1rem" }}/> Device</Typography></Box>
          <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
            <Typography component="p" variant="body1">{job.device_brand} {job.device_type} {job.device_model}</Typography>
            {(job.device_color || job.storage_capacity) && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", pt: 0.25 }}>
                {job.device_color && (
                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5, fontSize: "0.8125rem", color: "hsl(var(--muted-foreground))" }}>
                    {resolveColorSwatchHex(job.device_color) && (
                      <Box component="span" sx={{ width: 10, height: 10, borderRadius: "9999px", display: "inline-block", backgroundColor: resolveColorSwatchHex(job.device_color)!, border: "1px solid rgba(15,23,42,0.2)" }} />
                    )}
                    Color: {job.device_color}
                  </Box>
                )}
                {job.storage_capacity && (
                  <Box component="span" sx={{ fontSize: "0.8125rem", color: "hsl(var(--muted-foreground))" }}>· {job.storage_capacity}</Box>
                )}
              </Box>
            )}
            {job.serial_number && <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>S/N: {job.serial_number}</Typography>}
            {job.imei_number && <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>IMEI: {job.imei_number}</Typography>}
          </CardContent>
        </Card>

        {/* Photos */}
        {images.length > 0 && (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
            {images.map(img => (<Box key={img.id}>
                <Box src={img.image_url} alt={img.image_type} component="img" sx={{ borderRadius: "var(--radius)", borderWidth: "1px", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}/>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textAlign: "center", marginTop: "0.25rem", textTransform: "capitalize" }}>{img.image_type}</Typography>
              </Box>))}
          </Box>)}

        {/* Checklist */}
        <Card>
          <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={ClipboardList} sx={{ height: "1rem", width: "1rem" }}/> Pre-Repair Checklist</Typography></Box>
          <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
            {isDevicePoweredOffChecklist(checklist as any) && (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1, borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", border: "1px solid color-mix(in srgb, hsl(var(--warning)) 30%, transparent)", fontSize: "0.75rem", mb: 0.5 }}>
                <Box component={PowerOff} sx={{ width: 14, height: 14, color: "hsl(var(--warning))", flexShrink: 0 }} />
                <Box component="span">Device did not power on at intake — {summarizeChecklist(checklist as any).naCount} power-dependent checks marked N/A; physical & lock checks recorded.</Box>
              </Box>
            )}
            {categories.map(cat => (<Box key={cat as string}>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>{cat as string}</Typography>
                {checklist.filter((c: any) => c.category === cat).map((item: any, idx: number) => (<Box key={idx} sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem", paddingTop: "0.125rem", paddingBottom: "0.125rem" }}>
                    <Box component="span">{item.item}</Box>
                    <StatusChip label={item.value === "na" ? "N/A" : item.value} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
                  </Box>))}
              </Box>))}
          </CardContent>
        </Card>

        {/* Problem & Estimate */}
        <Card>
          <CardContent sx={{ paddingTop: "1rem", fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
            <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Problem:</Box> {job.problem_description}</Typography>
            {job.estimated_completion && <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Expected By:</Box> {job.estimated_completion}</Typography>}
          </CardContent>
        </Card>

        {/* Billing Summary */}
        {hasBilling && (<Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={IndianRupee} sx={{ height: "1rem", width: "1rem" }}/> Cost Estimate</Typography>
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
              {/* Service items */}
              {serviceItems.length > 0 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Service Charges</Typography>
                  {serviceItems.map((item: any, i: number) => (<Box key={i} sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                      <Box component="span">{item.name} {item.hsn_code ? `(HSN: ${item.hsn_code})` : ""} × {item.quantity || 1}</Box>
                      <Box component="span" sx={{ fontWeight: "500" }}>{fmt(Number(item.total) || 0)}</Box>
                    </Box>))}
                </Box>)}
              {serviceItems.length === 0 && serviceCharge > 0 && (<Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Box component="span">Service Charge</Box>
                  <Box component="span" sx={{ fontWeight: "500" }}>{fmt(serviceCharge)}</Box>
                </Box>)}

              {/* Parts */}
              {parts.length > 0 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", textTransform: "uppercase" }}>Parts</Typography>
                  {parts.map((p: any) => (<Box key={p.id} sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                      <Box component="span">{p.name} × {p.quantity}</Box>
                      <Box component="span" sx={{ fontWeight: "500" }}>{fmt(Number(p.total))}</Box>
                    </Box>))}
                </Box>)}

              <Divider />

              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                {discountVal > 0 && (<Box sx={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--muted-foreground))" }}>
                    <Box component="span">Discount</Box>
                    <Box component="span">-{fmt(discountVal)}</Box>
                  </Box>)}
                {gstAmount > 0 && (<Box sx={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--muted-foreground))" }}>
                    <Box component="span">GST {job.gst_mode === "inclusive" ? "(Inclusive)" : ""}</Box>
                    <Box component="span">{fmt(gstAmount)}</Box>
                  </Box>)}
                <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1rem", lineHeight: "1.5rem", paddingTop: "0.25rem" }}>
                  <Box component="span">Total</Box>
                  <Box component="span">{fmt(totalAmount)}</Box>
                </Box>
              </Box>
            </CardContent>
          </Card>)}

        {/* Approval Actions */}
        {canRespond && (<Box sx={{ display: "flex", gap: "0.75rem" }}>
            <Button onClick={() => respond("approved")} disabled={responding} variant="contained" sx={{ flex: "1 1 0%" }}>
              <Box component={Check} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Approve Repair
            </Button>
            <Button onClick={() => respond("rejected")} disabled={responding} variant="contained" color="error" sx={{ flex: "1 1 0%" }}>
              <Box component={X} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Reject
            </Button>
          </Box>)}

        {job.approval_status && (<Box sx={{ textAlign: "center" }}>
            <StatusChip label={<>
              {job.approval_status === "approved" ? "✓ Approved" : "✗ Rejected"}
              {job.approval_timestamp && ` on ${new Date(job.approval_timestamp).toLocaleString("en-IN")}`}
            </>} sx={job.approval_status === "approved" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" }}/>
          </Box>)}
      </Box>
    </Box></AnimatedPage>;
}
