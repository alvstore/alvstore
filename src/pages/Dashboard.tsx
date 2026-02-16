import {
  DollarSign, TrendingUp, CreditCard, Wallet,
  Package, Wrench, CheckCircle, Users, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays, startOfDay, startOfMonth } from "date-fns";

// --- Data fetchers ---

async function fetchKpis() {
  const today = startOfDay(new Date()).toISOString();
  const monthStart = startOfMonth(new Date()).toISOString();

  const [salesToday, salesMonth, pendingPayments, cashBalance, lowStock, activeRepairs, completedToday, totalCustomers] = await Promise.all([
    supabase.from("pos_transactions").select("total").gte("created_at", today).then(r => r.data?.reduce((s, t) => s + Number(t.total), 0) ?? 0),
    supabase.from("pos_transactions").select("total").gte("created_at", monthStart).then(r => r.data?.reduce((s, t) => s + Number(t.total), 0) ?? 0),
    supabase.from("payments").select("amount").eq("status", "pending").then(r => r.data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0),
    supabase.from("payments").select("amount").eq("status", "completed").then(r => r.data?.reduce((s, p) => s + Number(p.amount), 0) ?? 0),
    supabase.from("products").select("id", { count: "exact", head: true }).or("stock_quantity.lte.low_stock_threshold").then(r => r.count ?? 0),
    supabase.from("repair_tickets").select("id", { count: "exact", head: true }).not("status", "in", '("completed","delivered")').then(r => r.count ?? 0),
    supabase.from("repair_status_history").select("id", { count: "exact", head: true }).eq("new_status", "completed").gte("created_at", today).then(r => r.count ?? 0),
    supabase.from("customers").select("id", { count: "exact", head: true }).then(r => r.count ?? 0),
  ]);

  return { salesToday, salesMonth, pendingPayments, cashBalance, lowStock, activeRepairs, completedToday, totalCustomers };
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

function fmt(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: kpis, isLoading: kpiLoading } = useQuery({ queryKey: ["dashboard-kpis"], queryFn: fetchKpis, staleTime: 60_000 });
  const { data: salesTrend, isLoading: trendLoading } = useQuery({ queryKey: ["dashboard-sales-trend"], queryFn: fetchSalesTrend, staleTime: 60_000 });
  const { data: repairBreakdown } = useQuery({ queryKey: ["dashboard-repairs"], queryFn: fetchRepairBreakdown, staleTime: 60_000 });
  const { data: topProducts } = useQuery({ queryKey: ["dashboard-top-products"], queryFn: fetchTopProducts, staleTime: 60_000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-sales-trend"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-repairs"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-top-products"] });
  };

  const kpiCards = [
    { label: "Sales Today", value: kpis ? fmt(kpis.salesToday) : "—", icon: DollarSign, color: "text-primary" },
    { label: "Sales This Month", value: kpis ? fmt(kpis.salesMonth) : "—", icon: TrendingUp, color: "text-success" },
    { label: "Pending Payments", value: kpis ? fmt(kpis.pendingPayments) : "—", icon: CreditCard, color: "text-warning" },
    { label: "Cash Balance", value: kpis ? fmt(kpis.cashBalance) : "—", icon: Wallet, color: "text-info" },
    { label: "Low Stock Items", value: kpis ? String(kpis.lowStock) : "—", icon: Package, color: "text-destructive" },
    { label: "Active Repairs", value: kpis ? String(kpis.activeRepairs) : "—", icon: Wrench, color: "text-accent" },
    { label: "Completed Today", value: kpis ? String(kpis.completedToday) : "—", icon: CheckCircle, color: "text-success" },
    { label: "Total Customers", value: kpis ? String(kpis.totalCustomers) : "—", icon: Users, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome back. Here's your business overview.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-5">
              {kpiLoading ? (
                <div className="space-y-2"><Skeleton className="h-4 w-24" /><Skeleton className="h-7 w-32" /></div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold">{kpi.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-xl bg-muted ${kpi.color}`}>
                    <kpi.icon className="h-5 w-5" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Sales Trend (Last 7 Days)</CardTitle></CardHeader>
          <CardContent>
            {trendLoading ? <Skeleton className="h-[280px] w-full" /> : (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Line type="monotone" dataKey="sales" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ fill: "hsl(var(--primary))", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Repair Status Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={repairBreakdown || []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={4} dataKey="value">
                  {(repairBreakdown || []).map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Top Selling Products</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart layout="vertical" data={topProducts || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="qty" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
