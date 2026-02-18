import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft, Copy, Loader2, User, Smartphone, ClipboardCheck,
  History, Shield, Upload, CheckCircle, Circle, Clock,
  FileText, Wrench, Package, Eye, Truck, IndianRupee, ArrowRightLeft, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

const JOB_STATUSES = [
  "created", "pending_approval", "approved", "rejected", "assigned",
  "in_progress", "waiting_parts", "repair_completed", "quality_check",
  "invoice_generated", "delivered",
] as const;

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

const TIMELINE_STEPS = [
  { key: "created", label: "Created", icon: FileText },
  { key: "pending_approval", label: "Pending Approval", icon: Clock },
  { key: "approved", label: "Approved", icon: CheckCircle },
  { key: "assigned", label: "Assigned", icon: User },
  { key: "in_progress", label: "In Progress", icon: Wrench },
  { key: "waiting_parts", label: "Waiting Parts", icon: Package },
  { key: "repair_completed", label: "Repair Completed", icon: CheckCircle },
  { key: "quality_check", label: "Quality Check", icon: Shield },
  { key: "invoice_generated", label: "Invoice Generated", icon: FileText },
  { key: "delivered", label: "Delivered", icon: Truck },
];

const POST_REPAIR_ITEMS = [
  "Device powers ON", "Display working", "Touch working", "Speaker working",
  "Microphone working", "Camera working", "Network working", "Charging working",
];

