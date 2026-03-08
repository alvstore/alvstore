import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp, CreditCard, Wallet,
  Package, Wrench, Users, RefreshCw,
  ArrowUpRight, ShoppingCart, Clock,
  Plus, FileText, Receipt,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

// --- Data fetchers ---
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

function KpiCard({ label, value, trend, icon: Icon, accentClass, isLoading }: {
  label: string; value: string; trend?: string; icon: React.ComponentType<{ className?: string }>;
  accentClass: string; isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        {isLoading ? (
          <div className="space-y-3"><Skeleton className="h-10 w-10 rounded-xl" /><Skeleton className="h-4 w-20" /><Skeleton className="h-7 w-28" /></div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className={`h-11 w-11 rounded-xl ${accentClass} flex items-center justify-center`}><Icon className="h-5 w-5" /></div>
              <button className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <div className="flex items-end justify-between">
              <p className="text-2xl font-bold text-foreground">{value}</p>
              {trend && <div className="flex items-center gap-1 text-success"><ArrowUpRight className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{trend}</span></div>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

  const paymentBadge = (status: string) => {
    const styles: Record<string, string> = { paid: "bg-success/10 text-success", unpaid: "bg-destructive/10 text-destructive", partial: "bg-warning/10 text-warning" };
    return <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize ${styles[status] || "bg-muted text-muted-foreground"}`}>{status}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header + Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back — here's your business overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => navigate("/pos")}><ShoppingCart className="h-3.5 w-3.5 mr-1.5" />New Sale</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/sales/new")}><FileText className="h-3.5 w-3.5 mr-1.5" />Quotation</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/invoices/new")}><Receipt className="h-3.5 w-3.5 mr-1.5" />Invoice</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/repairs/new")}><Wrench className="h-3.5 w-3.5 mr-1.5" />Repair</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/finance")}><Wallet className="h-3.5 w-3.5 mr-1.5" />Payment</Button>
          <Button size="sm" variant="outline" onClick={() => navigate("/finance")}><CreditCard className="h-3.5 w-3.5 mr-1.5" />Expense</Button>
          <button onClick={refresh} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border text-sm font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors">
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Today's Sales" value={kpis ? fmt(kpis.salesToday) : "—"} trend="POS today" icon={ShoppingCart} accentClass="bg-success/10 text-success" isLoading={kpiLoading} />
        <KpiCard label="Monthly Revenue" value={kpis ? fmt(kpis.revenue) : "—"} trend="This month" icon={TrendingUp} accentClass="bg-primary/10 text-primary" isLoading={kpiLoading} />
        <KpiCard label="Customers" value={kpis ? String(kpis.totalCustomers) : "—"} icon={Users} accentClass="bg-info/10 text-info" isLoading={kpiLoading} />
        <KpiCard label="Active Repairs" value={kpis ? String(kpis.activeRepairs) : "—"} trend={kpis ? `${kpis.completedToday} done today` : undefined} icon={Wrench} accentClass="bg-warning/10 text-warning" isLoading={kpiLoading} />
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Cash Balance", value: kpis ? fmt(kpis.totalBalance) : "—", icon: Wallet, cls: "text-primary" },
          { label: "Pending Payments", value: kpis ? fmt(kpis.pendingPayments) : "—", icon: Clock, cls: "text-warning" },
          { label: "Invoices (Month)", value: kpis ? fmt(kpis.invoicesMonth) : "—", icon: CreditCard, cls: "text-info" },
          { label: "Low Stock Items", value: kpis ? String(kpis.lowStock) : "—", icon: Package, cls: "text-destructive" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl bg-muted flex items-center justify-center ${s.cls}`}><s.icon className="h-4 w-4" /></div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{kpiLoading ? "—" : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div><CardTitle className="text-base font-semibold">Sales Analytics</CardTitle><p className="text-xs text-muted-foreground mt-0.5">Last 7 days</p></div>
              <div className="text-right"><p className="text-lg font-bold text-foreground">{kpis ? fmt(kpis.salesMonth) : "—"}</p><p className="text-[11px] text-muted-foreground">This Month</p></div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {salesLoading ? <Skeleton className="h-[240px] w-full rounded-xl" /> : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={weeklySales}>
                  <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.9} /><stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.3} /></linearGradient></defs>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }} formatter={(value: number) => [fmt(value), "Sales"]} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                  <Bar dataKey="sales" fill="url(#barGrad)" radius={[8, 8, 0, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base font-semibold">Repair Progress</CardTitle><p className="text-xs text-muted-foreground">Current status breakdown</p></CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={repairBreakdown || []} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {(repairBreakdown || []).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", fontSize: "12px", color: "hsl(var(--foreground))" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", color: "hsl(var(--muted-foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Invoices */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div><CardTitle className="text-base font-semibold">Recent Invoices</CardTitle><p className="text-xs text-muted-foreground">Latest transactions</p></div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-0">
            {(recentInvoices || []).map((inv: any) => (
              <div key={inv.id} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9"><AvatarFallback className="text-[11px] bg-primary/10 text-primary font-semibold">{(inv.customers?.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div><p className="text-sm font-medium text-foreground">{inv.customers?.name || "Unknown"}</p><p className="text-[11px] text-muted-foreground">{inv.invoice_number}</p></div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <p className="text-sm font-semibold text-foreground">{fmt(inv.total || 0)}</p>
                  {paymentBadge(inv.payment_status || "unpaid")}
                </div>
              </div>
            ))}
            {(!recentInvoices || recentInvoices.length === 0) && <p className="text-sm text-muted-foreground text-center py-8">No recent invoices</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
