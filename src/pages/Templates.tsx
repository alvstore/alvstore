import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Mail, MessageSquare, FileText, File } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  variables: any;
  is_default: boolean;
  created_at: string;
}

const typeIcons: Record<string, any> = { email: Mail, sms: MessageSquare, invoice: FileText, quotation: File };
const typeColors: Record<string, string> = { email: "bg-primary/10 text-primary", sms: "bg-success/10 text-success", invoice: "bg-warning/10 text-warning", quotation: "bg-accent/10 text-accent" };

const variablesList = ["{{customer_name}}", "{{invoice_number}}", "{{quotation_number}}", "{{amount}}", "{{date}}", "{{company_name}}", "{{repair_status}}"];

export default function Templates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "email", subject: "", body: "" });

  const fetchTemplates = async () => {
    setLoading(true);
    let query = supabase.from("templates").select("*").order("created_at", { ascending: false });
    if (tab !== "all") query = query.eq("type", tab as any);
    const { data } = await query;
    setTemplates(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, [tab]);

  const openNew = () => { setEditId(null); setForm({ name: "", type: "email", subject: "", body: "" }); setSheetOpen(true); };
  const openEdit = (t: Template) => { setEditId(t.id); setForm({ name: t.name, type: t.type, subject: t.subject || "", body: t.body }); setSheetOpen(true); };

  const handleSave = async () => {
    if (!form.name || !form.body) { toast.error("Name and body are required"); return; }
    const payload = { name: form.name, type: form.type as any, subject: form.subject || null, body: form.body, created_by: user?.id };
    if (editId) {
      const { error } = await supabase.from("templates").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Template updated");
    } else {
      const { error } = await supabase.from("templates").insert(payload);
      if (error) toast.error(error.message); else toast.success("Template created");
    }
    setSheetOpen(false);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("templates").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Deleted"); fetchTemplates(); }
  };

  const insertVariable = (v: string) => setForm(p => ({ ...p, body: p.body + v }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground">Manage email, SMS, and document templates</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Template</Button>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="invoice">Invoice</TabsTrigger>
          <TabsTrigger value="quotation">Quotation</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : templates.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No templates yet. Create your first one!</p>
      ) : (
        <div className="grid gap-3">
          {templates.map(t => {
            const Icon = typeIcons[t.type] || File;
            return (
              <Card key={t.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`p-2.5 rounded-lg ${typeColors[t.type] || "bg-muted"}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{t.name}</p>
                    {t.subject && <p className="text-sm text-muted-foreground truncate">{t.subject}</p>}
                  </div>
                  <Badge variant="outline" className="capitalize">{t.type}</Badge>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Template" : "New Template"}</SheetTitle>
            <SheetDescription>Create reusable message templates with variables</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(form.type === "email") && (
              <div className="space-y-1.5"><Label>Subject</Label><Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} /></div>
            )}
            <div className="space-y-1.5">
              <Label>Body *</Label>
              <Textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={8} />
              {form.type === "sms" && <p className="text-xs text-muted-foreground">{form.body.length}/160 characters</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Insert Variable</Label>
              <div className="flex flex-wrap gap-1">
                {variablesList.map(v => (
                  <Button key={v} variant="outline" size="sm" className="text-xs" onClick={() => insertVariable(v)}>{v}</Button>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={handleSave}>{editId ? "Update" : "Create"} Template</Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
