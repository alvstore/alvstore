import {
  DollarSign, TrendingUp, CreditCard, Wallet,
  Package, Wrench, CheckCircle, Users, RefreshCw,
  ArrowUpRight, ArrowDownRight, ShoppingCart, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

// --- Data fetchers ---

async function fetchKpis() {
  const today = startOfDay(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [salesToday, salesMonth, pendingPayments, totalBalance, revenue, expenses, lowStock, activeRepairs, completedToday, totalCustomers,
    quotationsToday, quotationsMonth, invoicesToday, invoicesMonth] = await Promise.all([
    supabase.from("pos_transactions").select("total").gte("created_at", today).then(r => r.data?.reduce((s, t) => s + Number(t.total), 0) ?? 0),
    supabase.from("pos_transactions").select("total").gte("created_at", monthStart).then(r => r.data?.reduce((s, t) => s + Number(t.total), 0) ?? 0),
    supabase.from("payments").select("amount").eq("status", "pending").then(r => r.data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0),
    supabase.from("finance_accounts").select("current_balance").eq("status", "active").then(r => r.data?.reduce((s, a) => s + Number(a.current_balance), 0) ?? 0),
    supabase.from("finance_transactions").select("amount").eq("type", "income").gte("date", format(startOfMonth(new Date()), "yyyy-MM-dd")).then(r => r.data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0),
    supabase.from("finance_transactions").select("amount").eq("type", "expense").gte("date", format(startOfMonth(new Date()), "yyyy-MM-dd")).then(r => r.data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0),
    supabase.from("products").select("id", { count: "exact", head: true }).or("stock_quantity.lte.low_stock_threshold").then(r => r.count ?? 0),
    supabase.from("repair_tickets").select("id", { count: "exact", head: true }).not("status", "in", '("completed","delivered")').then(r => r.count ?? 0),
    supabase.from("repair_status_history").select("id", { count: "exact", head: true }).eq("new_status", "completed").gte("created_at", today).then(r => r.count ?? 0),
    supabase.from("customers").select("id", { count: "exact", head: true }).then(r => r.count ?? 0),
    // Quotations
    supabase.from("quotations").select("total").gte("created_at", today).then(r => r.data?.reduce((s, t) => s + Number(t.total || 0), 0) ?? 0),
    supabase.from("quotations").select("total").gte("created_at", monthStart).then(r => r.data?.reduce((s, t) => s + Number(t.total || 0), 0) ?? 0),
    // Invoices
    supabase.from("invoices").select("total").gte("created_at", today).then(r => r.data?.reduce((s, t) => s + Number(t.total || 0), 0) ?? 0),
    supabase.from("invoices").select("total").gte("created_at", monthStart).then(r => r.data?.reduce((s, t) => s + Number(t.total || 0), 0) ?? 0),
  ]);

  return { salesToday, salesMonth, pendingPayments, totalBalance, revenue, expenses, lowStock, activeRepairs, completedToday, totalCustomers,
    quotationsToday, quotationsMonth, invoicesToday, invoicesMonth };
}

async function fetchIncomeExpenseTrend() {
  const days: { name: string; income: number; expense: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const dayStr = format(d, "yyyy-MM-dd");
    const [incData, expData] = await Promise.all([
      supabase.from("finance_transactions").select("amount").eq("type", "income").eq("date", dayStr),
      supabase.from("finance_transactions").select("amount").eq("type", "expense").eq("date", dayStr),
    ]);
    days.push({
      name: format(d, "EEE"),
      income: incData.data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0,
      expense: expData.data?.reduce((s, t) => s + Number(t.amount), 0) ?? 0,
    });
  }
  return days;
}

async function fetchSalesTrend() {
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
  const { data } = await supabase.from("repair_tickets").select("status");
  const counts: Record<string, number> = {};
  data?.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
  const colorMap: Record<string, string> = {
    pending: "hsl(38, 92%, 50%)", assigned: "hsl(200, 80%, 55%)",
    in_progress: "hsl(217, 91%, 60%)", waiting_parts: "hsl(262, 83%, 58%)",
    completed: "hsl(142, 71%, 45%)", delivered: "hsl(0, 0%, 60%)",
  };
  return Object.entries(counts).map(([name, value]) => ({ name: name.replace("_", " "), value, color: colorMap[name] || "hsl(0,0%,50%)" }));
}

async function fetchTopProducts() {
  const { data } = await supabase.from("pos_transactions").select("items");
  const productQty: Record<string, number> = {};
  data?.forEach(t => {
    const items = t.items as any[];
    items?.forEach((item: any) => {
      const name = item.product_name || item.name || "Unknown";
      productQty[name] = (productQty[name] || 0) + (item.quantity || 1);
    });
  });
  return Object.entries(productQty).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, qty]) => ({ name, qty }));
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

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: kpis, isLoading: kpiLoading } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: fetchKpis, staleTime: 60_000 });
  const { data: salesTrend, isLoading: trendLoading } = useQuery({ queryKey: ["dashboard-sales-trend"], queryFn: fetchSalesTrend, staleTime: 60_000 });
  const { data: incomeExpenseTrend } = useQuery({ queryKey: ["dashboard-income-expense"], queryFn: fetchIncomeExpenseTrend, staleTime: 60_000 });
  const { data: repairBreakdown } = useQuery({ queryKey: ["dashboard-repairs"], queryFn: fetchRepairBreakdown, staleTime: 60_000 });
  const { data: topProducts } = useQuery({ queryKey: ["dashboard-top-products"], queryFn: fetchTopProducts, staleTime: 60_000 });
  const { data: recentInvoices } = useQuery({ queryKey: ["dashboard-recent-invoices"], queryFn: fetchRecentInvoices, staleTime: 60_000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-sales-trend"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-income-expense"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-repairs"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-top-products"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-recent-invoices"] });
  };

  const kpiCards = [
    { label: "Revenue", value: kpis ? fmt(kpis.revenue) : "—", icon: TrendingUp, bg: "bg-success/10", iconColor: "text-success", trend: "+8%", up: true },
    { label: "Expenses", value: kpis ? fmt(kpis.expenses) : "—", icon: CreditCard, bg: "bg-destructive/10", iconColor: "text-destructive", trend: "-5%", up: false },
    { label: "Net Balance", value: kpis ? fmt(kpis.totalBalance) : "—", icon: Wallet, bg: "bg-primary/10", iconColor: "text-primary", trend: "+12%", up: true },
    { label: "Total Customers", value: kpis ? String(kpis.totalCustomers) : "—", icon: Users, bg: "bg-info/10", iconColor: "text-info", trend: "+22%", up: true },
  ];

  const salesWidgets = [
    { label: "POS Sales Today", value: kpis ? fmt(kpis.salesToday) : "—", sub: kpis ? `This Month: ${fmt(kpis.salesMonth)}` : "", icon: ShoppingCart, bg: "bg-primary/10", iconColor: "text-primary" },
    { label: "Quotations Today", value: kpis ? fmt(kpis.quotationsToday) : "—", sub: kpis ? `This Month: ${fmt(kpis.quotationsMonth)}` : "", icon: Clock, bg: "bg-warning/10", iconColor: "text-warning" },
    { label: "Invoices Today", value: kpis ? fmt(kpis.invoicesToday) : "—", sub: kpis ? `This Month: ${fmt(kpis.invoicesMonth)}` : "", icon: CreditCard, bg: "bg-success/10", iconColor: "text-success" },
  ];

  const statCards = [
    { label: "Low Stock", value: kpis ? String(kpis.lowStock) : "—", icon: Package, color: "text-destructive" },
    { label: "Active Repairs", value: kpis ? String(kpis.activeRepairs) : "—", icon: Wrench, color: "text-accent" },
    { label: "Completed Today", value: kpis ? String(kpis.completedToday) : "—", icon: CheckCircle, color: "text-success" },
  ];

  const paymentBadge = (status: string) => {
    const styles: Record<string, string> = {
      paid: "bg-success/10 text-success",
      unpaid: "bg-destructive/10 text-destructive",
      partial: "bg-warning/10 text-warning",
    };
    return (
      <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full capitalize ${styles[status] || "bg-muted text-muted-foreground"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent overflow-hidden">
        <CardContent className="p-6 flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome back! 🎉
            </h1>
            <p className="text-sm text-muted-foreground max-w-md">
              Here's what's happening with your business today. Keep up the great work!
            </p>
            <Button variant="default" size="sm" className="mt-2" onClick={refresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-2" />Refresh Data
            </Button>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Today's Date</p>
              <p className="text-sm font-semibold text-foreground">{format(new Date(), "dd MMM yyyy")}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary KPI Cards - Materialize style with trend indicators */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="border-border/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              {kpiLoading ? (
                <div className="space-y-3"><Skeleton className="h-4 w-20" /><Skeleton className="h-8 w-28" /></div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                    <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                    <div className={`flex items-center gap-1 text-xs font-medium ${kpi.up ? "text-success" : "text-destructive"}`}>
                      {kpi.up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {kpi.trend}
                    </div>
                  </div>
                  <div className={`h-11 w-11 rounded-xl ${kpi.bg} flex items-center justify-center`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Sales / Quotations / Invoices Widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {salesWidgets.map((w) => (
          <Card key={w.label} className="border-border/50 shadow-sm">
            <CardContent className="p-5">
              {kpiLoading ? (
                <div className="space-y-3"><Skeleton className="h-4 w-24" /><Skeleton className="h-8 w-32" /></div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{w.label}</p>
                    <p className="text-2xl font-bold text-foreground">{w.value}</p>
                    <p className="text-[11px] text-muted-foreground">{w.sub}</p>
                  </div>
                  <div className={`h-11 w-11 rounded-xl ${w.bg} flex items-center justify-center`}>
                    <w.icon className={`h-5 w-5 ${w.iconColor}`} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary stat row */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map((s) => (
          <Card key={s.label} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg bg-muted flex items-center justify-center ${s.color}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground font-medium">{s.label}</p>
                <p className="text-lg font-bold text-foreground">{kpiLoading ? "—" : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 gap-6">
        {/* Sales Trend - Area chart */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Sales Trend</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Last 7 days performance</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-foreground">{kpis ? fmt(kpis.salesMonth) : "—"}</p>
                <p className="text-[11px] text-muted-foreground">This Month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {trendLoading ? <Skeleton className="h-[260px] w-full rounded-lg" /> : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={salesTrend}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                      borderRadius: "8px", fontSize: "12px", boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
                    }}
                    formatter={(value: number) => [fmt(value), "Sales"]}
                  />
                  <Area type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#salesGradient)" dot={{ fill: "hsl(var(--primary))", r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 - Income/Expense + Repair */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Expense Bar Chart */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Income vs Expenses</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Last 7 days from Finance</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-success">{kpis ? fmt(kpis.revenue - kpis.expenses) : "—"}</p>
                <p className="text-[11px] text-muted-foreground">Net This Month</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={incomeExpenseTrend || []} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} formatter={(value: number) => [fmt(value)]} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="income" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={16} name="Income" />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={16} name="Expense" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Repair Breakdown - Donut (moved from row 1) */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Repair Status</CardTitle>
            <p className="text-xs text-muted-foreground">Current breakdown</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={repairBreakdown || []} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {(repairBreakdown || []).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products - Horizontal Bar */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Top Selling Products</CardTitle>
            <p className="text-xs text-muted-foreground">By quantity sold</p>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart layout="vertical" data={topProducts || []} barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={100} stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="qty" fill="hsl(var(--info))" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Invoices - Materialize style list */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Recent Invoices</CardTitle>
                <p className="text-xs text-muted-foreground">Latest transactions</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-0">
              {(recentInvoices || []).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between py-3 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-[11px] bg-primary/10 text-primary font-semibold">
                        {(inv.customers?.name || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium text-foreground">{inv.customers?.name || "Unknown"}</p>
                      <p className="text-[11px] text-muted-foreground">{inv.invoice_number}</p>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-3">
                    <p className="text-sm font-semibold text-foreground">{fmt(inv.total || 0)}</p>
                    {paymentBadge(inv.payment_status || "unpaid")}
                  </div>
                </div>
              ))}
              {(!recentInvoices || recentInvoices.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No recent invoices</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
