import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wrench, Clock, CheckCircle, Eye, User, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { differenceInDays, differenceInHours, parseISO } from "date-fns";

const JOB_STATUSES = ["assigned", "in_progress", "waiting_parts", "repair_completed"] as const;

const statusColors: Record<string, string> = {
  assigned: "bg-info/10 text-info",
  in_progress: "bg-primary/10 text-primary",
  waiting_parts: "bg-warning/10 text-warning",
  repair_completed: "bg-success/10 text-success",
  quality_check: "bg-accent/10 text-accent-foreground",
  delivered: "bg-muted text-muted-foreground",
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
  customers?: { name: string } | null;
}

interface TechnicianOverview {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  active_jobs: number;
  completed_jobs: number;
}

function getTTR(estimated: string | null) {
  if (!estimated) return null;
  const target = parseISO(estimated);
  const now = new Date();
  const diffDays = differenceInDays(target, now);
  const diffHours = differenceInHours(target, now);
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: "text-destructive", urgent: true };
  if (diffDays === 0) return { label: `${Math.max(0, diffHours)}h left`, color: "text-warning", urgent: true };
  return { label: `${diffDays}d left`, color: "text-success", urgent: false };
}

export default function TechnicianDashboard() {
  const { user, hasRole } = useAuth();
  const isAdminOrStaff = hasRole("admin") || hasRole("staff");
  const isTechnician = hasRole("technician");

  if (isAdminOrStaff && !isTechnician) {
    return <TechnicianOverviewView />;
  }
  return <MyRepairsView />;
}

function TechnicianOverviewView() {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<TechnicianOverview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "technician");
      if (!roles || roles.length === 0) { setTechnicians([]); setLoading(false); return; }

      const techIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, phone").in("user_id", techIds);
      const { data: jobs } = await supabase.from("job_sheets").select("assigned_technician_id, status").in("assigned_technician_id", techIds);

      const mapped = (profiles || []).map(p => {
        const techJobs = (jobs || []).filter(j => j.assigned_technician_id === p.user_id);
        return {
          user_id: p.user_id,
          full_name: p.full_name,
          phone: p.phone,
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Technician Overview</h1>
        <p className="text-muted-foreground">Workload summary for all technicians</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Users className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{technicians.length}</p><p className="text-xs text-muted-foreground">Technicians</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-warning/10"><Wrench className="h-5 w-5 text-warning" /></div><div><p className="text-2xl font-bold">{totalActive}</p><p className="text-xs text-muted-foreground">Active Jobs</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div><div><p className="text-2xl font-bold">{totalCompleted}</p><p className="text-xs text-muted-foreground">Completed</p></div></CardContent></Card>
      </div>

      {loading ? <p className="text-center text-muted-foreground py-12">Loading...</p> : technicians.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No technicians found. Assign the "Technician" role to staff members in Settings → Users.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {technicians.map(t => (
            <Card key={t.user_id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate(`/repairs?technician=${t.user_id}`)}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-3 rounded-full bg-muted"><User className="h-6 w-6 text-muted-foreground" /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{t.full_name || "Unnamed"}</p>
                  <p className="text-sm text-muted-foreground">{t.phone || "No phone"}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-semibold text-primary">{t.active_jobs} active</p>
                  <p className="text-muted-foreground">{t.completed_jobs} done</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function MyRepairsView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobSheet[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_sheets")
      .select("id, job_number, device_brand, device_model, problem_description, status, priority, created_at, estimated_completion, customers(name)")
      .eq("assigned_technician_id", user?.id || "")
      .not("status", "eq", "delivered")
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setJobs((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { if (user) fetchJobs(); }, [user]);

  const updateStatus = async (jobId: string, newStatus: string) => {
    const { error } = await supabase.from("job_sheets").update({ status: newStatus as any }).eq("id", jobId);
    if (error) toast.error(error.message);
    else { toast.success("Status updated"); fetchJobs(); }
  };

  const active = jobs.filter(j => !["repair_completed", "delivered", "quality_check"].includes(j.status));
  const completed = jobs.filter(j => ["repair_completed", "quality_check"].includes(j.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Repairs</h1>
        <p className="text-muted-foreground">Your assigned repair jobs</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Wrench className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{active.length}</p><p className="text-xs text-muted-foreground">Active</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-success/10"><CheckCircle className="h-5 w-5 text-success" /></div><div><p className="text-2xl font-bold">{completed.length}</p><p className="text-xs text-muted-foreground">Completed</p></div></CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-warning/10"><Clock className="h-5 w-5 text-warning" /></div><div><p className="text-2xl font-bold">{jobs.filter(j => j.priority === "urgent").length}</p><p className="text-xs text-muted-foreground">Urgent</p></div></CardContent></Card>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No jobs assigned to you</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {jobs.map(j => {
            const ttr = getTTR(j.estimated_completion);
            return (
              <Card key={j.id} className={`hover:shadow-md transition-shadow ${ttr?.urgent ? "border-l-4 border-l-destructive" : ""}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold">{j.job_number}</CardTitle>
                    <Badge className={statusColors[j.status] || ""} variant="secondary">{j.status.replace(/_/g, " ")}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm">
                    <p className="font-medium">{j.customers?.name}</p>
                    <p className="text-muted-foreground">{[j.device_brand, j.device_model].filter(Boolean).join(" ") || "No device info"}</p>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{j.problem_description}</p>
                  {ttr && (
                    <div className={`flex items-center gap-1.5 text-xs font-medium ${ttr.color}`}>
                      {ttr.urgent ? <AlertTriangle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                      {ttr.label}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Select value={j.status} onValueChange={v => updateStatus(j.id, v)}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{JOB_STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize text-xs">{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(`/repairs/${j.id}`)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
