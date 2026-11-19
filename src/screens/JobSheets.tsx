"use client";

import { Box, Button, Card, IconButton, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { ActionMenu, AnimatedPage, DataTable, PageHeader, SearchToolbar, StatCard, StatusChip, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, ClipboardList, Eye, Clock, CheckCircle, AlertTriangle, Loader2, MoreHorizontal, Wrench, IndianRupee, FileText, CreditCard, TrendingUp, Activity, } from "lucide-react";
import { format } from "date-fns";
const JOB_STATUSES = [
    "all", "created", "pending_approval", "approved", "assigned",
    "in_progress", "waiting_parts", "repair_completed", "quality_check",
    "invoice_generated", "delivered",
] as const;
const STATUS_LABELS: Record<string, string> = {
    all: "All Jobs",
    created: "Created",
    pending_approval: "Pending Approval",
    approved: "Approved",
    assigned: "Assigned",
    in_progress: "In Progress",
    waiting_parts: "Waiting Parts",
    repair_completed: "Completed",
    quality_check: "QC",
    invoice_generated: "Invoiced",
    delivered: "Delivered",
};
const STATUS_STYLES = {
    created: { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 60%, transparent)", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" },
    pending_approval: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))", borderColor: "color-mix(in srgb, hsl(var(--warning)) 20%, transparent)" },
    approved: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))", borderColor: "color-mix(in srgb, hsl(var(--info)) 20%, transparent)" },
    rejected: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))", borderColor: "color-mix(in srgb, hsl(var(--destructive)) 20%, transparent)" },
    assigned: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)", color: "hsl(var(--primary))", borderColor: "color-mix(in srgb, hsl(var(--primary)) 20%, transparent)" },
    in_progress: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)", color: "hsl(var(--accent))", borderColor: "color-mix(in srgb, hsl(var(--accent)) 20%, transparent)" },
    waiting_parts: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))", borderColor: "color-mix(in srgb, hsl(var(--warning)) 20%, transparent)" },
    repair_completed: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 20%, transparent)" },
    quality_check: { backgroundColor: "color-mix(in srgb, hsl(var(--info)) 10%, transparent)", color: "hsl(var(--info))", borderColor: "color-mix(in srgb, hsl(var(--info)) 20%, transparent)" },
    invoice_generated: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))", borderColor: "color-mix(in srgb, hsl(var(--success)) 20%, transparent)" },
    delivered: { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 60%, transparent)", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" },
};
const PAYMENT_STYLES = {
    paid: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)", color: "hsl(var(--success))" },
    partial: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))" },
    unpaid: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))" },
};
const PRIORITY_STYLES = {
    urgent: { backgroundColor: "color-mix(in srgb, hsl(var(--destructive)) 10%, transparent)", color: "hsl(var(--destructive))", borderColor: "color-mix(in srgb, hsl(var(--destructive)) 20%, transparent)" },
    high: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)", color: "hsl(var(--warning))", borderColor: "color-mix(in srgb, hsl(var(--warning)) 20%, transparent)" },
    normal: { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 60%, transparent)", color: "hsl(var(--muted-foreground))", borderColor: "hsl(var(--border))" },
    low: { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 40%, transparent)", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 70%, transparent)", borderColor: "color-mix(in srgb, hsl(var(--border)) 50%, transparent)" },
};
interface JobSheet {
    id: string;
    job_number: string;
    device_brand: string;
    device_type: string;
    device_model: string | null;
    status: string;
    priority: string;
    payment_status: string | null;
    service_charge: number | null;
    total_amount: number | null;
    created_at: string;
    customers?: {
        name: string;
    } | null;
}
function fmt(n: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
export default function JobSheets() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState<JobSheet[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    const fetchJobs = async () => {
        setLoading(true);
        let query = supabase
            .from("job_sheets")
            .select("id, job_number, device_brand, device_type, device_model, status, priority, payment_status, service_charge, total_amount, created_at, customers(name)")
            .order("created_at", { ascending: false });
        if (statusFilter !== "all")
            query = query.eq("status", statusFilter as any);
        if (search)
            query = query.or(`job_number.ilike.%${search}%,device_brand.ilike.%${search}%,device_model.ilike.%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setJobs((data as any) || []);
        setLoading(false);
    };
    useEffect(() => { fetchJobs(); }, [search, statusFilter]);
    // KPI calculations
    const totalJobs = jobs.length;
    const pendingApproval = jobs.filter(j => j.status === "pending_approval").length;
    const inProgress = jobs.filter(j => ["assigned", "in_progress", "waiting_parts"].includes(j.status)).length;
    const repairRevenue = jobs.filter(j => j.payment_status === "paid").reduce((s, j) => s + (j.total_amount || 0), 0);
    const kpis = [
        { label: "Total Jobs", value: totalJobs, icon: ClipboardList, color: { color: "hsl(var(--primary))" }, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--primary)) 10%, transparent)" }, trend: null },
        { label: "Pending Approval", value: pendingApproval, icon: Clock, color: { color: "hsl(var(--warning))" }, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--warning)) 10%, transparent)" }, trend: null },
        { label: "In Progress", value: inProgress, icon: Activity, color: { color: "hsl(var(--accent))" }, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--accent)) 10%, transparent)" }, trend: null },
        { label: "Repair Revenue", value: fmt(repairRevenue), icon: IndianRupee, color: { color: "hsl(var(--success))" }, bg: { backgroundColor: "color-mix(in srgb, hsl(var(--success)) 10%, transparent)" }, trend: null },
    ];
    const getCustomerInitials = (name: string | undefined) => {
        if (!name)
            return "?";
        return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    };
    return <AnimatedPage><Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1.5rem" } }}>
      {/* Header */}
      <PageHeader title={"Repair Management"} subtitle={"Manage all job sheets, repairs, and service workflows"} actions={<><Button onClick={() => navigate("/repairs/new")} variant="contained" sx={{ gap: "0.5rem", "--alv-shadow": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "--alv-shadow-colored": "0 1px 2px 0 var(--alv-shadow-color)", boxShadow: "var(--alv-ring-offset-shadow, 0 0 #0000), var(--alv-ring-shadow, 0 0 #0000), var(--alv-shadow)" }}>
          <Box component={Plus} sx={{ height: "1rem", width: "1rem" }}/> New Job Sheet
        </Button></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", "@media (min-width: 1024px)": { gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }, gap: "1rem" }}>
        {kpis.map((kpi) => (<StatCard label={kpi.label} value={kpi.value} icon={<Box component={kpi.icon} sx={mergeSx({ height: "1.25rem", width: "1.25rem" }, kpi.color)}/>} key={kpi.label} sx={{ "--alv-shadow-color": "hsl(var(--card))", "--alv-shadow": "var(--alv-shadow-colored)", borderColor: "color-mix(in srgb, hsl(var(--border)) 60%, transparent)", "&:hover": { boxShadow: "var(--shadow-md)" }, transitionProperty: "box-shadow", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}/>))}
      </Box>

      {/* Filters */}
      <Box sx={{ display: "flex", flexDirection: "column", "@media (min-width: 640px)": { flexDirection: "row", alignItems: "center" }, gap: "0.75rem", alignItems: "flex-start" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search job #, brand, model..." sx={{ flex: "1 1 0%", maxWidth: "20rem" }}/>
        <TextField value={statusFilter} select size="small" fullWidth onChange={event => setStatusFilter(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} sx={{ width: "180px", height: "2.25rem", fontSize: "0.875rem", lineHeight: "1.25rem", borderColor: "color-mix(in srgb, hsl(var(--border)) 60%, transparent)" }}>
            {JOB_STATUSES.map(s => (<MenuItem key={s} value={s} sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                {STATUS_LABELS[s] || s}
              </MenuItem>))}
          </TextField>
      </Box>

      {/* Table */}
      <Card sx={{ "--alv-shadow-color": "hsl(var(--card))", "--alv-shadow": "var(--alv-shadow-colored)", borderColor: "color-mix(in srgb, hsl(var(--border)) 60%, transparent)", overflow: "hidden" }}>
        <DataTable columnsCount={10} loading={loading} empty={jobs.length === 0} emptyMessage={<>
                  <Box component={Wrench} sx={{ height: "2.5rem", width: "2.5rem", marginLeft: "auto", marginRight: "auto", marginBottom: "0.75rem", color: "color-mix(in srgb, hsl(var(--muted-foreground)) 25%, transparent)" }}/>
                  <Typography component="p" variant="body1" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", color: "hsl(var(--muted-foreground))" }}>No job sheets found</Typography>
                  <Button onClick={() => navigate("/repairs/new")} variant="text" size="small" sx={{ marginTop: "0.5rem", color: "hsl(var(--primary))" }}>
                    Create your first job sheet
                  </Button>
                </>}>
          <TableHead>
            <TableRow sx={{ backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" } }}>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Job #</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Customer</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Device</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>Category</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>Service</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Total</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))" }}>Status</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>Payment</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "hsl(var(--muted-foreground))", display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>Date</TableCell>
              <TableCell sx={{ width: "2.5rem" }}/>
            </TableRow>
          </TableHead>
          <TableBody>{jobs.map(j => (<TableRow key={j.id} onClick={() => navigate(`/repairs/${j.id}`)} data-ui-group sx={{ cursor: "pointer", "&:hover": { backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 30%, transparent)" }, transitionProperty: "color, background-color, border-color, text-decoration-color, fill, stroke", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                <TableCell>
                  <Box component="span" sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: "13px", fontWeight: "600", color: "hsl(var(--primary))" }}>{j.job_number}</Box>
                </TableCell>

                {/* Customer */}
                <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Box sx={{ height: "1.75rem", width: "1.75rem", borderRadius: "9999px", backgroundImage: "linear-gradient(to bottom right, var(--alv-gradient-stops))", "--alv-gradient-from": "color-mix(in srgb, hsl(var(--primary)) 30%, transparent) var(--alv-gradient-from-position)", "--alv-gradient-to": "color-mix(in srgb, hsl(var(--accent)) 30%, transparent) var(--alv-gradient-to-position)", "--alv-gradient-stops": "var(--alv-gradient-from), var(--alv-gradient-to)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "700", color: "hsl(var(--foreground))", flexShrink: "0" }}>
                      {getCustomerInitials(j.customers?.name)}
                    </Box>
                    <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100px" }}>{j.customers?.name || "—"}</Box>
                  </Box>
                </TableCell>

                {/* Device */}
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>
                  <Box sx={{ fontSize: "0.875rem", lineHeight: "1.25rem" }}>
                    <Box component="span" sx={{ fontWeight: "500" }}>{j.device_brand}</Box>
                    {j.device_model && <Box component="span" sx={{ color: "hsl(var(--muted-foreground))" }}> {j.device_model}</Box>}
                  </Box>
                </TableCell>

                {/* Category */}
                <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "0.75rem", lineHeight: "1rem", color: "hsl(var(--muted-foreground))" }}>{j.device_type}</Box>
                </TableCell>

                {/* Service Charge */}
                <TableCell sx={{ display: "none", "@media (min-width: 1024px)": { display: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "500", "--alv-numeric-spacing": "tabular-nums", fontVariantNumeric: "var(--alv-ordinal) var(--alv-slashed-zero) var(--alv-numeric-figure) var(--alv-numeric-spacing) var(--alv-numeric-fraction)" }}>
                    {j.service_charge ? fmt(j.service_charge) : "—"}
                  </Box>
                </TableCell>

                {/* Total */}
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "0.875rem", lineHeight: "1.25rem", fontWeight: "600", "--alv-numeric-spacing": "tabular-nums", fontVariantNumeric: "var(--alv-ordinal) var(--alv-slashed-zero) var(--alv-numeric-figure) var(--alv-numeric-spacing) var(--alv-numeric-fraction)" }}>
                    {j.total_amount ? fmt(j.total_amount) : "—"}
                  </Box>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusChip label={j.status.replace(/_/g, " ")} variant="outlined" sx={mergeSx({ fontSize: "10px", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderWidth: "1px", fontWeight: "600", textTransform: "capitalize" }, STATUS_STYLES[j.status] || {})}/>
                </TableCell>

                {/* Payment */}
                <TableCell sx={{ display: "none", "@media (min-width: 640px)": { display: "table-cell" } }}>
                  <Box component="span" sx={mergeSx({ fontSize: "10px", fontWeight: "600", paddingLeft: "0.5rem", paddingRight: "0.5rem", paddingTop: "0.125rem", paddingBottom: "0.125rem", borderRadius: "9999px", textTransform: "capitalize" }, PAYMENT_STYLES[j.payment_status || "unpaid"] || {})}>
                    {j.payment_status || "unpaid"}
                  </Box>
                </TableCell>

                {/* Date */}
                <TableCell sx={{ display: "none", "@media (min-width: 768px)": { display: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>{format(new Date(j.created_at), "dd MMM yy")}</Box>
                </TableCell>

                {/* Actions */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <ActionMenu trigger={<IconButton aria-label={"More Horizontal"} sx={{ height: "1.75rem", width: "1.75rem", opacity: "0", "[data-ui-group]:hover &": { opacity: "1" }, transitionProperty: "opacity", transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)", transitionDuration: "150ms" }}>
                        <Box component={MoreHorizontal} sx={{ height: "0.875rem", width: "0.875rem" }}/>
                      </IconButton>}>
                      <MenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <Box component={Eye} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> View Detail
                      </MenuItem>
                      <MenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <Box component={FileText} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> Generate Invoice
                      </MenuItem>
                      <MenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <Box component={CreditCard} sx={{ height: "0.875rem", width: "0.875rem", marginRight: "0.5rem" }}/> Add Payment
                      </MenuItem>
                    </ActionMenu>
                </TableCell>
              </TableRow>))}</TableBody>
        </DataTable>

        {/* Footer count */}
        {jobs.length > 0 && (<Box sx={{ paddingLeft: "1rem", paddingRight: "1rem", paddingTop: "0.625rem", paddingBottom: "0.625rem", borderTopWidth: "1px", borderColor: "color-mix(in srgb, hsl(var(--border)) 60%, transparent)", backgroundColor: "color-mix(in srgb, hsl(var(--muted)) 20%, transparent)" }}>
            <Typography component="p" variant="body1" sx={{ fontSize: "12px", color: "hsl(var(--muted-foreground))" }}>
              Showing <Box component="span" sx={{ fontWeight: "500", color: "hsl(var(--foreground))" }}>{jobs.length}</Box> job sheets
              {statusFilter !== "all" && ` • ${STATUS_LABELS[statusFilter]}`}
            </Typography>
          </Box>)}
      </Card>
    </Box></AnimatedPage>;
}
