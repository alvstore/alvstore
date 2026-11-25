"use client";

import { Box, Button, FormLabel, IconButton, Radio, RadioGroup, Skeleton, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, DatePicker, PageHeader, SideDrawer, StatCard, StatusChip, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Phone, Eye, CalendarPlus, Clock, FileText, Wrench, MessageSquarePlus, CheckCircle2, XCircle, PhoneCall, ArrowUpRight, TrendingUp, AlertTriangle, CalendarIcon, } from "lucide-react";
import { format, differenceInDays } from "date-fns";
interface PendingQuotation {
    id: string;
    quotation_number: string;
    total: number;
    status: string;
    created_at: string;
    customers: {
        name: string;
        phone: string | null;
    } | null;
}
interface PendingRepair {
    id: string;
    job_number: string;
    status: string;
    problem_description: string;
    created_at: string;
    estimated_cost: number | null;
    customers: {
        name: string;
        phone: string | null;
    } | null;
}
interface FollowUpNote {
    id: string;
    entity_type: string;
    entity_id: string;
    note: string;
    outcome: string | null;
    next_follow_up_date: string | null;
    created_at: string;
}
const OUTCOMES = [
    { value: "interested", label: "Interested", icon: TrendingUp, color: { color: "hsl(var(--success))" } },
    { value: "callback", label: "Callback Later", icon: PhoneCall, color: { color: "hsl(var(--info))" } },
    { value: "no_answer", label: "No Answer", icon: Phone, color: { color: "hsl(var(--warning))" } },
    { value: "not_interested", label: "Not Interested", icon: XCircle, color: { color: "hsl(var(--destructive))" } },
    { value: "converted", label: "Converted", icon: CheckCircle2, color: { color: "hsl(var(--success))" } },
];
export default function FollowUps() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [quotations, setQuotations] = useState<PendingQuotation[]>([]);
    const [repairs, setRepairs] = useState<PendingRepair[]>([]);
    const [loading, setLoading] = useState(true);
    // Sheet state
    const [sheetOpen, setSheetOpen] = useState(false);
    const [selectedEntity, setSelectedEntity] = useState<{
        type: string;
        id: string;
        label: string;
        customer: string;
        phone: string | null;
    } | null>(null);
    const [outcome, setOutcome] = useState("");
    const [note, setNote] = useState("");
    const [nextDate, setNextDate] = useState<Date | undefined>();
    const [saving, setSaving] = useState(false);
    const [history, setHistory] = useState<FollowUpNote[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    // KPI state
    const [todayCompleted, setTodayCompleted] = useState(0);
    const [totalConverted, setTotalConverted] = useState(0);
    useEffect(() => { load(); }, []);
    const load = async () => {
        setLoading(true);
        const [qRes, rRes] = await Promise.all([
            supabase.from("quotations").select("id, quotation_number, total, status, created_at, customers(name, phone)")
                .in("status", ["draft", "sent"]).order("created_at", { ascending: false }).limit(50),
            supabase.from("job_sheets").select("id, job_number, status, problem_description, created_at, estimated_cost, customers(name, phone)")
                .not("status", "in", '("delivered","invoice_generated")').order("created_at", { ascending: false }).limit(50),
        ]);
        setQuotations((qRes.data as any[]) || []);
        setRepairs((rRes.data as any[]) || []);
        // KPI counts
        const today = new Date().toISOString().split("T")[0];
        const [completedRes, convertedRes] = await Promise.all([
            supabase.from("follow_up_notes").select("id", { count: "exact", head: true }).gte("created_at", today),
            supabase.from("follow_up_notes").select("id", { count: "exact", head: true }).eq("outcome", "converted"),
        ]);
        setTodayCompleted(completedRes.count ?? 0);
        setTotalConverted(convertedRes.count ?? 0);
        setLoading(false);
    };
    const openRecordSheet = async (type: string, id: string, label: string, customer: string, phone: string | null) => {
        setSelectedEntity({ type, id, label, customer, phone });
        setOutcome("");
        setNote("");
        setNextDate(undefined);
        setSheetOpen(true);
        setHistoryLoading(true);
        const { data } = await supabase.from("follow_up_notes")
            .select("*").eq("entity_type", type).eq("entity_id", id)
            .order("created_at", { ascending: false });
        setHistory((data as FollowUpNote[]) || []);
        setHistoryLoading(false);
    };
    const saveFollowUp = async () => {
        if (!selectedEntity || !note.trim()) {
            toast.error("Please add a note");
            return;
        }
        setSaving(true);
        const { error } = await supabase.from("follow_up_notes").insert({
            entity_type: selectedEntity.type,
            entity_id: selectedEntity.id,
            note: note.trim(),
            outcome: outcome || null,
            next_follow_up_date: nextDate ? format(nextDate, "yyyy-MM-dd") : null,
            created_by: user?.id,
        });
        if (error) {
            toast.error("Failed to save");
            setSaving(false);
            return;
        }
        // Create calendar event if next date set
        if (nextDate && user?.id) {
            const startDate = new Date(nextDate);
            startDate.setHours(10, 0, 0, 0);
            await supabase.from("calendar_events").insert({
                title: `📞 Follow-up: ${selectedEntity.label}`,
                category: "business",
                start_date: startDate.toISOString(),
                end_date: new Date(startDate.getTime() + 30 * 60000).toISOString(),
                created_by: user.id,
            });
        }
        toast.success("Follow-up recorded");
        setSaving(false);
        setSheetOpen(false);
        load();
    };
    const daysSince = (date: string) => differenceInDays(new Date(), new Date(date));
    const urgencyBadge = (days: number) => {
        if (days <= 3)
            return <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "11px", fontWeight: "500", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }}>{days}d</Box>;
        if (days <= 7)
            return <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "11px", fontWeight: "500", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" }}>{days}d</Box>;
        return <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", fontSize: "11px", fontWeight: "500", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "9999px", backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" }}>{days}d</Box>;
    };
    const statusColor = (status: string) => {
        const map = {
            draft: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }, sent: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
            created: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" }, pending_approval: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
            approved: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" }, assigned: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
            in_progress: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" }, waiting_parts: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
            repair_completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" }, quality_check: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent-foreground))" },
        };
        return map[status] || { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" };
    };
    const overdueCount = [...quotations, ...repairs].filter((item: any) => daysSince(item.created_at) > 7).length;
    const totalDue = quotations.length + repairs.length;
    const conversionRate = totalDue > 0 ? Math.round((totalConverted / Math.max(totalDue, 1)) * 100) : 0;
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Follow-Ups"} subtitle={"Track and record follow-up interactions"}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Total Due"} value={loading ? "—" : totalDue} icon={<Box component={FileText} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info" sx={{ "&:hover": { "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" }, transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" }}/>
        <StatCard label={"Overdue (&gt;7d)"} value={loading ? "—" : overdueCount} icon={<Box component={AlertTriangle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--destructive))" }}/>} accent="error" sx={{ "&:hover": { "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "color-mix(in srgb, hsl(var(--destructive)) 5%, transparent)" }, transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" }}/>
        <StatCard label={"Completed Today"} value={loading ? "—" : todayCompleted} icon={<Box component={CheckCircle2} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success" sx={{ "&:hover": { "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "color-mix(in srgb, hsl(var(--success)) 5%, transparent)" }, transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" }}/>
        <StatCard label={"Conversion Rate"} value={loading ? "—" : `${conversionRate}%`} icon={<Box component={TrendingUp} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary" sx={{ "&:hover": { "--alv-shadow": "var(--alv-shadow-colored)", "--alv-shadow-colored": "0 10px 15px -3px var(--alv-shadow-color), 0 4px 6px -4px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)", "--alv-shadow-color": "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" }, transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "300ms", animationDuration: "300ms" }}/>
      </Box>

      {/* Tabs */}
      <TabView defaultValue="quotations">
        <TabBar>
          <Tab value="quotations" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={FileText} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Quotations ({quotations.length})</Box>}/>
          <Tab value="repairs" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Wrench} sx={{ height: "1rem", width: "1rem", marginRight: "0.375rem" }}/>Repairs ({repairs.length})</Box>}/>
        </TabBar>

        <TabPanel value="quotations" sx={{ marginTop: "1rem" }}>
          {loading ? <Skeleton sx={{ height: "300px", width: "100%", borderRadius: "0.75rem" }}/> : (<Box sx={{ borderRadius: "1rem", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", overflow: "hidden" }}>
              <DataTable columnsCount={6} empty={quotations.length === 0} emptyMessage={"No pending quotations \uD83C\uDF89"}>
                <TableHead>
                  <TableRow>
                    <TableCell>Quotation</TableCell><TableCell>Customer</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Amount</TableCell><TableCell>Status</TableCell>
                    <TableCell>Age</TableCell><TableCell sx={{ textAlign: "right" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>{quotations.map(q => (<TableRow key={q.id} sx={{ "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                      <TableCell sx={{ fontWeight: "500" }}>{q.quotation_number}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{q.customers?.name || "—"}</Typography>
                          {q.customers?.phone && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{q.customers.phone}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ textAlign: "right", fontWeight: "600" }}>₹{(q.total || 0).toLocaleString("en-IN")}</TableCell>
                      <TableCell><StatusChip label={q.status} sx={statusColor(q.status)}/></TableCell>
                      <TableCell>{urgencyBadge(daysSince(q.created_at))}</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: "0.25rem" }}>
                          <IconButton onClick={() => navigate(`/sales/${q.id}`)} title="View" aria-label={"View"} sx={{ height: "1.75rem", width: "1.75rem" }}><Box component={Eye} sx={{ height: "0.875rem", width: "0.875rem" }}/></IconButton>
                          <IconButton onClick={() => openRecordSheet("quotation", q.id, q.quotation_number, q.customers?.name || "Unknown", q.customers?.phone || null)} title="Record Follow-Up" aria-label={"Record Follow-Up"} sx={{ height: "1.75rem", width: "1.75rem", color: "hsl(var(--primary))" }}>
                            <Box component={MessageSquarePlus} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                          </IconButton>
                          {q.customers?.phone && (<IconButton onClick={() => window.open(`tel:${q.customers!.phone}`)} title="Call" aria-label={"Call"} sx={{ height: "1.75rem", width: "1.75rem", color: "hsl(var(--success))" }}><Box component={Phone} sx={{ height: "0.875rem", width: "0.875rem" }}/></IconButton>)}
                        </Box>
                      </TableCell>
                    </TableRow>))}</TableBody>
              </DataTable>
            </Box>)}
        </TabPanel>

        <TabPanel value="repairs" sx={{ marginTop: "1rem" }}>
          {loading ? <Skeleton sx={{ height: "300px", width: "100%", borderRadius: "0.75rem" }}/> : (<Box sx={{ borderRadius: "1rem", borderWidth: "1px", borderColor: "hsl(var(--border))", backgroundColor: "hsl(var(--card))", overflow: "hidden" }}>
              <DataTable columnsCount={6} empty={repairs.length === 0} emptyMessage={"No active repairs \uD83C\uDF89"}>
                <TableHead>
                  <TableRow>
                    <TableCell>Job #</TableCell><TableCell>Customer</TableCell>
                    <TableCell>Problem</TableCell><TableCell>Status</TableCell>
                    <TableCell>Age</TableCell><TableCell sx={{ textAlign: "right" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>{repairs.map(r => (<TableRow key={r.id} sx={{ "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                      <TableCell sx={{ fontWeight: "500" }}>{r.job_number}</TableCell>
                      <TableCell>
                        <Box>
                          <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{r.customers?.name || "—"}</Typography>
                          {r.customers?.phone && <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{r.customers.phone}</Typography>}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "0.875rem", lineHeight: "1.25rem" }}>{r.problem_description}</TableCell>
                      <TableCell><StatusChip label={r.status.replace(/_/g, " ")} sx={statusColor(r.status)}/></TableCell>
                      <TableCell>{urgencyBadge(daysSince(r.created_at))}</TableCell>
                      <TableCell sx={{ textAlign: "right" }}>
                        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: "0.25rem" }}>
                          <IconButton onClick={() => navigate(`/repairs/${r.id}`)} title="View" aria-label={"View"} sx={{ height: "1.75rem", width: "1.75rem" }}><Box component={Eye} sx={{ height: "0.875rem", width: "0.875rem" }}/></IconButton>
                          <IconButton onClick={() => openRecordSheet("job_sheet", r.id, r.job_number, r.customers?.name || "Unknown", r.customers?.phone || null)} title="Record Follow-Up" aria-label={"Record Follow-Up"} sx={{ height: "1.75rem", width: "1.75rem", color: "hsl(var(--primary))" }}>
                            <Box component={MessageSquarePlus} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>))}</TableBody>
              </DataTable>
            </Box>)}
        </TabPanel>
      </TabView>

      {/* Follow-Up Recording Sheet */}
      <SideDrawer
        open={sheetOpen}
        busy={saving}
        onClose={() => setSheetOpen(false)}
        title={"Record Follow-Up"}
        width={500}
        footer={
          selectedEntity ? (
            <>
              <Button variant="outlined" onClick={() => setSheetOpen(false)} disabled={saving} sx={{ minHeight: 36 }}>
                Cancel
              </Button>
              <Button onClick={saveFollowUp} disabled={saving} variant="contained" sx={{ minHeight: 36 }}>
                {saving ? "Saving..." : "Save Follow-Up"}
              </Button>
            </>
          ) : undefined
        }
      >


          {selectedEntity && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
              {/* Entity info header */}
              <Box sx={{ padding: "1rem", borderRadius: "0.75rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)", borderWidth: "1px", borderColor: "hsl(var(--border))" }}>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>{selectedEntity.customer}</Typography>
                <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", marginTop: "0.125rem" }}>{selectedEntity.type === "quotation" ? "Quotation" : "Job Sheet"}: {selectedEntity.label}</Typography>
                {selectedEntity.phone && (<Button onClick={() => window.open(`tel:${selectedEntity.phone}`)} variant="text" size="small" sx={{ marginTop: "0.5rem", height: "1.75rem", fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--success))" }}>
                    <Box component={Phone} sx={{ height: "0.75rem", width: "0.75rem", marginRight: "0.25rem" }}/>Call {selectedEntity.phone}
                  </Button>)}
              </Box>

              {/* Outcome selector */}
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                <FormLabel sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>Outcome</FormLabel>
                <RadioGroup value={outcome} onChange={event => setOutcome(event.target.value)} sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", gap: "0.5rem" }}>
                  {OUTCOMES.map(o => (<FormLabel key={o.value} sx={mergeSx({ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem", borderRadius: "0.75rem", borderWidth: "1px", borderColor: "hsl(var(--border))", cursor: "pointer", transitionProperty: "all", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 50%, transparent)" } }, outcome === o.value && { borderColor: "hsl(var(--primary))", backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 5%, transparent)" })}>
                      <Radio value={o.value}/>
                      <Box component={o.icon} sx={mergeSx({ height: "1rem", width: "1rem" }, o.color)}/>
                      <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500" }}>{o.label}</Box>
                    </FormLabel>))}
                </RadioGroup>
              </Box>

              {/* Notes */}
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>

                <TextField placeholder="What was discussed? Any key takeaways..." value={note} onChange={e => setNote(e.target.value)} label={"Notes"} size="small" fullWidth multiline sx={{ minHeight: "100px", borderRadius: "0.75rem" }}/>
              </Box>

              {/* Next follow-up date */}
              <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.5rem" } }}>
                <FormLabel sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600" }}>Next Follow-Up Date</FormLabel>
                <DatePicker selected={nextDate} onSelect={setNextDate} disabled={(date) => date < new Date()}/>
              </Box>

              {/* History Timeline */}
              {historyLoading ? (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}><Skeleton sx={{ height: "4rem", width: "100%", borderRadius: "0.75rem" }}/><Skeleton sx={{ height: "4rem", width: "100%", borderRadius: "0.75rem" }}/></Box>) : history.length > 0 && (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", color: "hsl(var(--foreground))" }}>Previous Follow-Ups</Typography>
                  <Box sx={{ position: "relative", paddingLeft: "1.5rem", "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" } }}>
                    <Box sx={{ position: "absolute", left: "0.5rem", top: "0.5rem", bottom: "0.5rem", width: "1px", backgroundColor: "hsl(var(--border))" }}/>
                    {history.map(h => {
                    const outcomeData = OUTCOMES.find(o => o.value === h.outcome);
                    return (<Box key={h.id} sx={{ position: "relative" }}>
                          <Box sx={{ position: "absolute", left: "-18px", top: "0.25rem", height: "0.75rem", width: "0.75rem", borderRadius: "9999px", backgroundColor: "hsl(var(--muted))", borderWidth: "2px", borderColor: "hsl(var(--border))" }}/>
                          <Box sx={{ padding: "0.75rem", borderRadius: "0.75rem", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", borderWidth: "1px", borderColor: "hsl(var(--border))" }}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                              {outcomeData && (<Box component="span" sx={mergeSx({ fontSize: "11px", fontWeight: "500", display: "flex", alignItems: "center", gap: "0.25rem" }, outcomeData.color)}>
                                  <Box component={outcomeData.icon} sx={{ height: "0.75rem", width: "0.75rem" }}/>{outcomeData.label}
                                </Box>)}
                              <Box component="span" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }}>{format(new Date(h.created_at), "dd MMM yyyy, HH:mm")}</Box>
                            </Box>
                            <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--foreground))" }}>{h.note}</Typography>
                            {h.next_follow_up_date && (<Typography component="p" variant="body1" sx={{ fontSize: "11px", color: "hsl(var(--muted-foreground))", marginTop: "0.25rem", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <Box component={CalendarIcon} sx={{ height: "0.75rem", width: "0.75rem" }}/>Next: {format(new Date(h.next_follow_up_date), "dd MMM yyyy")}
                              </Typography>)}
                          </Box>
                        </Box>);
                })}
                  </Box>
                </Box>)}
            </Box>)}
        </SideDrawer>
    </Box></AnimatedPage>;
}
