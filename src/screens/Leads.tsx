"use client";

import { Box, Button, Card, CardContent, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, SearchToolbar, SideDrawer, StatCard, StatusChip, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Search, UserPlus, Target, Phone, Mail, MessageSquare, Calendar, TrendingUp, Users, ArrowRight, Clock, AlertTriangle, } from "lucide-react";
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
    { id: "new", label: "New", color: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" } },
    { id: "contacted", label: "Contacted", color: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" } },
    { id: "qualified", label: "Qualified", color: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" } },
    { id: "proposal", label: "Proposal", color: { backgroundColor: "hsl(var(--accent))", color: "hsl(var(--accent-foreground))" } },
    { id: "negotiation", label: "Negotiation", color: { backgroundColor: "hsl(var(--secondary))", color: "hsl(var(--secondary-foreground))" } },
    { id: "converted", label: "Converted", color: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" } },
    { id: "lost", label: "Lost", color: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" } },
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
    const [staffList, setStaffList] = useState<{
        user_id: string;
        full_name: string | null;
    }[]>([]);
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [activityForm, setActivityForm] = useState({ type: "note", description: "", outcome: "" });
    const [viewTab, setViewTab] = useState("pipeline");
    const fetchLeads = useCallback(async () => {
        setLoading(true);
        let query = supabase.from("leads").select("*").order("created_at", { ascending: false });
        if (stageFilter !== "all")
            query = query.eq("pipeline_stage", stageFilter);
        if (search)
            query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setLeads((data || []) as Lead[]);
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
        if (!form.name.trim()) {
            toast.error("Name is required");
            return;
        }
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
            if (error)
                toast.error(error.message);
            else
                toast.success("Lead updated");
        }
        else {
            const { error } = await supabase.from("leads").insert(payload as any);
            if (error)
                toast.error(error.message);
            else
                toast.success("Lead created");
        }
        setSheetOpen(false);
        fetchLeads();
    };
    const addActivity = async () => {
        if (!detailLead || !activityForm.description.trim()) {
            toast.error("Description required");
            return;
        }
        const { error } = await supabase.from("lead_activities").insert({
            lead_id: detailLead.id, type: activityForm.type,
            description: activityForm.description, outcome: activityForm.outcome || null,
            created_by: user?.id,
        });
        if (error)
            toast.error(error.message);
        else {
            toast.success("Activity added");
            setActivityForm({ type: "note", description: "", outcome: "" });
            fetchActivities(detailLead.id);
        }
    };
    const convertToCustomer = async (lead: Lead) => {
        if (lead.converted_customer_id) {
            toast.error("Already converted");
            return;
        }
        const { data, error } = await supabase.from("customers").insert({
            name: lead.name, phone: lead.phone, email: lead.email, created_by: user?.id,
        }).select().single();
        if (error) {
            toast.error(error.message);
            return;
        }
        await supabase.from("leads").update({
            status: "converted", converted_customer_id: data.id, pipeline_stage: "converted",
        }).eq("id", lead.id);
        toast.success("Lead converted to customer");
        fetchLeads();
    };
    const updateStage = async (id: string, stage: string) => {
        const status = stage === "converted" ? "converted" : stage === "lost" ? "lost" : "new";
        const { error } = await supabase.from("leads").update({ pipeline_stage: stage, status }).eq("id", id);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Stage updated");
            fetchLeads();
        }
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
            if (groups[stage])
                groups[stage].push(l);
        });
        return groups;
    }, [leads]);
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Header */}
      <PageHeader title={"Lead Management"} subtitle={"Advanced CRM pipeline with scoring & activity tracking"} actions={<><Button onClick={openNew} variant="contained"><Box component={Plus} sx={{ height: "1rem", width: "1rem", marginRight: "0.5rem" }}/>New Lead</Button></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }, gap: "0.75rem" }}>
        <StatCard label={"Total Leads"} value={kpis.total} icon={<Box component={Target} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <Card><CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Box sx={{ padding: "0.625rem", borderRadius: "0.75rem", backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)" }}><Box component={TrendingUp} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/></Box>
          <Box><Typography component="p" variant="body1" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700" }}>{kpis.convRate}%</Typography><Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Conversion</Typography></Box>
        </CardContent></Card>
        <StatCard label={"Overdue"} value={kpis.overdue} icon={<Box component={AlertTriangle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Converted"} value={kpis.converted} icon={<Box component={UserPlus} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
        <Card><CardContent sx={{ padding: "1rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Box sx={{ padding: "0.625rem", borderRadius: "0.75rem", backgroundColor: "hsl(var(--accent))" }}><Box component={TrendingUp} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--accent-foreground))" }}/></Box>
          <Box><Typography component="p" variant="body1" sx={{ fontSize: "1.25rem", lineHeight: "1.75rem", fontWeight: "700" }}>₹{(kpis.pipelineValue / 1000).toFixed(0)}K</Typography><Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>Pipeline</Typography></Box>
        </CardContent></Card>
      </Box>

      {/* Tabs: Pipeline vs Table */}
      <TabView value={viewTab} onChange={setViewTab}>
        <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row" }, gap: "0.75rem", alignItems: "flex-start", justifyContent: "space-between" }}>
          <TabBar>
            <Tab value="pipeline" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Pipeline</Box>}/>
            <Tab value="table" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>Table</Box>}/>
          </TabBar>
          <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search leads..." sx={{ maxWidth: "24rem" }}/>
        </Box>

        {/* Pipeline View */}
        <TabPanel value="pipeline">
          {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : (<Box sx={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "1rem", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
              {PIPELINE_STAGES.map(stage => (<Box key={stage.id} sx={{ minWidth: "240px", flexShrink: "0" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
                    <StatusChip label={stage.label} sx={mergeSx(stage.color, { fontSize: "0.75rem", lineHeight: "1rem" })}/>
                    <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", fontWeight: "500" }}>{pipelineGroups[stage.id]?.length || 0}</Box>
                  </Box>
                  <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                    {(pipelineGroups[stage.id] || []).map(lead => (<Card key={lead.id} onClick={() => openEdit(lead)} sx={{ cursor: "pointer", "&:hover": { "--alv-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 4px 6px -1px var(--alv-shadow-color), 0 2px 4px -2px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                        <CardContent sx={{ padding: "0.75rem" }}>
                          <Typography component="p" variant="body1" sx={{ fontWeight: "500", fontSize: "0.875rem", lineHeight: "1.25rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.name}</Typography>
                          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.phone || lead.email || "—"}</Typography>
                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem" }}>
                            <StatusChip label={lead.source} variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize" }}/>
                            {lead.score ? <Box component="span" sx={{ fontSize: "10px", fontWeight: "500", color: "hsl(var(--primary))" }}>{lead.score}pts</Box> : null}
                          </Box>
                          {lead.expected_value ? (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem" }}>₹{lead.expected_value.toLocaleString("en-IN")}</Typography>) : null}
                          {lead.next_follow_up && new Date(lead.next_follow_up) < new Date() && stage.id !== "converted" && stage.id !== "lost" && (<Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--destructive))", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Clock} sx={{ height: "0.75rem", width: "0.75rem" }}/>Overdue</Typography>)}
                        </CardContent>
                      </Card>))}
                    {(pipelineGroups[stage.id] || []).length === 0 && (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textAlign: "center", paddingTop: "1.5rem", paddingBottom: "1.5rem" }}>No leads</Typography>)}
                  </Box>
                </Box>))}
            </Box>)}
        </TabPanel>

        {/* Table View */}
        <TabPanel value="table">
          <Box sx={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", overflowX: "auto" }}>
            <TabView value={stageFilter} onChange={setStageFilter}>
              <TabBar>
                <Tab value="all" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>All</Box>}/>
                {PIPELINE_STAGES.map(s => (<Tab key={s.id} value={s.id} label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>{s.label}</Box>}/>))}
              </TabBar>
            </TabView>
          </Box>
          <Box sx={{ borderRadius: "var(--radius)", borderWidth: "1px", backgroundColor: "hsl(var(--card))" }}>
            <DataTable columnsCount={8} loading={loading} empty={leads.length === 0} emptyMessage={<>
                    <Box component={Target} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.5rem", opacity: "0.3" }}/>No leads yet
                  </>}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Contact</TableCell>
                  <TableCell>Source</TableCell>
                  <TableCell>Stage</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Score</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Value</TableCell>
                  <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>Follow-up</TableCell>
                  <TableCell sx={{ width: "8rem" }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>{leads.map(l => (<TableRow key={l.id}>
                    <TableCell onClick={() => openEdit(l)} sx={{ fontWeight: "500", cursor: "pointer", "&:hover": { color: "hsl(var(--primary))" } }}>{l.name}</TableCell>
                    <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{l.phone || l.email || "—"}</TableCell>
                    <TableCell><StatusChip label={l.source} variant="outlined" sx={{ textTransform: "capitalize", fontSize: "0.75rem", lineHeight: "1rem" }}/></TableCell>
                    <TableCell>
                      <TextField value={l.pipeline_stage || "new"} select size="small" fullWidth onChange={event => (v => updateStage(l.id, v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "1.75rem", width: "110px", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          {PIPELINE_STAGES.map(s => (<MenuItem key={s.id} value={s.id} sx={{ textTransform: "capitalize", fontSize: "0.75rem", lineHeight: "1rem" }}>{s.label}</MenuItem>))}
                        </TextField>
                    </TableCell>
                    <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>
                      <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500", color: "hsl(var(--primary))" }}>{l.score || 0}</Box>
                    </TableCell>
                    <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                      {l.expected_value ? `₹${l.expected_value.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" }, fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                      {l.next_follow_up ? (<Box component="span" sx={new Date(l.next_follow_up) < new Date() ? { color: "hsl(var(--destructive))" } : { color: "hsl(var(--muted-foreground))" }}>
                          {format(new Date(l.next_follow_up), "dd MMM")}
                        </Box>) : "—"}
                    </TableCell>
                    <TableCell>
                      {l.pipeline_stage !== "converted" && (<Button onClick={() => convertToCustomer(l)} variant="outlined" size="small">
                          <Box component={UserPlus} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.25rem" }}/>Convert
                        </Button>)}
                    </TableCell>
                  </TableRow>))}</TableBody>
            </DataTable>
          </Box>
        </TabPanel>
      </TabView>

      {/* Lead Detail Sheet */}
      <SideDrawer
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editId ? "Lead Details" : "New Lead"}
        description={editId ? "Edit details and track activities" : "Enter lead details"}
        width={520}
        footer={
          <>
            <Button variant="outlined" onClick={() => setSheetOpen(false)} sx={{ minHeight: 36 }}>Cancel</Button>
            <Button onClick={handleSave} variant="contained" sx={{ minHeight: 36 }}>{editId ? "Update Lead" : "Create Lead"}</Button>
          </>
        }
      >

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} label={"Name *"} size="small" fullWidth/></Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} label={"Phone"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} label={"Email"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.source} label={"Source"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, source: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                    {SOURCES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: "capitalize" }}>{s.replace("_", " ")}</MenuItem>)}
                  </TextField>
              </Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

                <TextField value={form.pipeline_stage} label={"Pipeline Stage"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, pipeline_stage: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                    {PIPELINE_STAGES.map(s => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
                  </TextField>
              </Box>
            </Box>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0.75rem" }}>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="number" value={form.expected_value} onChange={e => setForm(p => ({ ...p, expected_value: e.target.value }))} label={"Expected Value (\u20B9)"} size="small" fullWidth/></Box>
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField type="datetime-local" value={form.next_follow_up} onChange={e => setForm(p => ({ ...p, next_follow_up: e.target.value }))} label={"Next Follow-up"} size="small" fullWidth/></Box>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={form.assigned_to} label={"Assign To"} select size="small" fullWidth onChange={event => (v => setForm(p => ({ ...p, assigned_to: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}><MenuItem value="" disabled>{"Select staff"}</MenuItem>
                  {staffList.map(s => <MenuItem key={s.user_id} value={s.user_id}>{s.full_name || "Unnamed"}</MenuItem>)}
                </TextField>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}><TextField value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} label={"Notes"} size="small" fullWidth multiline/></Box>

            {/* Activity Timeline */}
            {editId && detailLead && (<Box sx={{ marginTop: "1.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                <Typography component="h3" variant="h3" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>Activity Timeline</Typography>

                {/* Add Activity */}
                <Card>
                  <CardContent sx={{ padding: "0.75rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                    <Box sx={{ display: "flex", gap: "0.5rem" }}>
                      <TextField value={activityForm.type} select size="small" fullWidth onChange={event => (v => setActivityForm(p => ({ ...p, type: v })))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "100px", height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}>
                          {ACTIVITY_TYPES.map(a => <MenuItem key={a.id} value={a.id} sx={{ fontSize: "0.75rem", lineHeight: "1rem" }}>{a.label}</MenuItem>)}
                        </TextField>
                      <TextField placeholder="What happened?" value={activityForm.description} onChange={e => setActivityForm(p => ({ ...p, description: e.target.value }))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "What happened?" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                    </Box>
                    <Box sx={{ display: "flex", gap: "0.5rem" }}>
                      <TextField placeholder="Outcome (optional)" value={activityForm.outcome} onChange={e => setActivityForm(p => ({ ...p, outcome: e.target.value }))} size="small" fullWidth slotProps={{ htmlInput: { "aria-label": "Outcome (optional)" } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}/>
                      <Button onClick={addActivity} variant="contained" size="small" sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem" }}><Box component={Plus} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Add</Button>
                    </Box>
                  </CardContent>
                </Card>

                {/* Timeline */}
                <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" }, maxHeight: "15rem", overflowY: "auto" }}>
                  {activities.length === 0 ? (<Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", textAlign: "center", paddingTop: "1rem", paddingBottom: "1rem" }}>No activities yet</Typography>) : activities.map(a => {
                const actType = ACTIVITY_TYPES.find(t => t.id === a.type);
                const Icon = actType?.icon || Target;
                return (<Box key={a.id} sx={{ display: "flex", gap: "0.75rem", padding: "0.5rem", borderRadius: "var(--radius)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }}>
                        <Box sx={{ padding: "0.375rem", borderRadius: "calc(var(--radius) - 2px)", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", height: "fit-content" }}>
                          <Box component={Icon} sx={{ height: "0.875rem", width: "0.875rem", color: "hsl(var(--primary))" }}/>
                        </Box>
                        <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <StatusChip label={a.type} variant="outlined" sx={{ fontSize: "10px", textTransform: "capitalize" }}/>
                            <Box component="span" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))" }}>{format(new Date(a.created_at), "dd MMM, HH:mm")}</Box>
                          </Box>
                          <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", marginTop: "0.125rem" }}>{a.description}</Typography>
                          {a.outcome && <Typography component="p" variant="body1" sx={{ fontSize: "10px", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>→ {a.outcome}</Typography>}
                        </Box>
                      </Box>);
            })}
                </Box>
              </Box>)}
          </Box>
        </SideDrawer>
    </Box></AnimatedPage>;
}
