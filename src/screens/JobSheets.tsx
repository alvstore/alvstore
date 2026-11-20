"use client";

import { Avatar, Box, Button, Card, IconButton, MenuItem, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ActionMenu, AnimatedPage, DataTable, DistributionWidget, PageHeader, ProgressRing, SearchToolbar, StatCard, StatusChip, WidgetCard, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, ClipboardList, Eye, Clock, CheckCircle, AlertTriangle, Loader2, MoreHorizontal, Wrench, IndianRupee, FileText, CreditCard, TrendingUp, Activity, } from "lucide-react";
import { format } from "date-fns";
import { completionPercent } from "@/lib/widget-data";
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
    const completedJobs = jobs.filter(j => ["repair_completed", "quality_check", "invoice_generated", "delivered"].includes(j.status)).length;
    const resolutionRate = completionPercent(completedJobs, totalJobs);
    const repairRevenue = jobs.filter(j => j.payment_status === "paid").reduce((s, j) => s + (j.total_amount || 0), 0);

    const statusDistribution = Object.entries(jobs.reduce((acc, j) => {
        const label = STATUS_LABELS[j.status] || j.status.replace(/_/g, " ");
        acc[label] = (acc[label] || 0) + 1;
        return acc;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    return <AnimatedPage><Box sx={{ display: "grid", gap: 3 }}>
      {/* Header */}
      <PageHeader title={"Repair Management"} subtitle={"Manage all job sheets, repairs, and service workflows"} actions={<><Button onClick={() => navigate("/repairs/new")} variant="contained" startIcon={<Box component={Plus} sx={{ height: "1rem", width: "1rem" }} />}>New Job Sheet</Button></>}/>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard label="Total Jobs" value={totalJobs} icon={<Box component={ClipboardList} sx={{ height: 20, width: 20 }} />} accent="primary" loading={loading} />
        <StatCard label="Pending Approval" value={pendingApproval} icon={<Box component={Clock} sx={{ height: 20, width: 20 }} />} accent="warning" loading={loading} />
        <StatCard label="In Progress" value={inProgress} icon={<Box component={Activity} sx={{ height: 20, width: 20 }} />} accent="info" loading={loading} />
        <StatCard label="Repair Revenue" value={repairRevenue} formatter={fmt} icon={<Box component={IndianRupee} sx={{ height: 20, width: 20 }} />} accent="success" loading={loading} />
      </Box>

      {/* Widgets: Completion rate + Status distribution */}
      {jobs.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.8fr" }, gap: 2.5 }}>
          <WidgetCard title="Repair resolution" subtitle="Overall progress on recorded jobs" eyebrow="SERVICE VELOCITY" featured>
            <Box sx={{ py: 1 }}>
              <ProgressRing value={resolutionRate} label="Repair resolution rate" caption={`${completedJobs} of ${totalJobs} jobs repaired`} size={130} />
              <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">In progress: <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>{inProgress}</Box></Typography>
                <Typography variant="caption" color="text.secondary">Resolved: <Box component="span" sx={{ fontWeight: 600, color: "success.main" }}>{completedJobs}</Box></Typography>
              </Box>
            </Box>
          </WidgetCard>
          <DistributionWidget
            title="Repair pipeline distribution"
            subtitle="Current stage of all open and completed service jobs."
            items={statusDistribution}
            loading={loading}
            formatter={val => `${val} jobs`}
          />
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, alignItems: "flex-start" }}>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search job #, brand, model..." sx={{ flex: 1, maxWidth: "24rem" }}/>
        <TextField value={statusFilter} select size="small" onChange={event => setStatusFilter(event.target.value)} slotProps={{ select: { displayEmpty: true } }} sx={{ width: 180 }}>
          {JOB_STATUSES.map(s => (
            <MenuItem key={s} value={s} sx={{ fontSize: "0.875rem" }}>
              {STATUS_LABELS[s] || s}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Table */}
      <Card sx={theme => ({ borderRadius: "16px", border: `1px solid ${theme.palette.divider}`, overflow: "hidden" })}>
        <DataTable columnsCount={10} loading={loading} empty={jobs.length === 0} emptyMessage={<>
                  <Box component={Wrench} sx={{ height: "2.5rem", width: "2.5rem", mx: "auto", mb: 1, opacity: 0.25 }}/>
                  <Typography variant="body2" color="text.secondary">No job sheets found</Typography>
                  <Button onClick={() => navigate("/repairs/new")} variant="text" size="small" sx={{ mt: 1 }}>
                    Create your first job sheet
                  </Button>
                </>}>
          <TableHead>
            <TableRow sx={theme => ({ bgcolor: alpha(theme.palette.text.primary, 0.03) })}>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Job #</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: { xs: "none", sm: "table-cell" } }}>Customer</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: { xs: "none", md: "table-cell" } }}>Device</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: { xs: "none", lg: "table-cell" } }}>Category</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: { xs: "none", lg: "table-cell" } }}>Service</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: { xs: "none", md: "table-cell" } }}>Total</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Status</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: { xs: "none", sm: "table-cell" } }}>Payment</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", display: { xs: "none", md: "table-cell" } }}>Date</TableCell>
              <TableCell sx={{ width: "2.5rem" }}/>
            </TableRow>
          </TableHead>
          <TableBody>{jobs.map(j => (<TableRow key={j.id} onClick={() => navigate(`/repairs/${j.id}`)} data-ui-group sx={theme => ({ cursor: "pointer", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) }, transition: "background-color 160ms ease" })}>
                <TableCell>
                  <Box component="span" sx={{ fontFamily: "monospace", fontSize: "13px", fontWeight: "700", color: "primary.main" }}>{j.job_number}</Box>
                </TableCell>

                {/* Customer */}
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar sx={theme => ({ height: 26, width: 26, bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", fontSize: 10, fontWeight: 700 })}>
                      {String(j.customers?.name || "?").slice(0, 2).toUpperCase()}
                    </Avatar>
                    <Box component="span" sx={{ fontSize: "0.875rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{j.customers?.name || "—"}</Box>
                  </Box>
                </TableCell>

                {/* Device */}
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Box sx={{ fontSize: "0.875rem" }}>
                    <Box component="span" sx={{ fontWeight: "600" }}>{j.device_brand}</Box>
                    {j.device_model && <Box component="span" sx={{ color: "text.secondary" }}> {j.device_model}</Box>}
                  </Box>
                </TableCell>

                {/* Category */}
                <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>{j.device_type}</Box>
                </TableCell>

                {/* Service Charge */}
                <TableCell sx={{ display: { xs: "none", lg: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "0.875rem", fontWeight: "500", fontVariantNumeric: "tabular-nums" }}>
                    {j.service_charge ? fmt(j.service_charge) : "—"}
                  </Box>
                </TableCell>

                {/* Total */}
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "0.875rem", fontWeight: "650", fontVariantNumeric: "tabular-nums" }}>
                    {j.total_amount ? fmt(j.total_amount) : "—"}
                  </Box>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <StatusChip label={j.status.replace(/_/g, " ")} />
                </TableCell>

                {/* Payment */}
                <TableCell sx={{ display: { xs: "none", sm: "table-cell" } }}>
                  <StatusChip label={j.payment_status || "unpaid"} />
                </TableCell>

                {/* Date */}
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>
                  <Box component="span" sx={{ fontSize: "12px", color: "text.secondary" }}>{format(new Date(j.created_at), "dd MMM yy")}</Box>
                </TableCell>

                {/* Actions */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <ActionMenu trigger={<IconButton aria-label="More actions" size="small" sx={{ opacity: 0.6, "&:hover": { opacity: 1 } }}>
                        <Box component={MoreHorizontal} sx={{ height: 15, width: 15 }}/>
                      </IconButton>}>
                      <MenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <Box component={Eye} sx={{ height: 14, width: 14, marginRight: "0.5rem" }}/> View Detail
                      </MenuItem>
                      <MenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <Box component={FileText} sx={{ height: 14, width: 14, marginRight: "0.5rem" }}/> Generate Invoice
                      </MenuItem>
                      <MenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <Box component={CreditCard} sx={{ height: 14, width: 14, marginRight: "0.5rem" }}/> Add Payment
                      </MenuItem>
                    </ActionMenu>
                </TableCell>
              </TableRow>))}</TableBody>
        </DataTable>

        {/* Footer count */}
        {jobs.length > 0 && (<Box sx={theme => ({ px: 2, py: 1.25, borderTop: 1, borderColor: "divider", bgcolor: alpha(theme.palette.text.primary, 0.02) })}>
            <Typography variant="caption" color="text.secondary">
              Showing <Box component="span" sx={{ fontWeight: "600", color: "text.primary" }}>{jobs.length}</Box> job sheets
              {statusFilter !== "all" && ` • ${STATUS_LABELS[statusFilter] || statusFilter}`}
            </Typography>
          </Box>)}
      </Card>
    </Box></AnimatedPage>;
}
