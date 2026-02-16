import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Plus, Search, ClipboardList, Eye, Clock, CheckCircle, AlertTriangle, Loader2,
} from "lucide-react";
import { toast } from "sonner";

const JOB_STATUSES = [
  "created", "pending_approval", "approved", "rejected", "assigned",
  "in_progress", "waiting_parts", "repair_completed", "quality_check",
  "invoice_generated", "delivered",
] as const;

const statusColors: Record<string, string> = {
  created: "bg-muted text-muted-foreground",
  pending_approval: "bg-warning/10 text-warning",
  approved: "bg-info/10 text-info",
  rejected: "bg-destructive/10 text-destructive",
  assigned: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  waiting_parts: "bg-warning/10 text-warning",
  repair_completed: "bg-success/10 text-success",
  quality_check: "bg-accent/10 text-accent-foreground",
  invoice_generated: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
};

interface JobSheet {
  id: string;
  job_number: string;
  device_brand: string;
  device_type: string;
  device_model: string | null;
  status: string;
  priority: string;
  created_at: string;
  estimated_cost: number | null;
  customers?: { name: string } | null;
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
      .select("id, job_number, device_brand, device_type, device_model, status, priority, created_at, estimated_cost, customers(name)")
      .order("created_at", { ascending: false });

    if (statusFilter !== "all") query = query.eq("status", statusFilter as any);
    if (search) query = query.or(`job_number.ilike.%${search}%,device_brand.ilike.%${search}%,device_model.ilike.%${search}%`);

    const { data, error } = await query;
    if (error) toast.error(error.message);
    else setJobs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { fetchJobs(); }, [search, statusFilter]);

  const today = new Date().toISOString().slice(0, 10);
  const totalJobs = jobs.length;
  const pendingApproval = jobs.filter(j => j.status === "pending_approval").length;
  const inProgress = jobs.filter(j => ["assigned", "in_progress", "waiting_parts"].includes(j.status)).length;
  const completedToday = jobs.filter(j => j.status === "delivered" && j.created_at.slice(0, 10) === today).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Job Sheets</h1>
          <p className="text-muted-foreground">Enterprise repair workflow management</p>
        </div>
        <Button onClick={() => navigate("/job-sheets/new")}>
          <Plus className="h-4 w-4 mr-2" /> New Job Sheet
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10"><ClipboardList className="h-5 w-5 text-primary" /></div>
          <div><p className="text-2xl font-bold">{totalJobs}</p><p className="text-xs text-muted-foreground">Total Jobs</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div>
          <div><p className="text-2xl font-bold">{pendingApproval}</p><p className="text-xs text-muted-foreground">Pending Approval</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-info/10"><AlertTriangle className="h-5 w-5 text-info" /></div>
          <div><p className="text-2xl font-bold">{inProgress}</p><p className="text-xs text-muted-foreground">In Progress</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div>
          <div><p className="text-2xl font-bold">{completedToday}</p><p className="text-xs text-muted-foreground">Delivered Today</p></div>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start">
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all">All</TabsTrigger>
            {JOB_STATUSES.map(s => (
              <TabsTrigger key={s} value={s} className="capitalize text-xs">
                {s.replace(/_/g, " ")}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search jobs..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job #</TableHead>
              <TableHead className="hidden sm:table-cell">Customer</TableHead>
              <TableHead className="hidden md:table-cell">Device</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="hidden sm:table-cell">Priority</TableHead>
              <TableHead className="hidden md:table-cell">Est. Cost</TableHead>
              <TableHead className="w-16">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </TableCell></TableRow>
            ) : jobs.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-30" />No job sheets found
              </TableCell></TableRow>
            ) : jobs.map(j => (
              <TableRow key={j.id} className="cursor-pointer" onClick={() => navigate(`/job-sheets/${j.id}`)}>
                <TableCell className="font-medium">{j.job_number}</TableCell>
                <TableCell className="hidden sm:table-cell">{j.customers?.name || "—"}</TableCell>
                <TableCell className="hidden md:table-cell">{[j.device_brand, j.device_model].filter(Boolean).join(" ") || "—"}</TableCell>
                <TableCell><Badge className={statusColors[j.status] || ""} variant="secondary">{j.status.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell className="hidden sm:table-cell"><Badge variant="outline" className="capitalize">{j.priority}</Badge></TableCell>
                <TableCell className="hidden md:table-cell">{j.estimated_cost ? `₹${j.estimated_cost.toLocaleString()}` : "—"}</TableCell>
                <TableCell><Button variant="ghost" size="icon"><Eye className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
