import {
  DollarSign, TrendingUp, CreditCard, Wallet,
  Package, Wrench, CheckCircle, Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const kpis = [
  { label: "Sales Today", value: "₹24,500", icon: DollarSign, trend: "+12%", color: "text-primary" },
  { label: "Sales This Month", value: "₹4,85,000", icon: TrendingUp, trend: "+8%", color: "text-success" },
  { label: "Pending Payments", value: "₹1,20,000", icon: CreditCard, trend: "5 invoices", color: "text-warning" },
  { label: "Cash Balance", value: "₹3,65,000", icon: Wallet, trend: "", color: "text-info" },
  { label: "Low Stock Items", value: "12", icon: Package, trend: "Action needed", color: "text-destructive" },
  { label: "Active Repairs", value: "8", icon: Wrench, trend: "3 urgent", color: "text-accent" },
  { label: "Completed Today", value: "5", icon: CheckCircle, trend: "+2 vs yesterday", color: "text-success" },
  { label: "Total Customers", value: "1,245", icon: Users, trend: "+15 this week", color: "text-primary" },
];

const salesTrend = [
  { name: "Mon", sales: 12000 },
  { name: "Tue", sales: 19000 },
  { name: "Wed", sales: 15000 },
  { name: "Thu", sales: 22000 },
  { name: "Fri", sales: 24500 },
  { name: "Sat", sales: 31000 },
  { name: "Sun", sales: 18000 },
];

const revenueExpenses = [
  { name: "Jan", revenue: 400000, expenses: 240000 },
  { name: "Feb", revenue: 380000, expenses: 220000 },
  { name: "Mar", revenue: 520000, expenses: 280000 },
  { name: "Apr", revenue: 485000, expenses: 260000 },
];

const repairStatus = [
  { name: "Pending", value: 12, color: "hsl(38, 92%, 50%)" },
  { name: "In Progress", value: 8, color: "hsl(217, 91%, 60%)" },
  { name: "Completed", value: 25, color: "hsl(142, 71%, 45%)" },
  { name: "Waiting Parts", value: 5, color: "hsl(262, 83%, 58%)" },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back. Here's your business overview.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="animate-fade-in">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-bold">{kpi.value}</p>
                  {kpi.trend && (
                    <p className="text-xs text-muted-foreground">{kpi.trend}</p>
                  )}
                </div>
                <div className={`p-2.5 rounded-xl bg-muted ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sales Trend (This Week)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="sales"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue vs Expenses */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueExpenses}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Repair Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Repair Status Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={repairStatus}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {repairStatus.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products placeholder */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Selling Products</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                layout="vertical"
                data={[
                  { name: "iPhone Screen", qty: 45 },
                  { name: "Samsung Battery", qty: 38 },
                  { name: "USB-C Cable", qty: 32 },
                  { name: "Tempered Glass", qty: 28 },
                  { name: "Back Cover", qty: 22 },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" width={110} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="qty" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
