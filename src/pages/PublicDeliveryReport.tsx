import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2, Smartphone, User, CheckCircle, XCircle, ShieldCheck, Printer, Download, PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { SignaturePad } from "@/components/documents/SignaturePad";

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export default function PublicDeliveryReport() {
  const { token } = useParams();
  const [job, setJob] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signatureName, setSignatureName] = useState("");
  const [signatureData, setSignatureData] = useState("");
  const [signing, setSigning] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  useEffect(() => {
    if (!token) return;
    supabase.from("job_sheets")
      .select("*, customers(name, phone, email)")
      .eq("public_token", token)
      .single()
      .then(async ({ data, error }) => {
        if (error || !data) { setLoading(false); return; }
        setJob(data);
        const { data: imgs } = await supabase.from("job_sheet_images").select("*").eq("job_sheet_id", data.id).order("created_at");
        setImages(imgs || []);
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
    } else {
      toast.success("Delivery approved! Thank you.");
      // Refresh
      const { data } = await supabase.from("job_sheets").select("*, customers(name, phone, email)").eq("id", job.id).single();
      if (data) setJob(data);
    }
    setSigning(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!job) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Delivery report not found.</div>;

  const preChecklist = (job.pre_repair_checklist as any[]) || [];
  const postChecklist = (job.post_repair_checklist as any[]) || [];
  const beforeImages = images.filter(i => (i as any).stage === "before" || (!((i as any).stage) && i.image_type !== "repair_completion"));
  const afterImages = images.filter(i => (i as any).stage === "after" || (!((i as any).stage) && i.image_type === "repair_completion"));
  const wDays = (job as any).warranty_days || 0;
  const wStart = (job as any).warranty_start_date;
  const warrantyExpiry = wDays > 0 && wStart ? new Date(new Date(wStart).getTime() + wDays * 86400000) : null;
  const isDeliveryApproved = !!(job as any).delivery_approved_at;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Delivery Report</h1>
          <p className="text-muted-foreground">{job.job_number}</p>
          {isDeliveryApproved && (
            <Badge className="bg-success/10 text-success"><CheckCircle className="h-3 w-3 mr-1" /> Delivery Approved</Badge>
          )}
        </div>

        {/* Job Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{job.customers?.name}</p>
              <p className="text-muted-foreground">{job.customers?.phone || ""}</p>
              <p className="text-muted-foreground">{job.customers?.email || ""}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4" /> Device</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{job.device_brand} {job.device_model || job.device_type}</p>
              <p className="text-muted-foreground">Serial: {job.serial_number || "—"}</p>
              <p className="text-muted-foreground">IMEI: {job.imei_number || "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Problem & Work Done */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Work Summary</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><span className="text-muted-foreground">Problem:</span> {job.problem_description}</p>
            {job.repair_notes && <p><span className="text-muted-foreground">Repair Notes:</span> {(job as any).repair_notes}</p>}
            <p><span className="text-muted-foreground">Total Amount:</span> <span className="font-semibold">{fmt(Number(job.total_amount) || 0)}</span></p>
          </CardContent>
        </Card>

        {/* Before / After Photos */}
        {(beforeImages.length > 0 || afterImages.length > 0) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {beforeImages.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-info">📷 Before Repair</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {beforeImages.slice(0, 4).map(img => (
                      <img key={img.id} src={img.image_url} alt="before" className="rounded-lg border w-full aspect-square object-cover" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {afterImages.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-success">✅ After Repair</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    {afterImages.slice(0, 4).map(img => (
                      <img key={img.id} src={img.image_url} alt="after" className="rounded-lg border w-full aspect-square object-cover" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Pre-Repair Checklist */}
        {preChecklist.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Pre-Repair Checklist</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {preChecklist.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    {item.value === "yes" ? <CheckCircle className="h-3 w-3 text-success shrink-0" /> : item.value === "no" ? <XCircle className="h-3 w-3 text-destructive shrink-0" /> : <div className="h-3 w-3 rounded-full bg-muted shrink-0" />}
                    <span className="truncate">{item.item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Post-Repair Checklist */}
        {postChecklist.length > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Post-Repair QC Checklist</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-1 text-xs">
                {postChecklist.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    {item.value === "yes" ? <CheckCircle className="h-3 w-3 text-success shrink-0" /> : <XCircle className="h-3 w-3 text-destructive shrink-0" />}
                    <span className="truncate">{item.item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Warranty */}
        {wDays > 0 && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Warranty</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Duration:</span> {wDays} days</p>
              {wStart && <p><span className="text-muted-foreground">Start:</span> {new Date(wStart).toLocaleDateString("en-IN")}</p>}
              {warrantyExpiry && <p><span className="text-muted-foreground">Expires:</span> {warrantyExpiry.toLocaleDateString("en-IN")}</p>}
              {(job as any).warranty_terms && <p><span className="text-muted-foreground">Terms:</span> {(job as any).warranty_terms}</p>}
            </CardContent>
          </Card>
        )}

        {/* Delivery Signature */}
        {isDeliveryApproved ? (
          <Card className="border-success/30">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2 text-success"><CheckCircle className="h-4 w-4" /> Delivery Approved</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <p><span className="text-muted-foreground">Signed by:</span> {(job as any).delivery_signature_name}</p>
              <p><span className="text-muted-foreground">Date:</span> {new Date((job as any).delivery_approved_at).toLocaleString("en-IN")}</p>
              {(job as any).delivery_signature_data && (
                <img src={(job as any).delivery_signature_data} alt="Signature" className="border rounded-lg max-h-20" />
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><PenTool className="h-4 w-4" /> Approve Delivery</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">By signing below, you confirm that you have received your device and approve the repair work done.</p>
              <div className="space-y-1.5">
                <Label>Your Name</Label>
                <Input value={signatureName} onChange={e => setSignatureName(e.target.value)} placeholder="Enter your full name" />
              </div>
              {!showSignature ? (
                <Button variant="outline" onClick={() => setShowSignature(true)} className="w-full">
                  <PenTool className="h-4 w-4 mr-2" /> Add Signature
                </Button>
              ) : (
                <div className="space-y-2">
                  <Label>Signature</Label>
                  <SignaturePad onSignature={(data) => setSignatureData(data)} />
                </div>
              )}
              <Button onClick={handleSignDelivery} disabled={signing || !signatureData || !signatureName.trim()} className="w-full">
                {signing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Approve & Confirm Delivery
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Print */}
        <div className="flex justify-center gap-3 pb-8 no-print">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print Report
          </Button>
        </div>
      </div>
    </div>
  );
}
