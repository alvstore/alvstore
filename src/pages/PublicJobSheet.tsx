import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, X, Loader2, ClipboardList, Smartphone, User } from "lucide-react";
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

export default function PublicJobSheet() {
  const { token } = useParams();
  const [job, setJob] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
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
      const { data: imgs } = await supabase.from("job_sheet_images").select("*").eq("job_sheet_id", data.id);
      setImages(imgs || []);
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

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
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
            {job.estimated_cost && <p><span className="text-muted-foreground">Estimated Cost:</span> ₹{job.estimated_cost}</p>}
            {job.estimated_completion && <p><span className="text-muted-foreground">Expected By:</span> {job.estimated_completion}</p>}
          </CardContent>
        </Card>

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
