import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, Search, UserPlus, Target, Phone, Mail, MessageSquare,
  Calendar, TrendingUp, Users, ArrowRight, Clock, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  assigned_to: string | null;
  notes: string | null;
  converted_customer_id: string | null;
  created_at: string;
  score: number | null;
  next_follow_up: string | null;
  expected_value: number | null;
  pipeline_stage: string | null;
  lost_reason: string | null;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  type: string;
  description: string | null;
  outcome: string | null;
  created_by: string | null;
  created_at: string;
}

const PIPELINE_STAGES = [
  { id: "new", label: "New", color: "bg-info/10 text-info" },
  { id: "contacted", label: "Contacted", color: "bg-primary/10 text-primary" },
  { id: "qualified", label: "Qualified", color: "bg-warning/10 text-warning" },
  { id: "proposal", label: "Proposal", color: "bg-accent text-accent-foreground" },
  { id: "negotiation", label: "Negotiation", color: "bg-secondary text-secondary-foreground" },
  { id: "converted", label: "Converted", color: "bg-success/10 text-success" },
  { id: "lost", label: "Lost", color: "bg-destructive/10 text-destructive" },
];

const ACTIVITY_TYPES = [
  { id: "call", label: "Call", icon: Phone },
  { id: "email", label: "Email", icon: Mail },
  { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { id: "meeting", label: "Meeting", icon: Users },
  { id: "note", label: "Note", icon: Target },
];

const SOURCES = ["walkin", "website", "referral", "ads", "social", "cold_call"];

function calcScore(source: string): number {
  const map: Record<string, number> = { referral: 80, website: 60, ads: 40, walkin: 50, social: 45, cold_call: 30 };
  return map[source] || 30;
}

const emptyForm = {
  name: "", phone: "", email: "", source: "walkin", notes: "",
  assigned_to: "", expected_value: "", next_follow_up: "", pipeline_stage: "new",
};

export default function Leads() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [staffList, setStaffList] = useState<{ user_id: string; full_name: string | null }[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [activityForm, setActivityForm] = useState({ type: "note", description: "", outcome: "" });
  const [viewTab, setViewTab] = useState("pipeline");

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (stageFilter !== "all") query = query.eq("pipeline_stage", stageFilter);
    if (search) query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setLeads((data || []) as Lead[]);
    setLoading(false);
  }, [search, stageFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").then(({ data }) => setStaffList(data || []));
  }, []);

  const fetchActivities = async (leadId: string) => {
    const { data } = await supabase
      .from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false });
    setActivities((data || []) as LeadActivity[]);
  };

  const openNew = () => { setEditId(null); setDetailLead(null); setForm(emptyForm); setSheetOpen(true); };
  const openEdit = (l: Lead) => {
    setEditId(l.id);
    setDetailLead(l);
    setForm({
      name: l.name, phone: l.phone || "", email: l.email || "", source: l.source || "walkin",
      notes: l.notes || "", assigned_to: l.assigned_to || "",
      expected_value: l.expected_value?.toString() || "", next_follow_up: l.next_follow_up?.substring(0, 16) || "",
      pipeline_stage: l.pipeline_stage || "new",
    });
    setSheetOpen(true);
    fetchActivities(l.id);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const score = calcScore(form.source);
    const payload: Record<string, any> = {
      name: form.name, phone: form.phone || null, email: form.email || null,
      source: form.source, notes: form.notes || null,
      assigned_to: form.assigned_to || null, score,
      expected_value: form.expected_value ? parseFloat(form.expected_value) : 0,
      next_follow_up: form.next_follow_up || null,
      pipeline_stage: form.pipeline_stage,
      status: form.pipeline_stage === "converted" ? "converted" : form.pipeline_stage === "lost" ? "lost" : "new",
    };
    if (editId) {
      const { error } = await supabase.from("leads").update(payload).eq("id", editId);
      if (error) toast.error(error.message); else toast.success("Lead updated");
    } else {
      const { created_by, ...insertPayload } = { ...payload, created_by: user?.id };
      const { error } = await supabase.from("leads").insert(insertPayload as any);
      if (error) toast.error(error.message); else toast.success("Lead created");
    }
      if (error) toast.error(error.message); else toast.success("Lead created");
    }
    setSheetOpen(false);
    fetchLeads();
  };

  const addActivity = async () => {
    if (!detailLead || !activityForm.description.trim()) { toast.error("Description required"); return; }
    const { error } = await supabase.from("lead_activities").insert({
      lead_id: detailLead.id, type: activityForm.type,
      description: activityForm.description, outcome: activityForm.outcome || null,
      created_by: user?.id,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Activity added");
      setActivityForm({ type: "note", description: "", outcome: "" });
      fetchActivities(detailLead.id);
    }
  };

  const convertToCustomer = async (lead: Lead) => {
    if (lead.converted_customer_id) { toast.error("Already converted"); return; }
    const { data, error } = await supabase.from("customers").insert({
      name: lead.name, phone: lead.phone, email: lead.email, created_by: user?.id,
    }).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("leads").update({
      status: "converted", converted_customer_id: data.id, pipeline_stage: "converted",
    }).eq("id", lead.id);
    toast.success("Lead converted to customer");
    fetchLeads();
  };

  const updateStage = async (id: string, stage: string) => {
    const status = stage === "converted" ? "converted" : stage === "lost" ? "lost" : "new";
    const { error } = await supabase.from("leads").update({ pipeline_stage: stage, status }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Stage updated"); fetchLeads(); }
  };

  // KPI calculations
  const kpis = useMemo(() => {
    const total = leads.length;
    const converted = leads.filter(l => l.pipeline_stage === "converted").length;
    const overdue = leads.filter(l => l.next_follow_up && new Date(l.next_follow_up) < new Date() && l.pipeline_stage !== "converted" && l.pipeline_stage !== "lost").length;
    const pipelineValue = leads.filter(l => l.pipeline_stage !== "converted" && l.pipeline_stage !== "lost").reduce((s, l) => s + (l.expected_value || 0), 0);
    const convRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    return { total, converted, overdue, pipelineValue, convRate };
  }, [leads]);

  // Pipeline grouped
  const pipelineGroups = useMemo(() => {
    const groups: Record<string, Lead[]> = {};
    PIPELINE_STAGES.forEach(s => { groups[s.id] = []; });
    leads.forEach(l => {
      const stage = l.pipeline_stage || "new";
      if (groups[stage]) groups[stage].push(l);
    });
    return groups;
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Lead Management</h1>
          <p className="text-muted-foreground">Advanced CRM pipeline with scoring & activity tracking</p>
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />New Lead</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10"><Target className="h-5 w-5 text-primary" /></div>
          <div><p className="text-xl font-bold">{kpis.total}</p><p className="text-[11px] text-muted-foreground">Total Leads</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-success/10"><TrendingUp className="h-5 w-5 text-success" /></div>
          <div><p className="text-xl font-bold">{kpis.convRate}%</p><p className="text-[11px] text-muted-foreground">Conversion</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-warning/10"><AlertTriangle className="h-5 w-5 text-warning" /></div>
          <div><p className="text-xl font-bold">{kpis.overdue}</p><p className="text-[11px] text-muted-foreground">Overdue</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-info/10"><UserPlus className="h-5 w-5 text-info" /></div>
          <div><p className="text-xl font-bold">{kpis.converted}</p><p className="text-[11px] text-muted-foreground">Converted</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-accent"><TrendingUp className="h-5 w-5 text-accent-foreground" /></div>
          <div><p className="text-xl font-bold">₹{(kpis.pipelineValue / 1000).toFixed(0)}K</p><p className="text-[11px] text-muted-foreground">Pipeline</p></div>
        </CardContent></Card>
      </div>

      {/* Tabs: Pipeline vs Table */}
      <Tabs value={viewTab} onValueChange={setViewTab}>
        <div className="flex flex-col sm:flex-row gap-3 items-start justify-between">
          <TabsList>
            <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search leads..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Pipeline View */}
        <TabsContent value="pipeline">
          {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : (
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
              {PIPELINE_STAGES.map(stage => (
                <div key={stage.id} className="min-w-[240px] flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <Badge className={`${stage.color} text-xs`}>{stage.label}</Badge>
                    <span className="text-xs text-muted-foreground font-medium">{pipelineGroups[stage.id]?.length || 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(pipelineGroups[stage.id] || []).map(lead => (
                      <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => openEdit(lead)}>
                        <CardContent className="p-3">
                          <p className="font-medium text-sm truncate">{lead.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.phone || lead.email || "—"}</p>
                          <div className="flex items-center justify-between mt-2">
                            <Badge variant="outline" className="text-[10px] capitalize">{lead.source}</Badge>
                            {lead.score ? <span className="text-[10px] font-medium text-primary">{lead.score}pts</span> : null}
                          </div>
                          {lead.expected_value ? (
                            <p className="text-xs text-muted-foreground mt-1">₹{lead.expected_value.toLocaleString("en-IN")}</p>
                          ) : null}
                          {lead.next_follow_up && new Date(lead.next_follow_up) < new Date() && stage.id !== "converted" && stage.id !== "lost" && (
                            <p className="text-[10px] text-destructive mt-1 flex items-center gap-1"><Clock className="h-3 w-3" />Overdue</p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                    {(pipelineGroups[stage.id] || []).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">No leads</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Table View */}
        <TabsContent value="table">
          <div className="flex gap-3 mb-3 overflow-x-auto">
            <Tabs value={stageFilter} onValueChange={setStageFilter}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                {PIPELINE_STAGES.map(s => (
                  <TabsTrigger key={s.id} value={s.id}>{s.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="hidden md:table-cell">Score</TableHead>
                  <TableHead className="hidden md:table-cell">Value</TableHead>
                  <TableHead className="hidden lg:table-cell">Follow-up</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : leads.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <Target className="h-10 w-10 mx-auto mb-2 opacity-30" />No leads yet
                  </TableCell></TableRow>
                ) : leads.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium cursor-pointer hover:text-primary" onClick={() => openEdit(l)}>{l.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground">{l.phone || l.email || "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize text-xs">{l.source}</Badge></TableCell>
                    <TableCell>
                      <Select value={l.pipeline_stage || "new"} onValueChange={v => updateStage(l.id, v)}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PIPELINE_STAGES.map(s => (
                            <SelectItem key={s.id} value={s.id} className="capitalize text-xs">{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-xs font-medium text-primary">{l.score || 0}</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">
                      {l.expected_value ? `₹${l.expected_value.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">
                      {l.next_follow_up ? (
                        <span className={new Date(l.next_follow_up) < new Date() ? "text-destructive" : "text-muted-foreground"}>
                          {format(new Date(l.next_follow_up), "dd MMM")}
                        </span>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {l.pipeline_stage !== "converted" && (
                        <Button variant="outline" size="sm" onClick={() => convertToCustomer(l)}>
                          <UserPlus className="h-3.5 w-3.5 mr-1" />Convert
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Lead Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{editId ? "Lead Details" : "New Lead"}</SheetTitle>
            <SheetDescription>{editId ? "Edit details and track activities" : "Enter lead details"}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6">
            <div className="space-y-1.5"><Label>Name *</Label><Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Email</Label><Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={v => setForm(p => ({ ...p, source: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pipeline Stage</Label>
                <Select value={form.pipeline_stage} onValueChange={v => setForm(p => ({ ...p, pipeline_stage: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PIPELINE_STAGES.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Expected Value (₹)</Label><Input type="number" value={form.expected_value} onChange={e => setForm(p => ({ ...p, expected_value: e.target.value }))} /></div>
              <div className="space-y-1.5"><Label>Next Follow-up</Label><Input type="datetime-local" value={form.next_follow_up} onChange={e => setForm(p => ({ ...p, next_follow_up: e.target.value }))} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign To</Label>
              <Select value={form.assigned_to} onValueChange={v => setForm(p => ({ ...p, assigned_to: v }))}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>
                  {staffList.map(s => <SelectItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Notes</Label><Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} /></div>
            <Button className="w-full" onClick={handleSave}>{editId ? "Update Lead" : "Create Lead"}</Button>

            {/* Activity Timeline */}
            {editId && detailLead && (
              <div className="mt-6 space-y-4">
                <h3 className="text-sm font-semibold">Activity Timeline</h3>

                {/* Add Activity */}
                <Card>
                  <CardContent className="p-3 space-y-2">
                    <div className="flex gap-2">
                      <Select value={activityForm.type} onValueChange={v => setActivityForm(p => ({ ...p, type: v }))}>
                        <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ACTIVITY_TYPES.map(a => <SelectItem key={a.id} value={a.id} className="text-xs">{a.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input className="h-8 text-xs" placeholder="What happened?" value={activityForm.description} onChange={e => setActivityForm(p => ({ ...p, description: e.target.value }))} />
                    </div>
                    <div className="flex gap-2">
                      <Input className="h-8 text-xs" placeholder="Outcome (optional)" value={activityForm.outcome} onChange={e => setActivityForm(p => ({ ...p, outcome: e.target.value }))} />
                      <Button size="sm" className="h-8 text-xs" onClick={addActivity}><Plus className="h-3 w-3 mr-1" />Add</Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {activities.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No activities yet</p>
                  ) : activities.map(a => {
                    const actType = ACTIVITY_TYPES.find(t => t.id === a.type);
                    const Icon = actType?.icon || Target;
                    return (
                      <div key={a.id} className="flex gap-3 p-2 rounded-lg bg-muted/30">
                        <div className="p-1.5 rounded-md bg-primary/10 h-fit">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] capitalize">{a.type}</Badge>
                            <span className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), "dd MMM, HH:mm")}</span>
                          </div>
                          <p className="text-xs mt-0.5">{a.description}</p>
                          {a.outcome && <p className="text-[10px] text-muted-foreground mt-0.5">→ {a.outcome}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
