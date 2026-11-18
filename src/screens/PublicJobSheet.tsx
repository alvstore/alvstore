import { useState, useEffect } from "react";
import { useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, X, Loader2, ClipboardList, Smartphone, User, IndianRupee } from "lucide-react";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  pending_approval: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  rejected: "bg-destructive/10 text-destructive",
  assigned: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  waiting_parts: "bg-warning/10 text-warning",
  repair_completed: "bg-success/10 text-success",
  quality_check: "bg-accent/10 text-accent-foreground",
  invoice_generated: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
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
    if (!token) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("job_sheets")
        .select("*, customers(name, phone, email)")
        .eq("public_token", token)
        .single();
      if (error || !data) { setLoading(false); return; }
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
    if (!job) return;
    setResponding(true);
    const { error } = await supabase.from("job_sheets").update({
      approval_status: status,
      approval_timestamp: new Date().toISOString(),
      status: (status === "approved" ? "approved" : "rejected") as any,
    }).eq("id", job.id);

    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({
        job_sheet_id: job.id,
        action: status === "approved" ? "customer_approved" : "customer_rejected",
        details: `Customer ${status} the repair`,
      });
      toast.success(`Repair ${status}`);
      setJob((prev: any) => ({ ...prev, approval_status: status, status: status === "approved" ? "approved" : "rejected" }));
    }
    setResponding(false);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!job) return <div className="flex items-center justify-center min-h-screen text-muted-foreground">Job sheet not found</div>;

  const checklist = (job.pre_repair_checklist as any[]) || [];
  const categories = [...new Set(checklist.map((c: any) => c.category))];
  const canRespond = job.status === "pending_approval" && !job.approval_status;

  // Billing calculations
  const serviceItems = (job.service_items as any[]) || [];
  const serviceCharge = Number(job.service_charge) || 0;
  const partsTotal = parts.reduce((s, p) => s + Number(p.total), 0);
  const gstAmount = Number(job.gst_amount) || 0;
  const discountVal = Number(job.discount_value) || 0;
  const totalAmount = Number(job.total_amount) || 0;
  const hasBilling = serviceCharge > 0 || serviceItems.length > 0 || partsTotal > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6 print-area">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{job.job_number}</h1>
          <Badge className={statusColors[job.status] || ""} variant="secondary">{job.status.replace(/_/g, " ")}</Badge>
        </div>

        {/* Customer */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <p>{job.customers?.name} · {job.customers?.phone || "No phone"}</p>
          </CardContent>
        </Card>

        {/* Device */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4" /> Device</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>{job.device_brand} {job.device_type} {job.device_model}</p>
            {job.serial_number && <p className="text-muted-foreground">S/N: {job.serial_number}</p>}
            {job.imei_number && <p className="text-muted-foreground">IMEI: {job.imei_number}</p>}
          </CardContent>
        </Card>

        {/* Photos */}
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {images.map(img => (
              <div key={img.id}>
                <img src={img.image_url} alt={img.image_type} className="rounded-lg border w-full aspect-square object-cover" />
                <p className="text-xs text-muted-foreground text-center mt-1 capitalize">{img.image_type}</p>
              </div>
            ))}
          </div>
        )}

        {/* Checklist */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Pre-Repair Checklist</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {categories.map(cat => (
              <div key={cat as string}>
                <p className="text-xs font-medium text-muted-foreground mb-1">{cat as string}</p>
                {checklist.filter((c: any) => c.category === cat).map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm py-0.5">
                    <span>{item.item}</span>
                    <Badge variant={item.value === "yes" ? "default" : item.value === "no" ? "destructive" : "secondary"} className="text-xs">
                      {item.value === "na" ? "N/A" : item.value}
                    </Badge>
                  </div>
                ))}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Problem & Estimate */}
        <Card>
          <CardContent className="pt-4 text-sm space-y-2">
            <p><span className="text-muted-foreground">Problem:</span> {job.problem_description}</p>
            {job.estimated_completion && <p><span className="text-muted-foreground">Expected By:</span> {job.estimated_completion}</p>}
          </CardContent>
        </Card>

        {/* Billing Summary */}
        {hasBilling && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Cost Estimate</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Service items */}
              {serviceItems.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Service Charges</p>
                  {serviceItems.map((item: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.name} {item.hsn_code ? `(HSN: ${item.hsn_code})` : ""} × {item.quantity || 1}</span>
                      <span className="font-medium">{fmt(Number(item.total) || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
              {serviceItems.length === 0 && serviceCharge > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Service Charge</span>
                  <span className="font-medium">{fmt(serviceCharge)}</span>
                </div>
              )}

              {/* Parts */}
              {parts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Parts</p>
                  {parts.map((p: any) => (
                    <div key={p.id} className="flex justify-between text-sm">
                      <span>{p.name} × {p.quantity}</span>
                      <span className="font-medium">{fmt(Number(p.total))}</span>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-1 text-sm">
                {discountVal > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount</span>
                    <span>-{fmt(discountVal)}</span>
                  </div>
                )}
                {gstAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST {job.gst_mode === "inclusive" ? "(Inclusive)" : ""}</span>
                    <span>{fmt(gstAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base pt-1">
                  <span>Total</span>
                  <span>{fmt(totalAmount + partsTotal)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Approval Actions */}
        {canRespond && (
          <div className="flex gap-3">
            <Button className="flex-1" onClick={() => respond("approved")} disabled={responding}>
              <Check className="h-4 w-4 mr-2" /> Approve Repair
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => respond("rejected")} disabled={responding}>
              <X className="h-4 w-4 mr-2" /> Reject
            </Button>
          </div>
        )}

        {job.approval_status && (
          <div className="text-center">
            <Badge className={job.approval_status === "approved" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}>
              {job.approval_status === "approved" ? "✓ Approved" : "✗ Rejected"}
              {job.approval_timestamp && ` on ${new Date(job.approval_timestamp).toLocaleString("en-IN")}`}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
