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
import { Textarea } from "@/components/ui/textarea";
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
  Receipt, CreditCard, Plus, Download, Phone, Hash, Power, PowerOff,
  UserCheck, CalendarDays, ShieldCheck, Link,
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

const paymentStatusColors: Record<string, string> = {
  unpaid: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
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

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n);
}

export default function JobSheetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [technicians, setTechnicians] = useState<any[]>([]);
  const [repairParts, setRepairParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatorName, setCreatorName] = useState<string | null>(null);
  const [postChecklist, setPostChecklist] = useState<{ item: string; value: string }[]>(
    POST_REPAIR_ITEMS.map(item => ({ item, value: "" }))
  );
  const [techPaySheetOpen, setTechPaySheetOpen] = useState(false);
  const [techPayForm, setTechPayForm] = useState({ amount: "", method: "cash", notes: "" });
  const [actualCost, setActualCost] = useState("");
  const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash", notes: "" });
  const [partsSheetOpen, setPartsSheetOpen] = useState(false);
  const [partForm, setPartForm] = useState({ name: "", cost: "", gst_percentage: "18", quantity: "1" });
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
  // Warranty state
  const [warrantyDays, setWarrantyDays] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [savingWarranty, setSavingWarranty] = useState(false);

  const isAdminStaff = hasRole("admin") || hasRole("staff");

  const fetchAll = async () => {
    if (!id) return;
    const [jobRes, imgRes, logRes, partsRes] = await Promise.all([
      supabase.from("job_sheets").select("*, customers(name, phone, email, gst_number, address)").eq("id", id).single(),
      supabase.from("job_sheet_images").select("*").eq("job_sheet_id", id).order("created_at"),
      supabase.from("job_sheet_audit_log").select("*").eq("job_sheet_id", id).order("created_at", { ascending: true }),
      supabase.from("repair_parts").select("*").eq("job_sheet_id", id).order("created_at"),
    ]);
    if (jobRes.error) { toast.error("Job sheet not found"); navigate("/repairs"); return; }
    setJob(jobRes.data);
    setImages(imgRes.data || []);
    setAuditLog(logRes.data || []);
    setRepairParts((partsRes.data as any[]) || []);
    setActualCost(jobRes.data.actual_cost?.toString() || "");
    setWarrantyDays((jobRes.data as any).warranty_days?.toString() || "");
    setWarrantyTerms((jobRes.data as any).warranty_terms || "");

    if (jobRes.data.post_repair_checklist && (jobRes.data.post_repair_checklist as any[]).length > 0) {
      setPostChecklist(jobRes.data.post_repair_checklist as any);
    }

    // Fetch creator name
    if (jobRes.data.created_by) {
      const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", jobRes.data.created_by).maybeSingle();
      setCreatorName(profile?.full_name || null);
    }

    // Fetch technicians from employees table
    const { data: empTechs } = await supabase.from("employees").select("id, name").eq("role", "technician").eq("status", "active");
    setTechnicians(empTechs || []);
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
      assigned_technician_id: techId, status: "assigned" as any,
    }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({
        job_sheet_id: id!, action: "technician_assigned", details: `Technician assigned`, user_id: user?.id, user_role: hasRole("admin") ? "admin" : "staff",
      });
      const techName = technicians.find(t => t.id === techId)?.name || "Technician";
      // Try to notify if technician has a linked user_id
      const { data: empData } = await supabase.from("employees").select("user_id").eq("id", techId).single();
      if (empData?.user_id) {
        await createNotification(empData.user_id, "New Job Assigned", `Job ${job?.job_number} has been assigned to you`, "repair", `/repairs/${id}`);
      }
      toast.success(`Technician ${techName} assigned`); fetchAll();
    }
  };

  const savePostChecklist = async () => {
    const incomplete = postChecklist.filter(c => c.value === "");
    if (incomplete.length > 0) { toast.error(`Complete all items (${incomplete.length} remaining)`); return; }
    const { error } = await supabase.from("job_sheets").update({ post_repair_checklist: postChecklist as any, status: "quality_check" as any }).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id!, action: "post_repair_checklist_completed", details: "Post-repair quality checklist completed", user_id: user?.id });
      toast.success("Quality check completed"); fetchAll();
    }
  };

  const copyPublicLink = () => {
    if (!job) return;
    navigator.clipboard.writeText(`${window.location.origin}/job/public/${job.public_token}`);
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
        await supabase.from("job_sheet_images").insert({ job_sheet_id: id, image_url: urlData.publicUrl, image_type: "repair_completion", uploaded_by: user?.id });
      }
    }
    toast.success("Photos uploaded"); fetchAll();
  };

  const sendToTechnician = async () => {
    if (!id) return;
    const { error } = await supabase.from("job_sheets").update({ device_sent_at: new Date().toISOString(), device_sent_by: user?.id } as any).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "device_sent_to_technician", details: "Device sent to technician for repair", user_id: user?.id, user_role: hasRole("admin") ? "admin" : "staff" });
      toast.success("Device sent to technician recorded"); fetchAll();
    }
  };

  const receiveFromTechnician = async () => {
    if (!id) return;
    const { error } = await supabase.from("job_sheets").update({ device_received_at: new Date().toISOString(), device_received_by: user?.id } as any).eq("id", id);
    if (error) toast.error(error.message);
    else {
      await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "device_received_from_technician", details: "Device received back from technician", user_id: user?.id, user_role: hasRole("admin") ? "admin" : "staff" });
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
    const { error: jobErr } = await supabase.from("job_sheets").update({ technician_payment: amount, technician_payment_status: "paid", technician_payment_date: new Date().toISOString() } as any).eq("id", id);
    if (jobErr) { toast.error(jobErr.message); return; }
    // Sync to technician_payments ledger table
    if (job.assigned_technician_id) {
      await supabase.from("technician_payments").insert({
        technician_id: job.assigned_technician_id,
        job_sheet_id: id,
        amount,
        status: "unpaid",
        payment_mode: techPayForm.method,
        notes: techPayForm.notes || `Payment for ${job.job_number}`,
        created_by: user?.id,
      } as any);
    }
    await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "technician_payment_recorded", details: `Technician paid ₹${amount} via ${techPayForm.method}. ${techPayForm.notes || ""}`.trim(), user_id: user?.id });
    toast.success("Technician payment recorded"); setTechPaySheetOpen(false); fetchAll();
  };

  const generateInvoice = async () => {
    if (!id || !job) return;
    if (job.invoice_id) { toast.info("Invoice already generated"); navigate(`/invoices/${job.invoice_id}`); return; }
    setGeneratingInvoice(true);
    try {
      const serviceCharge = Number(job.service_charge) || 0;
      const gstAmount = Number(job.gst_amount) || 0;
      const totalAmount = Number(job.total_amount) || 0;
      const partsTotal = repairParts.reduce((s, p) => s + Number(p.total), 0);

      const invoiceData: any = {
        customer_id: job.customer_id, job_sheet_id: job.id,
        gst_inclusive: job.gst_mode === "inclusive",
        discount_type: job.discount_type === "none" ? "percentage" : job.discount_type,
        discount_value: job.discount_type === "none" ? 0 : Number(job.discount_value) || 0,
        subtotal: serviceCharge + partsTotal, gst_amount: gstAmount,
        total: totalAmount + partsTotal, status: "draft", payment_status: "unpaid", created_by: user?.id,
      };
      const { data: invoice, error: invErr } = await supabase.from("invoices").insert(invoiceData).select().single();
      if (invErr) throw invErr;

      const items: any[] = [{ invoice_id: invoice.id, product_name: `Service Charge - ${job.device_type}`, unit_price: serviceCharge, quantity: 1, gst_percentage: Number(job.gst_percentage) || 18, total: serviceCharge }];
      for (const part of repairParts) {
        items.push({ invoice_id: invoice.id, product_name: part.name, unit_price: Number(part.cost), quantity: part.quantity, gst_percentage: Number(part.gst_percentage) || 18, total: Number(part.total) });
      }
      await supabase.from("invoice_items").insert(items);
      await supabase.from("job_sheets").update({ invoice_id: invoice.id, status: "invoice_generated" as any }).eq("id", id);
      await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "invoice_generated", details: `Invoice ${invoice.invoice_number} generated`, user_id: user?.id });
      toast.success(`Invoice ${invoice.invoice_number} generated`); fetchAll();
    } catch (err: any) { toast.error(err.message); } finally { setGeneratingInvoice(false); }
  };

  const addPayment = async () => {
    if (!id || !job) return;
    const amount = parseFloat(paymentForm.amount) || 0;
    if (amount <= 0) { toast.error("Enter valid amount"); return; }
    try {
      await supabase.from("payments").insert({ customer_id: job.customer_id, job_sheet_id: id, amount, payment_method: paymentForm.method as any, type: "invoice" as any, status: "completed" as any, notes: paymentForm.notes || `Payment for ${job.job_number}`, created_by: user?.id });
      const { data: allPayments } = await supabase.from("payments").select("amount").eq("job_sheet_id", id).eq("status", "completed");
      const totalPaid = (allPayments || []).reduce((s: number, p: any) => s + Number(p.amount), 0);
      const total = Number(job.total_amount) || 0;
      const newStatus = totalPaid >= total ? "paid" : totalPaid > 0 ? "partial" : "unpaid";
      await supabase.from("job_sheets").update({ payment_status: newStatus } as any).eq("id", id);
      if (job.invoice_id) {
        const currentPaid = Number(job.paid_amount) || 0;
        const newPaid = currentPaid + amount;
        const invPayStatus = newPaid >= total ? "paid" : "partial";
        await supabase.from("invoices").update({ paid_amount: newPaid, payment_status: invPayStatus } as any).eq("id", job.invoice_id);
      }
      await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "payment_received", details: `Payment of ₹${amount} received via ${paymentForm.method}`, user_id: user?.id });
      toast.success("Payment recorded"); setPaymentSheetOpen(false); fetchAll();
    } catch (err: any) { toast.error(err.message); }
  };

  const addPart = async () => {
    if (!id) return;
    const cost = parseFloat(partForm.cost) || 0;
    const qty = parseInt(partForm.quantity) || 1;
    const gstPct = parseFloat(partForm.gst_percentage) || 18;
    if (!partForm.name.trim()) { toast.error("Enter part name"); return; }
    if (cost <= 0) { toast.error("Enter valid cost"); return; }
    const total = cost * qty;
    const { error } = await supabase.from("repair_parts").insert({ job_sheet_id: id, name: partForm.name.trim(), cost, gst_percentage: gstPct, quantity: qty, total } as any);
    if (error) { toast.error(error.message); return; }
    const newPartsTotal = repairParts.reduce((s, p) => s + Number(p.total), 0) + total;
    await supabase.from("job_sheets").update({ parts_total: newPartsTotal } as any).eq("id", id);
    toast.success("Part added"); setPartForm({ name: "", cost: "", gst_percentage: "18", quantity: "1" }); setPartsSheetOpen(false); fetchAll();
  };

  const sendPaymentLink = async () => {
    if (!job) return;
    setSendingPaymentLink(true);
    try {
      const totalAmount = (Number(job.total_amount) || 0) + repairParts.reduce((s, p) => s + Number(p.total), 0);
      const { data, error } = await supabase.functions.invoke("create-payment-link", {
        body: {
          amount: totalAmount,
          customer_name: job.customers?.name,
          customer_email: job.customers?.email,
          customer_phone: job.customers?.phone,
          description: `Payment for ${job.job_number}`,
        },
      });
      if (error) throw error;
      if (data?.success) {
        navigator.clipboard.writeText(data.payment_link_url);
        toast.success("Payment link created & copied!");
      } else {
        toast.error(data?.error || "Failed to create payment link");
      }
    } catch (err: any) { toast.error(err.message); } finally { setSendingPaymentLink(false); }
  };

  const saveWarranty = async () => {
    if (!id) return;
    setSavingWarranty(true);
    const days = parseInt(warrantyDays) || 0;
    const { error } = await supabase.from("job_sheets").update({
      warranty_days: days,
      warranty_terms: warrantyTerms || null,
      warranty_start_date: days > 0 ? new Date().toISOString().split("T")[0] : null,
    } as any).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Warranty saved"); fetchAll(); }
    setSavingWarranty(false);
  };

  const handlePrint = () => window.print();

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!job) return null;

  const checklist = (job.pre_repair_checklist as any[]) || [];
  const checklistCategories = [...new Set(checklist.map((c: any) => c.category))];
  const techName = technicians.find(t => t.id === job.assigned_technician_id)?.name;
  const currentStatusIndex = TIMELINE_STEPS.findIndex(s => s.key === job.status);
  const isRejected = job.status === "rejected";

  const serviceCharge = Number(job.service_charge) || 0;
  const partsTotal = repairParts.reduce((s, p) => s + Number(p.total), 0);
  const discountVal = Number(job.discount_value) || 0;
  const discount = job.discount_type === "percentage" ? (serviceCharge * discountVal) / 100 : job.discount_type === "fixed" ? discountVal : 0;
  const gstAmount = Number(job.gst_amount) || 0;
  const totalAmount = Number(job.total_amount) || 0;

  // Device power status from pre-repair checklist
  const powerOnItem = checklist.find((c: any) => c.item === "Device turns ON");
  const devicePowerOn = powerOnItem?.value === "yes";
  const devicePowerOff = powerOnItem?.value === "no";

  // Warranty info
  const wDays = (job as any).warranty_days || 0;
  const wStart = (job as any).warranty_start_date;
  const warrantyActive = wDays > 0 && wStart;
  const warrantyExpiry = warrantyActive ? new Date(new Date(wStart).getTime() + wDays * 86400000) : null;
  const warrantyExpired = warrantyExpiry ? warrantyExpiry < new Date() : false;

  const showWarrantyCard = ["repair_completed", "quality_check", "invoice_generated", "delivered"].includes(job.status);
  const showTechAssignment = isAdminStaff && ["created", "pending_approval", "approved", "assigned"].includes(job.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/repairs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{job.job_number}</h1>
            <Badge className={statusColors[job.status] || ""} variant="secondary">{job.status.replace(/_/g, " ")}</Badge>
            <Badge variant="outline" className="capitalize">{job.priority}</Badge>
            <Badge className={paymentStatusColors[job.payment_status] || "bg-muted text-muted-foreground"} variant="secondary">
              {job.payment_status || "unpaid"}
            </Badge>
            {devicePowerOn && <Badge className="bg-success/10 text-success"><Power className="h-3 w-3 mr-1" />Power ON</Badge>}
            {devicePowerOff && <Badge className="bg-destructive/10 text-destructive"><PowerOff className="h-3 w-3 mr-1" />Power OFF</Badge>}
            {warrantyActive && !warrantyExpired && <Badge className="bg-info/10 text-info"><ShieldCheck className="h-3 w-3 mr-1" />Warranty till {warrantyExpiry!.toLocaleDateString("en-IN")}</Badge>}
            {warrantyActive && warrantyExpired && <Badge className="bg-muted text-muted-foreground"><ShieldCheck className="h-3 w-3 mr-1" />Warranty expired</Badge>}
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{job.customers?.name}</span>
            {job.customers?.phone && (
              <a href={`tel:${job.customers.phone}`} className="flex items-center gap-1 text-primary hover:underline">
                <Phone className="h-3 w-3" />{job.customers.phone}
              </a>
            )}
            {job.serial_number && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />SN: {job.serial_number}</span>}
            {job.imei_number && <span className="flex items-center gap-1"><Hash className="h-3 w-3" />IMEI: {job.imei_number}</span>}
          </div>
          {creatorName && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <UserCheck className="h-3 w-3" />Created by {creatorName} on {new Date(job.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
      </div>

      {/* Quick Info Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Smartphone className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xs text-muted-foreground">Device</p><p className="text-sm font-semibold">{job.device_brand} {job.device_model || job.device_type}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-warning/10 flex items-center justify-center"><CalendarDays className="h-5 w-5 text-warning" /></div>
          <div><p className="text-xs text-muted-foreground">Estimated</p><p className="text-sm font-semibold">{job.estimated_completion || "Not set"}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center"><IndianRupee className="h-5 w-5 text-success" /></div>
          <div><p className="text-xs text-muted-foreground">Total</p><p className="text-sm font-semibold">{fmt(totalAmount + partsTotal)}</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className={`h-10 w-10 rounded-xl flex items-center justify-center ${techName ? "bg-info/10" : "bg-muted"}`}>
            <User className={`h-5 w-5 ${techName ? "text-info" : "text-muted-foreground"}`} />
          </div>
          <div><p className="text-xs text-muted-foreground">Technician</p><p className="text-sm font-semibold">{techName || "Unassigned"}</p></div>
        </CardContent></Card>
      </div>

      {/* Two-column layout */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left column - Main content (70%) */}
        <div className="flex-1 space-y-6 min-w-0 print-area">

          {/* Customer & Device Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <p><span className="text-muted-foreground">Name:</span> <span className="font-medium">{job.customers?.name}</span></p>
                <p><span className="text-muted-foreground">Phone:</span> {job.customers?.phone ? <a href={`tel:${job.customers.phone}`} className="text-primary hover:underline">{job.customers.phone}</a> : "—"}</p>
                <p><span className="text-muted-foreground">Email:</span> {job.customers?.email || "—"}</p>
                <p><span className="text-muted-foreground">GST:</span> {job.customers?.gst_number || "—"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4" /> Device</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1.5">
                <p><span className="text-muted-foreground">Brand:</span> {job.device_brand} · <span className="text-muted-foreground">Type:</span> {job.device_type}</p>
                <p><span className="text-muted-foreground">Model:</span> {job.device_model || "—"} · <span className="text-muted-foreground">Color:</span> {job.device_color || "—"}</p>
                <p className="font-medium"><span className="text-muted-foreground">Serial #:</span> {job.serial_number || "—"}</p>
                <p className="font-medium"><span className="text-muted-foreground">IMEI:</span> {job.imei_number || "—"}</p>
                <p><span className="text-muted-foreground">Storage:</span> {job.storage_capacity || "—"}</p>
              </CardContent>
            </Card>
          </div>

          {/* Problem Description */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Problem Description</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm">{job.problem_description}</p>
              {job.staff_notes && <p className="text-sm text-muted-foreground mt-2 italic">Staff Notes: {job.staff_notes}</p>}
            </CardContent>
          </Card>

          {/* Service Charge & Parts Summary */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Billing Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Service Charge</span><span>{fmt(serviceCharge)}</span></div>
              {repairParts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Parts Used</p>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead><tr className="bg-muted/30"><th className="text-left px-3 py-1.5 text-xs font-medium text-muted-foreground">Part</th><th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Cost</th><th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Qty</th><th className="text-right px-3 py-1.5 text-xs font-medium text-muted-foreground">Total</th></tr></thead>
                      <tbody>
                        {repairParts.map(p => (
                          <tr key={p.id} className="border-t border-border/50">
                            <td className="px-3 py-1.5">{p.name}</td>
                            <td className="px-3 py-1.5 text-right">{fmt(Number(p.cost))}</td>
                            <td className="px-3 py-1.5 text-right">{p.quantity}</td>
                            <td className="px-3 py-1.5 text-right">{fmt(Number(p.total))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {partsTotal > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Parts Total</span><span>{fmt(partsTotal)}</span></div>}
              {discount > 0 && <div className="flex justify-between text-sm text-destructive"><span>Discount ({job.discount_type === "percentage" ? `${discountVal}%` : "Fixed"})</span><span>-{fmt(discount)}</span></div>}
              {job.gst_mode !== "none" && gstAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">GST ({job.gst_percentage}% {job.gst_mode})</span><span>{fmt(gstAmount)}</span></div>}
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Grand Total</span><span className="text-primary">{fmt(totalAmount + partsTotal)}</span></div>
            </CardContent>
          </Card>

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
                    <table className="w-full text-sm"><tbody>
                      {checklist.filter((c: any) => c.category === cat).map((item: any, idx: number) => (
                        <tr key={idx} className="border-t first:border-t-0 border-border/50">
                          <td className="px-3 py-1.5">{item.item}</td>
                          <td className="px-3 py-1.5 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${item.value === "yes" ? "bg-success/15 text-success" : item.value === "no" ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
                              {item.value === "na" ? "N/A" : item.value || "—"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

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
                        >{v === "yes" ? "Pass" : "Fail"}</Button>
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
        </div>

        {/* Right column - Timeline + Actions (30%) */}
        <div className="lg:w-80 shrink-0 no-print">
          <div className="sticky top-4 space-y-4">

            {/* Actions Card */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Actions</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {isAdminStaff && !job.invoice_id && ["quality_check", "repair_completed"].includes(job.status) && (
                  <Button className="w-full justify-start" size="sm" onClick={generateInvoice} disabled={generatingInvoice}>
                    <Receipt className="h-3.5 w-3.5 mr-2" /> {generatingInvoice ? "Generating..." : "Generate Invoice"}
                  </Button>
                )}
                {job.invoice_id && (
                  <Button className="w-full justify-start" variant="outline" size="sm" onClick={() => navigate(`/invoices/${job.invoice_id}`)}>
                    <FileText className="h-3.5 w-3.5 mr-2" /> View Invoice
                  </Button>
                )}
                {isAdminStaff && (
                  <Button className="w-full justify-start" variant="outline" size="sm" onClick={() => { setPaymentForm({ amount: "", method: "cash", notes: "" }); setPaymentSheetOpen(true); }}>
                    <CreditCard className="h-3.5 w-3.5 mr-2" /> Add Payment
                  </Button>
                )}
                {isAdminStaff && (
                  <Button className="w-full justify-start" variant="outline" size="sm" onClick={sendPaymentLink} disabled={sendingPaymentLink}>
                    <Link className="h-3.5 w-3.5 mr-2" /> {sendingPaymentLink ? "Sending..." : "Send Payment Link"}
                  </Button>
                )}
                {isAdminStaff && (
                  <Button className="w-full justify-start" variant="outline" size="sm" onClick={() => setPartsSheetOpen(true)}>
                    <Plus className="h-3.5 w-3.5 mr-2" /> Add Part
                  </Button>
                )}
                <Button className="w-full justify-start" variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5 mr-2" /> Print / PDF
                </Button>
                <Button className="w-full justify-start" variant="outline" size="sm" onClick={copyPublicLink}>
                  <Copy className="h-3.5 w-3.5 mr-2" /> Copy Public Link
                </Button>
                {isAdminStaff && (
                  <Button className="w-full justify-start" variant="outline" size="sm" onClick={() => navigate(`/repairs/${id}/edit`)}>
                    <FileText className="h-3.5 w-3.5 mr-2" /> Edit Job Sheet
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Technician Assignment */}
            {showTechAssignment && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Assign Technician</CardTitle></CardHeader>
                <CardContent>
                  <Select value={job.assigned_technician_id || undefined} onValueChange={assignTechnician}>
                    <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                    <SelectContent>
                      {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
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

            {/* Device Movement */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ArrowRightLeft className="h-4 w-4" /> Device Custody</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="p-2.5 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Sent to Technician</p>
                  <p className="font-medium">{job.device_sent_at ? new Date(job.device_sent_at).toLocaleString("en-IN") : "Not yet"}</p>
                </div>
                <div className="p-2.5 bg-muted/50 rounded-lg">
                  <p className="text-muted-foreground">Received Back</p>
                  <p className="font-medium">{job.device_received_at ? new Date(job.device_received_at).toLocaleString("en-IN") : "Not yet"}</p>
                </div>
                {isAdminStaff && (
                  <div className="flex flex-col gap-1.5">
                    {!job.device_sent_at && job.assigned_technician_id && (
                      <Button size="sm" variant="outline" className="w-full text-xs" onClick={sendToTechnician}><Truck className="h-3 w-3 mr-1" /> Send to Technician</Button>
                    )}
                    {job.device_sent_at && !job.device_received_at && (
                      <Button size="sm" variant="outline" className="w-full text-xs" onClick={receiveFromTechnician}><Truck className="h-3 w-3 mr-1" /> Receive Device</Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cost Tracking */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Cost Tracking</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Estimated</span><span>{job.estimated_cost ? fmt(Number(job.estimated_cost)) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Actual</span><span>{job.actual_cost ? fmt(Number(job.actual_cost)) : "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Tech Payment</span><span>{job.technician_payment ? fmt(Number(job.technician_payment)) : "—"}</span></div>
                {(isAdminStaff || hasRole("technician")) && (
                  <>
                    <Separator />
                    <div className="flex gap-1.5 items-end">
                      <Input type="number" className="h-7 text-xs" placeholder="Actual cost" value={actualCost} onChange={e => setActualCost(e.target.value)} />
                      <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={saveActualCost}>Save</Button>
                    </div>
                    {isAdminStaff && job.technician_payment_status !== "paid" && (
                      <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => { setTechPayForm({ amount: "", method: "cash", notes: "" }); setTechPaySheetOpen(true); }}>
                        <IndianRupee className="h-3 w-3 mr-1" /> Record Tech Payment
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Warranty Card */}
            {showWarrantyCard && isAdminStaff && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Warranty</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs">
                  {warrantyActive && (
                    <div className={`p-2.5 rounded-lg ${warrantyExpired ? "bg-destructive/10" : "bg-success/10"}`}>
                      <p className="font-medium">{wDays} days warranty</p>
                      <p className="text-muted-foreground">Start: {new Date(wStart).toLocaleDateString("en-IN")} · Expires: {warrantyExpiry!.toLocaleDateString("en-IN")}</p>
                      {(job as any).warranty_terms && <p className="mt-1 text-muted-foreground">{(job as any).warranty_terms}</p>}
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Warranty Days</Label>
                    <Input type="number" className="h-7 text-xs" value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} placeholder="e.g. 30, 90, 180" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Warranty Terms</Label>
                    <Textarea className="text-xs min-h-[60px]" value={warrantyTerms} onChange={e => setWarrantyTerms(e.target.value)} placeholder="e.g. Display replacement warranty, no water damage coverage" />
                  </div>
                  <Button size="sm" variant="outline" className="w-full text-xs" onClick={saveWarranty} disabled={savingWarranty}>
                    {savingWarranty ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <ShieldCheck className="h-3 w-3 mr-1" />} Save Warranty
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Repair Timeline</CardTitle></CardHeader>
              <CardContent>
                {isRejected ? (
                  <div className="flex items-center gap-3 text-destructive">
                    <div className="w-8 h-8 rounded-full bg-destructive/15 flex items-center justify-center"><Circle className="h-4 w-4 fill-destructive text-destructive" /></div>
                    <div><p className="font-medium">Rejected</p><p className="text-xs text-muted-foreground">Customer rejected the repair</p></div>
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
                        <div key={step.key} className="flex gap-3 relative">
                          {idx < TIMELINE_STEPS.length - 1 && (
                            <div className={`absolute left-[14px] top-8 w-0.5 h-[calc(100%-8px)] ${isCompleted ? "bg-primary" : "bg-border"}`} />
                          )}
                          <div className={`relative z-10 flex items-center justify-center w-7 h-7 rounded-full shrink-0 transition-all ${
                            isCompleted ? "bg-primary text-primary-foreground" :
                            isCurrent ? "bg-primary/20 text-primary ring-2 ring-primary ring-offset-1 ring-offset-background" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {isCompleted ? <CheckCircle className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                          </div>
                          <div className={`pb-4 ${isFuture ? "opacity-40" : ""}`}>
                            <p className={`text-xs font-medium ${isCurrent ? "text-primary" : ""}`}>{step.label}</p>
                            {logEntry && <p className="text-[10px] text-muted-foreground">{new Date(logEntry.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
                            {isCurrent && <span className="inline-block mt-0.5 text-[9px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Current</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Audit Log */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" /> Audit Log</CardTitle></CardHeader>
              <CardContent>
                {auditLog.length === 0 ? <p className="text-xs text-muted-foreground">No audit entries yet.</p> : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto">
                    {auditLog.map(entry => (
                      <div key={entry.id} className="flex gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div>
                          <p className="font-medium capitalize">{entry.action.replace(/_/g, " ")}</p>
                          {entry.details && <p className="text-muted-foreground">{entry.details}</p>}
                          <p className="text-muted-foreground">{new Date(entry.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Payment Sheet */}
      <Sheet open={paymentSheetOpen} onOpenChange={setPaymentSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Record Payment</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Payment Method</Label>
              <Select value={paymentForm.method} onValueChange={v => setPaymentForm(p => ({ ...p, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="card">Card</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" /></div>
            <Button className="w-full" onClick={addPayment}>Record Payment</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Parts Sheet */}
      <Sheet open={partsSheetOpen} onOpenChange={setPartsSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Add Part</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Part Name</Label><Input value={partForm.name} onChange={e => setPartForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Cost (₹)</Label><Input type="number" value={partForm.cost} onChange={e => setPartForm(p => ({ ...p, cost: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>GST %</Label><Input type="number" value={partForm.gst_percentage} onChange={e => setPartForm(p => ({ ...p, gst_percentage: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Quantity</Label><Input type="number" value={partForm.quantity} onChange={e => setPartForm(p => ({ ...p, quantity: e.target.value }))} /></div>
            <Button className="w-full" onClick={addPart}>Add Part</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Technician Payment Sheet */}
      <Sheet open={techPaySheetOpen} onOpenChange={setTechPaySheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Record Technician Payment</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Amount (₹)</Label><Input type="number" value={techPayForm.amount} onChange={e => setTechPayForm(p => ({ ...p, amount: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label>Payment Method</Label>
              <Select value={techPayForm.method} onValueChange={v => setTechPayForm(p => ({ ...p, method: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="cash">Cash</SelectItem><SelectItem value="upi">UPI</SelectItem><SelectItem value="bank">Bank Transfer</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Input value={techPayForm.notes} onChange={e => setTechPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" /></div>
            <Button className="w-full" onClick={recordTechnicianPayment}>Record Payment</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}