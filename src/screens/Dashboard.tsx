"use client";

import { useEffect, useRef } from "react";
import { useNavigate } from "@/lib/router-compat";
import { gsap } from "gsap";
import { motion, type Variants } from "framer-motion";
import {
  Box, Card, CardContent, Typography, Chip, Avatar, Stack, IconButton,
  LinearProgress, Tooltip, Divider, Button, Skeleton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  ShoppingCart, TrendingUp, AccountBalanceWallet, PendingActions,
  People, Build, Receipt, Inventory2, Refresh, NorthEast,
  Payments, PointOfSale, RequestQuote, Savings, CheckCircle, QueryBuilder,
} from "@mui/icons-material";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// --- Data fetchers (unchanged) ---
async function fetchKpis() {
  const today = startOfDay(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();
  const monthDate = format(startOfMonth(new Date()), "yyyy-MM-dd");

  const [salesToday, salesMonth, pendingPayments, totalBalance, revenue, expenses, lowStock, activeRepairs, completedToday, totalCustomers,
    quotationsMonth, invoicesMonth, repairRevenueMonth, totalRepairJobs, pendingRepairs] = await Promise.all([
    supabase.from("pos_transactions").select("total").gte("created_at", today).then(r => r.data?.reduce((s, t) => s + Number(t.total), 0) ?? 0),
    supabase.from("pos_transactions").select("total").gte("created_at", monthStart).then(r => r.data?.reduce((s, t) => s + Number(t.total), 0) ?? 0),
    supabase.from("payments").select("amount").eq("status", "pending").then(r => r.data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0),
    supabase.from("finance_accounts").select("current_balance").eq("status", "active").then(r => r.data?.reduce((s, a) => s + Number(a.current_balance), 0) ?? 0),
    supabase.from("finance_transactions").select("amount").eq("type", "income").gte("date", monthDate).then(r => r.data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0),
    supabase.from("finance_transactions").select("amount").eq("type", "expense").gte("date", monthDate).then(r => r.data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0),
    supabase.from("products").select("id", { count: "exact", head: true }).or("stock_quantity.lte.low_stock_threshold").then(r => r.count ?? 0),
    supabase.from("job_sheets").select("id", { count: "exact", head: true }).not("status", "in", '("delivered","invoice_generated")').then(r => r.count ?? 0),
    supabase.from("job_sheets").select("id", { count: "exact", head: true }).eq("status", "repair_completed").gte("created_at", today).then(r => r.count ?? 0),
    supabase.from("customers").select("id", { count: "exact", head: true }).then(r => r.count ?? 0),
    supabase.from("quotations").select("total").gte("created_at", monthStart).then(r => r.data?.reduce((s, t) => s + Number(t.total || 0), 0) ?? 0),
    supabase.from("invoices").select("total").gte("created_at", monthStart).then(r => r.data?.reduce((s, t) => s + Number(t.total || 0), 0) ?? 0),
    supabase.from("job_sheets").select("total_amount").eq("payment_status", "paid").gte("created_at", monthStart).then(r => r.data?.reduce((s, j) => s + Number(j.total_amount || 0), 0) ?? 0),
    supabase.from("job_sheets").select("id", { count: "exact", head: true }).then(r => r.count ?? 0),
    supabase.from("job_sheets").select("id", { count: "exact", head: true }).in("status", ["created","pending_approval","assigned","in_progress","waiting_parts"]).then(r => r.count ?? 0),
  ]);

  return { salesToday, salesMonth, pendingPayments, totalBalance, revenue, expenses, lowStock, activeRepairs, completedToday, totalCustomers,
    quotationsMonth, invoicesMonth, repairRevenueMonth, totalRepairJobs, pendingRepairs };
}

async function fetchWeeklySales() {
  const days: { name: string; sales: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const dayStart = startOfDay(d).toISOString();
    const dayEnd = startOfDay(subDays(new Date(), i - 1)).toISOString();
    const { data } = await supabase.from("pos_transactions").select("total").gte("created_at", dayStart).lt("created_at", dayEnd);
    days.push({ name: format(d, "EEE"), sales: data?.reduce((s, t) => s + Number(t.total), 0) ?? 0 });
  }
  return days;
}

async function fetchRepairBreakdown() {
  const { data } = await supabase.from("job_sheets").select("status");
  const counts: Record<string, number> = {};
  data?.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
  const colorMap: Record<string, string> = {
    created: "#6366f1", pending_approval: "#f59e0b", approved: "#3b82f6", rejected: "#ef4444",
    assigned: "#06b6d4", in_progress: "#8b5cf6", waiting_parts: "#a855f7",
    repair_completed: "#22c55e", quality_check: "#ec4899", invoice_generated: "#14b8a6", delivered: "#6b7280",
  };
  return Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value, color: colorMap[name] || "#6b7280" }));
}

