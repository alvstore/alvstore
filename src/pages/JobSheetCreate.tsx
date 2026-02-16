import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Upload, Plus, X } from "lucide-react";
import { toast } from "sonner";

const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

interface ChecklistItem {
  category: string;
  item: string;
  value: "yes" | "no" | "na" | "";
}

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { category: "Power", item: "Device turns ON", value: "" },
  { category: "Power", item: "Device turns OFF", value: "" },
  { category: "Display", item: "Display working", value: "" },
  { category: "Display", item: "Touch working", value: "" },
  { category: "Display", item: "Display damaged", value: "" },
  { category: "Audio", item: "Speaker working", value: "" },
  { category: "Audio", item: "Microphone working", value: "" },
  { category: "Camera", item: "Front camera working", value: "" },
  { category: "Camera", item: "Rear camera working", value: "" },
  { category: "Network", item: "WiFi working", value: "" },
  { category: "Network", item: "Cellular signal working", value: "" },
  { category: "Network", item: "Bluetooth working", value: "" },
  { category: "Hardware", item: "Buttons working", value: "" },
  { category: "Hardware", item: "Charging port working", value: "" },
  { category: "Hardware", item: "Fingerprint working", value: "" },
  { category: "Hardware", item: "Face ID working", value: "" },
  { category: "Accounts", item: "Apple ID present", value: "" },
  { category: "Accounts", item: "Apple ID password provided", value: "" },
  { category: "Accounts", item: "Google account present", value: "" },
  { category: "Accounts", item: "Google password provided", value: "" },
  { category: "Accessories", item: "Charger received", value: "" },
  { category: "Accessories", item: "Cable received", value: "" },
  { category: "Accessories", item: "Cover received", value: "" },
  { category: "Accessories", item: "SIM received", value: "" },
  { category: "Accessories", item: "Memory card received", value: "" },
];

export default function JobSheetCreate() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<{ id: string; name: string }[]>([]);
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(DEFAULT_CHECKLIST.map(c => ({ ...c })));
  const [issueTags, setIssueTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [imageFiles, setImageFiles] = useState<{ type: string; file: File }[]>([]);
  const [saving, setSaving] = useState(false);

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

  const updateField = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const updateChecklist = (index: number, value: "yes" | "no" | "na") => {
    setChecklist(prev => prev.map((c, i) => i === index ? { ...c, value } : c));
  };

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
      // Save custom brand/type if "Other"
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
        pre_repair_checklist: checklist,
        staff_notes: form.staff_notes,
        estimated_cost: form.estimated_cost ? parseFloat(form.estimated_cost) : null,
        estimated_completion: form.estimated_completion || null,
        priority: form.priority,
        status: "pending_approval",
        created_by: user?.id,
      };
      const { data: job, error } = await supabase.from("job_sheets").insert(insertData).select().single();

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

      // Insert audit log entry
      await supabase.from("job_sheet_audit_log").insert({
        job_sheet_id: job.id,
        action: "created",
        details: "Job sheet created with pre-repair checklist completed",
        user_id: user?.id,
        user_role: "staff",
      });

      toast.success(`Job Sheet ${job.job_number} created`);
      navigate(`/job-sheets/${job.id}`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const categories = [...new Set(checklist.map(c => c.category))];
  const imageTypes = ["front", "back", "side", "damage"];

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/job-sheets")}>
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

      {/* Pre-Repair Checklist */}
      <Card>
        <CardHeader><CardTitle className="text-base">Pre-Repair Checklist *</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-sm font-medium mb-2">{cat}</p>
              <div className="space-y-2">
                {checklist.map((item, idx) => item.category !== cat ? null : (
                  <div key={idx} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex-1">{item.item}</span>
                    <div className="flex gap-1">
                      {(["yes", "no", "na"] as const).map(v => (
                        <Button
                          key={v}
                          type="button"
                          variant={item.value === v ? "default" : "outline"}
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          onClick={() => updateChecklist(idx, v)}
                        >
                          {v === "na" ? "N/A" : v === "yes" ? "Yes" : "No"}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <Separator className="mt-3" />
            </div>
          ))}
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
        <Button variant="outline" onClick={() => navigate("/job-sheets")}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Creating..." : "Create Job Sheet"}
        </Button>
      </div>
    </div>
  );
}