export default function JobSheetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [postChecklist, setPostChecklist] = useState<{ item: string; value: string }[]>(
    POST_REPAIR_ITEMS.map(item => ({ item, value: "" }))
  );
  // Cost & payment
  const [techPaySheetOpen, setTechPaySheetOpen] = useState(false);
  const [techPayForm, setTechPayForm] = useState({ amount: "", method: "cash", notes: "" });
  const [actualCost, setActualCost] = useState("");

  const isAdminStaff = hasRole("admin") || hasRole("staff");

  const fetchAll = async () => {
    if (!id) return;
    const [jobRes, imgRes, logRes] = await Promise.all([
      supabase.from("job_sheets").select("*, customers(name, phone, email, gst_number, address)").eq("id", id).single(),
      supabase.from("job_sheet_images").select("*").eq("job_sheet_id", id).order("created_at"),
      supabase.from("job_sheet_audit_log").select("*").eq("job_sheet_id", id).order("created_at", { ascending: true }),
    ]);
    if (jobRes.error) { toast.error("Job sheet not found"); navigate("/repairs"); return; }
    setJob(jobRes.data);
    setImages(imgRes.data || []);
    setAuditLog(logRes.data || []);
    setActualCost(jobRes.data.actual_cost?.toString() || "");

    if (jobRes.data.post_repair_checklist && (jobRes.data.post_repair_checklist as any[]).length > 0) {
      setPostChecklist(jobRes.data.post_repair_checklist as any);
    }

    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
    if (roles && roles.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", roles.map(r => r.user_id));
      setTechnicians(profiles || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [id]);

  const updateStatus = async (newStatus: string) => {
    const { error } = await supabase.from("job_sheets").update({ status: newStatus as any }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); fetchAll(); }
  };

  const assignTechnician = async (techId: string) => {
    const { error } = await supabase.from("job_sheets").update({
      assigned_technician_id: techId,
      status: "assigned" as any,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({
        job_sheet_id: id!, action: "technician_assigned",
        details: `Technician assigned`, user_id: user?.id, user_role: hasRole("admin") ? "admin" : "staff",
      });
      // Notify technician
      const techName = technicians.find(t => t.user_id === techId)?.full_name || "Technician";
      await createNotification(techId, "New Job Assigned", `Job ${job?.job_number} has been assigned to you`, "repair", `/repairs/${id}`);
      toast.success("Technician assigned"); fetchAll();
    }
  };

  const savePostChecklist = async () => {
    const incomplete = postChecklist.filter(c => c.value === "");
    if (incomplete.length > 0) { toast.error(`Complete all items (${incomplete.length} remaining)`); return; }
    const { error } = await supabase.from("job_sheets").update({
      post_repair_checklist: postChecklist as any,
      status: "quality_check" as any,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({
        job_sheet_id: id!, action: "post_repair_checklist_completed",
        details: "Post-repair quality checklist completed", user_id: user?.id,
      });
      toast.success("Quality check completed"); fetchAll();
    }
  };

  const copyPublicLink = () => {
    if (!job) return;
    const link = `${window.location.origin}/job/public/${job.public_token}`;
    navigator.clipboard.writeText(link);
    toast.success("Public link copied");
  };

  const handleRepairImageUpload = async (files: FileList | null) => {
    if (!files || !id) return;
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop();
      const path = `job-sheets/${id}/repair_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("uploads").upload(path, file);
      if (!error) {
        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
        await supabase.from("job_sheet_images").insert({
          job_sheet_id: id, image_url: urlData.publicUrl, image_type: "repair_completion", uploaded_by: user?.id,
        });
      }
    }
    toast.success("Photos uploaded"); fetchAll();
  };

  // Device movement actions
  const sendToTechnician = async () => {
    if (!id) return;
    const { error } = await supabase.from("job_sheets").update({
      device_sent_at: new Date().toISOString(),
      device_sent_by: user?.id,
    } as any).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({
        job_sheet_id: id, action: "device_sent_to_technician",
        details: "Device sent to technician for repair", user_id: user?.id,
      });
      toast.success("Device sent to technician recorded"); fetchAll();
    }
  };

  const receiveFromTechnician = async () => {
    if (!id) return;
    const { error } = await supabase.from("job_sheets").update({
      device_received_at: new Date().toISOString(),
      device_received_by: user?.id,
    } as any).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({
        job_sheet_id: id, action: "device_received_from_technician",
        details: "Device received back from technician", user_id: user?.id,
      });
      toast.success("Device received recorded"); fetchAll();
    }
  };

  const saveActualCost = async () => {
    if (!id) return;
    const cost = parseFloat(actualCost) || 0;
    const { error } = await supabase.from("job_sheets").update({ actual_cost: cost } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Actual cost saved"); fetchAll(); }
  };

  const recordTechnicianPayment = async () => {
    if (!id || !job) return;
    const amount = parseFloat(techPayForm.amount) || 0;
    if (amount <= 0) { toast.error("Enter valid amount"); return; }
    // Update job_sheets
    const { error: jobErr } = await supabase.from("job_sheets").update({
      technician_payment: amount,
      technician_payment_status: "paid",
      technician_payment_date: new Date().toISOString(),
    } as any).eq("id", id);
    if (jobErr) { toast.error(jobErr.message); return; }

    await supabase.from("job_sheet_audit_log").insert({
      job_sheet_id: id, action: "technician_payment_recorded",
      details: `Technician paid ₹${amount} via ${techPayForm.method}. ${techPayForm.notes || ""}`.trim(),
      user_id: user?.id,
    });

    toast.success("Technician payment recorded");
    setTechPaySheetOpen(false);
    fetchAll();
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!job) return null;

  const checklist = (job.pre_repair_checklist as any[]) || [];
  const checklistCategories = [...new Set(checklist.map((c: any) => c.category))];
  const techName = technicians.find(t => t.user_id === job.assigned_technician_id)?.full_name;

  const currentStatusIndex = TIMELINE_STEPS.findIndex(s => s.key === job.status);
  const isRejected = job.status === "rejected";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/repairs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{job.job_number}</h1>
            <Badge className={statusColors[job.status] || ""} variant="secondary">
              {job.status.replace(/_/g, " ")}
            </Badge>
            <Badge variant="outline" className="capitalize">{job.priority}</Badge>
          </div>
          <p className="text-muted-foreground">{job.customers?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-3 w-3 mr-1.5" /> Print
          </Button>
          <Button variant="outline" size="sm" onClick={copyPublicLink}>
            <Copy className="h-3 w-3 mr-1.5" /> Public Link
          </Button>
        </div>
      </div>

      {/* Repair Progress Timeline */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Repair Progress</CardTitle></CardHeader>
        <CardContent>
          {isRejected ? (
            <div className="flex items-center gap-3 text-destructive">
              <div className="w-8 h-8 rounded-full bg-destructive/15 flex items-center justify-center">
                <Circle className="h-4 w-4 fill-destructive text-destructive" />
              </div>
              <div>
                <p className="font-medium">Rejected</p>
                <p className="text-xs text-muted-foreground">Customer rejected the repair</p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {TIMELINE_STEPS.map((step, idx) => {
                const isCompleted = idx < currentStatusIndex;
                const isCurrent = idx === currentStatusIndex;
                const isFuture = idx > currentStatusIndex;
                const StepIcon = step.icon;
                const logEntry = auditLog.find(l => l.details?.toLowerCase().includes(step.key.replace(/_/g, " ")) || (l.action === "created" && step.key === "created"));

                return (
                  <div key={step.key} className="flex gap-4 relative">
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <div className={`absolute left-4 top-9 w-0.5 h-[calc(100%-12px)] ${isCompleted ? "bg-primary" : "bg-border"}`} />
                    )}
                    <div className={`relative z-10 flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-all ${
                      isCompleted ? "bg-primary text-primary-foreground" :
                      isCurrent ? "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? <CheckCircle className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </div>
                    <div className={`pb-6 ${isFuture ? "opacity-40" : ""}`}>
                      <p className={`text-sm font-medium ${isCurrent ? "text-primary" : ""}`}>{step.label}</p>
                      {logEntry && (
                        <p className="text-xs text-muted-foreground">
                          {new Date(logEntry.created_at).toLocaleString("en-IN")}
                        </p>
                      )}
                      {isCurrent && (
                        <span className="inline-block mt-1 text-[10px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer Info */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-2 gap-2">
          <p><span className="text-muted-foreground">Name:</span> {job.customers?.name}</p>
          <p><span className="text-muted-foreground">Phone:</span> {job.customers?.phone || "—"}</p>
          <p><span className="text-muted-foreground">Email:</span> {job.customers?.email || "—"}</p>
          <p><span className="text-muted-foreground">GST:</span> {job.customers?.gst_number || "—"}</p>
        </CardContent>
      </Card>

      {/* Device Info */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4" /> Device</CardTitle></CardHeader>
        <CardContent className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-2">
          <p><span className="text-muted-foreground">Brand:</span> {job.device_brand}</p>
          <p><span className="text-muted-foreground">Type:</span> {job.device_type}</p>
          <p><span className="text-muted-foreground">Model:</span> {job.device_model || "—"}</p>
          <p><span className="text-muted-foreground">Serial:</span> {job.serial_number || "—"}</p>
          <p><span className="text-muted-foreground">IMEI:</span> {job.imei_number || "—"}</p>
          <p><span className="text-muted-foreground">Color:</span> {job.device_color || "—"}</p>
          <p><span className="text-muted-foreground">Storage:</span> {job.storage_capacity || "—"}</p>
          <p><span className="text-muted-foreground">Lock Code:</span> {isAdminStaff ? (job.device_lock_code || "—") : "••••"}</p>
        </CardContent>
      </Card>

      {/* Account Credentials (admin/staff only) */}
      {isAdminStaff && (job.apple_id || job.google_account) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Account Credentials</CardTitle></CardHeader>
          <CardContent className="text-sm grid grid-cols-2 gap-2">
            {job.apple_id && <p><span className="text-muted-foreground">Apple ID:</span> {job.apple_id}</p>}
            {job.apple_id_password && <p><span className="text-muted-foreground">Apple Password:</span> ••••••••</p>}
            {job.google_account && <p><span className="text-muted-foreground">Google:</span> {job.google_account}</p>}
            {job.google_account_password && <p><span className="text-muted-foreground">Google Password:</span> ••••••••</p>}
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {images.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Device Photos</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map(img => (
                <div key={img.id} className="space-y-1">
                  <img src={img.image_url} alt={img.image_type} className="rounded-lg border w-full aspect-square object-cover" />
                  <p className="text-xs text-muted-foreground text-center capitalize">{img.image_type.replace("_", " ")}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pre-Repair Checklist */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Pre-Repair Checklist</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {checklistCategories.map(cat => (
            <div key={cat as string}>
              <p className="text-xs font-medium text-muted-foreground mb-1">{cat as string}</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {checklist.filter((c: any) => c.category === cat).map((item: any, idx: number) => (
                      <tr key={idx} className="border-t first:border-t-0 border-border/50">
                        <td className="px-3 py-1.5">{item.item}</td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            item.value === "yes" ? "bg-success/15 text-success" :
                            item.value === "no" ? "bg-destructive/15 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {item.value === "na" ? "N/A" : item.value}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Problem & Estimate */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Problem & Estimate</CardTitle></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><span className="text-muted-foreground">Problem:</span> {job.problem_description}</p>
          {(job.issue_tags as string[])?.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {(job.issue_tags as string[]).map((tag: string) => <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>)}
            </div>
          )}
          <p><span className="text-muted-foreground">Staff Notes:</span> {job.staff_notes || "—"}</p>
          <p><span className="text-muted-foreground">Est. Cost:</span> {job.estimated_cost ? `₹${job.estimated_cost}` : "—"}</p>
          <p><span className="text-muted-foreground">Est. Completion:</span> {job.estimated_completion || "—"}</p>
        </CardContent>
      </Card>

      {/* Cost & Payment Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Cost & Payment Tracking</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Estimated Cost</p>
              <p className="text-lg font-bold">{job.estimated_cost ? `₹${Number(job.estimated_cost).toLocaleString()}` : "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Actual Cost</p>
              <p className="text-lg font-bold">{job.actual_cost ? `₹${Number(job.actual_cost).toLocaleString()}` : "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Technician Payment</p>
              <p className="text-lg font-bold">{job.technician_payment ? `₹${Number(job.technician_payment).toLocaleString()}` : "—"}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Payment Status</p>
              <Badge variant={job.technician_payment_status === "paid" ? "default" : "secondary"} className="capitalize">
                {job.technician_payment_status || "pending"}
              </Badge>
            </div>
          </div>
          {(isAdminStaff || hasRole("technician")) && (
            <>
              <Separator />
              <div className="flex flex-wrap gap-3 items-end">
                {(isAdminStaff || hasRole("technician")) && (
                  <div className="flex gap-2 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Actual Cost (₹)</Label>
                      <Input type="number" className="w-32" value={actualCost} onChange={e => setActualCost(e.target.value)} />
                    </div>
                    <Button size="sm" variant="outline" onClick={saveActualCost}>Save</Button>
                  </div>
                )}
                {isAdminStaff && job.technician_payment_status !== "paid" && (
                  <Button size="sm" onClick={() => { setTechPayForm({ amount: "", method: "cash", notes: "" }); setTechPaySheetOpen(true); }}>
                    <IndianRupee className="h-3 w-3 mr-1" /> Record Tech Payment
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Device Movement Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Device Movement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground">Sent to Technician</p>
              <p className="font-medium">{job.device_sent_at ? new Date(job.device_sent_at).toLocaleString("en-IN") : "Not yet"}</p>
            </div>
            <div className="space-y-1 p-3 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground">Received from Technician</p>
              <p className="font-medium">{job.device_received_at ? new Date(job.device_received_at).toLocaleString("en-IN") : "Not yet"}</p>
            </div>
          </div>
          {isAdminStaff && (
            <div className="flex gap-2">
              {!job.device_sent_at && job.assigned_technician_id && (
                <Button size="sm" variant="outline" onClick={sendToTechnician}>
                  <Truck className="h-3 w-3 mr-1.5" /> Send to Technician
                </Button>
              )}
              {job.device_sent_at && !job.device_received_at && (
                <Button size="sm" variant="outline" onClick={receiveFromTechnician}>
                  <Truck className="h-3 w-3 mr-1.5" /> Receive Device
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Technician Assignment (admin/staff only) */}
      {isAdminStaff && job.status === "approved" && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Assign Technician</CardTitle></CardHeader>
          <CardContent>
            <Select onValueChange={assignTechnician}>
              <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
              <SelectContent>
                {technicians.map(t => <SelectItem key={t.user_id} value={t.user_id}>{t.full_name || t.user_id}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {techName && (
        <p className="text-sm"><span className="text-muted-foreground">Assigned Technician:</span> {techName}</p>
      )}

      {/* Status Update */}
      {(isAdminStaff || hasRole("technician")) && !["delivered", "rejected"].includes(job.status) && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Update Status</CardTitle></CardHeader>
          <CardContent>
            <Select value={job.status} onValueChange={updateStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {JOB_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {/* Post-Repair Checklist */}
      {job.status === "repair_completed" && isAdminStaff && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Shield className="h-4 w-4" /> Post-Repair Quality Check</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {postChecklist.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm">
                <span>{item.item}</span>
                <div className="flex gap-1">
                  {(["yes", "no"] as const).map(v => (
                    <Button key={v} type="button" variant={item.value === v ? "default" : "outline"} size="sm" className="h-7 px-2.5 text-xs"
                      onClick={() => setPostChecklist(prev => prev.map((c, i) => i === idx ? { ...c, value: v } : c))}
                    >
                      {v === "yes" ? "Pass" : "Fail"}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
            <div className="space-y-2">
              <Label className="text-xs">Upload Repair Completion Photos</Label>
              <label className="flex items-center gap-2 text-xs text-primary cursor-pointer">
                <Upload className="h-4 w-4" /> Choose files
                <input type="file" accept="image/*" multiple className="hidden" onChange={e => handleRepairImageUpload(e.target.files)} />
              </label>
            </div>
            <Button onClick={savePostChecklist} className="w-full"><CheckCircle className="h-4 w-4 mr-2" /> Complete Quality Check</Button>
          </CardContent>
        </Card>
      )}

      {/* Audit Log */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Audit Log</CardTitle></CardHeader>
        <CardContent>
          {auditLog.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries yet.</p>
          ) : (
            <div className="space-y-3">
              {auditLog.map(entry => (
                <div key={entry.id} className="flex gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div>
                    <p className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</p>
                    {entry.details && <p className="text-xs text-muted-foreground">{entry.details}</p>}
                    <p className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Technician Payment Sheet */}
      <Sheet open={techPaySheetOpen} onOpenChange={setTechPaySheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Record Technician Payment</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5">
              <Label>Amount (₹)</Label>
              <Input type="number" value={techPayForm.amount} onChange={e => setTechPayForm(p => ({ ...p, amount: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={techPayForm.method} onValueChange={v => setTechPayForm(p => ({ ...p, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={techPayForm.notes} onChange={e => setTechPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" />
            </div>
            <Button className="w-full" onClick={recordTechnicianPayment}>Record Payment</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
