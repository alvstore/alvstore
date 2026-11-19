"use client";

import { Accordion, AccordionDetails, AccordionSummary, Box, Button, ButtonBase, Card, CardContent, Divider, FormLabel, IconButton, LinearProgress, MenuItem, Radio, RadioGroup, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Upload, Plus, X, ChevronDown, Eye, EyeOff, AlertTriangle, CheckCircle2, Check, User, Smartphone, IndianRupee, ClipboardCheck, FileText, Trash2, Tag, } from "lucide-react";
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const STEPS = [
    { label: "Customer", icon: User },
    { label: "Device", icon: Smartphone },
    { label: "Service Charges", icon: IndianRupee },
    { label: "Checklist", icon: ClipboardCheck },
    { label: "Review", icon: FileText },
];
interface ChecklistItem {
    category: string;
    item: string;
    value: "yes" | "no" | "na" | "";
    autoSet?: boolean;
}
interface ServiceLineItem {
    id: string;
    name: string;
    hsn_code: string;
    gst_percentage: number;
    price: number;
    quantity: number;
    discount_type: "none" | "percentage" | "fixed";
    discount_value: number;
}
// Device-specific checklists (fallback when no issue category selected)
const DEVICE_CHECKLISTS: Record<string, ChecklistItem[]> = {
    Mobile: [
        { category: "Power", item: "Device turns ON", value: "" },
        { category: "Power", item: "Device turns OFF", value: "" },
        { category: "Display", item: "Display working", value: "" },
        { category: "Display", item: "Touch working", value: "" },
        { category: "Display", item: "Display damaged / scratches", value: "" },
        { category: "Audio", item: "Earpiece speaker working", value: "" },
        { category: "Audio", item: "Loudspeaker working", value: "" },
        { category: "Audio", item: "Microphone working", value: "" },
        { category: "Camera", item: "Front camera working", value: "" },
        { category: "Camera", item: "Rear camera working", value: "" },
        { category: "Camera", item: "Flash working", value: "" },
        { category: "Network", item: "WiFi working", value: "" },
        { category: "Network", item: "Cellular signal working", value: "" },
        { category: "Network", item: "Bluetooth working", value: "" },
        { category: "Hardware", item: "Volume buttons working", value: "" },
        { category: "Hardware", item: "Power button working", value: "" },
        { category: "Hardware", item: "Charging port working", value: "" },
        { category: "Hardware", item: "Fingerprint sensor working", value: "" },
        { category: "Hardware", item: "Face ID / Face unlock working", value: "" },
        { category: "Hardware", item: "Vibration motor working", value: "" },
        { category: "Accessories", item: "Charger received", value: "" },
        { category: "Accessories", item: "Cable received", value: "" },
        { category: "Accessories", item: "Cover / Case received", value: "" },
        { category: "Accessories", item: "SIM card received", value: "" },
        { category: "Accessories", item: "Memory card received", value: "" },
    ],
    Laptop: [
        { category: "Power", item: "Device turns ON", value: "" },
        { category: "Power", item: "Battery charges", value: "" },
        { category: "Power", item: "Battery health acceptable", value: "" },
        { category: "Display", item: "Display working", value: "" },
        { category: "Display", item: "Display hinge intact", value: "" },
        { category: "Display", item: "Display damaged / scratches", value: "" },
        { category: "Input", item: "Keyboard working (all keys)", value: "" },
        { category: "Input", item: "Trackpad working", value: "" },
        { category: "Input", item: "Trackpad buttons working", value: "" },
        { category: "Audio", item: "Speaker working", value: "" },
        { category: "Audio", item: "Microphone working", value: "" },
        { category: "Audio", item: "Headphone jack working", value: "" },
        { category: "Camera", item: "Webcam working", value: "" },
        { category: "Network", item: "WiFi working", value: "" },
        { category: "Network", item: "Ethernet port working", value: "" },
        { category: "Network", item: "Bluetooth working", value: "" },
        { category: "Ports", item: "USB ports working", value: "" },
        { category: "Ports", item: "HDMI / Display port working", value: "" },
        { category: "Ports", item: "Charging port working", value: "" },
        { category: "Ports", item: "SD card slot working", value: "" },
        { category: "Cooling", item: "Fan noise normal", value: "" },
        { category: "Cooling", item: "No overheating", value: "" },
        { category: "Accessories", item: "Charger / Adapter received", value: "" },
        { category: "Accessories", item: "Laptop bag received", value: "" },
        { category: "Accessories", item: "Mouse received", value: "" },
    ],
    Tablet: [
        { category: "Power", item: "Device turns ON", value: "" },
        { category: "Power", item: "Device turns OFF", value: "" },
        { category: "Power", item: "Battery charges", value: "" },
        { category: "Display", item: "Display working", value: "" },
        { category: "Display", item: "Touch working", value: "" },
        { category: "Display", item: "Display damaged / scratches", value: "" },
        { category: "Audio", item: "Speaker working", value: "" },
        { category: "Audio", item: "Microphone working", value: "" },
        { category: "Camera", item: "Front camera working", value: "" },
        { category: "Camera", item: "Rear camera working", value: "" },
        { category: "Network", item: "WiFi working", value: "" },
        { category: "Network", item: "Cellular signal working", value: "" },
        { category: "Network", item: "Bluetooth working", value: "" },
        { category: "Hardware", item: "Volume buttons working", value: "" },
        { category: "Hardware", item: "Power button working", value: "" },
        { category: "Hardware", item: "Charging port working", value: "" },
        { category: "Hardware", item: "Stylus / Pen support working", value: "" },
        { category: "Accessories", item: "Charger received", value: "" },
        { category: "Accessories", item: "Cable received", value: "" },
        { category: "Accessories", item: "Cover / Case received", value: "" },
        { category: "Accessories", item: "Stylus / Pen received", value: "" },
        { category: "Accessories", item: "SIM card received", value: "" },
    ],
    Desktop: [
        { category: "Power", item: "Device turns ON", value: "" },
        { category: "Power", item: "Device turns OFF", value: "" },
        { category: "Power", item: "PSU fan working", value: "" },
        { category: "Display", item: "Monitor output working", value: "" },
        { category: "Display", item: "Monitor included (physical damage)", value: "" },
        { category: "Input", item: "Keyboard working", value: "" },
        { category: "Input", item: "Mouse working", value: "" },
        { category: "Audio", item: "Speaker / Audio output working", value: "" },
        { category: "Network", item: "Ethernet port working", value: "" },
        { category: "Network", item: "WiFi adapter working", value: "" },
        { category: "Ports", item: "USB ports working", value: "" },
        { category: "Ports", item: "HDMI / VGA / DP ports working", value: "" },
        { category: "Ports", item: "Audio jack working", value: "" },
        { category: "Cooling", item: "CPU fan working", value: "" },
        { category: "Cooling", item: "Case fan working", value: "" },
        { category: "Cooling", item: "No overheating", value: "" },
        { category: "Accessories", item: "Power cable received", value: "" },
        { category: "Accessories", item: "Keyboard received", value: "" },
        { category: "Accessories", item: "Mouse received", value: "" },
        { category: "Accessories", item: "Monitor received", value: "" },
    ],
};
const POWER_DEPENDENT_CATEGORIES = ["Display", "Audio", "Camera", "Network", "Hardware", "Input", "Ports", "Cooling"];
function getChecklistForDevice(deviceType: string): ChecklistItem[] {
    if (DEVICE_CHECKLISTS[deviceType])
        return DEVICE_CHECKLISTS[deviceType].map(c => ({ ...c }));
    const lower = deviceType.toLowerCase();
    if (lower.includes("laptop") || lower.includes("notebook"))
        return DEVICE_CHECKLISTS.Laptop.map(c => ({ ...c }));
    if (lower.includes("tablet") || lower.includes("ipad"))
        return DEVICE_CHECKLISTS.Tablet.map(c => ({ ...c }));
    if (lower.includes("desktop") || lower.includes("pc") || lower.includes("computer"))
        return DEVICE_CHECKLISTS.Desktop.map(c => ({ ...c }));
    return DEVICE_CHECKLISTS.Mobile.map(c => ({ ...c }));
}
interface ServiceCategory {
    id: string;
    name: string;
    default_charge: number;
}
function genId() { return Math.random().toString(36).slice(2, 10); }
function calcLineItem(item: ServiceLineItem) {
    const base = item.price * item.quantity;
    let disc = 0;
    if (item.discount_type === "percentage")
        disc = (base * item.discount_value) / 100;
    else if (item.discount_type === "fixed")
        disc = item.discount_value;
    const taxable = base - disc;
    const gstAmt = (taxable * item.gst_percentage) / 100;
    return { base, disc, taxable, gstAmt, total: taxable + gstAmt };
}
export default function JobSheetCreate() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { id: editId } = useParams();
    const isEditMode = !!editId;
    const [currentStep, setCurrentStep] = useState(1);
    const [brands, setBrands] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [deviceTypes, setDeviceTypes] = useState<{
        id: string;
        name: string;
    }[]>([]);
    const [customers, setCustomers] = useState<{
        id: string;
        name: string;
        phone?: string;
        email?: string;
        gst_number?: string;
        address?: string;
    }[]>([]);
    const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
    const [checklist, setChecklist] = useState<ChecklistItem[]>(getChecklistForDevice("Mobile"));
    const [issueTags, setIssueTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");
    const [imageFiles, setImageFiles] = useState<{
        type: string;
        file: File;
    }[]>([]);
    const [saving, setSaving] = useState(false);
    const [deviceIsOff, setDeviceIsOff] = useState(false);
    const [showApplePassword, setShowApplePassword] = useState(false);
    const [showGooglePassword, setShowGooglePassword] = useState(false);
    const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
    const [editLoading, setEditLoading] = useState(false);
    // Issue category state
    const [issueCategories, setIssueCategories] = useState<{
        id: string;
        name: string;
        description: string | null;
    }[]>([]);
    const [selectedIssueCategory, setSelectedIssueCategory] = useState<string>("");
    const [dynamicChecklistLoaded, setDynamicChecklistLoaded] = useState(false);
    // Service line items
    const [serviceItems, setServiceItems] = useState<ServiceLineItem[]>([
        { id: genId(), name: "", hsn_code: "", gst_percentage: 18, price: 0, quantity: 1, discount_type: "none", discount_value: 0 },
    ]);
    const [gstMode, setGstMode] = useState<"none" | "inclusive" | "exclusive">("exclusive");
    const [form, setForm] = useState({
        customer_id: "",
        device_brand: "",
        custom_brand: "",
        device_type: "",
        custom_type: "",
        device_model: "",
        serial_number: "",
        imei_number: "",
        device_color: "",
        storage_capacity: "",
        problem_description: "",
        staff_notes: "",
        estimated_cost: "",
        estimated_completion: "",
        priority: "normal",
        apple_id: "",
        apple_id_password: "",
        google_account: "",
        google_account_password: "",
        device_lock_code: "",
    });
    useEffect(() => {
        Promise.all([
            supabase.from("device_brands").select("id, name").order("name"),
            supabase.from("device_types").select("id, name").order("name"),
            supabase.from("customers").select("id, name, phone, email, gst_number, address").order("name"),
            supabase.from("service_charge_categories").select("*").order("name"),
            supabase.from("issue_categories").select("id, name, description").eq("status", "active").order("name"),
        ]).then(([bRes, tRes, cRes, scRes, icRes]) => {
            setBrands(bRes.data || []);
            setDeviceTypes(tRes.data || []);
            setCustomers(cRes.data || []);
            setServiceCategories((scRes.data as ServiceCategory[]) || []);
            setIssueCategories((icRes.data as any[]) || []);
        });
    }, []);
    // Load dynamic checklist when issue category changes
    useEffect(() => {
        if (!selectedIssueCategory || isEditMode)
            return;
        supabase.from("checklist_templates")
            .select("*")
            .eq("issue_category_id", selectedIssueCategory)
            .eq("stage", "pre")
            .order("sort_order")
            .then(({ data }) => {
            if (data && data.length > 0) {
                const dynamicChecklist: ChecklistItem[] = data.map((t: any) => ({
                    category: t.type === "boolean" ? "Checks" : "Details",
                    item: t.title,
                    value: "" as const,
                }));
                // Merge with device-specific checklist
                const deviceType = form.device_type === "__other__" ? form.custom_type : form.device_type;
                const deviceChecklist = deviceType ? getChecklistForDevice(deviceType) : [];
                setChecklist([...deviceChecklist, ...dynamicChecklist]);
                setDynamicChecklistLoaded(true);
            }
        });
    }, [selectedIssueCategory]);
    // Load existing job sheet in edit mode
    useEffect(() => {
        if (!editId)
            return;
        setEditLoading(true);
        supabase.from("job_sheets").select("*, customers(name, phone, email, gst_number, address)")
            .eq("id", editId).single()
            .then(({ data, error }) => {
            if (error || !data) {
                toast.error("Job sheet not found");
                navigate("/repairs");
                return;
            }
            setForm({
                customer_id: data.customer_id || "",
                device_brand: data.device_brand || "",
                custom_brand: "",
                device_type: data.device_type || "",
                custom_type: "",
                device_model: data.device_model || "",
                serial_number: data.serial_number || "",
                imei_number: data.imei_number || "",
                device_color: data.device_color || "",
                storage_capacity: data.storage_capacity || "",
                problem_description: data.problem_description || "",
                staff_notes: data.staff_notes || "",
                estimated_cost: data.estimated_cost?.toString() || "",
                estimated_completion: data.estimated_completion || "",
                priority: data.priority || "normal",
                apple_id: data.apple_id || "",
                apple_id_password: data.apple_id_password || "",
                google_account: data.google_account || "",
                google_account_password: data.google_account_password || "",
                device_lock_code: data.device_lock_code || "",
            });
            setSelectedIssueCategory((data as any).issue_category_id || "");
            setIssueTags((data.issue_tags as string[]) || []);
            setGstMode((data.gst_mode as any) || "exclusive");
            const items = (data as any).service_items as ServiceLineItem[] | null;
            if (items && Array.isArray(items) && items.length > 0) {
                setServiceItems(items.map(i => ({ ...i, id: i.id || genId() })));
            }
            else if (Number(data.service_charge) > 0) {
                setServiceItems([{
                        id: genId(),
                        name: `Service Charge - ${data.device_type}`,
                        hsn_code: "",
                        gst_percentage: Number(data.gst_percentage) || 18,
                        price: Number(data.service_charge) || 0,
                        quantity: 1,
                        discount_type: (data.discount_type as any) || "none",
                        discount_value: Number(data.discount_value) || 0,
                    }]);
            }
            if (data.pre_repair_checklist && (data.pre_repair_checklist as any[]).length > 0) {
                setChecklist(data.pre_repair_checklist as unknown as ChecklistItem[]);
            }
            setSelectedCustomer(data.customers || null);
            setEditLoading(false);
        });
    }, [editId]);
    // When device type changes, reload checklist and auto-fill service charge
    useEffect(() => {
        if (isEditMode)
            return;
        const type = form.device_type === "__other__" ? form.custom_type : form.device_type;
        if (!type)
            return;
        if (!dynamicChecklistLoaded) {
            const newChecklist = getChecklistForDevice(type);
            setChecklist(newChecklist);
        }
        setDeviceIsOff(false);
        const cats = [...new Set(checklist.map(c => c.category))];
        const openMap: Record<string, boolean> = {};
        cats.forEach(c => { openMap[c] = true; });
        setOpenCategories(openMap);
        const matchCat = serviceCategories.find(sc => sc.name.toLowerCase() === type.toLowerCase() ||
            type.toLowerCase().includes(sc.name.toLowerCase()));
        if (matchCat && serviceItems.length > 0) {
            setServiceItems(prev => {
                const updated = [...prev];
                updated[0] = { ...updated[0], name: `Service Charge - ${type}`, price: matchCat.default_charge };
                return updated;
            });
        }
    }, [form.device_type, form.custom_type, serviceCategories]);
    useEffect(() => {
        if (form.customer_id) {
            const cust = customers.find(c => c.id === form.customer_id);
            setSelectedCustomer(cust || null);
        }
        else {
            setSelectedCustomer(null);
        }
    }, [form.customer_id, customers]);
    const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));
    const updateChecklist = useCallback((index: number, value: "yes" | "no" | "na") => {
        setChecklist(prev => {
            const updated = prev.map((c, i) => i === index ? { ...c, value, autoSet: false } : c);
            const powerOnItem = updated.find(c => c.item === "Device turns ON");
            if (powerOnItem && powerOnItem.value === "no") {
                setDeviceIsOff(true);
                return updated.map(c => {
                    if (POWER_DEPENDENT_CATEGORIES.includes(c.category) && !c.autoSet && c.value === "") {
                        return { ...c, value: "na" as const, autoSet: true };
                    }
                    return c;
                });
            }
            else if (powerOnItem && powerOnItem.value !== "no") {
                setDeviceIsOff(false);
                return updated.map(c => c.autoSet ? { ...c, value: "" as const, autoSet: false } : c);
            }
            return updated;
        });
    }, []);
    const addTag = () => {
        if (newTag.trim() && !issueTags.includes(newTag.trim())) {
            setIssueTags(prev => [...prev, newTag.trim()]);
            setNewTag("");
        }
    };
    const handleImageSelect = (type: string, files: FileList | null) => {
        if (!files || files.length === 0)
            return;
        setImageFiles(prev => [...prev.filter(i => i.type !== type), { type, file: files[0] }]);
    };
    const addServiceLine = () => {
        setServiceItems(prev => [...prev, { id: genId(), name: "", hsn_code: "", gst_percentage: 18, price: 0, quantity: 1, discount_type: "none", discount_value: 0 }]);
    };
    const removeServiceLine = (id: string) => {
        setServiceItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
    };
    const updateServiceLine = (id: string, field: keyof ServiceLineItem, value: any) => {
        setServiceItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    };
    const serviceTotals = serviceItems.reduce((acc, item) => {
        const calc = calcLineItem(item);
        acc.subtotal += calc.base;
        acc.discount += calc.disc;
        acc.gst += gstMode === "none" ? 0 : calc.gstAmt;
        acc.total += gstMode === "none" ? calc.taxable : (gstMode === "inclusive" ? calc.taxable : calc.total);
        return acc;
    }, { subtotal: 0, discount: 0, gst: 0, total: 0 });
    const grandTotal = gstMode === "inclusive"
        ? serviceTotals.subtotal - serviceTotals.discount
        : serviceTotals.total;
    const effectiveGst = gstMode === "inclusive"
        ? (serviceTotals.subtotal - serviceTotals.discount) - ((serviceTotals.subtotal - serviceTotals.discount) / (1 + (serviceItems[0]?.gst_percentage || 18) / 100))
        : serviceTotals.gst;
    const validateStep = (step: number) => {
        if (step === 1) {
            if (!form.customer_id) {
                toast.error("Select a customer");
                return false;
            }
        }
        if (step === 2) {
            if (!form.device_brand && !form.custom_brand) {
                toast.error("Select device brand");
                return false;
            }
            if (!form.device_type && !form.custom_type) {
                toast.error("Select device type");
                return false;
            }
            if (!form.problem_description.trim()) {
                toast.error("Enter problem description");
                return false;
            }
        }
        if (step === 4) {
            if (!form.staff_notes.trim()) {
                toast.error("Staff notes are mandatory");
                return false;
            }
            if (!isEditMode) {
                const incomplete = checklist.filter(c => c.value === "");
                if (incomplete.length > 0) {
                    toast.error(`Complete all checklist items (${incomplete.length} remaining)`);
                    return false;
                }
            }
        }
        return true;
    };
    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 5));
        }
    };
    const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));
    const handleSave = async () => {
        if (!validateStep(4))
            return;
        setSaving(true);
        try {
            let finalBrand = form.device_brand;
            if (form.device_brand === "__other__" && form.custom_brand.trim()) {
                finalBrand = form.custom_brand.trim();
                await supabase.from("device_brands").insert({ name: finalBrand });
            }
            let finalType = form.device_type;
            if (form.device_type === "__other__" && form.custom_type.trim()) {
                finalType = form.custom_type.trim();
                await supabase.from("device_types").insert({ name: finalType });
            }
            const totalServiceCharge = serviceItems.reduce((s, i) => s + i.price * i.quantity, 0);
            const totalDiscount = serviceTotals.discount;
            const jobData: any = {
                customer_id: form.customer_id,
                device_brand: finalBrand,
                device_type: finalType,
                device_model: form.device_model || null,
                serial_number: form.serial_number || null,
                imei_number: form.imei_number || null,
                device_color: form.device_color || null,
                storage_capacity: form.storage_capacity || null,
                problem_description: form.problem_description,
                issue_tags: issueTags,
                issue_category_id: selectedIssueCategory || null,
                pre_repair_checklist: checklist.map(({ category, item, value }) => ({ category, item, value })),
                staff_notes: form.staff_notes,
                estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
                estimated_completion: form.estimated_completion || null,
                priority: form.priority,
                apple_id: form.apple_id || null,
                apple_id_password: form.apple_id_password || null,
                google_account: form.google_account || null,
                google_account_password: form.google_account_password || null,
                device_lock_code: form.device_lock_code || null,
                service_charge: totalServiceCharge,
                service_items: serviceItems,
                gst_mode: gstMode,
                gst_percentage: serviceItems[0]?.gst_percentage || 18,
                gst_amount: effectiveGst,
                discount_type: totalDiscount > 0 ? "fixed" : "none",
                discount_value: totalDiscount,
                total_amount: grandTotal,
                payment_status: "unpaid",
            };
            if (isEditMode) {
                const { error } = await supabase.from("job_sheets").update(jobData).eq("id", editId);
                if (error)
                    throw error;
                await supabase.from("job_sheet_audit_log").insert({
                    job_sheet_id: editId!, action: "job_sheet_edited", details: "Job sheet edited and updated", user_id: user?.id, user_role: "staff",
                });
                toast.success("Job Sheet updated");
                navigate(`/repairs/${editId}`);
            }
            else {
                jobData.status = "pending_approval";
                jobData.created_by = user?.id;
                const { data: job, error } = await supabase.from("job_sheets").insert(jobData).select().single();
                if (error)
                    throw error;
                for (const img of imageFiles) {
                    const ext = img.file.name.split(".").pop();
                    const path = `job-sheets/${job.id}/${img.type}.${ext}`;
                    const { error: uploadErr } = await supabase.storage.from("uploads").upload(path, img.file);
                    if (!uploadErr) {
                        const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
                        await supabase.from("job_sheet_images").insert({
                            job_sheet_id: job.id, image_url: urlData.publicUrl, image_type: img.type, uploaded_by: user?.id, stage: "before",
                        });
                    }
                }
                await supabase.from("job_sheet_audit_log").insert({
                    job_sheet_id: job.id, action: "created", details: "Job sheet created with pre-repair checklist completed", user_id: user?.id, user_role: "staff",
                });
                toast.success(`Job Sheet ${job.job_number} created`);
                navigate(`/repairs/${job.id}`);
            }
        }
        catch (err: any) {
            toast.error(err.message);
        }
        finally {
            setSaving(false);
        }
    };
    const categories = [...new Set(checklist.map(c => c.category))];
    const imageTypes = ["front", "back", "side", "damage"];
    const getCategoryProgress = (cat: string) => {
        const items = checklist.filter(c => c.category === cat);
        const completed = items.filter(c => c.value !== "").length;
        return { completed, total: items.length, percent: items.length > 0 ? Math.round((completed / items.length) * 100) : 0 };
    };
    const overallProgress = (() => {
        const total = checklist.length;
        const completed = checklist.filter(c => c.value !== "").length;
        return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    })();
    if (editLoading)
        return <AnimatedPage><Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: "5rem", paddingBottom: "5rem" }}><Box sx={{ animation: "spin 1s linear infinite", height: "2rem", width: "2rem", borderWidth: "2px", borderColor: "hsl(var(--primary))", borderTopColor: "transparent", borderRadius: "9999px" }}/></Box></AnimatedPage>;
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" }, maxWidth: "56rem" }}>
      {/* Header */}
      <PageHeader title={isEditMode ? "Edit Job Sheet" : "New Job Sheet"} subtitle={isEditMode ? "Update repair job details" : "Step-by-step repair job creation"} actions={<><IconButton onClick={() => navigate(isEditMode ? `/repairs/${editId}` : "/repairs")} aria-label={"Arrow Left"}>
          <Box component={ArrowLeft} sx={{ height: "1rem", width: "1rem" }}/>
        </IconButton></>}/>

      {/* Stepper Indicator */}
      <Card>
        <CardContent sx={{ padding: "1rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {STEPS.map((step, idx) => {
            const stepNum = idx + 1;
            const isCompleted = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;
            const StepIcon = step.icon;
            return (<Box key={stepNum} sx={{ display: "flex", alignItems: "center", flex: "1 1 0%", "&:last-child": { flex: "0 1 auto" } }}>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
                    <ButtonBase onClick={() => { if (stepNum < currentStep)
                setCurrentStep(stepNum); }} type="button" sx={mergeSx({ height: "2.5rem", width: "2.5rem", borderRadius: "9999px", display: "flex", alignItems: "center", justifyContent: "center", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }, isCompleted
                ? { backgroundColor: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))", cursor: "pointer" } : isCurrent
                ? { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)", color: "hsl(var(--primary))", "--alv-ring-offset-shadow": "var(--alv-ring-inset) 0 0 0 var(--alv-ring-offset-width) var(--alv-ring-offset-color)", "--alv-ring-shadow": "var(--alv-ring-inset) 0 0 0 calc(2px + var(--alv-ring-offset-width)) var(--alv-ring-color)", boxShadow: "var(--alv-ring-offset-shadow), var(--alv-ring-shadow), var(--alv-shadow, 0 0 #0000)", "--alv-ring-color": "hsl(var(--primary))", "--alv-ring-offset-width": "2px", "--alv-ring-offset-color": "hsl(var(--background))" } : { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" })}>
                      {isCompleted ? <Box component={Check} sx={{ height: "1rem", width: "1rem" }}/> : <Box component={StepIcon} sx={{ height: "1rem", width: "1rem" }}/>}
                    </ButtonBase>
                    <Box component="span" sx={mergeSx({ fontSize: "11px", fontWeight: "500", display: "none", "@media (min-width: 640px)": { display: "block" } }, isCurrent ? { color: "hsl(var(--primary))" } : isCompleted ? { color: "hsl(var(--foreground))" } : { color: "hsl(var(--muted-foreground))" })}>{step.label}</Box>
                  </Box>
                  {idx < STEPS.length - 1 && (<Box sx={mergeSx({ flex: "1 1 0%", height: "0.125rem", marginLeft: "0.5rem", marginRight: "0.5rem", borderRadius: "9999px" }, isCompleted ? { backgroundColor: "hsl(var(--primary))" } : { backgroundColor: "hsl(var(--border))" })}/>)}
                </Box>);
        })}
          </Box>
        </CardContent>
      </Card>

      {/* Step 1: Customer */}
      {currentStep === 1 && (<Card>
          <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={User} sx={{ height: "1rem", width: "1rem" }}/> Customer Information</Typography></Box>
          <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.customer_id} label={"Select Customer *"} select size="small" fullWidth onChange={event => (v => updateField("customer_id", v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Search and select customer"}</MenuItem>
                  {customers.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.phone ? `— ${c.phone}` : ""}</MenuItem>)}
                </TextField>
            </Box>
            {selectedCustomer && (<Card sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", borderColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" }}>
                <CardContent sx={{ padding: "1rem" }}>
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
                    <Box sx={{ height: "2.5rem", width: "2.5rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: "0" }}>
                      <Box component={User} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>
                    </Box>
                    <Box sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: "1.5rem", rowGap: "0.25rem", flex: "1 1 0%" }}>
                      <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Name:</Box> {selectedCustomer.name}</Typography>
                      <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Phone:</Box> {selectedCustomer.phone || "—"}</Typography>
                      <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Email:</Box> {selectedCustomer.email || "—"}</Typography>
                      <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>GSTIN:</Box> {selectedCustomer.gst_number || "—"}</Typography>
                      {selectedCustomer.address && (<Typography component="p" variant="body1" sx={{ gridColumn: "span 2 / span 2" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Address:</Box> {selectedCustomer.address}</Typography>)}
                    </Box>
                  </Box>
                </CardContent>
              </Card>)}
          </CardContent>
        </Card>)}

      {/* Step 2: Device */}
      {currentStep === 2 && (<>
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Smartphone} sx={{ height: "1rem", width: "1rem" }}/> Device Information</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={form.device_type} label={"Device Type *"} select size="small" fullWidth onChange={event => (v => updateField("device_type", v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select type"}</MenuItem>
                      {deviceTypes.map(t => <MenuItem key={t.id} value={t.name}>{t.name}</MenuItem>)}
                      <MenuItem value="__other__">Other</MenuItem>
                    </TextField>
                  {form.device_type === "__other__" && (<TextField placeholder="Enter device type" value={form.custom_type} onChange={e => updateField("custom_type", e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Enter device type" } }} sx={{ marginTop: "0.5rem" }}/>)}
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={form.device_brand} label={"Brand *"} select size="small" fullWidth onChange={event => (v => updateField("device_brand", v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select brand"}</MenuItem>
                      {brands.map(b => <MenuItem key={b.id} value={b.name}>{b.name}</MenuItem>)}
                      <MenuItem value="__other__">Other</MenuItem>
                    </TextField>
                  {form.device_brand === "__other__" && (<TextField placeholder="Enter brand name" value={form.custom_brand} onChange={e => updateField("custom_brand", e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Enter brand name" } }} sx={{ marginTop: "0.5rem" }}/>)}
                </Box>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                {[
                { field: "device_model", label: "Model Name" },
                { field: "serial_number", label: "Serial Number" },
                { field: "imei_number", label: "IMEI Number" },
                { field: "device_color", label: "Color" },
                { field: "storage_capacity", label: "Storage Capacity" },
            ].map(({ field, label }) => (<Box key={field} sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                    <TextField value={(form as any)[field]} onChange={e => updateField(field, e.target.value)} label={label} size="small" fullWidth/>
                  </Box>))}
              </Box>

              {/* Issue Category Selector */}
              <Divider />
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={selectedIssueCategory} label={<><Box component={Tag} sx={{ height: "1rem", width: "1rem" }}/> Issue Category</>} select size="small" fullWidth onChange={event => (v => { setSelectedIssueCategory(v); setDynamicChecklistLoaded(false); })(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select issue category (optional)"}</MenuItem>
                    {issueCategories.map(ic => (<MenuItem key={ic.id} value={ic.id}>
                        {ic.name}
                        {ic.description && <Box component="span" sx={{ color: "hsl(var(--muted-foreground))", marginLeft: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem" }}>— {ic.description}</Box>}
                      </MenuItem>))}
                  </TextField>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>Selecting a category loads additional checklist items for that issue type.</Typography>
              </Box>

              <Divider />
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField rows={3} placeholder="Describe the issue..." value={form.problem_description} onChange={e => updateField("problem_description", e.target.value)} label={"Problem Description *"} size="small" fullWidth multiline/>
              </Box>
              <Box>
                <FormLabel sx={{ marginBottom: "0.375rem", display: "block" }}>Issue Tags</FormLabel>
                <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
                  {issueTags.map(tag => (<StatusChip key={tag} label={<>
                      {tag}
                      <ButtonBase type="button" onClick={() => setIssueTags(prev => prev.filter(t => t !== tag))}><Box component={X} sx={{ height: "0.75rem", width: "0.75rem" }}/></ButtonBase>
                    </>} variant="filled" sx={{ gap: "0.25rem" }}/>))}
                </Box>
                <Box sx={{ display: "flex", gap: "0.5rem" }}>
                  <TextField placeholder="Add tag" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Add tag" } }} sx={{ maxWidth: "20rem" }}/>
                  <Button type="button" onClick={addTag} variant="outlined" size="small"><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem" }}/></Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Photos */}
          {!isEditMode && (<Card>
              <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Device Photos</Typography></Box>
              <CardContent>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
                  {imageTypes.map(type => {
                    const selected = imageFiles.find(i => i.type === type);
                    return (<Box key={type} component="label" sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderWidth: "2px", borderStyle: "dashed", borderRadius: "var(--radius)", padding: "1rem", cursor: "pointer", "&:hover": { borderColor: "color-mix(in srgb, hsl(var(--primary)) 50%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", minHeight: "120px" }}>
                        {selected ? (<Box sx={{ textAlign: "center" }}>
                            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--primary))", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{selected.file.name}</Typography>
                            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "capitalize", marginTop: "0.25rem" }}>{type}</Typography>
                          </Box>) : (<>
                            <Box component={Upload} sx={{ height: "1.5rem", width: "1.5rem", color: "hsl(var(--muted-foreground))", marginBottom: "0.25rem" }}/>
                            <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textTransform: "capitalize" }}>{type}</Typography>
                          </>)}
                        <Box type="file" accept="image/*" onChange={e => handleImageSelect(type, e.target.files)} component="input" sx={{ display: "none" }}/>
                      </Box>);
                })}
                </Box>
              </CardContent>
            </Card>)}

          {/* Credentials */}
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Account & Security Credentials</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField placeholder="apple@icloud.com" value={form.apple_id} onChange={e => updateField("apple_id", e.target.value)} label={"Apple ID"} size="small" fullWidth/>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                  <FormLabel>Apple ID Password</FormLabel>
                  <Box sx={{ position: "relative" }}>
                    <TextField type={showApplePassword ? "text" : "password"} placeholder="••••••••" value={form.apple_id_password} onChange={e => updateField("apple_id_password", e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "••••••••" } }}/>
                    <ButtonBase type="button" onClick={() => setShowApplePassword(p => !p)} sx={{ position: "absolute", right: "0.75rem", top: "50%", "--alv-translate-y": "-50%", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
                      {showApplePassword ? <Box component={EyeOff} sx={{ height: "1rem", width: "1rem" }}/> : <Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/>}
                    </ButtonBase>
                  </Box>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField placeholder="user@gmail.com" value={form.google_account} onChange={e => updateField("google_account", e.target.value)} label={"Google Account"} size="small" fullWidth/>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>
                  <FormLabel>Google Account Password</FormLabel>
                  <Box sx={{ position: "relative" }}>
                    <TextField type={showGooglePassword ? "text" : "password"} placeholder="••••••••" value={form.google_account_password} onChange={e => updateField("google_account_password", e.target.value)} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "••••••••" } }}/>
                    <ButtonBase type="button" onClick={() => setShowGooglePassword(p => !p)} sx={{ position: "absolute", right: "0.75rem", top: "50%", "--alv-translate-y": "-50%", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))", color: "hsl(var(--muted-foreground))", "&:hover": { color: "hsl(var(--foreground))" } }}>
                      {showGooglePassword ? <Box component={EyeOff} sx={{ height: "1rem", width: "1rem" }}/> : <Box component={Eye} sx={{ height: "1rem", width: "1rem" }}/>}
                    </ButtonBase>
                  </Box>
                </Box>
              </Box>
              <Box sx={{ maxWidth: "24rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField placeholder="Enter lock code" value={form.device_lock_code} onChange={e => updateField("device_lock_code", e.target.value)} label={"Device Lock Code / PIN"} size="small" fullWidth/>
              </Box>
            </CardContent>
          </Card>
        </>)}

      {/* Step 3: Service Charges */}
      {currentStep === 3 && (<Card>
          <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={IndianRupee} sx={{ height: "1rem", width: "1rem" }}/> Service Charges & Billing</Typography>
              <Button onClick={addServiceLine} variant="outlined" size="small"><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/> Add Line</Button>
            </Box>
          </Box>
          <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              <FormLabel>GST Mode</FormLabel>
              <RadioGroup value={gstMode} onChange={event => (v => setGstMode(v as any))(event.target.value)} sx={{ display: "flex", gap: "1rem" }}>
                <Box sx={{ display: "flex", alignItems: "center", "& > :not([hidden]) ~ :not([hidden])": { marginLeft: "0.5rem" } }}><Radio value="none" id="gst-none"/><FormLabel htmlFor="gst-none" sx={{ fontWeight: "400" }}>No GST</FormLabel></Box>
                <Box sx={{ display: "flex", alignItems: "center", "& > :not([hidden]) ~ :not([hidden])": { marginLeft: "0.5rem" } }}><Radio value="inclusive" id="gst-inc"/><FormLabel htmlFor="gst-inc" sx={{ fontWeight: "400" }}>Inclusive</FormLabel></Box>
                <Box sx={{ display: "flex", alignItems: "center", "& > :not([hidden]) ~ :not([hidden])": { marginLeft: "0.5rem" } }}><Radio value="exclusive" id="gst-exc"/><FormLabel htmlFor="gst-exc" sx={{ fontWeight: "400" }}>Exclusive</FormLabel></Box>
              </RadioGroup>
            </Box>

            <Box sx={{ borderWidth: "1px", borderRadius: "var(--radius)", overflowX: "auto" }}>
              <DataTable columnsCount={8} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                <TableHead>
                  <TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", fontSize: "0.75rem", lineHeight: "1rem" }}>
                    <TableCell sx={{ textAlign: "left", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", minWidth: "180px" }}>Service Name</TableCell>
                    <TableCell sx={{ textAlign: "left", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", width: "90px" }}>HSN</TableCell>
                    {gstMode !== "none" && <TableCell sx={{ textAlign: "center", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", width: "70px" }}>GST%</TableCell>}
                    <TableCell sx={{ textAlign: "right", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", width: "100px" }}>Price</TableCell>
                    <TableCell sx={{ textAlign: "center", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", width: "60px" }}>Qty</TableCell>
                    <TableCell sx={{ textAlign: "center", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", width: "90px" }}>Discount</TableCell>
                    <TableCell sx={{ textAlign: "right", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", width: "100px" }}>Total</TableCell>
                    <TableCell sx={{ width: "40px" }}/>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {serviceItems.map((item) => {
                const calc = calcLineItem(item);
                const lineTotal = gstMode === "none" ? calc.taxable : (gstMode === "inclusive" ? calc.taxable : calc.total);
                return (<TableRow key={item.id} sx={{ borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                        <TableCell sx={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}><TextField value={item.name} onChange={e => updateServiceLine(item.id, "name", e.target.value)} placeholder="Service name" size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Service name" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}/></TableCell>
                        <TableCell sx={{ paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}><TextField value={item.hsn_code} onChange={e => updateServiceLine(item.id, "hsn_code", e.target.value)} placeholder="HSN" size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "HSN" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}/></TableCell>
                        {gstMode !== "none" && (<TableCell sx={{ paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                            <TextField value={String(item.gst_percentage)} select size="small" fullWidth onChange={event => (v => updateServiceLine(item.id, "gst_percentage", Number(v)))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}>{["0", "5", "12", "18", "28"].map(p => <MenuItem key={p} value={p}>{p}%</MenuItem>)}</TextField>
                          </TableCell>)}
                        <TableCell sx={{ paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}><TextField type="number" value={item.price || ""} onChange={e => updateServiceLine(item.id, "price", Number(e.target.value))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem", textAlign: "right" }}/></TableCell>
                        <TableCell sx={{ paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}><TextField type="number" value={item.quantity || ""} onChange={e => updateServiceLine(item.id, "quantity", Number(e.target.value))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem", textAlign: "center", width: "3.5rem", marginLeft: "auto", marginRight: "auto" }}/></TableCell>
                        <TableCell sx={{ paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                          <Box sx={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                            <TextField value={item.discount_type} select size="small" fullWidth onChange={event => (v => updateServiceLine(item.id, "discount_type", v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem", width: "55px" }}><MenuItem value="none">—</MenuItem><MenuItem value="percentage">%</MenuItem><MenuItem value="fixed">₹</MenuItem></TextField>
                            {item.discount_type !== "none" && (<TextField type="number" value={item.discount_value || ""} onChange={e => updateServiceLine(item.id, "discount_value", Number(e.target.value))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Input" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem", width: "3.5rem" }}/>)}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", textAlign: "right", fontWeight: "500", fontSize: "0.75rem", lineHeight: "1rem" }}>₹{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</TableCell>
                        <TableCell sx={{ paddingLeft: "0.25rem", paddingRight: "0.25rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                          {serviceItems.length > 1 && (<Button onClick={() => removeServiceLine(item.id)} variant="text" size="small" sx={{ height: "1.75rem", width: "1.75rem", padding: "0px", color: "hsl(var(--destructive))" }}><Box component={Trash2} sx={{ height: "0.75rem", width: "0.75rem" }}/></Button>)}
                        </TableCell>
                      </TableRow>);
            })}
                </TableBody>
              </DataTable>
            </Box>

            <Card sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", borderColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" }}>
              <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem" })}>Billing Summary</Typography></Box>
              <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Subtotal</Box><Box component="span">₹{serviceTotals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box></Box>
                {serviceTotals.discount > 0 && <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--destructive))" }}><Box component="span">Discount</Box><Box component="span">-₹{serviceTotals.discount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box></Box>}
                {gstMode !== "none" && <Box sx={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>GST ({gstMode})</Box><Box component="span">₹{effectiveGst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box></Box>}
                <Divider />
                <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1rem", lineHeight: "1.5rem" }}><Box component="span">Grand Total</Box><Box component="span" sx={{ color: "hsl(var(--primary))" }}>₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box></Box>
              </CardContent>
            </Card>
          </CardContent>
        </Card>)}

      {/* Step 4: Pre-Repair Checklist */}
      {currentStep === 4 && (<>
          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}>
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={ClipboardCheck} sx={{ height: "1rem", width: "1rem" }}/> Pre-Repair Checklist {!isEditMode && "*"}</Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {overallProgress.percent === 100 && <Box component={CheckCircle2} sx={{ height: "1rem", width: "1rem", color: "hsl(var(--success))" }}/>}
                  <StatusChip label={<>{overallProgress.completed}/{overallProgress.total}</>}/>
                </Box>
              </Box>
              <LinearProgress value={overallProgress.percent} variant="determinate" sx={{ height: "0.5rem", marginTop: "0.5rem" }}/>
              {deviceIsOff && (<Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--warning))", marginTop: "0.5rem" }}>
                  <Box component={AlertTriangle} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                  <Box component="span">Device is OFF — dependent checks auto-set to N/A. You can override manually.</Box>
                </Box>)}
            </Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
              {categories.map(cat => {
                const progress = getCategoryProgress(cat);
                return (<Accordion key={cat} expanded={openCategories[cat] ?? true} onChange={(event, expanded) => ((open) => setOpenCategories(prev => ({ ...prev, [cat]: open })))(expanded)}>
                    <AccordionSummary sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", "&:hover": { backgroundColor: "hsl(var(--muted))" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Box component={ChevronDown} sx={mergeSx({ height: "1rem", width: "1rem", transitionProperty: "transform", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, openCategories[cat] ? {} : { "--alv-rotate": "-90deg", transform: "translate(var(--alv-translate-x), var(--alv-translate-y)) rotate(var(--alv-rotate)) skewX(var(--alv-skew-x)) skewY(var(--alv-skew-y)) scaleX(var(--alv-scale-x)) scaleY(var(--alv-scale-y))" })}/>
                          <Box component="span" sx={{ fontWeight: "500" }}>{cat}</Box>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <LinearProgress value={progress.percent} variant="determinate" sx={{ height: "0.375rem", width: "4rem" }}/>
                          <StatusChip label={<>
                            {progress.completed}/{progress.total}
                          </>} sx={mergeSx({ fontSize: "0.75rem", lineHeight: "1rem", minWidth: "40px", justifyContent: "center" }, progress.percent > 0 && progress.percent < 100 ? { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 15%, transparent)", color: "hsl(var(--warning))", borderColor: "color-mix(in srgb, hsl(var(--warning)) 30%, transparent)" } : {})}/>
                        </Box>
                      </AccordionSummary>
                    <AccordionDetails sx={{ marginTop: "0.25rem" }}>
                      <Box sx={{ borderWidth: "1px", borderRadius: "var(--radius)", overflow: "hidden" }}>
                        <DataTable columnsCount={2} sx={{ width: "100%", fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                          <TableHead><TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}><TableCell sx={{ textAlign: "left", paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem" }}>Item</TableCell><TableCell sx={{ textAlign: "center", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem", fontWeight: "500", color: "hsl(var(--muted-foreground))", fontSize: "0.75rem", lineHeight: "1rem", width: "140px" }}>Status</TableCell></TableRow></TableHead>
                          <TableBody>
                            {checklist.map((item, idx) => item.category !== cat ? null : (<TableRow key={idx} sx={{ borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" }}>
                                <TableCell sx={{ paddingLeft: "0.75rem", paddingRight: "0.75rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Box component="span">{item.item}</Box>
                                    {item.autoSet && <Box component="span" sx={{ fontSize: "9px", fontWeight: "500", color: "hsl(var(--warning))", backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", paddingLeft: "0.375rem", paddingRight: "0.375rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "9999px" }}>Auto</Box>}
                                  </Box>
                                </TableCell>
                                <TableCell sx={{ paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.5rem", paddingBottom: "0.5rem" }}>
                                  <Box sx={{ display: "flex", gap: "0.25rem", justifyContent: "center" }}>
                                    {(["yes", "no", "na"] as const).map(v => (<ButtonBase key={v} type="button" onClick={() => updateChecklist(idx, v)} sx={mergeSx({ paddingLeft: "0.625rem", paddingRight: "0.625rem", paddingTop: "0.25rem", paddingBottom: "0.25rem", borderRadius: "0.25rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, item.value === v
                            ? v === "yes" ? { backgroundColor: "hsl(var(--success))", color: "hsl(var(--success-foreground))" } : v === "no" ? { backgroundColor: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))" } : { backgroundColor: "hsl(var(--muted-foreground))", color: "hsl(var(--background))" }
                            : mergeSx({ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }, v === "yes" ? { "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 20%, transparent)", color: "hsl(var(--success))" } } : v === "no" ? { "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 20%, transparent)", color: "hsl(var(--destructive))" } } : { "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted-foreground)) 20%, transparent)" } }))}>{v === "na" ? "N/A" : v.charAt(0).toUpperCase() + v.slice(1)}</ButtonBase>))}
                                  </Box>
                                </TableCell>
                              </TableRow>))}
                          </TableBody>
                        </DataTable>
                      </Box>
                    </AccordionDetails>
                  </Accordion>);
            })}
            </CardContent>
          </Card>

          <Card>
            <Box sx={{ padding: "1.5rem", paddingBottom: "0.75rem" }}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "1rem", lineHeight: "1.5rem" })}>Staff Notes & Priority *</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
              <TextField rows={3} placeholder="Enter mandatory staff notes..." value={form.staff_notes} onChange={e => updateField("staff_notes", e.target.value)} size="small" fullWidth multiline slotProps={{ htmlInput: { "aria-label": "Enter mandatory staff notes..." } }}/>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField type="number" value={form.estimated_cost} onChange={e => updateField("estimated_cost", e.target.value)} label={"Estimated Cost (\u20B9)"} size="small" fullWidth/>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField type="date" value={form.estimated_completion} onChange={e => updateField("estimated_completion", e.target.value)} label={"Estimated Completion"} size="small" fullWidth/>
                </Box>
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                  <TextField value={form.priority} label={"Priority"} select size="small" fullWidth onChange={event => (v => updateField("priority", v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>{PRIORITIES.map(p => <MenuItem key={p} value={p} sx={{ textTransform: "capitalize" }}>{p}</MenuItem>)}</TextField>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </>)}

      {/* Step 5: Review */}
      {currentStep === 5 && (<>
          <Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={User} sx={{ height: "1rem", width: "1rem" }}/> Customer</Typography></Box>
            <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.5rem" }}>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Name:</Box> {selectedCustomer?.name || "—"}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Phone:</Box> {selectedCustomer?.phone || "—"}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Email:</Box> {selectedCustomer?.email || "—"}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>GSTIN:</Box> {selectedCustomer?.gst_number || "—"}</Typography>
            </CardContent>
          </Card>

          <Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={Smartphone} sx={{ height: "1rem", width: "1rem" }}/> Device</Typography></Box>
            <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "0.5rem" }}>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Type:</Box> {form.device_type === "__other__" ? form.custom_type : form.device_type}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Brand:</Box> {form.device_brand === "__other__" ? form.custom_brand : form.device_brand}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Model:</Box> {form.device_model || "—"}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Serial:</Box> {form.serial_number || "—"}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>IMEI:</Box> {form.imei_number || "—"}</Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Problem:</Box> {form.problem_description.slice(0, 50)}{form.problem_description.length > 50 ? "..." : ""}</Typography>
              {selectedIssueCategory && (<Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Issue Category:</Box> {issueCategories.find(c => c.id === selectedIssueCategory)?.name || "—"}</Typography>)}
            </CardContent>
          </Card>

          <Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={IndianRupee} sx={{ height: "1rem", width: "1rem" }}/> Service Charges ({serviceItems.length} items)</Typography></Box>
            <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
              {serviceItems.filter(i => i.name).map(item => {
                const calc = calcLineItem(item);
                return (<Box key={item.id} sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>{item.name} × {item.quantity}</Box>
                    <Box component="span">₹{(gstMode === "none" ? calc.taxable : gstMode === "inclusive" ? calc.taxable : calc.total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box>
                  </Box>);
            })}
              <Divider />
              <Box sx={{ display: "flex", justifyContent: "space-between", fontWeight: "700", fontSize: "1rem", lineHeight: "1.5rem" }}><Box component="span">Grand Total</Box><Box component="span" sx={{ color: "hsl(var(--primary))" }}>₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</Box></Box>
            </CardContent>
          </Card>

          <Card>
            <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}><Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" })}><Box component={ClipboardCheck} sx={{ height: "1rem", width: "1rem" }}/> Checklist Summary</Typography></Box>
            <CardContent sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>
              <Box sx={{ display: "flex", gap: "1rem" }}>
                <StatusChip label={<>Pass: {checklist.filter(c => c.value === "yes").length}</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }}/>
                <StatusChip label={<>Fail: {checklist.filter(c => c.value === "no").length}</>} sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" }}/>
                <StatusChip label={<>N/A: {checklist.filter(c => c.value === "na").length}</>} sx={{ backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }}/>
              </Box>
              <Typography component="p" variant="body1" sx={{ marginTop: "0.5rem" }}><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Priority:</Box> <Box component="span" sx={{ textTransform: "capitalize" }}>{form.priority}</Box></Typography>
              <Typography component="p" variant="body1"><Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}>Staff Notes:</Box> {form.staff_notes.slice(0, 100)}</Typography>
            </CardContent>
          </Card>
        </>)}

      {/* Navigation Buttons */}
      <Box sx={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", paddingBottom: "1.5rem" }}>
        <Box>
          {currentStep > 1 && (<Button onClick={prevStep} variant="outlined">Back</Button>)}
        </Box>
        <Box sx={{ display: "flex", gap: "0.75rem" }}>
          <Button onClick={() => navigate(isEditMode ? `/repairs/${editId}` : "/repairs")} variant="outlined">Cancel</Button>
          {currentStep < 5 ? (<Button onClick={nextStep} variant="contained">Next</Button>) : (<Button onClick={handleSave} disabled={saving} variant="contained">
              {saving ? "Saving..." : isEditMode ? "Update Job Sheet" : "Save Job Sheet"}
            </Button>)}
        </Box>
      </Box>
    </Box></AnimatedPage>;
}