async function fetchRecentInvoices() {
  const { data } = await supabase.from("invoices")
    .select("id, invoice_number, total, payment_status, created_at, customers(name)")
    .order("created_at", { ascending: false }).limit(5);
  return data || [];
}

// --- Formatters ---
function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}
function fmtInt(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(n));
}

// --- GSAP-driven count-up number ---
function CountUp({ value, formatter = fmtInt, duration = 1.4 }: {
  value: number; formatter?: (n: number) => string; duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const displayed = useRef(0);

  useEffect(() => {
    const from = displayed.current;
    const obj = { v: from };
    const tween = gsap.to(obj, {
      v: value,
      duration,
      ease: "power3.out",
      onUpdate: () => { if (ref.current) ref.current.textContent = formatter(obj.v); },
      onComplete: () => { displayed.current = value; },
    });
    return () => { tween.kill(); };
  }, [value, formatter, duration]);

  return <span ref={ref}>{formatter(0)}</span>;
}

// --- framer-motion variants ---
const containerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};
const cardVariants: Variants = {
  hidden: { opacity: 0, y: 26, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] } },
};

type AccentKey = "success" | "primary" | "info" | "warning" | "error" | "secondary";

function KpiCard({ label, value, isCurrency, trend, trendUp, icon, accent, isLoading, onClick, index }: {
  label: string; value: number; isCurrency?: boolean; trend?: string; trendUp?: boolean;
  icon: React.ReactNode; accent: AccentKey; isLoading: boolean; onClick?: () => void; index: number;
}) {
  return (
    <motion.div variants={cardVariants} whileHover={{ y: -5 }} transition={{ type: "spring", stiffness: 300, damping: 22 }} style={{ height: "100%" }}>
      <Card
        onClick={onClick}
        sx={{
          height: "100%", cursor: "pointer", position: "relative", overflow: "hidden",
          transition: "border-color .25s, box-shadow .25s",
          "&:hover": (t) => ({
            borderColor: alpha(t.palette[accent].main, 0.5),
            boxShadow: `0 12px 32px -12px ${alpha(t.palette[accent].main, 0.35)}`,
          }),
        }}
      >
        {/* corner glow */}
        <Box sx={{
          position: "absolute", top: -30, right: -30, width: 90, height: 90, borderRadius: "50%",
          background: (t) => `radial-gradient(circle, ${alpha(t.palette[accent].main, 0.16)}, transparent 70%)`,
        }} />
        <CardContent sx={{ p: 2.5, position: "relative" }}>
          {isLoading ? (
            <Stack spacing={1.5}>
              <Skeleton variant="rounded" width={44} height={44} sx={{ borderRadius: 3 }} />
              <Skeleton variant="text" width="55%" />
              <Skeleton variant="text" width="75%" height={32} />
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <Box sx={(t) => ({
                  height: 44, width: 44, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center",
                  bgcolor: alpha(t.palette[accent].main, 0.14), color: t.palette[accent].main,
                })}>
                  {icon}
                </Box>
                <IconButton size="small" sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}>
                  <NorthEast sx={{ fontSize: 16 }} />
                </IconButton>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary", textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                {label}
              </Typography>
              <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700, lineHeight: 1.1 }}>
                  <CountUp value={value} formatter={isCurrency ? fmt : fmtInt} duration={1.2 + index * 0.08} />
                </Typography>
                {trend && (
                  <Chip
                    size="small"
                    label={trend}
                    icon={trendUp === false ? undefined : <NorthEast sx={{ fontSize: 12 }} />}
                    sx={{
                      height: 22, fontSize: 11, fontWeight: 600,
                      bgcolor: (t) => alpha(t.palette[accent].main, 0.12),
                      color: `${accent}.main`,
                      "& .MuiChip-icon": { color: "inherit" },
                    }}
                  />
                )}
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

const paymentColor: Record<string, "success" | "error" | "warning"> = { paid: "success", unpaid: "error", partial: "warning" };

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: kpis, isLoading: kpiLoading } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: fetchKpis, staleTime: 60_000 });
  const { data: weeklySales, isLoading: salesLoading } = useQuery({ queryKey: ["dashboard-weekly-sales"], queryFn: fetchWeeklySales, staleTime: 60_000 });
  const { data: repairBreakdown } = useQuery({ queryKey: ["dashboard-repairs"], queryFn: fetchRepairBreakdown, staleTime: 60_000 });
  const { data: recentInvoices } = useQuery({ queryKey: ["dashboard-recent-invoices"], queryFn: fetchRecentInvoices, staleTime: 60_000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-weekly-sales"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-repairs"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent-invoices"] });
  };

  const firstName = (user as { user_metadata?: { full_name?: string }; email?: string })?.user_metadata?.full_name?.split(" ")[0]
    || (user as { email?: string })?.email?.split("@")[0]
    || "there";

  const net = (kpis?.revenue ?? 0) - (kpis?.expenses ?? 0);
  const margin = kpis && kpis.revenue > 0 ? Math.max(0, Math.min(100, (net / kpis.revenue) * 100)) : 0;
  const repairThroughput = kpis && kpis.totalRepairJobs > 0 ? Math.round(((kpis.totalRepairJobs - kpis.pendingRepairs) / kpis.totalRepairJobs) * 100) : 0;
  const collectionRate = kpis && (kpis.invoicesMonth + kpis.pendingPayments) > 0
    ? Math.round((kpis.invoicesMonth / (kpis.invoicesMonth + kpis.pendingPayments)) * 100) : 0;

  const kpisList = [
    { label: "Today's Sales", value: kpis?.salesToday ?? 0, isCurrency: true, trend: "POS today", icon: <ShoppingCart fontSize="small" />, accent: "success" as AccentKey, onClick: () => navigate("/pos") },
    { label: "Monthly Revenue", value: kpis?.revenue ?? 0, isCurrency: true, trend: "This month", icon: <TrendingUp fontSize="small" />, accent: "primary" as AccentKey, onClick: () => navigate("/finance") },
    { label: "Cash Balance", value: kpis?.totalBalance ?? 0, isCurrency: true, icon: <AccountBalanceWallet fontSize="small" />, accent: "info" as AccentKey, onClick: () => navigate("/finance") },
    { label: "Pending Payments", value: kpis?.pendingPayments ?? 0, isCurrency: true, trend: "Due", trendUp: false, icon: <PendingActions fontSize="small" />, accent: "warning" as AccentKey, onClick: () => navigate("/payments") },
    { label: "Customers", value: kpis?.totalCustomers ?? 0, icon: <People fontSize="small" />, accent: "primary" as AccentKey, onClick: () => navigate("/customers") },
    { label: "Active Repairs", value: kpis?.activeRepairs ?? 0, trend: kpis ? `${kpis.completedToday} done today` : undefined, icon: <Build fontSize="small" />, accent: "secondary" as AccentKey, onClick: () => navigate("/repairs") },
    { label: "Invoices (Month)", value: kpis?.invoicesMonth ?? 0, isCurrency: true, trend: "This month", icon: <Receipt fontSize="small" />, accent: "success" as AccentKey, onClick: () => navigate("/invoices") },
    { label: "Low Stock Items", value: kpis?.lowStock ?? 0, icon: <Inventory2 fontSize="small" />, accent: "error" as AccentKey, onClick: () => navigate("/inventory") },
  ];

  const quickActions = [
    { label: "New Sale", icon: <PointOfSale fontSize="small" />, to: "/pos" },
    { label: "Quotation", icon: <RequestQuote fontSize="small" />, to: "/sales/new" },
    { label: "Invoice", icon: <Receipt fontSize="small" />, to: "/invoices/new" },
    { label: "Repair", icon: <Build fontSize="small" />, to: "/repairs/new" },
    { label: "Payment", icon: <Payments fontSize="small" />, to: "/finance" },
  ];

  return (
    <Box component={motion.div} initial="hidden" animate="show" variants={containerVariants} sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* ─── Header ─── */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 2 }}>
        <motion.div variants={cardVariants}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: -0.5 }}>Dashboard</Typography>
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 0.5 }}>
            Welcome back, <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>{firstName}</Box> — here's your business overview
          </Typography>
        </motion.div>
        <motion.div variants={cardVariants}>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            {quickActions.map(a => (
              <Button key={a.label} size="small" variant="outlined" startIcon={a.icon} onClick={() => navigate(a.to)}
                sx={{ borderRadius: 3, borderColor: "divider" }}>
                {a.label}
              </Button>
            ))}
            <Tooltip title="Refresh">
              <IconButton onClick={refresh} size="small" sx={{ border: 1, borderColor: "divider", borderRadius: 3 }}>
                <Refresh fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </motion.div>
      </Box>

      {/* ─── KPI grid ─── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(4,1fr)" }, gap: 2 }}>
        {kpisList.map((k, i) => (
          <KpiCard key={k.label} index={i} label={k.label} value={k.value} isCurrency={k.isCurrency}
            trend={k.trend} trendUp={k.trendUp} icon={k.icon} accent={k.accent} isLoading={kpiLoading} onClick={k.onClick} />
        ))}
      </Box>

      {/* ─── Charts row ─── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "3fr 2fr" }, gap: 3 }}>
        <motion.div variants={cardVariants}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 2 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Sales Analytics</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Last 7 days</Typography>
                </Box>
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    <CountUp value={kpis?.salesMonth ?? 0} formatter={fmt} />
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>This Month</Typography>
                </Box>
              </Box>
              {salesLoading ? (
                <Skeleton variant="rounded" height={240} sx={{ borderRadius: 3 }} />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={weeklySales} barCategoryGap="28%">
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0.25} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="name" stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} style={{ fill: "currentColor", opacity: 0.6 }} />
                    <YAxis stroke="currentColor" fontSize={11} tickLine={false} axisLine={false} style={{ fill: "currentColor", opacity: 0.6 }} />
                    <RTooltip
                      contentStyle={{ background: "var(--mui-palette-background-paper, #141416)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 12, fontSize: 12 }}
                      formatter={(value: number) => [fmt(value), "Sales"]}
                      cursor={{ fill: "rgba(128,128,128,0.12)" }}
                    />
                    <Bar dataKey="sales" fill="url(#barGrad)" radius={[8, 8, 0, 0]} barSize={32} isAnimationActive animationDuration={900} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={cardVariants}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Repair Progress</Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>Current status breakdown</Typography>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={repairBreakdown || []} cx="50%" cy="50%" innerRadius={58} outerRadius={88} paddingAngle={3}
                    dataKey="value" strokeWidth={0} isAnimationActive animationDuration={900} animationEasing="ease-out">
                    {(repairBreakdown || []).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <RTooltip contentStyle={{ background: "var(--mui-palette-background-paper, #141416)", border: "1px solid rgba(128,128,128,0.25)", borderRadius: 12, fontSize: 12 }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </Box>

      {/* ─── Financial overview + recent invoices ─── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "2fr 3fr" }, gap: 3 }}>
        {/* Financial overview */}
        <motion.div variants={cardVariants}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                <Savings fontSize="small" sx={{ color: "primary.main" }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Financial Overview</Typography>
              </Box>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>This month</Typography>

              <Stack direction="row" spacing={2} sx={{ mt: 2.5, mb: 3 }}>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 3, bgcolor: (t) => alpha(t.palette.success.main, 0.08) }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Revenue</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "success.main" }}>
                    <CountUp value={kpis?.revenue ?? 0} formatter={fmt} />
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, p: 1.5, borderRadius: 3, bgcolor: (t) => alpha(t.palette.error.main, 0.08) }}>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Expenses</Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "error.main" }}>
                    <CountUp value={kpis?.expenses ?? 0} formatter={fmt} />
                  </Typography>
                </Box>
              </Stack>

              {/* Animated metric bars */}
              {[
                { label: "Net margin", value: margin, display: `${margin.toFixed(0)}%`, color: "primary" as const, icon: <TrendingUp sx={{ fontSize: 14 }} /> },
                { label: "Collection rate", value: collectionRate, display: `${collectionRate}%`, color: "success" as const, icon: <CheckCircle sx={{ fontSize: 14 }} /> },
                { label: "Repair throughput", value: repairThroughput, display: `${repairThroughput}%`, color: "warning" as const, icon: <QueryBuilder sx={{ fontSize: 14 }} /> },
              ].map((m, i) => (
                <Box key={m.label} sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                    <Typography variant="caption" sx={{ color: "text.secondary", display: "flex", alignItems: "center", gap: 0.5 }}>
                      {m.icon}{m.label}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: `${m.color}.main` }}>{m.display}</Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={kpiLoading ? 0 : m.value}
                    color={m.color}
                    sx={{
                      height: 8, borderRadius: 4,
                      bgcolor: (t) => alpha(t.palette[m.color].main, 0.12),
                      "& .MuiLinearProgress-bar": { borderRadius: 4, transition: "transform 1.2s cubic-bezier(0.16,1,0.3,1)" },
                    }}
                  />
                </Box>
              ))}

              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography variant="body2" sx={{ color: "text.secondary" }}>Net profit</Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: net >= 0 ? "success.main" : "error.main" }}>
                  <CountUp value={net} formatter={fmt} />
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent invoices */}
        <motion.div variants={cardVariants}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Recent Invoices</Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>Latest transactions</Typography>
                </Box>
                <Button size="small" endIcon={<NorthEast sx={{ fontSize: 14 }} />} onClick={() => navigate("/invoices")}>View all</Button>
              </Box>
              <Box component={motion.div} variants={containerVariants} initial="hidden" animate="show">
                {(recentInvoices || []).map((inv: { id: string; invoice_number?: string; total?: number; payment_status?: string; customers?: { name?: string } }, idx: number) => (
                  <Box
                    component={motion.div}
                    variants={cardVariants}
                    key={inv.id}
                    onClick={() => navigate("/invoices")}
                    sx={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      py: 1.5, px: 1, borderRadius: 2, cursor: "pointer",
                      borderBottom: 1, borderColor: "divider", "&:last-child": { borderBottom: 0 },
                      "&:hover": { bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar sx={{ width: 36, height: 36, fontSize: 12, fontWeight: 700, bgcolor: (t) => alpha(t.palette.primary.main, 0.12), color: "primary.main" }}>
                        {(inv.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{inv.customers?.name || "Unknown"}</Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>{inv.invoice_number}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{fmt(inv.total || 0)}</Typography>
                      <Chip size="small" label={inv.payment_status || "unpaid"} color={paymentColor[inv.payment_status || "unpaid"] || "default"}
                        variant="outlined" sx={{ textTransform: "capitalize", height: 22, fontSize: 11 }} />
                    </Box>
                  </Box>
                ))}
              </Box>
              {(!recentInvoices || recentInvoices.length === 0) && (
                <Typography variant="body2" sx={{ color: "text.secondary", textAlign: "center", py: 6 }}>No recent invoices</Typography>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </Box>
    </Box>
  );
}
