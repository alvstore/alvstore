import { useState } from "react";
import {
  DollarSign, TrendingUp, CreditCard, Wallet,
  Package, Wrench, CheckCircle, Users, RefreshCw,
  ArrowUpRight, ArrowDownRight, ShoppingCart, Clock,
  BarChart2, LineChart as LineChartIcon, AreaChart as AreaChartIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// --- Data fetchers (keep existing) ---
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

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

// KPI Card component matching Dribbble reference
function KpiCard({ label, value, trend, icon: Icon, accentColor, isLoading }: {
  label: string; value: string; trend?: string; icon: React.ComponentType<{ className?: string }>;
  accentColor: string; isLoading: boolean;
}) {
  const bgMap: Record<string, string> = {
    purple: "bg-purple-500/10", green: "bg-emerald-500/10", blue: "bg-blue-500/10", orange: "bg-orange-500/10",
  };
  const textMap: Record<string, string> = {
    purple: "text-purple-400", green: "text-emerald-400", blue: "text-blue-400", orange: "text-orange-400",
  };

  return (
    <Card className="border-white/5">
      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-7 w-28" />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Icon container */}
            <div className={`h-11 w-11 rounded-xl ${bgMap[accentColor]} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${textMap[accentColor]}`} />
            </div>
            {/* Label */}
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{label}</p>
            {/* Value */}
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-white">{value}</p>
              {trend && (
                <div className="flex items-center gap-1 text-emerald-400">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-medium">{trend}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const tooltipStyle = {
  background: "#121212",
  border: "1px solid rgba(255,255,255,0.05)",
  borderRadius: "12px",
  fontSize: "12px",
  color: "#fff",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

export default function Dashboard() {
  const { user } = useAuth();
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

  const paymentBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-emerald-500/10 text-emerald-400",
      unpaid: "bg-red-500/10 text-red-400",
      partial: "bg-orange-500/10 text-orange-400",
    };
    return (
      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize ${styles[status] || "bg-white/5 text-zinc-400"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">Welcome back — here's your business overview</p>
        </div>
        <button
          onClick={refresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Primary KPI Cards - Dribbble style */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Monthly Revenue" value={kpis ? fmt(kpis.revenue) : "—"} trend="This month" icon={TrendingUp} accentColor="purple" isLoading={kpiLoading} />
        <KpiCard label="Total Sales" value={kpis ? fmt(kpis.salesMonth) : "—"} trend="POS total" icon={ShoppingCart} accentColor="green" isLoading={kpiLoading} />
        <KpiCard label="Customers" value={kpis ? String(kpis.totalCustomers) : "—"} icon={Users} accentColor="blue" isLoading={kpiLoading} />
        <KpiCard label="Active Repairs" value={kpis ? String(kpis.activeRepairs) : "—"} trend={kpis ? `${kpis.completedToday} done today` : undefined} icon={Wrench} accentColor="orange" isLoading={kpiLoading} />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Cash Balance", value: kpis ? fmt(kpis.totalBalance) : "—", icon: Wallet, color: "text-purple-400" },
          { label: "Pending Payments", value: kpis ? fmt(kpis.pendingPayments) : "—", icon: Clock, color: "text-orange-400" },
          { label: "Invoices (Month)", value: kpis ? fmt(kpis.invoicesMonth) : "—", icon: CreditCard, color: "text-blue-400" },
          { label: "Low Stock Items", value: kpis ? String(kpis.lowStock) : "—", icon: Package, color: "text-red-400" },
        ].map((s) => (
          <Card key={s.label} className="border-white/5">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-zinc-500 font-medium">{s.label}</p>
                <p className="text-lg font-bold text-white">{kpiLoading ? "—" : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Sales Bar Chart */}
        <Card className="border-white/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold text-white">Sales Analytics</CardTitle>
                <p className="text-xs text-zinc-500 mt-0.5">Last 7 days</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{kpis ? fmt(kpis.salesMonth) : "—"}</p>
                <p className="text-[11px] text-zinc-500">This Month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {salesLoading ? <Skeleton className="h-[240px] w-full rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklySales}>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.3} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [fmt(value), "Sales"]} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                  <Bar dataKey="sales" fill="url(#barGrad)" radius={[8, 8, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Repair Breakdown - Donut */}
        <Card className="border-white/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-white">Repair Progress</CardTitle>
            <p className="text-xs text-zinc-500">Current status breakdown</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={repairBreakdown || []} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {(repairBreakdown || []).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card className="border-white/5">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-white">Recent Invoices</CardTitle>
              <p className="text-xs text-zinc-500">Latest transactions</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-0">
            {(recentInvoices || []).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarFallback className="text-[11px] bg-purple-500/10 text-purple-400 font-semibold">
                      {(inv.customers?.name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium text-white">{inv.customers?.name || "Unknown"}</p>
                    <p className="text-[11px] text-zinc-500">{inv.invoice_number}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <p className="text-sm font-semibold text-white">{fmt(inv.total || 0)}</p>
                  {paymentBadge(inv.payment_status || "unpaid")}
                </div>
              </div>
            ))}
            {(!recentInvoices || recentInvoices.length === 0) && (
              <p className="text-sm text-zinc-500 text-center py-8">No recent invoices</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
