"use client";

import {
  Avatar, Box, Button, ButtonBase, Card, CardContent, Chip, IconButton,
  LinearProgress, MenuItem, Skeleton, Tab, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AnimatedPage, DataTable, DistributionWidget, EmptyState, PageHeader,
  ProgressRing, StatCard, StatusChip, TabBar, TabPanel, TabView, WidgetCard,
  toast,
} from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Wrench, Clock, CheckCircle, Eye, User, Users, AlertTriangle, IndianRupee, BookOpen } from "lucide-react";
import { NorthEast } from "@mui/icons-material";
import { differenceInDays, differenceInHours, parseISO } from "date-fns";
import { completionPercent } from "@/lib/widget-data";

const JOB_STATUSES = ["assigned", "in_progress", "waiting_parts", "repair_completed"] as const;

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
  if (!estimated) return null;
  const target = parseISO(estimated);
  const now = new Date();
  const diffDays = differenceInDays(target, now);
  const diffHours = differenceInHours(target, now);
  if (diffDays < 0)
    return { label: `${Math.abs(diffDays)}d overdue`, urgent: true, color: "error.main" };
  if (diffDays === 0)
    return { label: `${Math.max(0, diffHours)}h left`, urgent: true, color: "warning.main" };
  return { label: `${diffDays}d left`, urgent: false, color: "success.main" };
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
  const totalJobs = totalActive + totalCompleted;
  const teamRate = completionPercent(totalCompleted, totalJobs);
  const techDistribution = technicians.map(t => ({
    name: t.full_name || "Technician",
    value: t.active_jobs,
  }));

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="Technician Overview"
        subtitle="Workload, repair throughput, and technician assignments"
        actions={
          <Button
            size="small"
            variant="outlined"
            onClick={() => navigate("/repairs")}
            endIcon={<NorthEast sx={{ fontSize: 13 }} />}
          >
            All Repair Jobs
          </Button>
        }
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard
          label="Technicians"
          value={technicians.length}
          icon={<Box component={Users} sx={{ height: 20, width: 20 }} />}
          accent="primary"
          loading={loading}
        />
        <StatCard
          label="Active Jobs"
          value={totalActive}
          icon={<Box component={Wrench} sx={{ height: 20, width: 20 }} />}
          accent="warning"
          loading={loading}
        />
        <StatCard
          label="Completed"
          value={totalCompleted}
          icon={<Box component={CheckCircle} sx={{ height: 20, width: 20 }} />}
          accent="success"
          loading={loading}
        />
        <StatCard
          label="Resolution Rate"
          value={`${Math.round(teamRate)}%`}
          icon={<Box component={CheckCircle} sx={{ height: 20, width: 20 }} />}
          accent="info"
          caption="Total jobs resolved"
          loading={loading}
        />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.6fr" }, gap: 2.5 }}>
        <WidgetCard
          title="Team repair velocity"
          subtitle="Overall repair completion across all active technicians."
          eyebrow="TEAM PERFORMANCE"
          featured
        >
          {loading ? (
            <Skeleton variant="circular" width={130} height={130} sx={{ mx: "auto", my: 2 }} />
          ) : (
            <Box sx={{ py: 1 }}>
              <ProgressRing
                value={teamRate}
                label="Team repair completion"
                caption={`${totalCompleted} of ${totalJobs} non-rejected jobs repaired`}
                size={130}
              />
              <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">Work in progress: <Box component="span" sx={{ fontWeight: 600, color: "text.primary" }}>{totalActive} jobs</Box></Typography>
                <Typography variant="caption" color="text.secondary">Resolved: <Box component="span" sx={{ fontWeight: 600, color: "success.main" }}>{totalCompleted} jobs</Box></Typography>
              </Box>
            </Box>
          )}
        </WidgetCard>

        <DistributionWidget
          title="Active workload allocation"
          subtitle="Open repair tasks assigned per technician."
          items={techDistribution}
          loading={loading}
          formatter={val => `${val} active`}
        />
      </Box>

      <Box sx={{ mt: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Technician Directory & Assignments
        </Typography>

        {loading ? (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 }}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} variant="rounded" height={110} />
            ))}
          </Box>
        ) : technicians.length === 0 ? (
          <EmptyState
            title="No technicians found"
            description="Assign technician roles in Employee Management to get started."
            action={<Button size="small" onClick={() => navigate("/employees")}>View Employees</Button>}
          />
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" }, gap: 2 }}>
            {technicians.map(t => {
              const techTotal = t.active_jobs + t.completed_jobs;
              const rate = completionPercent(t.completed_jobs, techTotal);
              return (
                <Card
                  key={t.user_id}
                  onClick={() => navigate(`/repairs?technician=${t.user_id}`)}
                  sx={theme => ({
                    cursor: "pointer",
                    borderRadius: "16px",
                    border: `1px solid ${theme.palette.divider}`,
                    bgcolor: "background.paper",
                    transition: "border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
                    "&:hover": {
                      borderColor: alpha(theme.palette.primary.main, 0.4),
                      boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.05)}`,
                      transform: "translateY(-1px)",
                    },
                  })}
                >
                  <CardContent sx={{ p: 2.25, "&:last-child": { pb: 2.25 } }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1.5 }}>
                      <Avatar
                        sx={theme => ({
                          width: 40,
                          height: 40,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          color: "primary.main",
                          fontSize: 14,
                          fontWeight: 700,
                        })}
                      >
                        {String(t.full_name || "?").slice(0, 2).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 650 }}>
                          {t.full_name || "Unnamed Technician"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11 }}>
                          {t.phone || "No phone registered"}
                        </Typography>
                      </Box>
                      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                        <Chip
                          size="small"
                          label={`${t.active_jobs} active`}
                          color={t.active_jobs > 3 ? "warning" : "primary"}
                          variant="outlined"
                          sx={{ height: 22, fontSize: 10.5, fontWeight: 600 }}
                        />
                      </Box>
                    </Box>

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5 }}>
                        Completion rate
                      </Typography>
                      <Typography variant="caption" sx={{ fontWeight: 650, fontSize: 11 }}>
                        {t.completed_jobs} done / {techTotal} total ({Math.round(rate)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={rate}
                      color="success"
                      sx={{ height: 4, borderRadius: 2 }}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>
    </Box>
  );
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
    if (error) toast.error(error.message);
    else setJobs((data as any) || []);
    setLoading(false);
  };

  const fetchPayments = async () => {
    const { data } = await supabase
      .from("technician_payments")
      .select("*")
      .eq("technician_id", user?.id || "")
      .order("created_at", { ascending: false });
    setPayments(data || []);
  };

  useEffect(() => {
    if (user) {
      fetchJobs();
      fetchPayments();
    }
  }, [user]);

  const updateStatus = async (jobId: string, newStatus: string) => {
    const { error } = await supabase.from("job_sheets").update({ status: newStatus as any }).eq("id", jobId);
    if (error) toast.error(error.message);
    else {
      toast.success("Status updated");
      fetchJobs();
    }
  };

  const active = jobs.filter(j => !["repair_completed", "delivered", "quality_check"].includes(j.status));
  const completed = jobs.filter(j => ["repair_completed", "quality_check"].includes(j.status));
  const urgentJobs = jobs.filter(j => getTTR(j.estimated_completion)?.urgent);
  const totalEarned = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalPaid = payments.filter(p => p.status === "paid").reduce((s, p) => s + (p.amount || 0), 0);
  const totalUnpaid = payments.filter(p => p.status === "unpaid").reduce((s, p) => s + (p.amount || 0), 0);
  const myTotal = active.length + completed.length;
  const myCompletionRate = completionPercent(completed.length, myTotal);

  return (
    <Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader
        title="My Workspace"
        subtitle="Your assigned repair jobs, completion velocity, and payment ledger"
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard
          label="Active Jobs"
          value={active.length}
          icon={<Box component={Wrench} sx={{ height: 20, width: 20 }} />}
          accent="primary"
          loading={loading}
        />
        <StatCard
          label="Completed"
          value={completed.length}
          icon={<Box component={CheckCircle} sx={{ height: 20, width: 20 }} />}
          accent="success"
          loading={loading}
        />
        <StatCard
          label="Received"
          value={totalPaid}
          isCurrency
          icon={<Box component={IndianRupee} sx={{ height: 20, width: 20 }} />}
          accent="info"
        />
        <StatCard
          label="Pending Payout"
          value={totalUnpaid}
          isCurrency
          icon={<Box component={IndianRupee} sx={{ height: 20, width: 20 }} />}
          accent="error"
        />
      </Box>

      {urgentJobs.length > 0 && (
        <Box
          sx={theme => ({
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            p: 1.5,
            px: 2,
            borderRadius: "14px",
            bgcolor: alpha(theme.palette.warning.main, 0.08),
            border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}`,
          })}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Box component={AlertTriangle} sx={{ color: "warning.main", height: 18, width: 18 }} />
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
              {urgentJobs.length} job{urgentJobs.length > 1 ? "s" : ""} approaching deadline or overdue
            </Typography>
          </Box>
          <Chip size="small" color="warning" label="High Priority" sx={{ fontWeight: 600 }} />
        </Box>
      )}

      <TabView value={tab} onChange={setTab}>
        <TabBar>
          <Tab
            value="repairs"
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box component={Wrench} sx={{ height: 14, width: 14 }} />
                My Repairs ({jobs.length})
              </Box>
            }
          />
          <Tab
            value="ledger"
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box component={BookOpen} sx={{ height: 14, width: 14 }} />
                Payment Ledger
              </Box>
            }
          />
        </TabBar>

        <TabPanel value="repairs">
          {loading ? (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2, pt: 2 }}>
              {Array.from({ length: 3 }, (_, idx) => (
                <Skeleton key={idx} variant="rounded" height={180} />
              ))}
            </Box>
          ) : jobs.length === 0 ? (
            <EmptyState
              title="No jobs currently assigned"
              description="New repair assignments from the workshop will appear here."
              sx={{ py: 6 }}
            />
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2, pt: 2 }}>
              {jobs.map(j => {
                const ttr = getTTR(j.estimated_completion);
                return (
                  <Card
                    key={j.id}
                    sx={theme => ({
                      borderRadius: "16px",
                      border: `1px solid ${theme.palette.divider}`,
                      bgcolor: "background.paper",
                      display: "flex",
                      flexDirection: "column",
                      transition: "border-color 160ms ease, box-shadow 160ms ease",
                      ...(ttr?.urgent && {
                        borderLeft: `4px solid ${ttr.color === "error.main" ? theme.palette.error.main : theme.palette.warning.main}`,
                      }),
                      "&:hover": {
                        borderColor: alpha(theme.palette.primary.main, 0.4),
                        boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.2 : 0.05)}`,
                      },
                    })}
                  >
                    <Box sx={{ p: 2, pb: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {j.job_number}
                      </Typography>
                      <StatusChip label={j.status.replace(/_/g, " ")} />
                    </Box>
                    <CardContent sx={{ p: 2, pt: 0.5, flex: 1, display: "flex", flexDirection: "column", gap: 1.25 }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {j.customers?.name || "Walk-in client"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {[j.device_brand, j.device_model].filter(Boolean).join(" ")}
                        </Typography>
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          fontSize: 11.5,
                          overflow: "hidden",
                          display: "-webkit-box",
                          WebkitBoxOrient: "vertical",
                          WebkitLineClamp: 2,
                          lineHeight: 1.4,
                        }}
                      >
                        {j.problem_description}
                      </Typography>
                      {ttr && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: "auto", pt: 0.5 }}>
                          {ttr.urgent ? (
                            <Box component={AlertTriangle} sx={{ height: 13, width: 13, color: ttr.color }} />
                          ) : (
                            <Box component={Clock} sx={{ height: 13, width: 13, color: ttr.color }} />
                          )}
                          <Typography variant="caption" sx={{ fontSize: 11, fontWeight: 650, color: ttr.color }}>
                            {ttr.label}
                          </Typography>
                        </Box>
                      )}
                      <Box sx={{ display: "flex", gap: 1, alignItems: "center", pt: 1, borderTop: 1, borderColor: "divider" }}>
                        <TextField
                          value={j.status}
                          select
                          size="small"
                          fullWidth
                          onChange={e => updateStatus(j.id, e.target.value)}
                          slotProps={{ select: { displayEmpty: true } }}
                          sx={{ flex: 1, "& .MuiSelect-select": { py: 0.75, fontSize: 11.5, fontWeight: 600 } }}
                        >
                          {JOB_STATUSES.map(s => (
                            <MenuItem key={s} value={s} sx={{ textTransform: "capitalize", fontSize: 12 }}>
                              {s.replace(/_/g, " ")}
                            </MenuItem>
                          ))}
                        </TextField>
                        <IconButton
                          onClick={() => navigate(`/repairs/${j.id}`)}
                          aria-label="View repair job"
                          size="small"
                          sx={{ border: 1, borderColor: "divider", borderRadius: 1.5 }}
                        >
                          <Box component={Eye} sx={{ height: 14, width: 14 }} />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          )}
        </TabPanel>

        <TabPanel value="ledger">
          <Card sx={{ borderRadius: "16px", mt: 2 }}>
            <CardContent sx={{ p: 0 }}>
              <DataTable columnsCount={5} empty={payments.length === 0} emptyMessage="No payment records yet">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Mode</TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell sx={{ fontSize: 12 }}>{new Date(p.created_at).toLocaleDateString()}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace", fontWeight: 700, fontSize: 12.5 }}>
                        ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell sx={{ fontSize: 12, textTransform: "capitalize" }}>{p.payment_mode || "—"}</TableCell>
                      <TableCell sx={{ fontSize: 12, color: "text.secondary", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {p.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <StatusChip label={p.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </DataTable>
            </CardContent>
          </Card>
        </TabPanel>
      </TabView>
    </Box>
  );
}
