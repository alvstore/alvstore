"use client";

import { Box, Button, Card, CardContent, IconButton, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { AnimatedPage, DataTable, PageHeader, StatCard, StatusChip, TabBar, TabPanel, TabView, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Wrench, Clock, CheckCircle, Eye, User, Users, AlertTriangle, IndianRupee, BookOpen } from "lucide-react";
import { differenceInDays, differenceInHours, parseISO } from "date-fns";
const JOB_STATUSES = ["assigned", "in_progress", "waiting_parts", "repair_completed"] as const;
const statusColors = {
    assigned: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))" },
    in_progress: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))" },
    waiting_parts: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    repair_completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
    quality_check: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent-foreground))" },
    delivered: { backgroundColor: "hsl(var(--muted))", color: "hsl(var(--muted-foreground))" },
};
interface JobSheet {
    id: string;
    job_number: string;
    device_brand: string;
    device_model: string | null;
    problem_description: string;
    status: string;
    priority: string;
    created_at: string;
    estimated_completion: string | null;
    customers?: {
        name: string;
    } | null;
}
function getTTR(estimated: string | null) {
    if (!estimated)
        return null;
    const target = parseISO(estimated);
    const now = new Date();
    const diffDays = differenceInDays(target, now);
    const diffHours = differenceInHours(target, now);
    if (diffDays < 0)
        return { label: `${Math.abs(diffDays)}d overdue`, color: { color: "hsl(var(--destructive))" }, urgent: true };
    if (diffDays === 0)
        return { label: `${Math.max(0, diffHours)}h left`, color: { color: "hsl(var(--warning))" }, urgent: true };
    return { label: `${diffDays}d left`, color: { color: "hsl(var(--success))" }, urgent: false };
}
export default function TechnicianDashboard() {
    const { user, hasRole } = useAuth();
    const isAdminOrStaff = hasRole("admin") || hasRole("staff");
    const isTechnician = hasRole("technician");
    if (isAdminOrStaff && !isTechnician) {
        return <AnimatedPage><TechnicianOverviewView /></AnimatedPage>;
    }
    return <AnimatedPage><MyRepairsView /></AnimatedPage>;
}
function TechnicianOverviewView() {
    const navigate = useNavigate();
    const [technicians, setTechnicians] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
            if (!roles || roles.length === 0) {
                setTechnicians([]);
                setLoading(false);
                return;
            }
            const techIds = roles.map(r => r.user_id);
            const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", techIds);
            const { data: jobs } = await supabase.from("job_sheets").select("assigned_technician_id, status").in("assigned_technician_id", techIds);
            const mapped = (profiles || []).map(p => {
                const techJobs = (jobs || []).filter(j => j.assigned_technician_id === p.user_id);
                return {
                    user_id: p.user_id, full_name: p.full_name, phone: p.phone,
                    active_jobs: techJobs.filter(j => !["repair_completed", "delivered", "quality_check"].includes(j.status)).length,
                    completed_jobs: techJobs.filter(j => ["repair_completed", "quality_check", "delivered"].includes(j.status)).length,
                };
            });
            setTechnicians(mapped);
            setLoading(false);
        };
        fetch();
    }, []);
    const totalActive = technicians.reduce((s, t) => s + t.active_jobs, 0);
    const totalCompleted = technicians.reduce((s, t) => s + t.completed_jobs, 0);
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"Technician Overview"} subtitle={"Workload summary for all technicians"}/>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Technicians"} value={technicians.length} icon={<Box component={Users} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Active Jobs"} value={totalActive} icon={<Box component={Wrench} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--warning))" }}/>} accent="warning"/>
        <StatCard label={"Completed"} value={totalCompleted} icon={<Box component={CheckCircle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
      </Box>
      {loading ? <Typography component="p" variant="body1" sx={{ textAlign: "center", color: "hsl(var(--muted-foreground))", paddingTop: "3rem", paddingBottom: "3rem" }}>Loading...</Typography> : technicians.length === 0 ? (<Box sx={{ textAlign: "center", paddingTop: "3rem", paddingBottom: "3rem", color: "hsl(var(--muted-foreground))" }}><Box component={Users} sx={{ height: "3rem", width: "3rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.3" }}/><Typography component="p" variant="body1">No technicians found.</Typography></Box>) : (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
          {technicians.map(t => (<Card key={t.user_id} onClick={() => navigate(`/repairs?technician=${t.user_id}`)} sx={{ cursor: "pointer", "&:hover": { "--alv-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 4px 6px -1px var(--alv-shadow-color), 0 2px 4px -2px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
              <CardContent sx={{ padding: "1.25rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <Box sx={{ padding: "0.75rem", borderRadius: "9999px", backgroundColor: "hsl(var(--muted))" }}><Box component={User} sx={{ height: "1.5rem", width: "1.5rem", color: "hsl(var(--muted-foreground))" }}/></Box>
                <Box sx={{ flex: "1 1 0%", minWidth: "0px" }}><Typography component="p" variant="body1" sx={{ fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.full_name || "Unnamed"}</Typography><Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>{t.phone || "No phone"}</Typography></Box>
                <Box sx={{ textAlign: "right", fontSize: "0.875rem", lineHeight: "1.25rem" }}><Typography component="p" variant="body1" sx={{ fontWeight: "600", color: "hsl(var(--primary))" }}>{t.active_jobs} active</Typography><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>{t.completed_jobs} done</Typography></Box>
              </CardContent>
            </Card>))}
        </Box>)}
    </Box>);
}
function MyRepairsView() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [jobs, setJobs] = useState<JobSheet[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState("repairs");
    const fetchJobs = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from("job_sheets")
            .select("id, job_number, device_brand, device_model, problem_description, status, priority, created_at, estimated_completion, customers(name)")
            .eq("assigned_technician_id", user?.id || "")
            .not("status", "eq", "delivered")
            .order("created_at", { ascending: false });
        if (error)
            toast.error(error.message);
        else
            setJobs((data as any) || []);
        setLoading(false);
    };
    const fetchPayments = async () => {
        const { data } = await supabase.from("technician_payments").select("*")
            .eq("technician_id", user?.id || "")
            .order("created_at", { ascending: false });
        setPayments(data || []);
    };
    useEffect(() => { if (user) {
        fetchJobs();
        fetchPayments();
    } }, [user]);
    const updateStatus = async (jobId: string, newStatus: string) => {
        const { error } = await supabase.from("job_sheets").update({ status: newStatus as any }).eq("id", jobId);
        if (error)
            toast.error(error.message);
        else {
            toast.success("Status updated");
            fetchJobs();
        }
    };
    const active = jobs.filter(j => !["repair_completed", "delivered", "quality_check"].includes(j.status));
    const completed = jobs.filter(j => ["repair_completed", "quality_check"].includes(j.status));
    const totalEarned = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
    const totalUnpaid = payments.filter(p => p.status === "unpaid").reduce((s, p) => s + (p.amount || 0), 0);
    return (<Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      <PageHeader title={"My Workspace"} subtitle={"Your repairs and payment ledger"}/>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        <StatCard label={"Active"} value={active.length} icon={<Box component={Wrench} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--primary))" }}/>} accent="primary"/>
        <StatCard label={"Completed"} value={completed.length} icon={<Box component={CheckCircle} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--success))" }}/>} accent="success"/>
        <StatCard label={"Received"} value={totalPaid} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={IndianRupee} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--info))" }}/>} accent="info"/>
        <StatCard label={"Pending"} value={totalUnpaid} formatter={amount => "\u20B9" + amount.toLocaleString()} icon={<Box component={IndianRupee} sx={{ height: "1.25rem", width: "1.25rem", color: "hsl(var(--destructive))" }}/>} accent="error"/>
      </Box>

      <TabView value={tab} onChange={setTab}>
        <TabBar>
          <Tab value="repairs" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={Wrench} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>My Repairs</Box>}/>
          <Tab value="ledger" label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Box component={BookOpen} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.375rem" }}/>Payment Ledger</Box>}/>
        </TabBar>

        <TabPanel value="repairs">
          {loading ? (<Box sx={{ textAlign: "center", paddingTop: "3rem", paddingBottom: "3rem", color: "hsl(var(--muted-foreground))" }}>Loading...</Box>) : jobs.length === 0 ? (<Box sx={{ textAlign: "center", paddingTop: "3rem", paddingBottom: "3rem", color: "hsl(var(--muted-foreground))" }}><Box component={Wrench} sx={{ height: "3rem", width: "3rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", opacity: "0.3" }}/><Typography component="p" variant="body1">No jobs assigned to you</Typography></Box>) : (<Box sx={{ display: "grid", gridTemplateColumns: "repeat(1, minmax(0, 1fr))", "@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }, "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }, gap: "1rem" }}>
              {jobs.map(j => {
                const ttr = getTTR(j.estimated_completion);
                return (<Card key={j.id} sx={mergeSx({ "&:hover": { "--alv-shadow": "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)", "--alv-shadow-colored": "0 4px 6px -1px var(--alv-shadow-color), 0 2px 4px -2px var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }, ttr?.urgent ? { borderLeftWidth: "4px", borderLeftColor: "hsl(var(--destructive))" } : {})}>
                    <Box sx={mergeSx({ padding: "1.5rem", paddingBottom: "0.75rem" }, { paddingBottom: "0.5rem" })}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <Typography variant="h6" component="h3" sx={mergeSx({ fontSize: "1rem", fontWeight: 650 }, { fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "700" })}>{j.job_number}</Typography>
                        <StatusChip label={j.status.replace(/_/g, " ")} variant="filled" sx={statusColors[j.status] || {}}/>
                      </Box>
                    </Box>
                    <CardContent sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.75rem" } }}>
                      <Box sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}><Typography component="p" variant="body1" sx={{ fontWeight: "500" }}>{j.customers?.name}</Typography><Typography component="p" variant="body1" sx={{ color: "hsl(var(--muted-foreground))" }}>{[j.device_brand, j.device_model].filter(Boolean).join(" ")}</Typography></Box>
                      <Typography component="p" variant="body1" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))", overflow: "hidden", display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: "2" }}>{j.problem_description}</Typography>
                      {ttr && <Box sx={mergeSx({ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", lineHeight: "1rem", fontWeight: "500" }, ttr.color)}>{ttr.urgent ? <Box component={AlertTriangle} sx={{ height: "0.875rem", width: "0.875rem" }}/> : <Box component={Clock} sx={{ height: "0.875rem", width: "0.875rem" }}/>}{ttr.label}</Box>}
                      <Box sx={{ display: "flex", gap: "0.5rem" }}>
                        <TextField value={j.status} select size="small" fullWidth onChange={event => (v => updateStatus(j.id, v))(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ height: "2rem", fontSize: "0.75rem", lineHeight: "1rem", flex: "1 1 0%" }}>{JOB_STATUSES.map(s => <MenuItem key={s} value={s} sx={{ textTransform: "capitalize", fontSize: "0.75rem", lineHeight: "1rem" }}>{s.replace(/_/g, " ")}</MenuItem>)}</TextField>
                        <IconButton onClick={() => navigate(`/repairs/${j.id}`)} aria-label={"Eye"} sx={{ height: "2rem", width: "2rem" }}><Box component={Eye} sx={{ height: "0.875rem", width: "0.875rem" }}/></IconButton>
                      </Box>
                    </CardContent>
                  </Card>);
            })}
            </Box>)}
        </TabPanel>

        <TabPanel value="ledger">
          <Card>
            <CardContent sx={{ padding: "0px" }}>
              <DataTable columnsCount={5} empty={payments.length === 0} emptyMessage={"No payment records yet"}>
                <TableHead><TableRow>
                  <TableCell>Date</TableCell><TableCell>Amount</TableCell><TableCell>Mode</TableCell>
                  <TableCell>Notes</TableCell><TableCell>Status</TableCell>
                </TableRow></TableHead>
                <TableBody>{payments.map(p => (<TableRow key={p.id}>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontWeight: "500" }}>₹{(p.amount || 0).toLocaleString()}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", textTransform: "capitalize" }}>{p.payment_mode || "—"}</TableCell>
                      <TableCell sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.notes || "—"}</TableCell>
                      <TableCell><StatusChip label={p.status}/></TableCell>
                    </TableRow>))}</TableBody>
              </DataTable>
            </CardContent>
          </Card>
        </TabPanel>
      </TabView>
    </Box>);
}
