"use client";

import { Box, Button, Card, CardContent, Divider, IconButton, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, EmptyState, DataTable, SideDrawer, StatusChip, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Copy, Loader2, User, Smartphone, ClipboardCheck, History, Shield, Upload, CheckCircle, Circle, Clock, FileText, Wrench, Package, Eye, Truck, IndianRupee, ArrowRightLeft, Printer, Receipt, CreditCard, Plus, Download, Phone, Hash, Power, PowerOff, UserCheck, CalendarDays, ShieldCheck, Link, Camera, XCircle, CheckCircle2, } from "lucide-react";
import { createNotification } from "@/lib/notifications";
const JOB_STATUSES = [
    "created", "pending_approval", "approved", "rejected", "assigned",
    "in_progress", "waiting_parts", "repair_completed", "quality_check",
    "qc_failed", "invoice_generated", "ready_for_delivery", "delivered",
] as const;
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
    qc_failed: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
    invoice_generated: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
    ready_for_delivery: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    delivered: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
};
const paymentStatusColors = {
    unpaid: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
    partial: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    paid: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
};
const TIMELINE_STEPS = [
    { key: "created", label: "Created", icon: FileText },
    { key: "pending_approval", label: "Pending Approval", icon: Clock },
    { key: "approved", label: "Approved", icon: CheckCircle },
    { key: "assigned", label: "Assigned", icon: User },
    { key: "in_progress", label: "In Progress", icon: Wrench },
    { key: "waiting_parts", label: "Waiting Parts", icon: Package },
    { key: "repair_completed", label: "Repair Completed", icon: CheckCircle },
    { key: "quality_check", label: "QC Pending", icon: Shield },
    { key: "qc_failed", label: "QC Failed", icon: XCircle },
    { key: "invoice_generated", label: "Invoice Generated", icon: FileText },
    { key: "ready_for_delivery", label: "Ready for Delivery", icon: Truck },
    { key: "delivered", label: "Delivered", icon: Truck },
];
const POST_REPAIR_ITEMS = [
    "Device powers ON", "Display working", "Touch working", "Speaker working",
    "Microphone working", "Camera working", "Network working", "Charging working",
    "Repaired parts verified", "Device cleaned", "Final condition verified",
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
    const [postChecklist, setPostChecklist] = useState<{
        item: string;
        value: string;
    }[]>(POST_REPAIR_ITEMS.map(item => ({ item, value: "" })));
    const [techPaySheetOpen, setTechPaySheetOpen] = useState(false);
    const [techPayForm, setTechPayForm] = useState({ amount: "", method: "cash", notes: "" });
    const [actualCost, setActualCost] = useState("");
    const [paymentSheetOpen, setPaymentSheetOpen] = useState(false);
    const [paymentForm, setPaymentForm] = useState({ amount: "", method: "cash", notes: "" });
    const [partsSheetOpen, setPartsSheetOpen] = useState(false);
    const [partForm, setPartForm] = useState({ name: "", cost: "", gst_percentage: "18", quantity: "1" });
    const [generatingInvoice, setGeneratingInvoice] = useState(false);
    const [sendingPaymentLink, setSendingPaymentLink] = useState(false);
    const [warrantyDays, setWarrantyDays] = useState("");
    const [warrantyTerms, setWarrantyTerms] = useState("");
    const [savingWarranty, setSavingWarranty] = useState(false);
    const [uploadStage, setUploadStage] = useState<string>("before");
    const isAdminStaff = hasRole("admin") || hasRole("staff");
    const fetchAll = async () => {
        if (!id)
            return;
        const [jobRes, imgRes, logRes, partsRes] = await Promise.all([
            supabase.from("job_sheets").select("*, customers(name, phone, email, gst_number, address)").eq("id", id).single(),
            supabase.from("job_sheet_images").select("*").eq("job_sheet_id", id).order("created_at"),
            supabase.from("job_sheet_audit_log").select("*").eq("job_sheet_id", id).order("created_at", { ascending: true }),
            supabase.from("repair_parts").select("*").eq("job_sheet_id", id).order("created_at"),
        ]);
        if (jobRes.error) {
            toast.error("Job sheet not found");
            navigate("/repairs");
            return;
        }
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
        // Auto-set upload stage based on status
        const status = jobRes.data.status;
        if (["in_progress", "waiting_parts"].includes(status))
            setUploadStage("during");
        else if (["repair_completed", "quality_check", "qc_failed", "invoice_generated", "ready_for_delivery", "delivered"].includes(status))
            setUploadStage("after");
        else
            setUploadStage("before");
        if (jobRes.data.created_by) {
            const { data: profile } = await supabase.from("profiles").select("full_name").eq("user_id", jobRes.data.created_by).maybeSingle();
            setCreatorName(profile?.full_name || null);
        }
        const { data: empTechs } = await supabase.from("employees").select("id, name").eq("role", "technician").eq("status", "active");
        setTechnicians(empTechs || []);
        setLoading(false);
    };
    useEffect(() => { fetchAll(); }, [id]);
    const triggerAutomation = async (eventType: string) => {
        if (!job?.customers?.phone)
            return;
        try {
            await supabase.functions.invoke("whatsapp-automation", {
                body: {
                    event_type: eventType,
                    customer_phone: job.customers.phone,
                    variables: {
                        customer_name: job.customers.name || "",
                        job_id: job.job_number || "",
                        status: eventType.replace("job_", "").replace("_", " "),
                        link: `${window.location.origin}/job/${job.public_token}`,
                        amount: job.total_amount?.toString() || "0",
                    },
                },
            });
        }
        catch (e) {
            console.log("Automation trigger skipped:", e);
        }
    };
    const STATUS_EVENT_MAP: Record<string, string> = {
        approved: "job_approved",
        in_progress: "job_in_progress",
        repair_completed: "job_ready",
        ready_for_delivery: "job_ready",
        delivered: "job_delivered",
    };
    const updateStatus = async (newStatus: string) => {
        const { error } = await supabase.from("job_sheets").update({ status: newStatus as any }).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Status updated");
            // Trigger WhatsApp automation for key status changes
            const eventType = STATUS_EVENT_MAP[newStatus];
            if (eventType)
                triggerAutomation(eventType);
            fetchAll();
        }
    };
    const assignTechnician = async (techId: string) => {
        const { error } = await supabase.from("job_sheets").update({
            assigned_technician_id: techId, status: "assigned" as any,
        }).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("job_sheet_audit_log").insert({
                job_sheet_id: id!, action: "technician_assigned", details: `Technician assigned`, user_id: user?.id, user_role: hasRole("admin") ? "admin" : "staff",
            });
            const techName = technicians.find(t => t.id === techId)?.name || "Technician";
            const { data: empData } = await supabase.from("employees").select("user_id").eq("id", techId).single();
            if (empData?.user_id) {
                await createNotification(empData.user_id, "New Job Assigned", `Job ${job?.job_number} has been assigned to you`, "repair", `/repairs/${id}`);
            }
            toast.success(`Technician ${techName} assigned`);
            fetchAll();
        }
    };
    const savePostChecklist = async () => {
        const incomplete = postChecklist.filter(c => c.value === "");
        if (incomplete.length > 0) {
            toast.error(`Complete all items (${incomplete.length} remaining)`);
            return;
        }
        const { error } = await supabase.from("job_sheets").update({ post_repair_checklist: postChecklist as any, status: "quality_check" as any }).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id!, action: "post_repair_checklist_completed", details: "Post-repair quality checklist completed", user_id: user?.id });
            toast.success("Quality check completed");
            fetchAll();
        }
    };
    const approveQC = async () => {
        const { error } = await supabase.from("job_sheets").update({ status: "invoice_generated" as any }).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id!, action: "qc_approved", details: "Quality check approved — ready for invoice generation", user_id: user?.id });
            toast.success("QC Approved");
            fetchAll();
        }
    };
    const rejectQC = async () => {
        const { error } = await supabase.from("job_sheets").update({ status: "qc_failed" as any }).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id!, action: "qc_failed", details: "Quality check failed — needs rework", user_id: user?.id });
            toast.success("QC Failed — sent back for rework");
            fetchAll();
        }
    };
    const copyPublicLink = () => {
        if (!job)
            return;
        navigator.clipboard.writeText(`${window.location.origin}/job/public/${job.public_token}`);
        toast.success("Public link copied");
    };
    const copyDeliveryReportLink = () => {
        if (!job)
            return;
        navigator.clipboard.writeText(`${window.location.origin}/delivery-report/${job.public_token}`);
        toast.success("Delivery report link copied");
    };
    const handleRepairImageUpload = async (files: FileList | null, stage: string = "after") => {
        if (!files || !id)
            return;
        for (const file of Array.from(files)) {
            const ext = file.name.split(".").pop();
            const path = `job-sheets/${id}/${stage}_${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from("uploads").upload(path, file);
            if (!error) {
                const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
                await supabase.from("job_sheet_images").insert({ job_sheet_id: id, image_url: urlData.publicUrl, image_type: "repair_completion", uploaded_by: user?.id, stage });
            }
        }
        toast.success("Photos uploaded");
        fetchAll();
    };
    const sendToTechnician = async () => {
        if (!id)
            return;
        const { error } = await supabase.from("job_sheets").update({ device_sent_at: new Date().toISOString(), device_sent_by: user?.id } as any).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "device_sent_to_technician", details: "Device sent to technician for repair", user_id: user?.id, user_role: hasRole("admin") ? "admin" : "staff" });
            toast.success("Device sent to technician recorded");
            fetchAll();
        }
    };
    const receiveFromTechnician = async () => {
        if (!id)
            return;
        const { error } = await supabase.from("job_sheets").update({ device_received_at: new Date().toISOString(), device_received_by: user?.id } as any).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "device_received_from_technician", details: "Device received back from technician", user_id: user?.id, user_role: hasRole("admin") ? "admin" : "staff" });
            toast.success("Device received recorded");
            fetchAll();
        }
    };
    const saveActualCost = async () => {
        if (!id)
            return;
        const cost = parseFloat(actualCost) || 0;
        const { error } = await supabase.from("job_sheets").update({ actual_cost: cost } as any).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Actual cost saved");
            fetchAll();
        }
    };
    const recordTechnicianPayment = async () => {
        if (!id || !job)
            return;
        const amount = parseFloat(techPayForm.amount) || 0;
        if (amount <= 0) {
            toast.error("Enter valid amount");
            return;
        }
        const { error: jobErr } = await supabase.from("job_sheets").update({ technician_payment: amount, technician_payment_status: "paid", technician_payment_date: new Date().toISOString() } as any).eq("id", id);
        if (jobErr) {
            toast.error(jobErr.message);
            return;
        }
        if (job.assigned_technician_id) {
            await supabase.from("technician_payments").insert({
                technician_id: job.assigned_technician_id, job_sheet_id: id, amount, status: "unpaid", payment_mode: techPayForm.method, notes: techPayForm.notes || `Payment for ${job.job_number}`, created_by: user?.id,
            } as any);
        }
        await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "technician_payment_recorded", details: `Technician paid ₹${amount} via ${techPayForm.method}. ${techPayForm.notes || ""}`.trim(), user_id: user?.id });
        toast.success("Technician payment recorded");
        setTechPaySheetOpen(false);
        fetchAll();
    };
    const generateInvoice = async () => {
        if (!id || !job)
            return;
        // Block invoice generation unless QC is done
        if (!["quality_check", "invoice_generated", "ready_for_delivery", "delivered"].includes(job.status)) {
            toast.error("Invoice can only be generated after QC approval");
            return;
        }
        if (job.invoice_id) {
            toast.info("Invoice already generated");
            navigate(`/invoices/${job.invoice_id}`);
            return;
        }
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
            if (invErr)
                throw invErr;
            const items: any[] = [{ invoice_id: invoice.id, product_name: `Service Charge - ${job.device_type}`, unit_price: serviceCharge, quantity: 1, gst_percentage: Number(job.gst_percentage) || 18, total: serviceCharge }];
            for (const part of repairParts) {
                items.push({ invoice_id: invoice.id, product_name: part.name, unit_price: Number(part.cost), quantity: part.quantity, gst_percentage: Number(part.gst_percentage) || 18, total: Number(part.total) });
            }
            await supabase.from("invoice_items").insert(items);
            await supabase.from("job_sheets").update({ invoice_id: invoice.id, status: "invoice_generated" as any }).eq("id", id);
            await supabase.from("job_sheet_audit_log").insert({ job_sheet_id: id, action: "invoice_generated", details: `Invoice ${invoice.invoice_number} generated`, user_id: user?.id });
            toast.success(`Invoice ${invoice.invoice_number} generated`);
            fetchAll();
        }
        catch (err: any) {
            toast.error(err.message);
        }
        finally {
            setGeneratingInvoice(false);
        }
    };
    const addPayment = async () => {
        if (!id || !job)
            return;
        const amount = parseFloat(paymentForm.amount) || 0;
        if (amount <= 0) {
            toast.error("Enter valid amount");
            return;
        }
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
            toast.success("Payment recorded");
            setPaymentSheetOpen(false);
            fetchAll();
        }
        catch (err: any) {
            toast.error(err.message);
        }
    };
    const addPart = async () => {
        if (!id)
            return;
        const cost = parseFloat(partForm.cost) || 0;
        const qty = parseInt(partForm.quantity) || 1;
        const gstPct = parseFloat(partForm.gst_percentage) || 18;
        if (!partForm.name.trim()) {
            toast.error("Enter part name");
            return;
        }
        if (cost <= 0) {
            toast.error("Enter valid cost");
            return;
        }
        const total = cost * qty;
        const { error } = await supabase.from("repair_parts").insert({ job_sheet_id: id, name: partForm.name.trim(), cost, gst_percentage: gstPct, quantity: qty, total } as any);
        if (error) {
            toast.error(error.message);
            return;
        }
        const newPartsTotal = repairParts.reduce((s, p) => s + Number(p.total), 0) + total;
        await supabase.from("job_sheets").update({ parts_total: newPartsTotal } as any).eq("id", id);
        toast.success("Part added");
        setPartForm({ name: "", cost: "", gst_percentage: "18", quantity: "1" });
        setPartsSheetOpen(false);
        fetchAll();
    };
    const sendPaymentLink = async () => {
        if (!job)
            return;
        setSendingPaymentLink(true);
        try {
            const totalAmount = (Number(job.total_amount) || 0) + repairParts.reduce((s, p) => s + Number(p.total), 0);
            const { data, error } = await supabase.functions.invoke("create-payment-link", {
                body: { amount: totalAmount, customer_name: job.customers?.name, customer_email: job.customers?.email, customer_phone: job.customers?.phone, description: `Payment for ${job.job_number}` },
            });
            if (error)
                throw error;
            if (data?.success) {
                navigator.clipboard.writeText(data.payment_link_url);
                toast.success("Payment link created & copied!");
            }
            else {
                toast.error(data?.error || "Failed to create payment link");
            }
        }
        catch (err: any) {
            toast.error(err.message);
        }
        finally {
            setSendingPaymentLink(false);
        }
    };
    const saveWarranty = async () => {
        if (!id)
            return;
        setSavingWarranty(true);
        const days = parseInt(warrantyDays) || 0;
        const { error } = await supabase.from("job_sheets").update({
            warranty_days: days, warranty_terms: warrantyTerms || null, warranty_start_date: days > 0 ? new Date().toISOString().split("T")[0] : null,
        } as any).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Warranty saved");
            fetchAll();
        }
        setSavingWarranty(false);
    };
    const handlePrint = () => window.print();
    if (loading)
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "5rem", paddingBottom: "5rem" }}><Box component={Loader2} sx={{ height: "2rem", width: "2rem", animation: "spin 1s linear infinite", color: "hsl(var(--primary))" }}/></Box></AnimatedPage>;
    if (!job)
        return <AnimatedPage><EmptyState title="Job sheet not found" description="The job sheet may have been removed or is no longer available." action={<Button onClick={() => navigate("/repairs")}>Back to job sheets</Button>} /></AnimatedPage>;
    const preChecklist = (job.pre_repair_checklist as any[]) || [];
    const checklistCategories = [...new Set(preChecklist.map((c: any) => c.category))];
    const techName = technicians.find(t => t.id === job.assigned_technician_id)?.name;
    const currentStatusIndex = TIMELINE_STEPS.findIndex(s => s.key === job.status);
    const isRejected = job.status === "rejected";
    const serviceCharge = Number(job.service_charge) || 0;
    const partsTotal = repairParts.reduce((s, p) => s + Number(p.total), 0);
    const discountVal = Number(job.discount_value) || 0;
    const discount = job.discount_type === "percentage" ? (serviceCharge * discountVal) / 100 : job.discount_type === "fixed" ? discountVal : 0;
    const gstAmount = Number(job.gst_amount) || 0;
    const totalAmount = Number(job.total_amount) || 0;
    const powerOnItem = preChecklist.find((c: any) => c.item === "Device turns ON");
    const devicePowerOn = powerOnItem?.value === "yes";
    const devicePowerOff = powerOnItem?.value === "no";
    const wDays = (job as any).warranty_days || 0;
    const wStart = (job as any).warranty_start_date;
    const warrantyActive = wDays > 0 && wStart;
    const warrantyExpiry = warrantyActive ? new Date(new Date(wStart).getTime() + wDays * 86400000) : null;
    const warrantyExpired = warrantyExpiry ? warrantyExpiry < new Date() : false;
    const showWarrantyCard = ["repair_completed", "quality_check", "qc_failed", "invoice_generated", "ready_for_delivery", "delivered"].includes(job.status);
    const showTechAssignment = isAdminStaff && ["created", "pending_approval", "approved", "assigned"].includes(job.status);
    // Group images by stage
    const beforeImages = images.filter(i => (i as any).stage === "before" || (!((i as any).stage) && i.image_type !== "repair_completion"));
    const duringImages = images.filter(i => (i as any).stage === "during");
    const afterImages = images.filter(i => (i as any).stage === "after" || (!((i as any).stage) && i.image_type === "repair_completion"));
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
        <IconButton onClick={() => navigate("/repairs")} aria-label={"Arrow Left"}>
          <Box component={ArrowLeft} sx={{ height: "1rem", width: "1rem" }}/>
        </IconButton>
        <Box sx={{ flex: "1 1 0%" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <Typography component="h1" variant="h1" sx={{ fontSize: "1.5rem", lineHeight: "2rem", fontWeight: "700", letterSpacing: "-0.025em" }}>{job.job_number}</Typography>
            <StatusChip label={job.status.replace(/_/g, " ")} variant="filled" sx={statusColors[job.status] || {}}/>
            <StatusChip label={job.priority} variant="outlined" sx={{ textTransform: "capitalize" }}/>
            <StatusChip label={job.payment_status || "unpaid"} variant="filled" sx={paymentStatusColors[job.payment_status] || { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/>
            {devicePowerOn && <StatusChip label={<><Box component={Power} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Power ON</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }}/>}
            {devicePowerOff && <StatusChip label={<><Box component={PowerOff} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Power OFF</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" }}/>}
            {warrantyActive && !warrantyExpired && <StatusChip label={<><Box component={ShieldCheck} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Warranty till {warrantyExpiry!.toLocaleDateString("en-IN")}</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" }}/>}
            {warrantyActive && warrantyExpired && <StatusChip label={<><Box component={ShieldCheck} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Warranty expired</>} sx={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/>}
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.25rem", flexWrap: "wrap", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>
            <Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{job.customers?.name}</Box>
            {job.customers?.phone && <Box href={`tel:${job.customers.phone}`} component="a" sx={mergeSx({ color: "inherit", textDecoration: "none" }, { display: "flex", alignItems: "center", gap: "0.25rem", color: "hsl(var(--primary))", "&:hover": { textDecorationLine: "underline" } })}><Box component={Phone} sx={{ height: "0.75rem", width: "0.75rem" }}/>{job.customers.phone}</Box>}
            {job.serial_number && <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Hash} sx={{ height: "0.75rem", width: "0.75rem" }}/>SN: {job.serial_number}</Box>}
            {job.imei_number && <Box component="span" sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Hash} sx={{ height: "0.75rem", width: "0.75rem" }}/>IMEI: {job.imei_number}</Box>}
          </Box>
          {creatorName && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
              <Box component={UserCheck} sx={{ height: "0.75rem", width: "0.75rem" }}/>Created by {creatorName} on {new Date(job.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </Typography>)}
        </Box>
      </Box>

      {/* Quick Info Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.75rem" }}>
        <Card><CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "0.75rem", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><Box component={Smartphone} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/></Box>
          <Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Device</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{job.device_brand} {job.device_model || job.device_type}</Typography></Box>
        </CardContent></Card>
        <Card><CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "0.75rem", backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><Box component={CalendarDays} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/></Box>
          <Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Estimated</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{job.estimated_completion || "Not set"}</Typography></Box>
        </CardContent></Card>
        <Card><CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "0.75rem", backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><Box component={IndianRupee} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/></Box>
          <Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Total</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{fmt(totalAmount + partsTotal)}</Typography></Box>
        </CardContent></Card>
        <Card><CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Box sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center" }, techName ? { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)" } : { backgroundColor: "hsl(var(--muted))" })}>
            <Box component={User} sx={mergeSx({ height: "1.25rem", width: "1.25rem" }, techName ? { color: "hsl(var(--info))" } : { color: "hsl(var(--muted-foreground))" })}/>
          </Box>
          <Box><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Technician</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>{techName || "Unassigned"}</Typography></Box>
        </CardContent></Card>
      </Box>

      {/* Two-column layout */}
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 1024px)": { flexDirection: "row" }, gap: "1.5rem" }}>
        {/* Left column - Tabbed content */}
        <Box data-print-area sx={{ flex: "1 1 0%", minWidth: "0px" }}>
          <TabView defaultValue="overview" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <TabBar sx={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", width: "100%" }}>
              <Tab value="overview" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Overview</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <Tab value="checklist" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Checklist</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <Tab value="repair" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Repair</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <Tab value="parts" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Parts</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <Tab value="photos" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Photos</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
              <Tab value="audit" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Audit</Box>} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
            </TabBar>

            {/* Overview Tab */}
            <TabPanel value="overview" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 768px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={User} sx={{ height: "1rem", width: "1rem" }}/> Customer</Typography></Box>
                  <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                    <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Name:</Box> <Box component="span" sx={{ fontWeight: "500" }}>{job.customers?.name}</Box></Typography>
                    <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Phone:</Box> {job.customers?.phone ? <Box href={`tel:${job.customers.phone}`} component="a" sx={mergeSx({ color: "inherit", textDecoration: "none" }, { color: "hsl(var(--primary))", "&:hover": { textDecorationLine: "underline" } })}>{job.customers.phone}</Box> : "—"}</Typography>
                    <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Email:</Box> {job.customers?.email || "—"}</Typography>
                    <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>GST:</Box> {job.customers?.gst_number || "—"}</Typography>
                  </CardContent>
                </Card>
                <Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Smartphone} sx={{ height: "1rem", width: "1rem" }}/> Device</Typography></Box>
                  <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                    <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Brand:</Box> {job.device_brand} · <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Type:</Box> {job.device_type}</Typography>
                    <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Model:</Box> {job.device_model || "—"} · <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Color:</Box> {job.device_color || "—"}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Serial #:</Box> {job.serial_number || "—"}</Typography>
                    <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>IMEI:</Box> {job.imei_number || "—"}</Typography>
                    <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Storage:</Box> {job.storage_capacity || "—"}</Typography>
                  </CardContent>
                </Card>
              </Box>
              <Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Problem Description</Typography></Box>
                <CardContent>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{job.problem_description}</Typography>
                  {job.staff_notes && <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", marginTop: "0.5rem", fontStyle: "italic" }}>Staff Notes: {job.staff_notes}</Typography>}
                </CardContent>
              </Card>
              {/* Billing Summary */}
              <Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={IndianRupee} sx={{ height: "1rem", width: "1rem" }}/> Billing Summary</Typography></Box>
                <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Service Charge</Box><Box component="span">{fmt(serviceCharge)}</Box></Box>
                  {partsTotal > 0 && <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Parts Total</Box><Box component="span">{fmt(partsTotal)}</Box></Box>}
                  {discount > 0 && <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--destructive))" }}><Box component="span">Discount ({job.discount_type === "percentage" ? `${discountVal}%` : "Fixed"})</Box><Box component="span">-{fmt(discount)}</Box></Box>}
                  {job.gst_mode !== "none" && gstAmount > 0 && <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>GST ({job.gst_percentage}% {job.gst_mode})</Box><Box component="span">{fmt(gstAmount)}</Box></Box>}
                  <Divider />
                  <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1rem", lineHeight: "1.5rem" }}><Box component="span">Grand Total</Box><Box component="span" sx={{ color: "hsl(var(--primary))" }}>{fmt(totalAmount + partsTotal)}</Box></Box>
                </CardContent>
              </Card>
            </TabPanel>

            {/* Checklist Tab */}
            <TabPanel value="checklist" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              {/* Pre-Repair Checklist */}
              <Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={ClipboardCheck} sx={{ height: "1rem", width: "1rem" }}/> Pre-Repair Checklist</Typography></Box>
                <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  {checklistCategories.map(cat => (<Box key={cat as string}>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}>{cat as string}</Typography>
                      <Box sx={{ borderWidth: "1px", borderRadius: "var(--radius)", overflow: "hidden" }}>
                        <DataTable columnsCount={6} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}><TableBody>
                          {preChecklist.filter((c: any) => c.category === cat).map((item: any, idx: number) => (<TableRow key={idx} sx={{ borderTopWidth: "1px", "&:first-child": { borderTopWidth: "0px" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem" }}>{item.item}</TableCell>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", textAlign: "right" }}>
                                <Box component="span" sx={mergeSx({ display: "inline-block", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }, item.value === "yes" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 15%, transparent)", color: "hsl(var(--success))" } : item.value === "no" ? { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 15%, transparent)", color: "hsl(var(--destructive))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" })}>
                                  {item.value === "na" ? "N/A" : item.value || "—"}
                                </Box>
                              </TableCell>
                            </TableRow>))}
                        </TableBody></DataTable>
                      </Box>
                    </Box>))}
                </CardContent>
              </Card>

              {/* Post-Repair Checklist */}
              {(job.status === "repair_completed" || job.status === "qc_failed") && isAdminStaff && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Shield} sx={{ height: "1rem", width: "1rem" }}/> Post-Repair Quality Check</Typography></Box>
                  <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    {postChecklist.map((item, idx) => (<Box key={idx} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                        <Box component="span">{item.item}</Box>
                        <Box sx={{ display: "flex", gap: "0.25rem" }}>
                          {(["yes", "no"] as const).map(v => (<Button key={v} type="button" onClick={() => setPostChecklist(prev => prev.map((c, i) => i === idx ? { ...c, value: v } : c))} variant={item.value === v ? "contained" : "outlined"} size="small" sx={{ height: "1.75rem", paddingLeft: "0.625rem", paddingRight: "0.625rem", fontSize: "0.75rem", lineHeight: "1rem" }}>{v === "yes" ? "Pass" : "Fail"}</Button>))}
                        </Box>
                      </Box>))}
                    <Button onClick={savePostChecklist} variant="contained" sx={{ width: "100%" }}><Box component={CheckCircle} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Submit Quality Check</Button>
                  </CardContent>
                </Card>)}

              {/* QC Approval Actions */}
              {job.status === "quality_check" && isAdminStaff && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Shield} sx={{ height: "1rem", width: "1rem" }}/> QC Approval</Typography></Box>
                  <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    {job.post_repair_checklist && (job.post_repair_checklist as any[]).length > 0 && (<Box sx={{ borderWidth: "1px", borderRadius: "var(--radius)", overflow: "hidden" }}>
                        <DataTable columnsCount={6} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}><TableBody>
                          {(job.post_repair_checklist as any[]).map((item: any, idx: number) => (<TableRow key={idx} sx={{ borderTopWidth: "1px", "&:first-child": { borderTopWidth: "0px" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem" }}>{item.item}</TableCell>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", textAlign: "right" }}>
                                <Box component="span" sx={mergeSx({ display: "inline-block", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }, item.value === "yes" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 15%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 15%, transparent)", color: "hsl(var(--destructive))" })}>
                                  {item.value === "yes" ? "Pass" : "Fail"}
                                </Box>
                              </TableCell>
                            </TableRow>))}
                        </TableBody></DataTable>
                      </Box>)}
                    <Box sx={{ display: "flex", gap: "0.75rem" }}>
                      <Button onClick={approveQC} variant="contained" sx={{ flex: "1 1 0%", backgroundColor: "hsl(var(--success))", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 90%, transparent)" } }}><Box component={CheckCircle2} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Approve QC</Button>
                      <Button onClick={rejectQC} variant="contained" color="error" sx={{ flex: "1 1 0%" }}><Box component={XCircle} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/> Reject QC</Button>
                    </Box>
                  </CardContent>
                </Card>)}

              {/* Show completed post-repair checklist for other statuses */}
              {!["repair_completed", "qc_failed", "quality_check"].includes(job.status) && job.post_repair_checklist && (job.post_repair_checklist as any[]).length > 0 && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Shield} sx={{ height: "1rem", width: "1rem" }}/> Post-Repair Checklist (Completed)</Typography></Box>
                  <CardContent>
                    <Box sx={{ borderWidth: "1px", borderRadius: "var(--radius)", overflow: "hidden" }}>
                      <DataTable columnsCount={6} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}><TableBody>
                        {(job.post_repair_checklist as any[]).map((item: any, idx: number) => (<TableRow key={idx} sx={{ borderTopWidth: "1px", "&:first-child": { borderTopWidth: "0px" }, borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                            <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem" }}>{item.item}</TableCell>
                            <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", textAlign: "right" }}>
                              <Box component="span" sx={mergeSx({ display: "inline-block", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }, item.value === "yes" ? { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 15%, transparent)", color: "hsl(var(--success))" } : { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 15%, transparent)", color: "hsl(var(--destructive))" })}>
                                {item.value === "yes" ? "Pass" : "Fail"}
                              </Box>
                            </TableCell>
                          </TableRow>))}
                      </TableBody></DataTable>
                    </Box>
                  </CardContent>
                </Card>)}
            </TabPanel>

            {/* Repair Notes Tab */}
            <TabPanel value="repair" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Problem & Diagnosis</Typography></Box>
                <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                  <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontWeight: "500" }}>Problem:</Box> {job.problem_description}</Typography>
                  {job.repair_notes && <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontWeight: "500" }}>Repair Notes:</Box> {job.repair_notes}</Typography>}
                  {job.staff_notes && <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))", fontWeight: "500" }}>Staff Notes:</Box> {job.staff_notes}</Typography>}
                </CardContent>
              </Card>
              {isAdminStaff && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Update Repair Notes</Typography></Box>
                  <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <TextField placeholder="Add diagnosis or repair notes..." defaultValue={job.repair_notes || ""} onBlur={async (e) => {
            const val = e.target.value;
            if (val !== (job.repair_notes || "")) {
                await supabase.from("job_sheets").update({ repair_notes: val } as any).eq("id", id);
                toast.success("Notes saved");
                fetchAll();
            }
        }} size="small" fullWidth multiline slotProps={{ htmlInput: { "aria-label": "Add diagnosis or repair notes..." } }}/>
                  </CardContent>
                </Card>)}
            </TabPanel>

            {/* Parts Tab */}
            <TabPanel value="parts" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Package} sx={{ height: "1rem", width: "1rem" }}/> Parts Used</Typography>
                    {isAdminStaff && <Button onClick={() => setPartsSheetOpen(true)} variant="outlined" size="small"><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Add Part</Button>}
                  </Box>
                </Box>
                <CardContent>
                  {repairParts.length === 0 ? (<Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>No parts added yet.</Typography>) : (<Box sx={{ borderWidth: "1px", borderRadius: "var(--radius)", overflow: "hidden" }}>
                      <DataTable columnsCount={4} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                        <TableHead><TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}><TableCell sx={{ textAlign: "left", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))" }}>Part</TableCell><TableCell sx={{ textAlign: "right", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))" }}>Cost</TableCell><TableCell sx={{ textAlign: "right", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))" }}>Qty</TableCell><TableCell sx={{ textAlign: "right", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--muted-foreground))" }}>Total</TableCell></TableRow></TableHead>
                        <TableBody>
                          {repairParts.map(p => (<TableRow key={p.id} sx={{ borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem" }}>{p.name}</TableCell>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", textAlign: "right" }}>{fmt(Number(p.cost))}</TableCell>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", textAlign: "right" }}>{p.quantity}</TableCell>
                              <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.375rem", paddingBottom: "0.375rem", textAlign: "right" }}>{fmt(Number(p.total))}</TableCell>
                            </TableRow>))}
                        </TableBody>
                      </DataTable>
                    </Box>)}
                  {partsTotal > 0 && <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: "600", fontSize: "0.875rem", lineHeight: "1.25rem", marginTop: "0.75rem" }}><Box component="span">Parts Total</Box><Box component="span">{fmt(partsTotal)}</Box></Box>}
                </CardContent>
              </Card>
            </TabPanel>

            {/* Photos Tab */}
            <TabPanel value="photos" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              {/* Upload Section */}
              {isAdminStaff && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Camera} sx={{ height: "1rem", width: "1rem" }}/> Upload Photos</Typography></Box>
                  <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <TextField value={uploadStage} select size="small" fullWidth onChange={event => setUploadStage(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "10rem" }}>
                          <MenuItem value="before">Before Repair</MenuItem>
                          <MenuItem value="during">During Repair</MenuItem>
                          <MenuItem value="after">After Repair</MenuItem>
                        </TextField>
                      <Box component="label" sx={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--primary))", cursor: "pointer", "&:hover": { textDecorationLine: "underline" } }}>
                        <Box component={Upload} sx={{ height: "1rem", width: "1rem" }}/> Choose files
                        <Box type="file" accept="image/*" multiple onChange={e => handleRepairImageUpload(e.target.files, uploadStage)} component="input" sx={{ display: "none" }}/>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>)}

              {/* Before Images */}
              {beforeImages.length > 0 && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--info))" })}>📷 Before Repair ({beforeImages.length})</Typography></Box>
                  <CardContent>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.75rem" }}>
                      {beforeImages.map(img => (<Box key={img.id} sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                          <Box src={img.image_url} alt="before" component="img" sx={{ borderRadius: "var(--radius)", borderWidth: "1px", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}/>
                          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textAlign: "center", textTransform: "capitalize" }}>{img.image_type.replace("_", " ")}</Typography>
                        </Box>))}
                    </Box>
                  </CardContent>
                </Card>)}

              {/* During Images */}
              {duringImages.length > 0 && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--warning))" })}>🔧 During Repair ({duringImages.length})</Typography></Box>
                  <CardContent>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.75rem" }}>
                      {duringImages.map(img => (<Box key={img.id} sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                          <Box src={img.image_url} alt="during" component="img" sx={{ borderRadius: "var(--radius)", borderWidth: "1px", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}/>
                        </Box>))}
                    </Box>
                  </CardContent>
                </Card>)}

              {/* After Images */}
              {afterImages.length > 0 && (<Card>
                  <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--success))" })}>✅ After Repair ({afterImages.length})</Typography></Box>
                  <CardContent>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "0.75rem" }}>
                      {afterImages.map(img => (<Box key={img.id} sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.25rem" } }}>
                          <Box src={img.image_url} alt="after" component="img" sx={{ borderRadius: "var(--radius)", borderWidth: "1px", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }}/>
                        </Box>))}
                    </Box>
                  </CardContent>
                </Card>)}

              {images.length === 0 && <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", textAlign: "center", paddingTop: "2rem", paddingBottom: "2rem" }}>No photos uploaded yet.</Typography>}
            </TabPanel>

            {/* Audit Log Tab */}
            <TabPanel value="audit" sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/> Audit Log</Typography></Box>
                <CardContent>
                  {auditLog.length === 0 ? <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>No audit entries yet.</Typography> : (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.625rem" } }}>
                      {auditLog.map(entry => (<Box key={entry.id} sx={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          <Box sx={{ width: "0.375rem", height: "0.375rem", borderRadius: "9999px", backgroundColor: "hsl(var(--primary))", marginTop: "0.375rem", flexShrink: "0" }}/>
                          <Box>
                            <Typography component="p" variant="body1" sx={{ fontWeight: "500", textTransform: "capitalize" }}>{entry.action.replace(/_/g, " ")}</Typography>
                            {entry.details && <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>{entry.details}</Typography>}
                            <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>{new Date(entry.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Typography>
                          </Box>
                        </Box>))}
                    </Box>)}
                </CardContent>
              </Card>
            </TabPanel>
          </TabView>
        </Box>

        {/* Right column - Timeline + Actions (30%) */}
        <Box sx={{ "@media (min-width: 1024px)": { width: "20rem" }, flexShrink: "0", "@media print": { display: "none" } }}>
          <Box sx={{ position: "sticky", top: "1rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            {/* Actions Card */}
            <Card>
              <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Actions</Typography></Box>
              <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                {isAdminStaff && !job.invoice_id && ["quality_check", "invoice_generated", "ready_for_delivery"].includes(job.status) && (<Button onClick={generateInvoice} disabled={generatingInvoice} variant="contained" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                    <Box component={Receipt} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> {generatingInvoice ? "Generating..." : "Generate Invoice"}
                  </Button>)}
                {job.invoice_id && (<Button onClick={() => navigate(`/invoices/${job.invoice_id}`)} variant="outlined" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                    <Box component={FileText} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> View Invoice
                  </Button>)}
                {isAdminStaff && (<Button onClick={() => { setPaymentForm({ amount: "", method: "cash", notes: "" }); setPaymentSheetOpen(true); }} variant="outlined" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                    <Box component={CreditCard} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> Add Payment
                  </Button>)}
                {isAdminStaff && (<Button onClick={sendPaymentLink} disabled={sendingPaymentLink} variant="outlined" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                    <Box component={Link} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> {sendingPaymentLink ? "Sending..." : "Send Payment Link"}
                  </Button>)}
                <Button onClick={handlePrint} variant="outlined" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                  <Box component={Printer} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> Print / PDF
                </Button>
                <Button onClick={copyPublicLink} variant="outlined" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                  <Box component={Copy} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> Copy Public Link
                </Button>
                {["ready_for_delivery", "delivered"].includes(job.status) && (<Button onClick={copyDeliveryReportLink} variant="outlined" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                    <Box component={Download} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> Copy Delivery Report Link
                  </Button>)}
                {isAdminStaff && (<Button onClick={() => navigate(`/repairs/${id}/edit`)} variant="outlined" size="small" sx={{ width: "100%", justifyContent: "flex-start" }}>
                    <Box component={FileText} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> Edit Job Sheet
                  </Button>)}
              </CardContent>
            </Card>

            {/* Technician Assignment */}
            {showTechAssignment && (<Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Assign Technician</Typography></Box>
                <CardContent>
                  <TextField value={job.assigned_technician_id || undefined} select size="small" fullWidth onChange={event => assignTechnician(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select technician"}</MenuItem>{technicians.map(t => <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>)}</TextField>
                </CardContent>
              </Card>)}

            {/* Status Update */}
            {(isAdminStaff || hasRole("technician")) && !["delivered", "rejected"].includes(job.status) && (<Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Update Status</Typography></Box>
                <CardContent>
                  <TextField value={job.status} select size="small" fullWidth onChange={event => updateStatus(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>{JOB_STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>{s.replace(/_/g, " ")}</MenuItem>)}</TextField>
                </CardContent>
              </Card>)}

            {/* Device Movement */}
            <Card>
              <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={ArrowRightLeft} sx={{ height: "1rem", width: "1rem" }}/> Device Custody</Typography></Box>
              <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.75rem", lineHeight: "1rem" }}>
                <Box sx={{ padding: "0.625rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderRadius: "var(--radius)" }}>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Sent to Technician</Typography>
                  <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{job.device_sent_at ? new Date(job.device_sent_at).toLocaleString("en-IN") : "Not yet"}</Typography>
                </Box>
                <Box sx={{ padding: "0.625rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderRadius: "var(--radius)" }}>
                  <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Received Back</Typography>
                  <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{job.device_received_at ? new Date(job.device_received_at).toLocaleString("en-IN") : "Not yet"}</Typography>
                </Box>
                {isAdminStaff && (<Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                    {!job.device_sent_at && job.assigned_technician_id && (<Button onClick={sendToTechnician} variant="outlined" size="small" sx={{ width: "100%", fontSize: "0.75rem", lineHeight: "1rem" }}><Box component={Truck} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Send to Technician</Button>)}
                    {job.device_sent_at && !job.device_received_at && (<Button onClick={receiveFromTechnician} variant="outlined" size="small" sx={{ width: "100%", fontSize: "0.75rem", lineHeight: "1rem" }}><Box component={Truck} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Receive Device</Button>)}
                  </Box>)}
              </CardContent>
            </Card>

            {/* Cost Tracking */}
            <Card>
              <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Cost Tracking</Typography></Box>
              <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.75rem", lineHeight: "1rem" }}>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Estimated</Box><Box component="span">{job.estimated_cost ? fmt(Number(job.estimated_cost)) : "—"}</Box></Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Actual</Box><Box component="span">{job.actual_cost ? fmt(Number(job.actual_cost)) : "—"}</Box></Box>
                <Box sx={{ display: "flex", justifyContent: "space-between" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Tech Payment</Box><Box component="span">{job.technician_payment ? fmt(Number(job.technician_payment)) : "—"}</Box></Box>
                {(isAdminStaff || hasRole("technician")) && (<>
                    <Divider />
                    <Box sx={{ display: "flex", gap: "0.375rem", alignItems: "flex-end" }}>
                      <TextField type="number" placeholder="Actual cost" value={actualCost} onChange={e => setActualCost(e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Actual cost" } }} sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                      <Button onClick={saveActualCost} variant="outlined" size="small" sx={{ height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem", paddingLeft: "0.5rem", paddingRight: "0.5rem" }}>Save</Button>
                    </Box>
                    {isAdminStaff && job.technician_payment_status !== "paid" && (<Button onClick={() => { setTechPayForm({ amount: "", method: "cash", notes: "" }); setTechPaySheetOpen(true); }} variant="outlined" size="small" sx={{ width: "100%", fontSize: "0.75rem", lineHeight: "1rem" }}>
                        <Box component={IndianRupee} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Record Tech Payment
                      </Button>)}
                  </>)}
              </CardContent>
            </Card>

            {/* Warranty Card */}
            {showWarrantyCard && isAdminStaff && (<Card>
                <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={ShieldCheck} sx={{ height: "1rem", width: "1rem" }}/> Warranty</Typography></Box>
                <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.75rem", lineHeight: "1rem" }}>
                  {warrantyActive && (<Box sx={mergeSx({ padding: "0.625rem", borderRadius: "var(--radius)" }, warrantyExpired ? { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)" } : { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)" })}>
                      <Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{wDays} days warranty</Typography>
                      <Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>Start: {new Date(wStart).toLocaleDateString("en-IN")} · Expires: {warrantyExpiry!.toLocaleDateString("en-IN")}</Typography>
                      {(job as any).warranty_terms && <Typography component="p" variant="body1" sx={{ marginTop: "0.25rem", color: "hsl(var(--muted-foreground))" }}>{(job as any).warranty_terms}</Typography>}
                    </Box>)}
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField type="number" value={warrantyDays} onChange={e => setWarrantyDays(e.target.value)} placeholder="e.g. 30, 90, 180" label={"Warranty Days"} size="small" fullWidth sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}/>
                  </Box>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField value={warrantyTerms} onChange={e => setWarrantyTerms(e.target.value)} placeholder="e.g. Display replacement warranty" label={"Warranty Terms"} size="small" fullWidth multiline sx={{ fontSize: "0.75rem", lineHeight: "1rem", minHeight: "60px" }}/>
                  </Box>
                  <Button onClick={saveWarranty} disabled={savingWarranty} variant="outlined" size="small" sx={{ width: "100%", fontSize: "0.75rem", lineHeight: "1rem" }}>
                    {savingWarranty ? <Box component={Loader2} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem", animation: "spin 1s linear infinite" }}/> : <Box component={ShieldCheck} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>} Save Warranty
                  </Button>
                </CardContent>
              </Card>)}

            {/* Timeline */}
            <Card>
              <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={History} sx={{ height: "1rem", width: "1rem" }}/> Repair Timeline</Typography></Box>
              <CardContent>
                {isRejected ? (<Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", color: "hsl(var(--destructive))" }}>
                    <Box sx={{ width: "2rem", height: "2rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 15%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}><Box component={Circle} sx={{ height: "1rem", width: "1rem", fill: "hsl(var(--destructive))", color: "hsl(var(--destructive))" }}/></Box>
                    <Box><Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>Rejected</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Customer rejected the repair</Typography></Box>
                  </Box>) : (<Box sx={{ position: "relative" }}>
                    {TIMELINE_STEPS.filter(s => s.key !== "qc_failed" || job.status === "qc_failed").map((step, idx) => {
                const isCompleted = idx < currentStatusIndex;
                const isCurrent = idx === currentStatusIndex;
                const isFuture = idx > currentStatusIndex;
                const StepIcon = step.icon;
                const logEntry = auditLog.find(l => l.details?.toLowerCase().includes(step.key.replace(/_/g, " ")) || (l.action === "created" && step.key === "created") || l.action === step.key);
                return (<Box key={step.key} sx={{ display: "flex", gap: "0.75rem", position: "relative" }}>
                          {idx < TIMELINE_STEPS.filter(s => s.key !== "qc_failed" || job.status === "qc_failed").length - 1 && (<Box sx={mergeSx({ position: "absolute", left: "14px", top: "2rem", width: "0.125rem", height: "calc(100% - 8px)" }, isCompleted ? { backgroundColor: "hsl(var(--primary))" } : { backgroundColor: "hsl(var(--border))" })}/>)}
                          <Box sx={mergeSx({ position: "relative", zIndex: "10", display: "flex", alignItems: "center", justifyContent: "center", width: "1.75rem", height: "1.75rem", borderRadius: "9999px", flexShrink: "0", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, isCompleted ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" } :
                    isCurrent ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)", color: "hsl(var(--primary))", "--alv-ring-offset-shadow": "var(--alv-ring-inset) 0 0 0 var(--alv-ring-offset-width) var(--alv-ring-offset-color)", "--alv-ring-shadow": "var(--alv-ring-inset) 0 0 0 calc(2px + var(--alv-ring-offset-width)) var(--alv-ring-color)", boxShadow: "var(--alv-ring-offset-shadow), var(--alv-ring-shadow), var(--alv-shadow, 0 0 #0000)", "--alv-ring-color": "hsl(var(--primary))", "--alv-ring-offset-width": "1px", "--alv-ring-offset-color": "hsl(var(--background))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" })}>
                            {isCompleted ? <Box component={CheckCircle} sx={{ height: "0.875rem", width: "0.875rem" }}/> : <Box component={StepIcon} sx={{ height: "0.875rem", width: "0.875rem" }}/>}
                          </Box>
                          <Box sx={mergeSx({ paddingBottom: "1rem" }, isFuture ? { opacity: "0.4" } : {})}>
                            <Typography component="p" variant="body1" sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }, isCurrent ? { color: "hsl(var(--primary))" } : {})}>{step.label}</Typography>
                            {logEntry && <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{new Date(logEntry.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</Typography>}
                            {isCurrent && <Box component="span" sx={{ display: "inline-block", marginTop: "0.125rem", fontSize: "9px", fontWeight: "500", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))", paddingLeft: "0.375rem", paddingRight: "0.375rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "9999px" }}>Current</Box>}
                          </Box>
                        </Box>);
            })}
                  </Box>)}
              </CardContent>
            </Card>
          </Box>
        </Box>
      </Box>

      {/* Payment Sheet */}
      <SideDrawer
        open={paymentSheetOpen}
        onClose={() => setPaymentSheetOpen(false)}
        title={"Record Payment"}
        width={420}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPaymentSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={addPayment} variant="contained" sx={{ minHeight: 36 }}>Record Payment</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={paymentForm.amount} onChange={e => setPaymentForm(p => ({ ...p, amount: e.target.value }))} label={"Amount (\u20B9)"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
              <TextField value={paymentForm.method} label={"Payment Method"} select size="small" fullWidth onChange={event => (v => setPaymentForm(p => ({ ...p, method: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="cash">Cash</MenuItem><MenuItem value="upi">UPI</MenuItem><MenuItem value="card">Card</MenuItem><MenuItem value="online">Online</MenuItem></TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={paymentForm.notes} onChange={e => setPaymentForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" label={"Notes"} size="small" fullWidth/></Box>
          </Box>
        </SideDrawer>

      {/* Parts Sheet */}
      <SideDrawer
        open={partsSheetOpen}
        onClose={() => setPartsSheetOpen(false)}
        title={"Add Part"}
        width={420}
        footer={
          <>
            <Button variant="outlined" onClick={() => setPartsSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={addPart} variant="contained" sx={{ minHeight: 36 }}>Add Part</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={partForm.name} onChange={e => setPartForm(p => ({ ...p, name: e.target.value }))} label={"Part Name"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={partForm.cost} onChange={e => setPartForm(p => ({ ...p, cost: e.target.value }))} label={"Cost (\u20B9)"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={partForm.gst_percentage} onChange={e => setPartForm(p => ({ ...p, gst_percentage: e.target.value }))} label={"GST %"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={partForm.quantity} onChange={e => setPartForm(p => ({ ...p, quantity: e.target.value }))} label={"Quantity"} size="small" fullWidth/></Box>
          </Box>
        </SideDrawer>

      {/* Technician Payment Sheet */}
      <SideDrawer
        open={techPaySheetOpen}
        onClose={() => setTechPaySheetOpen(false)}
        title={"Record Technician Payment"}
        width={420}
        footer={
          <>
            <Button variant="outlined" onClick={() => setTechPaySheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={recordTechnicianPayment} variant="contained" sx={{ minHeight: 36 }}>Record Payment</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={techPayForm.amount} onChange={e => setTechPayForm(p => ({ ...p, amount: e.target.value }))} label={"Amount (\u20B9)"} size="small" fullWidth/></Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
              <TextField value={techPayForm.method} label={"Payment Method"} select size="small" fullWidth onChange={event => (v => setTechPayForm(p => ({ ...p, method: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="cash">Cash</MenuItem><MenuItem value="upi">UPI</MenuItem><MenuItem value="bank">Bank Transfer</MenuItem></TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={techPayForm.notes} onChange={e => setTechPayForm(p => ({ ...p, notes: e.target.value }))} placeholder="Optional notes" label={"Notes"} size="small" fullWidth/></Box>
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
