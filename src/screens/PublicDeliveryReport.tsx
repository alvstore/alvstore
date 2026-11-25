"use client";

import { Box, Button, Card, CardContent, FormLabel, TextField, Typography } from "@mui/material";
import { AnimatedPage, PageHeader, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useRef } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Smartphone, User, CheckCircle, XCircle, ShieldCheck, Printer, Download, PenTool, } from "lucide-react";
import { SignaturePad } from "@/components/documents/SignaturePad";
import { computeRepairBillingSummary } from "@/lib/repair-billing";
function fmt(n: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}
export default function PublicDeliveryReport() {
    const { token } = useParams();
    const [job, setJob] = useState<any>(null);
    const [images, setImages] = useState<any[]>([]);
    const [parts, setParts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [signatureName, setSignatureName] = useState("");
    const [signatureData, setSignatureData] = useState("");
    const [signing, setSigning] = useState(false);
    const [showSignature, setShowSignature] = useState(false);
    useEffect(() => {
        if (!token)
            return;
        supabase.from("job_sheets")
            .select("*, customers(name, phone, email)")
            .eq("public_token", token)
            .single()
            .then(async ({ data, error }) => {
            if (error || !data) {
                setLoading(false);
                return;
            }
            setJob(data);
            const [imgRes, partsRes] = await Promise.all([
                supabase.from("job_sheet_images").select("*").eq("job_sheet_id", data.id).order("created_at"),
                supabase.from("repair_parts").select("*").eq("job_sheet_id", data.id),
            ]);
            setImages(imgRes.data || []);
            setParts(partsRes.data || []);
            setLoading(false);
        });
    }, [token]);
    const handleSignDelivery = async () => {
        if (!job || !signatureData || !signatureName.trim()) {
            toast.error("Please provide your name and signature");
            return;
        }
        setSigning(true);
        const { error } = await supabase.from("job_sheets").update({
            delivery_signature_data: signatureData,
            delivery_signature_name: signatureName.trim(),
            delivery_approved_at: new Date().toISOString(),
            status: "delivered" as any,
        } as any).eq("id", job.id);
        if (error) {
            toast.error("Failed to submit signature");
        }
        else {
            await supabase.from("job_sheet_audit_log").insert({
                job_sheet_id: job.id,
                action: "customer_delivery_signed",
                details: `Delivery signed and accepted by ${signatureName.trim()}`,
                user_role: "customer",
            });
            await supabase.functions.invoke("notify-job-event", {
                body: {
                    job_id: job.id,
                    public_token: token,
                    event: "customer_delivery_signed",
                    details: `Delivery confirmed & signed by ${signatureName.trim()}`,
                },
            }).catch(() => undefined);
            toast.success("Delivery approved! Thank you.");
            // Refresh
            const { data } = await supabase.from("job_sheets").select("*, customers(name, phone, email)").eq("id", job.id).single();
            if (data)
                setJob(data);
        }
        setSigning(false);
    };
    if (loading)
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}><Box component={Loader2} sx={{ height: "2rem", width: "2rem", animation: "spin 1s linear infinite", color: "hsl(var(--primary))" }}/></Box></AnimatedPage>;
    if (!job)
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", color: "hsl(var(--muted-foreground))" }}>Delivery report not found.</Box></AnimatedPage>;
    const preChecklist = (job.pre_repair_checklist as any[]) || [];
    const postChecklist = (job.post_repair_checklist as any[]) || [];
    const beforeImages = images.filter(i => (i as any).stage === "before" || (!((i as any).stage) && i.image_type !== "repair_completion"));
    const afterImages = images.filter(i => (i as any).stage === "after" || (!((i as any).stage) && i.image_type === "repair_completion"));
    const wDays = (job as any).warranty_days || 0;
    const wStart = (job as any).warranty_start_date;
    const warrantyExpiry = wDays > 0 && wStart ? new Date(new Date(wStart).getTime() + wDays * 86400000) : null;
    const isDeliveryApproved = !!(job as any).delivery_approved_at;
    const deliveryBilling = computeRepairBillingSummary({
        serviceCharge: job.service_charge,
        gstAmount: job.gst_amount,
        totalAmount: job.total_amount,
        gstMode: job.gst_mode,
        repairParts: parts,
    });
    return <AnimatedPage><Box sx={{ minHeight: "100vh", backgroundColor: "hsl(var(--background))" }}>
      <Box data-print-area sx={{ maxWidth: "48rem", marginLeft: "auto", marginRight: "auto", paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "2rem", paddingBottom: "2rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
        {/* Header */}
        <PageHeader title={"Delivery Report"} subtitle={job.job_number} actions={<Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>{isDeliveryApproved && (<StatusChip label={<><Box component={CheckCircle} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Delivery Approved</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }}/>)}<Button onClick={() => window.print()} variant="outlined" size="small" sx={{ "@media print": { display: "none" } }}><Box component={Download} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.35rem" }}/>Print / PDF</Button></Box>}/>

        {/* Job Details */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
          <Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={User} sx={{ height: "1rem", width: "1rem" }}/> Customer</Typography></Box>
            <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
              <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{job.customers?.name}</Typography>
              <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>{job.customers?.phone || ""}</Typography>
              <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>{job.customers?.email || ""}</Typography>
            </CardContent>
          </Card>
          <Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Smartphone} sx={{ height: "1rem", width: "1rem" }}/> Device</Typography></Box>
            <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
              <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{job.device_brand} {job.device_model || job.device_type}</Typography>
              <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Serial: {job.serial_number || "—"}</Typography>
              <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>IMEI: {job.imei_number || "—"}</Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Problem & Work Done */}
        <Card>
          <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Work Summary</Typography></Box>
          <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
            <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Problem:</Box> {job.problem_description}</Typography>
            {job.repair_notes && <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Repair Notes:</Box> {(job as any).repair_notes}</Typography>}
            <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Total Amount:</Box> <Box component="span" sx={{ fontWeight: "600" }}>{fmt(deliveryBilling.grandTotal)}</Box></Typography>
          </CardContent>
        </Card>

        {/* Before / After Photos */}
        {(beforeImages.length > 0 || afterImages.length > 0) && (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
            {beforeImages.length > 0 && (<Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--info))" })}>📷 Before Repair</Typography></Box>
                <CardContent>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                    {beforeImages.slice(0, 4).map(img => (<Box key={img.id} src={img.image_url} alt="before" component="img" sx={{ borderRadius: "var(--radius)", borderWidth: "1px", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}/>))}
                  </Box>
                </CardContent>
              </Card>)}
            {afterImages.length > 0 && (<Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--success))" })}>✅ After Repair</Typography></Box>
                <CardContent>
                  <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
                    {afterImages.slice(0, 4).map(img => (<Box key={img.id} src={img.image_url} alt="after" component="img" sx={{ borderRadius: "var(--radius)", borderWidth: "1px", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}/>))}
                  </Box>
                </CardContent>
              </Card>)}
          </Box>)}

        {/* Pre-Repair Checklist */}
        {preChecklist.length > 0 && (<Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Pre-Repair Checklist</Typography></Box>
            <CardContent>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                {preChecklist.map((item: any, idx: number) => (<Box key={idx} sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    {item.value === "yes" ? <Box component={CheckCircle} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--success))", flexShrink: "0" }}/> : item.value === "no" ? <Box component={XCircle} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--destructive))", flexShrink: "0" }}/> : <Box sx={{ height: "0.75rem", width: "0.75rem", borderRadius: "9999px", backgroundColor: "hsl(var(--muted))", flexShrink: "0" }}/>}
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item}</Box>
                  </Box>))}
              </Box>
            </CardContent>
          </Card>)}

        {/* Post-Repair Checklist */}
        {postChecklist.length > 0 && (<Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Post-Repair QC Checklist</Typography></Box>
            <CardContent>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                {postChecklist.map((item: any, idx: number) => (<Box key={idx} sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    {item.value === "yes" ? <Box component={CheckCircle} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--success))", flexShrink: "0" }}/> : <Box component={XCircle} sx={{ height: "0.75rem", width: "0.75rem", color: "hsl(var(--destructive))", flexShrink: "0" }}/>}
                    <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item}</Box>
                  </Box>))}
              </Box>
            </CardContent>
          </Card>)}

        {/* Warranty */}
        {wDays > 0 && (<Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={ShieldCheck} sx={{ height: "1rem", width: "1rem" }}/> Warranty</Typography></Box>
            <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Duration:</Box> {wDays} days</Typography>
              {wStart && <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Start:</Box> {new Date(wStart).toLocaleDateString("en-IN")}</Typography>}
              {warrantyExpiry && <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Expires:</Box> {warrantyExpiry.toLocaleDateString("en-IN")}</Typography>}
              {(job as any).warranty_terms && <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Terms:</Box> {(job as any).warranty_terms}</Typography>}
            </CardContent>
          </Card>)}

        {/* Delivery Signature */}
        {isDeliveryApproved ? (<Card sx={{ borderColor: "color-mix(in srgb, hsl(var(--success)) 30%, transparent)" }}>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", color: "hsl(var(--success))" })}><Box component={CheckCircle} sx={{ height: "1rem", width: "1rem" }}/> Delivery Approved</Typography></Box>
            <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Signed by:</Box> {(job as any).delivery_signature_name}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Date:</Box> {new Date((job as any).delivery_approved_at).toLocaleString("en-IN")}</Typography>
              {(job as any).delivery_signature_data && (<Box src={(job as any).delivery_signature_data} alt="Signature" component="img" sx={{ borderWidth: "1px", borderRadius: "var(--radius)", maxHeight: "5rem" }}/>)}
            </CardContent>
          </Card>) : (<Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={PenTool} sx={{ height: "1rem", width: "1rem" }}/> Approve Delivery</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>By signing below, you confirm that you have received your device and approve the repair work done.</Typography>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="Enter your full name" label={"Your Name"} size="small" fullWidth/>
              </Box>
              {!showSignature ? (<Button onClick={() => setShowSignature(true)} variant="outlined" sx={{ width: "100%" }}>
                  <Box component={PenTool} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Add Signature
                </Button>) : (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                  <FormLabel>Signature</FormLabel>
                  <SignaturePad onSignature={(data) => setSignatureData(data)}/>
                </Box>)}
              <Button onClick={handleSignDelivery} disabled={signing || !signatureData || !signatureName.trim()} variant="contained" sx={{ width: "100%" }}>
                {signing ? <Box component={Loader2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem", animation: "spin 1s linear infinite" }}/> : <Box component={CheckCircle} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>}
                Approve & Confirm Delivery
              </Button>
            </CardContent>
          </Card>)}

        {/* Print */}
        <Box sx={{ display: "flex", justifyContent: "center", gap: "0.75rem", paddingBottom: "2rem", "@media print": { display: "none" } }}>
          <Button onClick={() => window.print()} variant="outlined">
            <Box component={Printer} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Print Report
          </Button>
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
