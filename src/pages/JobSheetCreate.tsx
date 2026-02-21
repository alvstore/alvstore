import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ArrowLeft, Upload, Plus, X, ChevronDown, Eye, EyeOff, AlertTriangle, CheckCircle2, Check,
  User, Smartphone, IndianRupee, ClipboardCheck, FileText, Trash2,
} from "lucide-react";
import { toast } from "sonner";

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

// Device-specific checklists
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
  if (DEVICE_CHECKLISTS[deviceType]) return DEVICE_CHECKLISTS[deviceType].map(c => ({ ...c }));
  const lower = deviceType.toLowerCase();
  if (lower.includes("laptop") || lower.includes("notebook")) return DEVICE_CHECKLISTS.Laptop.map(c => ({ ...c }));
  if (lower.includes("tablet") || lower.includes("ipad")) return DEVICE_CHECKLISTS.Tablet.map(c => ({ ...c }));
  if (lower.includes("desktop") || lower.includes("pc") || lower.includes("computer")) return DEVICE_CHECKLISTS.Desktop.map(c => ({ ...c }));
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
  if (item.discount_type === "percentage") disc = (base * item.discount_value) / 100;
  else if (item.discount_type === "fixed") disc = item.discount_value;
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
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string; phone?: string; email?: string; gst_number?: string; address?: string }[]>([]);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(getChecklistForDevice("Mobile"));
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [imageFiles, setImageFiles] = useState<{ type: string; file: File }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deviceIsOff, setDeviceIsOff] = useState(false);
  const [showApplePassword, setShowApplePassword] = useState(false);
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);

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
    ]).then(([bRes, tRes, cRes, scRes]) => {
      setBrands(bRes.data || []);
      setDeviceTypes(tRes.data || []);
      setCustomers(cRes.data || []);
      setServiceCategories((scRes.data as ServiceCategory[]) || []);
    });
  }, []);

  // Load existing job sheet in edit mode
  useEffect(() => {
    if (!editId) return;
    setEditLoading(true);
    supabase.from("job_sheets").select("*, customers(name, phone, email, gst_number, address)")
      .eq("id", editId).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error("Job sheet not found"); navigate("/repairs"); return; }
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
        setIssueTags((data.issue_tags as string[]) || []);
        setGstMode((data.gst_mode as any) || "exclusive");

        // Load service items from JSONB or fallback to legacy single charge
        const items = (data as any).service_items as ServiceLineItem[] | null;
        if (items && Array.isArray(items) && items.length > 0) {
          setServiceItems(items.map(i => ({ ...i, id: i.id || genId() })));
        } else if (Number(data.service_charge) > 0) {
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
    if (isEditMode) return; // Don't auto-fill on edit
    const type = form.device_type === "__other__" ? form.custom_type : form.device_type;
    if (!type) return;
    const newChecklist = getChecklistForDevice(type);
    setChecklist(newChecklist);
    setDeviceIsOff(false);
    const cats = [...new Set(newChecklist.map(c => c.category))];
    const openMap: Record<string, boolean> = {};
    cats.forEach(c => { openMap[c] = true; });
    setOpenCategories(openMap);

    // Auto-fill first service line from categories
    const matchCat = serviceCategories.find(sc =>
      sc.name.toLowerCase() === type.toLowerCase() ||
      type.toLowerCase().includes(sc.name.toLowerCase())
    );
    if (matchCat && serviceItems.length > 0) {
      setServiceItems(prev => {
        const updated = [...prev];
        updated[0] = { ...updated[0], name: `Service Charge - ${type}`, price: matchCat.default_charge };
        return updated;
      });
    }
  }, [form.device_type, form.custom_type, serviceCategories]);

  // When customer is selected, update preview
  useEffect(() => {
    if (form.customer_id) {
      const cust = customers.find(c => c.id === form.customer_id);
      setSelectedCustomer(cust || null);
    } else {
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
      } else if (powerOnItem && powerOnItem.value !== "no") {
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
    if (!files || files.length === 0) return;
    setImageFiles(prev => [...prev.filter(i => i.type !== type), { type, file: files[0] }]);
  };

  // Service items helpers
  const addServiceLine = () => {
    setServiceItems(prev => [...prev, { id: genId(), name: "", hsn_code: "", gst_percentage: 18, price: 0, quantity: 1, discount_type: "none", discount_value: 0 }]);
  };
  const removeServiceLine = (id: string) => {
    setServiceItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);
  };
  const updateServiceLine = (id: string, field: keyof ServiceLineItem, value: any) => {
    setServiceItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  // Totals calculation
  const serviceTotals = serviceItems.reduce((acc, item) => {
    const calc = calcLineItem(item);
    acc.subtotal += calc.base;
    acc.discount += calc.disc;
    acc.gst += gstMode === "none" ? 0 : calc.gstAmt;
    acc.total += gstMode === "none" ? calc.taxable : (gstMode === "inclusive" ? calc.taxable : calc.total);
    return acc;
  }, { subtotal: 0, discount: 0, gst: 0, total: 0 });

  // For inclusive GST, recalculate
  const grandTotal = gstMode === "inclusive"
    ? serviceTotals.subtotal - serviceTotals.discount
    : serviceTotals.total;
  const effectiveGst = gstMode === "inclusive"
    ? (serviceTotals.subtotal - serviceTotals.discount) - ((serviceTotals.subtotal - serviceTotals.discount) / (1 + (serviceItems[0]?.gst_percentage || 18) / 100))
    : serviceTotals.gst;

  const validateStep = (step: number) => {
    if (step === 1) {
      if (!form.customer_id) { toast.error("Select a customer"); return false; }
    }
    if (step === 2) {
      if (!form.device_brand && !form.custom_brand) { toast.error("Select device brand"); return false; }
      if (!form.device_type && !form.custom_type) { toast.error("Select device type"); return false; }
      if (!form.problem_description.trim()) { toast.error("Enter problem description"); return false; }
    }
    if (step === 4) {
      if (!form.staff_notes.trim()) { toast.error("Staff notes are mandatory"); return false; }
      if (!isEditMode) {
        const incomplete = checklist.filter(c => c.value === "");
        if (incomplete.length > 0) { toast.error(`Complete all checklist items (${incomplete.length} remaining)`); return false; }
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
    if (!validateStep(4)) return;
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

      // Compute totals from service items
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
        // Billing fields
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
        // UPDATE existing job sheet
        const { error } = await supabase.from("job_sheets").update(jobData).eq("id", editId);
        if (error) throw error;

        await supabase.from("job_sheet_audit_log").insert({
          job_sheet_id: editId!,
          action: "job_sheet_edited",
          details: "Job sheet edited and updated",
          user_id: user?.id,
          user_role: "staff",
        });

        toast.success("Job Sheet updated");
        navigate(`/repairs/${editId}`);
      } else {
        // INSERT new job sheet
        jobData.status = "pending_approval";
        jobData.created_by = user?.id;

        const { data: job, error } = await supabase.from("job_sheets").insert(jobData).select().single();
        if (error) throw error;

        // Upload images
        for (const img of imageFiles) {
          const ext = img.file.name.split(".").pop();
          const path = `job-sheets/${job.id}/${img.type}.${ext}`;
          const { error: uploadErr } = await supabase.storage.from("uploads").upload(path, img.file);
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from("uploads").getPublicUrl(path);
            await supabase.from("job_sheet_images").insert({
              job_sheet_id: job.id,
              image_url: urlData.publicUrl,
              image_type: img.type,
              uploaded_by: user?.id,
            });
          }
        }

        await supabase.from("job_sheet_audit_log").insert({
          job_sheet_id: job.id,
          action: "created",
          details: "Job sheet created with pre-repair checklist completed",
          user_id: user?.id,
          user_role: "staff",
        });

        toast.success(`Job Sheet ${job.job_number} created`);
        navigate(`/repairs/${job.id}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
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

  if (editLoading) return <div className="flex items-center justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(isEditMode ? `/repairs/${editId}` : "/repairs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEditMode ? "Edit Job Sheet" : "New Job Sheet"}</h1>
          <p className="text-muted-foreground">{isEditMode ? "Update repair job details" : "Step-by-step repair job creation"}</p>
        </div>
      </div>

      {/* Stepper Indicator */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            {STEPS.map((step, idx) => {
              const stepNum = idx + 1;
              const isCompleted = currentStep > stepNum;
              const isCurrent = currentStep === stepNum;
              const StepIcon = step.icon;
              return (
                <div key={stepNum} className="flex items-center flex-1 last:flex-initial">
                  <div className="flex flex-col items-center gap-1.5">
                    <button
                      onClick={() => { if (stepNum < currentStep) setCurrentStep(stepNum); }}
                      className={`h-10 w-10 rounded-full flex items-center justify-center transition-all text-sm font-semibold ${
                        isCompleted
                          ? "bg-primary text-primary-foreground cursor-pointer"
                          : isCurrent
                          ? "bg-primary/20 text-primary ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </button>
                    <span className={`text-[11px] font-medium hidden sm:block ${
                      isCurrent ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                    }`}>{step.label}</span>
                  </div>
                  {idx < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-2 rounded-full ${isCompleted ? "bg-primary" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Step 1: Customer */}
      {currentStep === 1 && (
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="h-4 w-4" /> Customer Information</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Select Customer *</Label>
              <Select value={form.customer_id} onValueChange={v => updateField("customer_id", v)}>
                <SelectTrigger><SelectValue placeholder="Search and select customer" /></SelectTrigger>
                <SelectContent>
                  {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `— ${c.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectedCustomer && (
              <Card className="bg-muted/30 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-sm grid grid-cols-2 gap-x-6 gap-y-1 flex-1">
                      <p><span className="text-muted-foreground">Name:</span> {selectedCustomer.name}</p>
                      <p><span className="text-muted-foreground">Phone:</span> {selectedCustomer.phone || "—"}</p>
                      <p><span className="text-muted-foreground">Email:</span> {selectedCustomer.email || "—"}</p>
                      <p><span className="text-muted-foreground">GSTIN:</span> {selectedCustomer.gst_number || "—"}</p>
                      {selectedCustomer.address && (
                        <p className="col-span-2"><span className="text-muted-foreground">Address:</span> {selectedCustomer.address}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Device */}
      {currentStep === 2 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Smartphone className="h-4 w-4" /> Device Information</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Device Type *</Label>
                  <Select value={form.device_type} onValueChange={v => updateField("device_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {deviceTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                      <SelectItem value="__other__">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.device_type === "__other__" && (
                    <Input placeholder="Enter device type" value={form.custom_type} onChange={e => updateField("custom_type", e.target.value)} className="mt-2" />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Brand *</Label>
                  <Select value={form.device_brand} onValueChange={v => updateField("device_brand", v)}>
                    <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                    <SelectContent>
                      {brands.map(b => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}
                      <SelectItem value="__other__">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.device_brand === "__other__" && (
                    <Input placeholder="Enter brand name" value={form.custom_brand} onChange={e => updateField("custom_brand", e.target.value)} className="mt-2" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { field: "device_model", label: "Model Name" },
                  { field: "serial_number", label: "Serial Number" },
                  { field: "imei_number", label: "IMEI Number" },
                  { field: "device_color", label: "Color" },
                  { field: "storage_capacity", label: "Storage Capacity" },
                ].map(({ field, label }) => (
                  <div key={field} className="space-y-1.5">
                    <Label>{label}</Label>
                    <Input value={(form as any)[field]} onChange={e => updateField(field, e.target.value)} />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label>Problem Description *</Label>
                <Textarea rows={3} placeholder="Describe the issue..." value={form.problem_description} onChange={e => updateField("problem_description", e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 block">Issue Tags</Label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {issueTags.map(tag => (
                    <Badge key={tag} variant="secondary" className="gap-1">
                      {tag}
                      <button type="button" onClick={() => setIssueTags(prev => prev.filter(t => t !== tag))}><X className="h-3 w-3" /></button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input placeholder="Add tag" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} className="max-w-xs" />
                  <Button type="button" variant="outline" size="sm" onClick={addTag}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photos */}
          {!isEditMode && (
            <Card>
              <CardHeader><CardTitle className="text-base">Device Photos</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {imageTypes.map(type => {
                    const selected = imageFiles.find(i => i.type === type);
                    return (
                      <label key={type} className="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-4 cursor-pointer hover:border-primary/50 transition-colors min-h-[120px]">
                        {selected ? (
                          <div className="text-center">
                            <p className="text-xs text-primary font-medium truncate max-w-full">{selected.file.name}</p>
                            <p className="text-xs text-muted-foreground capitalize mt-1">{type}</p>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                            <p className="text-xs text-muted-foreground capitalize">{type}</p>
                          </>
                        )}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleImageSelect(type, e.target.files)} />
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Credentials */}
          <Card>
            <CardHeader><CardTitle className="text-base">Account & Security Credentials</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Apple ID</Label>
                  <Input placeholder="apple@icloud.com" value={form.apple_id} onChange={e => updateField("apple_id", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Apple ID Password</Label>
                  <div className="relative">
                    <Input type={showApplePassword ? "text" : "password"} placeholder="••••••••" value={form.apple_id_password} onChange={e => updateField("apple_id_password", e.target.value)} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowApplePassword(p => !p)}>
                      {showApplePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Google Account</Label>
                  <Input placeholder="user@gmail.com" value={form.google_account} onChange={e => updateField("google_account", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Google Account Password</Label>
                  <div className="relative">
                    <Input type={showGooglePassword ? "text" : "password"} placeholder="••••••••" value={form.google_account_password} onChange={e => updateField("google_account_password", e.target.value)} />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setShowGooglePassword(p => !p)}>
                      {showGooglePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="max-w-sm space-y-1.5">
                <Label>Device Lock Code / PIN</Label>
                <Input placeholder="Enter lock code" value={form.device_lock_code} onChange={e => updateField("device_lock_code", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 3: Service Charges — Enhanced Line Items */}
      {currentStep === 3 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Service Charges & Billing</CardTitle>
              <Button variant="outline" size="sm" onClick={addServiceLine}><Plus className="h-3 w-3 mr-1" /> Add Line</Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* GST Mode */}
            <div className="space-y-2">
              <Label>GST Mode</Label>
              <RadioGroup value={gstMode} onValueChange={v => setGstMode(v as any)} className="flex gap-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="gst-none" /><Label htmlFor="gst-none" className="font-normal">No GST</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="inclusive" id="gst-inc" /><Label htmlFor="gst-inc" className="font-normal">Inclusive</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="exclusive" id="gst-exc" /><Label htmlFor="gst-exc" className="font-normal">Exclusive</Label></div>
              </RadioGroup>
            </div>

            {/* Service Line Items Table */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-xs">
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground min-w-[180px]">Service Name</th>
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground w-[90px]">HSN</th>
                    {gstMode !== "none" && <th className="text-center px-2 py-2 font-medium text-muted-foreground w-[70px]">GST%</th>}
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[100px]">Price</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground w-[60px]">Qty</th>
                    <th className="text-center px-2 py-2 font-medium text-muted-foreground w-[90px]">Discount</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground w-[100px]">Total</th>
                    <th className="w-[40px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {serviceItems.map((item) => {
                    const calc = calcLineItem(item);
                    const lineTotal = gstMode === "none" ? calc.taxable : (gstMode === "inclusive" ? calc.taxable : calc.total);
                    return (
                      <tr key={item.id} className="border-t border-border/50">
                        <td className="px-2 py-2">
                          <Input value={item.name} onChange={e => updateServiceLine(item.id, "name", e.target.value)} placeholder="Service name" className="h-8 text-xs" />
                        </td>
                        <td className="px-1 py-2">
                          <Input value={item.hsn_code} onChange={e => updateServiceLine(item.id, "hsn_code", e.target.value)} placeholder="HSN" className="h-8 text-xs" />
                        </td>
                        {gstMode !== "none" && (
                          <td className="px-1 py-2">
                            <Select value={String(item.gst_percentage)} onValueChange={v => updateServiceLine(item.id, "gst_percentage", Number(v))}>
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {["0", "5", "12", "18", "28"].map(p => <SelectItem key={p} value={p}>{p}%</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </td>
                        )}
                        <td className="px-1 py-2">
                          <Input type="number" value={item.price || ""} onChange={e => updateServiceLine(item.id, "price", Number(e.target.value))} className="h-8 text-xs text-right" />
                        </td>
                        <td className="px-1 py-2">
                          <Input type="number" value={item.quantity || ""} onChange={e => updateServiceLine(item.id, "quantity", Number(e.target.value))} className="h-8 text-xs text-center w-14 mx-auto" />
                        </td>
                        <td className="px-1 py-2">
                          <div className="flex gap-1 items-center">
                            <Select value={item.discount_type} onValueChange={v => updateServiceLine(item.id, "discount_type", v)}>
                              <SelectTrigger className="h-8 text-xs w-[55px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                <SelectItem value="percentage">%</SelectItem>
                                <SelectItem value="fixed">₹</SelectItem>
                              </SelectContent>
                            </Select>
                            {item.discount_type !== "none" && (
                              <Input type="number" value={item.discount_value || ""} onChange={e => updateServiceLine(item.id, "discount_value", Number(e.target.value))} className="h-8 text-xs w-14" />
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right font-medium text-xs">
                          ₹{lineTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-1 py-2">
                          {serviceItems.length > 1 && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => removeServiceLine(item.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <Card className="bg-muted/30 border-primary/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Billing Summary</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>₹{serviceTotals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
                {serviceTotals.discount > 0 && (
                  <div className="flex justify-between text-sm text-destructive">
                    <span>Discount</span>
                    <span>-₹{serviceTotals.discount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                {gstMode !== "none" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">GST ({gstMode})</span>
                    <span>₹{effectiveGst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Grand Total</span>
                  <span className="text-primary">₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Pre-Repair Checklist */}
      {currentStep === 4 && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Pre-Repair Checklist {!isEditMode && "*"}</CardTitle>
                <div className="flex items-center gap-2">
                  {overallProgress.percent === 100 && <CheckCircle2 className="h-4 w-4 text-success" />}
                  <Badge variant={overallProgress.percent === 100 ? "default" : "secondary"}>{overallProgress.completed}/{overallProgress.total}</Badge>
                </div>
              </div>
              <Progress value={overallProgress.percent} className="h-2 mt-2" />
              {deviceIsOff && (
                <div className="flex items-center gap-2 text-xs text-warning mt-2">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Device is OFF — dependent checks auto-set to N/A. You can override manually.</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {categories.map(cat => {
                const progress = getCategoryProgress(cat);
                return (
                  <Collapsible key={cat} open={openCategories[cat] ?? true} onOpenChange={(open) => setOpenCategories(prev => ({ ...prev, [cat]: open }))}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center justify-between w-full px-3 py-2.5 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm">
                        <div className="flex items-center gap-2">
                          <ChevronDown className={`h-4 w-4 transition-transform ${openCategories[cat] ? "" : "-rotate-90"}`} />
                          <span className="font-medium">{cat}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={progress.percent} className="h-1.5 w-16" />
                          <Badge variant={progress.percent === 100 ? "default" : "secondary"} className={`text-xs min-w-[40px] justify-center ${progress.percent > 0 && progress.percent < 100 ? "bg-warning/15 text-warning border-warning/30" : ""}`}>
                            {progress.completed}/{progress.total}
                          </Badge>
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-1">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead><tr className="bg-muted/30"><th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Item</th><th className="text-center px-2 py-2 font-medium text-muted-foreground text-xs w-[140px]">Status</th></tr></thead>
                          <tbody>
                            {checklist.map((item, idx) => item.category !== cat ? null : (
                              <tr key={idx} className="border-t border-border/50">
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span>{item.item}</span>
                                    {item.autoSet && <span className="text-[9px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">Auto</span>}
                                  </div>
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex gap-1 justify-center">
                                    {(["yes", "no", "na"] as const).map(v => (
                                      <button key={v} type="button" onClick={() => updateChecklist(idx, v)}
                                        className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                          item.value === v
                                            ? v === "yes" ? "bg-success text-success-foreground" : v === "no" ? "bg-destructive text-destructive-foreground" : "bg-muted-foreground text-background"
                                            : `bg-muted text-muted-foreground ${v === "yes" ? "hover:bg-success/20 hover:text-success" : v === "no" ? "hover:bg-destructive/20 hover:text-destructive" : "hover:bg-muted-foreground/20"}`
                                        }`}
                                      >{v === "na" ? "N/A" : v.charAt(0).toUpperCase() + v.slice(1)}</button>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Staff Notes & Priority *</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Textarea rows={3} placeholder="Enter mandatory staff notes..." value={form.staff_notes} onChange={e => updateField("staff_notes", e.target.value)} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label>Estimated Cost (₹)</Label>
                  <Input type="number" value={form.estimated_cost} onChange={e => updateField("estimated_cost", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Estimated Completion</Label>
                  <Input type="date" value={form.estimated_completion} onChange={e => updateField("estimated_completion", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={v => updateField("priority", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 5: Review */}
      {currentStep === 5 && (
        <>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Customer</CardTitle></CardHeader>
            <CardContent className="text-sm grid grid-cols-2 gap-2">
              <p><span className="text-muted-foreground">Name:</span> {selectedCustomer?.name || "—"}</p>
              <p><span className="text-muted-foreground">Phone:</span> {selectedCustomer?.phone || "—"}</p>
              <p><span className="text-muted-foreground">Email:</span> {selectedCustomer?.email || "—"}</p>
              <p><span className="text-muted-foreground">GSTIN:</span> {selectedCustomer?.gst_number || "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Smartphone className="h-4 w-4" /> Device</CardTitle></CardHeader>
            <CardContent className="text-sm grid grid-cols-2 sm:grid-cols-3 gap-2">
              <p><span className="text-muted-foreground">Type:</span> {form.device_type === "__other__" ? form.custom_type : form.device_type}</p>
              <p><span className="text-muted-foreground">Brand:</span> {form.device_brand === "__other__" ? form.custom_brand : form.device_brand}</p>
              <p><span className="text-muted-foreground">Model:</span> {form.device_model || "—"}</p>
              <p><span className="text-muted-foreground">Serial:</span> {form.serial_number || "—"}</p>
              <p><span className="text-muted-foreground">IMEI:</span> {form.imei_number || "—"}</p>
              <p><span className="text-muted-foreground">Problem:</span> {form.problem_description.slice(0, 50)}{form.problem_description.length > 50 ? "..." : ""}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><IndianRupee className="h-4 w-4" /> Service Charges ({serviceItems.length} items)</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {serviceItems.filter(i => i.name).map(item => {
                const calc = calcLineItem(item);
                return (
                  <div key={item.id} className="flex justify-between">
                    <span className="text-muted-foreground">{item.name} × {item.quantity}</span>
                    <span>₹{(gstMode === "none" ? calc.taxable : gstMode === "inclusive" ? calc.taxable : calc.total).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span>
                  </div>
                );
              })}
              <Separator />
              <div className="flex justify-between font-bold text-base"><span>Grand Total</span><span className="text-primary">₹{grandTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</span></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Checklist Summary</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <div className="flex gap-4">
                <Badge className="bg-success/10 text-success">Pass: {checklist.filter(c => c.value === "yes").length}</Badge>
                <Badge className="bg-destructive/10 text-destructive">Fail: {checklist.filter(c => c.value === "no").length}</Badge>
                <Badge className="bg-muted text-muted-foreground">N/A: {checklist.filter(c => c.value === "na").length}</Badge>
              </div>
              <p className="mt-2"><span className="text-muted-foreground">Priority:</span> <span className="capitalize">{form.priority}</span></p>
              <p><span className="text-muted-foreground">Staff Notes:</span> {form.staff_notes.slice(0, 100)}</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* Navigation Buttons — NO auto invoice generation */}
      <div className="flex gap-3 justify-between pb-6">
        <div>
          {currentStep > 1 && (
            <Button variant="outline" onClick={prevStep}>Back</Button>
          )}
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate(isEditMode ? `/repairs/${editId}` : "/repairs")}>Cancel</Button>
          {currentStep < 5 ? (
            <Button onClick={nextStep}>Next</Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : isEditMode ? "Update Job Sheet" : "Save Job Sheet"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
