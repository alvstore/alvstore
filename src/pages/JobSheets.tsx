import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, ClipboardList, Eye, Clock, CheckCircle, AlertTriangle,
  Loader2, MoreHorizontal, Wrench, IndianRupee, FileText, CreditCard,
  TrendingUp, Activity,
} from "lucide-react";
import { toast } from "sonner";
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

const STATUS_STYLES: Record<string, string> = {
  created: "bg-muted/60 text-muted-foreground border-border",
  pending_approval: "bg-warning/10 text-warning border-warning/20",
  approved: "bg-info/10 text-info border-info/20",
  rejected: "bg-destructive/10 text-destructive border-destructive/20",
  assigned: "bg-primary/10 text-primary border-primary/20",
  in_progress: "bg-accent/10 text-accent border-accent/20",
  waiting_parts: "bg-warning/10 text-warning border-warning/20",
  repair_completed: "bg-success/10 text-success border-success/20",
  quality_check: "bg-info/10 text-info border-info/20",
  invoice_generated: "bg-success/10 text-success border-success/20",
  delivered: "bg-muted/60 text-muted-foreground border-border",
};

const PAYMENT_STYLES: Record<string, string> = {
  paid: "bg-success/10 text-success",
  partial: "bg-warning/10 text-warning",
  unpaid: "bg-destructive/10 text-destructive",
};

const PRIORITY_STYLES: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
  high: "bg-warning/10 text-warning border-warning/20",
  normal: "bg-muted/60 text-muted-foreground border-border",
  low: "bg-muted/40 text-muted-foreground/70 border-border/50",
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
  customers?: { name: string } | null;
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

    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (search) query = query.or(`job_number.ilike.%${search}%,device_brand.ilike.%${search}%,device_model.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setJobs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, [search, statusFilter]);

  // KPI calculations
  const totalJobs = jobs.length;
  const pendingApproval = jobs.filter(j => j.status === "pending_approval").length;
  const inProgress = jobs.filter(j => ["assigned", "in_progress", "waiting_parts"].includes(j.status)).length;
  const repairRevenue = jobs.filter(j => j.payment_status === "paid").reduce((s, j) => s + (j.total_amount || 0), 0);

  const kpis = [
    { label: "Total Jobs", value: totalJobs, icon: ClipboardList, color: "text-primary", bg: "bg-primary/10", trend: null },
    { label: "Pending Approval", value: pendingApproval, icon: Clock, color: "text-warning", bg: "bg-warning/10", trend: null },
    { label: "In Progress", value: inProgress, icon: Activity, color: "text-accent", bg: "bg-accent/10", trend: null },
    { label: "Repair Revenue", value: fmt(repairRevenue), icon: IndianRupee, color: "text-success", bg: "bg-success/10", trend: null },
  ];

  const getCustomerInitials = (name: string | undefined) => {
    if (!name) return "?";
    return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Repair Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage all job sheets, repairs, and service workflows</p>
        </div>
        <Button onClick={() => navigate("/repairs/new")} className="gap-2 shadow-sm">
          <Plus className="h-4 w-4" /> New Job Sheet
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="shadow-card border-border/60 hover:shadow-elevated transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{kpi.value}</p>
                </div>
                <div className={`h-10 w-10 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search job #, brand, model..."
            className="pl-8 h-9 text-sm bg-background border-border/60"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm border-border/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JOB_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="text-sm">
                {STATUS_LABELS[s] || s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-card border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Job #</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Customer</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Device</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Category</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">Service</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Total</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Payment</TableHead>
              <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Date</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground/40" />
                </TableCell>
              </TableRow>
            ) : jobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-16">
                  <Wrench className="h-10 w-10 mx-auto mb-3 text-muted-foreground/25" />
                  <p className="text-sm text-muted-foreground">No job sheets found</p>
                  <Button variant="ghost" size="sm" className="mt-2 text-primary" onClick={() => navigate("/repairs/new")}>
                    Create your first job sheet
                  </Button>
                </TableCell>
              </TableRow>
            ) : jobs.map(j => (
              <TableRow
                key={j.id}
                className="group cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/repairs/${j.id}`)}
              >
                <TableCell>
                  <span className="font-mono text-[13px] font-semibold text-primary">{j.job_number}</span>
                </TableCell>

                {/* Customer */}
                <TableCell className="hidden sm:table-cell">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
                      {getCustomerInitials(j.customers?.name)}
                    </div>
                    <span className="text-sm font-medium truncate max-w-[100px]">{j.customers?.name || "—"}</span>
                  </div>
                </TableCell>

                {/* Device */}
                <TableCell className="hidden md:table-cell">
                  <div className="text-sm">
                    <span className="font-medium">{j.device_brand}</span>
                    {j.device_model && <span className="text-muted-foreground"> {j.device_model}</span>}
                  </div>
                </TableCell>

                {/* Category */}
                <TableCell className="hidden lg:table-cell">
                  <span className="text-xs text-muted-foreground">{j.device_type}</span>
                </TableCell>

                {/* Service Charge */}
                <TableCell className="hidden lg:table-cell">
                  <span className="text-sm font-medium tabular-nums">
                    {j.service_charge ? fmt(j.service_charge) : "—"}
                  </span>
                </TableCell>

                {/* Total */}
                <TableCell className="hidden md:table-cell">
                  <span className="text-sm font-semibold tabular-nums">
                    {j.total_amount ? fmt(j.total_amount) : "—"}
                  </span>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-2 py-0.5 border font-semibold capitalize ${STATUS_STYLES[j.status] || ""}`}
                  >
                    {j.status.replace(/_/g, " ")}
                  </Badge>
                </TableCell>

                {/* Payment */}
                <TableCell className="hidden sm:table-cell">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${PAYMENT_STYLES[j.payment_status || "unpaid"] || ""}`}>
                    {j.payment_status || "unpaid"}
                  </span>
                </TableCell>

                {/* Date */}
                <TableCell className="hidden md:table-cell">
                  <span className="text-[12px] text-muted-foreground">{format(new Date(j.created_at), "dd MMM yy")}</span>
                </TableCell>

                {/* Actions */}
                <TableCell onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 shadow-floating rounded-xl">
                      <DropdownMenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <Eye className="h-3.5 w-3.5 mr-2" /> View Detail
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <FileText className="h-3.5 w-3.5 mr-2" /> Generate Invoice
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/repairs/${j.id}`)}>
                        <CreditCard className="h-3.5 w-3.5 mr-2" /> Add Payment
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Footer count */}
        {jobs.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border/60 bg-muted/20">
            <p className="text-[12px] text-muted-foreground">
              Showing <span className="font-medium text-foreground">{jobs.length}</span> job sheets
              {statusFilter !== "all" && ` • ${STATUS_LABELS[statusFilter]}`}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
