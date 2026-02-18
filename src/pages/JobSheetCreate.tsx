import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, Upload, Plus, X, ChevronDown, Eye, EyeOff, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

interface ChecklistItem {
  category: string;
  item: string;
  value: "yes" | "no" | "na" | "";
  autoSet?: boolean;
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

// Categories that depend on "Device turns ON"
const POWER_DEPENDENT_CATEGORIES = ["Display", "Audio", "Camera", "Network", "Hardware", "Input", "Ports", "Cooling"];

function getChecklistForDevice(deviceType: string): ChecklistItem[] {
  // Try exact match first, then partial match
  if (DEVICE_CHECKLISTS[deviceType]) return DEVICE_CHECKLISTS[deviceType].map(c => ({ ...c }));
  const lower = deviceType.toLowerCase();
  if (lower.includes("laptop") || lower.includes("notebook")) return DEVICE_CHECKLISTS.Laptop.map(c => ({ ...c }));
  if (lower.includes("tablet") || lower.includes("ipad")) return DEVICE_CHECKLISTS.Tablet.map(c => ({ ...c }));
  if (lower.includes("desktop") || lower.includes("pc") || lower.includes("computer")) return DEVICE_CHECKLISTS.Desktop.map(c => ({ ...c }));
  // Default to Mobile
  return DEVICE_CHECKLISTS.Mobile.map(c => ({ ...c }));
}

export default function JobSheetCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(getChecklistForDevice("Mobile"));
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [imageFiles, setImageFiles] = useState<{ type: string; file: File }[]>([]);
  const [saving, setSaving] = useState(false);
  const [deviceIsOff, setDeviceIsOff] = useState(false);
  const [showApplePassword, setShowApplePassword] = useState(false);
  const [showGooglePassword, setShowGooglePassword] = useState(false);
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

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
      supabase.from("customers").select("id, name").order("name"),
    ]).then(([bRes, tRes, cRes]) => {
      setBrands(bRes.data || []);
      setDeviceTypes(tRes.data || []);
      setCustomers(cRes.data || []);
    });
  }, []);

  // When device type changes, reload checklist
  useEffect(() => {
    const type = form.device_type === "__other__" ? form.custom_type : form.device_type;
    if (!type) return;
    const newChecklist = getChecklistForDevice(type);
    setChecklist(newChecklist);
    setDeviceIsOff(false);
    // Open all categories by default
    const cats = [...new Set(newChecklist.map(c => c.category))];
    const openMap: Record<string, boolean> = {};
    cats.forEach(c => { openMap[c] = true; });
    setOpenCategories(openMap);
  }, [form.device_type, form.custom_type]);

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

  const validate = () => {
    if (!form.customer_id) { toast.error("Select a customer"); return false; }
    if (!form.device_brand && !form.custom_brand) { toast.error("Select device brand"); return false; }
    if (!form.device_type && !form.custom_type) { toast.error("Select device type"); return false; }
    if (!form.problem_description.trim()) { toast.error("Enter problem description"); return false; }
    if (!form.staff_notes.trim()) { toast.error("Staff notes are mandatory"); return false; }
    const incomplete = checklist.filter(c => c.value === "");
    if (incomplete.length > 0) { toast.error(`Complete all checklist items (${incomplete.length} remaining)`); return false; }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
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

      const insertData: any = {
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
        status: "pending_approval",
        created_by: user?.id,
        apple_id: form.apple_id || null,
        apple_id_password: form.apple_id_password || null,
        google_account: form.google_account || null,
        google_account_password: form.google_account_password || null,
        device_lock_code: form.device_lock_code || null,
      };
      const { data: job, error } = await supabase.from("job_sheets").insert(insertData).select().single();

      if (error) throw error;

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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/repairs")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">New Job Sheet</h1>
          <p className="text-muted-foreground">Create a mandatory repair job sheet</p>
        </div>
      </div>

      {/* Customer Section */}
      <Card>
        <CardHeader><CardTitle className="text-base">Customer Information</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            <Label>Customer *</Label>
            <Select value={form.customer_id} onValueChange={v => updateField("customer_id", v)}>
              <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
              <SelectContent>
                {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Device Section */}
      <Card>
        <CardHeader><CardTitle className="text-base">Device Information</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
        </CardContent>
      </Card>

      {/* Photo Upload */}
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

      {/* Account Credentials */}
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
                <Input
                  type={showApplePassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.apple_id_password}
                  onChange={e => updateField("apple_id_password", e.target.value)}
                />
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
                <Input
                  type={showGooglePassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.google_account_password}
                  onChange={e => updateField("google_account_password", e.target.value)}
                />
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

      {/* Pre-Repair Checklist */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Pre-Repair Checklist *</CardTitle>
            <div className="flex items-center gap-2">
              {overallProgress.percent === 100 && <CheckCircle2 className="h-4 w-4 text-success" />}
              <Badge variant={overallProgress.percent === 100 ? "default" : "secondary"}>
                {overallProgress.completed}/{overallProgress.total}
              </Badge>
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
              <Collapsible
                key={cat}
                open={openCategories[cat] ?? true}
                onOpenChange={(open) => setOpenCategories(prev => ({ ...prev, [cat]: open }))}
              >
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
                      <thead>
                        <tr className="bg-muted/30">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground text-xs">Item</th>
                          <th className="text-center px-2 py-2 font-medium text-muted-foreground text-xs w-[140px]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {checklist.map((item, idx) => item.category !== cat ? null : (
                          <tr key={idx} className="border-t border-border/50">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span>{item.item}</span>
                                {item.autoSet && (
                                  <span className="text-[9px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-full">Auto</span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex gap-1 justify-center">
                                <button
                                  type="button"
                                  onClick={() => updateChecklist(idx, "yes")}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                    item.value === "yes"
                                      ? "bg-success text-success-foreground"
                                      : "bg-muted text-muted-foreground hover:bg-success/20 hover:text-success"
                                  }`}
                                >
                                  Yes
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateChecklist(idx, "no")}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                    item.value === "no"
                                      ? "bg-destructive text-destructive-foreground"
                                      : "bg-muted text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                  }`}
                                >
                                  No
                                </button>
                                <button
                                  type="button"
                                  onClick={() => updateChecklist(idx, "na")}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                    item.value === "na"
                                      ? "bg-muted-foreground text-background"
                                      : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                                  }`}
                                >
                                  N/A
                                </button>
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

      {/* Problem Description */}
      <Card>
        <CardHeader><CardTitle className="text-base">Problem Description *</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            rows={3}
            placeholder="Describe the issue..."
            value={form.problem_description}
            onChange={e => updateField("problem_description", e.target.value)}
          />
          <div>
            <Label className="mb-1.5 block">Issue Tags</Label>
            <div className="flex gap-2 flex-wrap mb-2">
              {issueTags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1">
                  {tag}
                  <button type="button" onClick={() => setIssueTags(prev => prev.filter(t => t !== tag))}>
                    <X className="h-3 w-3" />
                  </button>
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

      {/* Estimate */}
      <Card>
        <CardHeader><CardTitle className="text-base">Repair Estimate</CardTitle></CardHeader>
        <CardContent>
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

      {/* Staff Notes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Staff Notes *</CardTitle></CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            placeholder="Enter mandatory staff notes..."
            value={form.staff_notes}
            onChange={e => updateField("staff_notes", e.target.value)}
          />
        </CardContent>
      </Card>

      <div className="flex gap-3 justify-end pb-6">
        <Button variant="outline" onClick={() => navigate("/repairs")}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Creating..." : "Create Job Sheet"}
        </Button>
      </div>
    </div>
  );
}
