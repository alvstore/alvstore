"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Avatar, Box, Button, ButtonBase, Chip, Divider, IconButton,
  LinearProgress, Skeleton, Tooltip, Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AccountBalanceWallet, Build, CheckCircleOutlined, Inventory2, NorthEast,
  Payments, PendingActions, People, PointOfSale, Receipt, Refresh, RequestQuote,
  ShoppingCart, TrendingUp,
} from "@mui/icons-material";
import { addDays, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import {
  AgendaWidget, AnimatedPage, ChecklistWidget, CountUp, DistributionWidget, EmptyState,
  InventoryWatchWidget, PageHeader, ProgressRing, StatCard, TrendChart, WidgetCard, WorkloadCalendar, money, type AgendaItem, type StatAccent,
} from "@/components/mui";
import { useAuth } from "@/hooks/useAuth";
import { useTaskBoard } from "@/hooks/useTaskBoard";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@/lib/router-compat";
import { completionPercent, dailySeries, localDateKey } from "@/lib/widget-data";
import { taskSummary } from "@/lib/task-summary";
import { controlFeedback } from "@/lib/motion-presets";

const integer = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const sum = (rows: any[] | null, column: string) => (rows ?? []).reduce((total, row) => total + Number(row[column] ?? 0), 0);
const assertResults = (results: { error: { message: string } | null }[]) => { for (const result of results) if (result.error) throw new Error(result.error.message); };

async function fetchKpis() {
  const today = startOfDay(new Date());
  const tomorrow = addDays(today, 1).toISOString();
  const monthStart = startOfMonth(today);
  const results = await Promise.all([
    supabase.from("pos_transactions").select("total").gte("created_at", today.toISOString()).lt("created_at", tomorrow),
    supabase.from("payments").select("amount").eq("status", "pending"),
    supabase.from("finance_accounts").select("current_balance").eq("status", "active"),
    supabase.from("finance_transactions").select("amount, type").gte("date", localDateKey(monthStart)).lte("date", localDateKey(today)),
    supabase.from("products").select("id", { count: "exact", head: true }).or("stock_quantity.lte.low_stock_threshold"),
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("total, paid_amount").gte("created_at", monthStart.toISOString()).lt("created_at", tomorrow),
  ]);
  assertResults(results);
  const [sales, pending, accounts, finance, stock, customers, invoices] = results;
  return {
    salesToday: sum(sales.data, "total"), pendingPayments: sum(pending.data, "amount"), totalBalance: sum(accounts.data, "current_balance"),
    revenue: sum(finance.data?.filter((row: any) => row.type === "income"), "amount"),
    expenses: sum(finance.data?.filter((row: any) => row.type === "expense"), "amount"),
    lowStock: stock.count ?? 0, totalCustomers: customers.count ?? 0,
    invoicesMonth: sum(invoices.data, "total"), collectedMonth: sum(invoices.data, "paid_amount"),
  };
}

async function fetchSalesTrend() {
  const { data, error } = await supabase.from("pos_transactions").select("total, created_at")
    .gte("created_at", startOfDay(subDays(new Date(), 59)).toISOString()).lt("created_at", startOfDay(addDays(new Date(), 1)).toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({ date: localDateKey(row.created_at), value: Number(row.total) }));
}

async function fetchRepairs() {
  const { data, error } = await supabase.from("job_sheets").select("status");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const completed = ["repair_completed", "quality_check", "invoice_generated", "delivered"].reduce((total, status) => total + (counts[status] ?? 0), 0);
  const total = (data ?? []).length - (counts.rejected ?? 0);
  const active = (data ?? []).length - (counts.delivered ?? 0) - (counts.invoice_generated ?? 0) - (counts.rejected ?? 0);
  return { completed, total, active, items: Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })) };
}

async function fetchRecentInvoices() {
  const { data, error } = await supabase.from("invoices").select("id, invoice_number, total, payment_status, created_at, customers(name)")
    .order("created_at", { ascending: false }).limit(5);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchLowStockItems() {
  const { data, error } = await supabase.from("products").select("id, name, stock_quantity, low_stock_threshold, category, selling_price")
    .or("stock_quantity.lte.low_stock_threshold")
    .order("stock_quantity", { ascending: true })
    .limit(5);
  if (error) throw new Error(error.message);
  return (data ?? []).filter((p: any) => Number(p.stock_quantity ?? 0) <= Number(p.low_stock_threshold ?? 0));
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [agendaDate, setAgendaDate] = useState(new Date());
  const weekStart = startOfWeek(agendaDate, { weekStartsOn: 1 });
  const key = ["dashboard", user?.id];
  const kpiQuery = useQuery({ queryKey: [...key, "kpis"], queryFn: fetchKpis, staleTime: 60_000 });
  const salesQuery = useQuery({ queryKey: [...key, "sales"], queryFn: fetchSalesTrend, staleTime: 60_000 });
  const repairsQuery = useQuery({ queryKey: [...key, "repairs"], queryFn: fetchRepairs, staleTime: 60_000 });
  const invoicesQuery = useQuery({ queryKey: [...key, "invoices"], queryFn: fetchRecentInvoices, staleTime: 60_000 });
  const lowStockQuery = useQuery({ queryKey: [...key, "low-stock"], queryFn: fetchLowStockItems, staleTime: 60_000 });
  const agendaQuery = useQuery({
    queryKey: [...key, "agenda", localDateKey(weekStart)], staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("calendar_events").select("id, title, start_date, all_day, category")
        .gte("start_date", weekStart.toISOString()).lte("start_date", endOfWeek(agendaDate, { weekStartsOn: 1 }).toISOString()).order("start_date");
      if (error) throw new Error(error.message);
      return (data ?? []).map((event: any) => ({ id: event.id, title: event.title, date: event.start_date, allDay: event.all_day, detail: event.category }));
    },
  });
  const board = useTaskBoard();
  const agendaItems: AgendaItem[] = [...(agendaQuery.data ?? []), ...board.tasks.filter(task => !!task.due_date).map(task => ({
    id: `task-${task.id}`, title: task.title, date: task.due_date!, allDay: true, kind: "task" as const,
    completed: task.status === "completed", detail: `${task.priority} priority · ${task.status.replace(/_/g, " ")}`,
  }))];
  const refreshing = [kpiQuery, salesQuery, repairsQuery, invoicesQuery, agendaQuery, lowStockQuery, board].some(query => query.isFetching);
  const work = taskSummary(board.tasks);
  const kpis = kpiQuery.data;
  const repairs = repairsQuery.data;
  const net = (kpis?.revenue ?? 0) - (kpis?.expenses ?? 0);
  const collection = completionPercent(kpis?.collectedMonth ?? 0, kpis?.invoicesMonth ?? 0);
  const repairHealth = repairs?.total ? completionPercent(repairs.completed, repairs.total) : 100;
  const taskHealth = work.total ? work.percent : 100;
  const stockHealth = Math.max(0, 100 - (kpis?.lowStock ?? 0) * 10);
  const vitalityScore = Math.round((repairHealth + collection + taskHealth + stockHealth) / 4);
  const today = localDateKey(new Date());
  const firstName = String(user?.user_metadata?.full_name ?? user?.email?.split("@")[0] ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ["dashboard"] }); void board.refresh(); };
  const kpiValue = (value?: number) => kpiQuery.isError ? "—" : value ?? 0;
  const stats: { label: string; value: number | string; isCurrency?: boolean; icon: React.ReactNode; accent: StatAccent; to: string; caption: string; sparkline?: number[] }[] = [
    { label: "Today's Sales", value: kpiValue(kpis?.salesToday), isCurrency: true, icon: <ShoppingCart fontSize="small" />, accent: "success", to: "/pos", caption: "Point-of-sale transactions", sparkline: salesQuery.data?.length ? dailySeries(salesQuery.data, 7).map(day => day.value) : undefined },
    { label: "Monthly Revenue", value: kpiValue(kpis?.revenue), isCurrency: true, icon: <TrendingUp fontSize="small" />, accent: "primary", to: "/finance", caption: format(new Date(), "MMMM 'to date'") },
    { label: "Cash Balance", value: kpiValue(kpis?.totalBalance), isCurrency: true, icon: <AccountBalanceWallet fontSize="small" />, accent: "info", to: "/finance", caption: "Across active accounts" },
    { label: "Pending Payments", value: kpiValue(kpis?.pendingPayments), isCurrency: true, icon: <PendingActions fontSize="small" />, accent: "warning", to: "/payments", caption: "Awaiting payment" },
    { label: "Customers", value: kpiValue(kpis?.totalCustomers), icon: <People fontSize="small" />, accent: "primary", to: "/customers", caption: "In your customer directory" },
    { label: "Active Repairs", value: repairsQuery.isError ? "—" : repairs?.active ?? 0, icon: <Build fontSize="small" />, accent: "secondary", to: "/repairs", caption: "Open, including ready for handover" },
    { label: "Invoices (Month)", value: kpiValue(kpis?.invoicesMonth), isCurrency: true, icon: <Receipt fontSize="small" />, accent: "success", to: "/invoices", caption: "Value invoiced this month" },
    { label: "Low Stock Items", value: kpiValue(kpis?.lowStock), icon: <Inventory2 fontSize="small" />, accent: "error", to: "/inventory", caption: "At or below reorder threshold" },
  ];
  const quickActions = [
    { label: "New Sale", icon: <PointOfSale fontSize="small" />, to: "/pos" },
    { label: "Quotation", icon: <RequestQuote fontSize="small" />, to: "/sales/new" },
    { label: "Invoice", icon: <Receipt fontSize="small" />, to: "/invoices/new" },
    { label: "Repair", icon: <Build fontSize="small" />, to: "/repairs/new" },
    { label: "Payment", icon: <Payments fontSize="small" />, to: "/finance" },
  ];

  return <AnimatedPage><Box sx={{ display: "grid", gap: 3 }}>
    <PageHeader title="Dashboard" subtitle={<>{greeting}, <Box component="span" sx={{ color: "primary.main", fontWeight: 600 }}>{firstName}</Box>. Welcome back — here’s your store at a glance.</>} actions={<>
      <Chip variant="outlined" size="small" label={format(new Date(), "EEE, d MMM")} sx={{ fontSize: 11 }} />
      <Tooltip title="Refresh dashboard"><Box component="span"><IconButton aria-label="Refresh dashboard" aria-busy={refreshing} loading={refreshing} onClick={refresh} size="small"><Refresh fontSize="small" /></IconButton></Box></Tooltip>
    </>} />

    <Box sx={theme => ({ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1.5, p: 1.75, px: 2.25, borderRadius: "16px", bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .04 : .025), border: `1px solid ${alpha(theme.palette.primary.main, .12)}` })}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        <Box sx={theme => ({ display: "inline-flex", alignItems: "center", gap: .85, px: 1.25, py: .35, borderRadius: "9999px", bgcolor: alpha(theme.palette.success.main, .1), border: `1px solid ${alpha(theme.palette.success.main, .25)}` })}>
          <Box sx={theme => ({
            width: 7, height: 7, borderRadius: "50%", bgcolor: "success.main", position: "relative",
            "&::after": {
              content: '""', position: "absolute", inset: -3, borderRadius: "50%",
              border: `2px solid ${alpha(theme.palette.success.main, .45)}`,
              animation: "alvStorePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            },
            "@keyframes alvStorePulse": {
              "0%, 100%": { opacity: 1, transform: "scale(1)" },
              "50%": { opacity: 0.25, transform: "scale(1.7)" },
            },
          })} />
          <Typography variant="caption" sx={{ fontSize: 10.5, fontWeight: 700, color: "success.main", letterSpacing: ".04em" }}>STORE ACTIVE</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
          <Box component="span" sx={{ fontWeight: 650, color: "text.primary" }}>{repairs?.active ?? 0}</Box> active repairs ·{" "}
          <Box component="span" sx={{ fontWeight: 650, color: "text.primary" }}>{work.total - work.completed}</Box> pending tasks ·{" "}
          {kpis?.lowStock ? <Box component="span" sx={{ color: "warning.main", fontWeight: 650 }}>{kpis.lowStock} low stock item{kpis.lowStock > 1 ? "s" : ""}</Box> : <Box component="span" sx={{ color: "success.main", fontWeight: 600 }}>Stock healthy</Box>}
        </Typography>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11.5, fontVariantNumeric: "tabular-nums" }}>
        Active cash balance: <Box component="span" sx={{ fontWeight: 700, color: "text.primary" }}>{money(kpis?.totalBalance ?? 0)}</Box>
      </Typography>
    </Box>

    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, fontWeight: 600, mr: .5, letterSpacing: ".05em", textTransform: "uppercase" }}>Quick actions:</Typography>
      {quickActions.map(action => <Button key={action.label} size="small" variant="outlined" startIcon={action.icon} onClick={() => navigate(action.to)} sx={{ borderColor: "divider", bgcolor: "background.paper", borderRadius: "10px", px: 1.5, fontWeight: 600, ...controlFeedback }}>{action.label}</Button>)}
    </Box>

    {kpiQuery.isError && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void kpiQuery.refetch()}>Retry</Button>}>Business totals could not be loaded. They are not shown as zero.</Alert>}

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,minmax(0,1fr))", lg: "repeat(4,minmax(0,1fr))" }, gap: 2 }}>
      {stats.map((stat, index) => <StatCard key={stat.label} {...stat} loading={stat.label === "Active Repairs" ? repairsQuery.isPending : kpiQuery.isPending} index={index} onClick={() => navigate(stat.to)} />)}
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1.5fr) minmax(0,1fr)" }, gap: 2.5 }}>
      <WorkloadCalendar tasks={board.tasks} date={agendaDate} onDateChange={setAgendaDate} loading={board.isPending} error={board.error?.message} onRetry={() => void board.refetch()} />
      <TrendChart title="Sales activity" subtitle="A little perspective on your daily sales." visual="area" series={[{ id: "sales", label: "POS sales", values: salesQuery.data ?? [], color: "primary" }]} loading={salesQuery.isPending} error={salesQuery.error?.message} onRetry={() => void salesQuery.refetch()} index={1} />
      <WidgetCard title="Repair momentum" subtitle="A clear view of your team’s repair progress." eyebrow="OPERATIONS" featured index={2} error={repairsQuery.error?.message} onRetry={() => void repairsQuery.refetch()} action={<Button size="small" endIcon={<NorthEast sx={{ fontSize: 13 }} />} onClick={() => navigate("/repairs")}>Jobs</Button>}>
        {repairsQuery.isPending ? <Skeleton variant="circular" width={144} height={144} sx={{ mx: "auto", my: 2 }} /> : repairs?.total ? <>
          <ProgressRing value={completionPercent(repairs.completed, repairs.total)} label="Repair completion" caption={`${repairs.completed} of ${repairs.total} non-rejected jobs repaired`} />
          <Box sx={{ mt: 2.5, display: "flex", gap: 1, alignItems: "center", justifyContent: "center", color: "text.secondary" }}><CheckCircleOutlined sx={{ fontSize: 15, color: "success.main" }} /><Typography variant="caption">Includes quality check, invoiced & delivered</Typography></Box>
        </> : <EmptyState title="Your next repair starts here" description="Repair completion will appear when jobs are recorded." action={<Button size="small" onClick={() => navigate("/repairs/new")}>Create a job</Button>} sx={{ py: 3 }} />}
        <Divider sx={{ my: 2 }} />
        {board.isError ? <Typography color="error" variant="caption">Task progress unavailable</Typography> : <>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}><Typography variant="caption" color="text.secondary">Team tasks</Typography><Typography variant="caption" sx={{ fontWeight: 600 }}>{board.isPending ? "Loading…" : `${work.completed} / ${work.total}`}</Typography></Box>
          <LinearProgress variant="determinate" value={work.percent} aria-label="Team task completion" sx={{ height: 5, borderRadius: 4 }} />
        </>}
      </WidgetCard>
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 2.5 }}>
      <ChecklistWidget items={work.focus.map(task => ({ id: task.id, title: task.title, completed: task.status === "completed", overdue: !!task.due_date && task.due_date < today, detail: task.due_date === today ? "Due today" : `Overdue · ${task.due_date}` }))} onToggle={(id, completed) => void board.updateStatus(id, completed ? "completed" : "pending")} pendingIds={board.pendingIds} loading={board.isPending} error={board.error?.message} onRetry={() => void board.refetch()} action={<Button size="small" onClick={() => navigate("/tasks")}>View all</Button>} />
      <AgendaWidget items={agendaItems} date={agendaDate} onDateChange={setAgendaDate} onOpen={item => navigate(item.kind === "task" ? "/tasks" : `/calendar?date=${localDateKey(item.date)}`)} loading={agendaQuery.isPending || board.isPending} error={agendaQuery.error?.message ?? board.error?.message} onRetry={() => { void agendaQuery.refetch(); void board.refetch(); }} index={1} action={<Button size="small" onClick={() => navigate("/calendar")}>Calendar</Button>} />
      <WidgetCard title="Financial overview" subtitle={format(new Date(), "MMMM yyyy")} index={2} error={kpiQuery.error?.message} onRetry={() => void kpiQuery.refetch()}>
        {kpiQuery.isPending ? <Skeleton height={180} /> : <>
          {[
            { label: "Income recorded", value: kpis?.revenue ?? 0, color: "success.main" },
            { label: "Expenses recorded", value: kpis?.expenses ?? 0, color: "warning.main" },
            { label: "Net income", value: net, color: net >= 0 ? "text.primary" : "error.main" },
          ].map(item => <Box key={item.label} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.5, borderBottom: 1, borderColor: "divider", gap: 1 }}><Typography variant="caption" color="text.secondary">{item.label}</Typography><Typography variant="body2" sx={{ color: item.color, fontWeight: 600 }}><CountUp value={item.value} formatter={money} /></Typography></Box>)}
          <Box sx={{ pt: 2.5 }}><Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 1 }}><Typography variant="caption" color="text.secondary">This month’s invoice collection</Typography><Typography variant="caption" sx={{ fontWeight: 600 }}>{Math.round(collection)}%</Typography></Box><LinearProgress variant="determinate" value={collection} color="success" aria-label="Invoice collection" sx={{ height: 5, borderRadius: 4 }} /><Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, fontSize: 10 }}>{money(kpis?.collectedMonth ?? 0)} paid against {money(kpis?.invoicesMonth ?? 0)} invoiced</Typography></Box>
        </>}
      </WidgetCard>
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.8fr) minmax(0,1fr)" }, gap: 2.5 }}>
      <WidgetCard title="Recent invoices" subtitle="The latest from your business." error={invoicesQuery.error?.message} onRetry={() => void invoicesQuery.refetch()} action={<Button size="small" endIcon={<NorthEast sx={{ fontSize: 13 }} />} onClick={() => navigate("/invoices")}>View all</Button>}>
        {invoicesQuery.isPending ? <Box>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height={65} />)}</Box> : !invoicesQuery.data?.length ? <EmptyState title="No invoices yet" description="Your most recent invoices will appear here." /> : invoicesQuery.data.map((invoice: any) => <ButtonBase key={invoice.id} onClick={() => navigate(`/invoices/${invoice.id}`)} sx={theme => ({ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.6, px: .75, borderRadius: 2, textAlign: "left", borderBottom: `1px solid ${theme.palette.divider}`, "&:last-child": { borderBottom: 0 }, "&:hover": { bgcolor: alpha(theme.palette.primary.main, .04) }, gap: 1 })}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, minWidth: 0 }}><Avatar sx={theme => ({ width: 34, height: 34, fontSize: 11, bgcolor: alpha(theme.palette.primary.main, .08), color: "primary.main" })}>{String(invoice.customers?.name ?? "?").slice(0, 2).toUpperCase()}</Avatar><Box sx={{ minWidth: 0 }}><Typography variant="body2" noWrap sx={{ fontSize: 12, fontWeight: 550 }}>{invoice.customers?.name ?? "Walk-in customer"}</Typography><Typography variant="caption" color="text.secondary" sx={{ fontSize: 10 }}>{invoice.invoice_number}</Typography></Box></Box>
          <Box sx={{ textAlign: "right", flexShrink: 0 }}><Typography variant="body2" sx={{ fontSize: 12, fontWeight: 650 }}>{money(Number(invoice.total ?? 0))}</Typography><Typography variant="caption" color={invoice.payment_status === "paid" ? "success.main" : "text.secondary"} sx={{ fontSize: 10, textTransform: "capitalize" }}>{invoice.payment_status ?? "unpaid"}</Typography></Box>
        </ButtonBase>)}
      </WidgetCard>
      <DistributionWidget title="Repair pipeline" subtitle="Every job, by its current stage." items={repairs?.items ?? []} loading={repairsQuery.isPending} error={repairsQuery.error?.message} onRetry={() => void repairsQuery.refetch()} formatter={integer} index={1} />
    </Box>

    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "repeat(2,minmax(0,1fr))" }, gap: 2.5 }}>
      <InventoryWatchWidget
        items={lowStockQuery.data ?? []}
        loading={lowStockQuery.isPending}
        error={lowStockQuery.error?.message}
        onRetry={() => void lowStockQuery.refetch()}
        index={2}
      />
      <WidgetCard
        title="Store operational pulse"
        subtitle="Operational vitality and key activity across store departments."
        eyebrow="CROSS-MODULE STATUS"
        index={3}
      >
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "140px 1fr" }, gap: 2.5, alignItems: "center", pt: 1 }}>
          <Box sx={{ textAlign: "center", py: 1 }}>
            <ProgressRing
              value={vitalityScore}
              label="Store vitality index"
              caption="Operational vitality"
              size={120}
              color={vitalityScore >= 75 ? "success" : vitalityScore >= 50 ? "primary" : "warning"}
            />
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)" }, gap: 1.5 }}>
            <Box sx={theme => ({ p: 1.75, borderRadius: 2.5, bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? .06 : .03), border: `1px solid ${alpha(theme.palette.primary.main, .1)}` })}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Customer directory</Typography>
              <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                <CountUp value={kpis?.totalCustomers ?? 0} />
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontSize: 10.5 }}>Active client accounts in CRM</Typography>
              <Button size="small" variant="text" onClick={() => navigate("/crm")} sx={{ mt: 0.75, p: 0, minHeight: "auto", fontSize: 11.5, fontWeight: 600 }}>Manage customers →</Button>
            </Box>
            <Box sx={theme => ({ p: 1.75, borderRadius: 2.5, bgcolor: alpha(theme.palette.success.main, theme.palette.mode === "dark" ? .06 : .03), border: `1px solid ${alpha(theme.palette.success.main, .1)}` })}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Collection performance</Typography>
              <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "success.main" }}>
                {Math.round(collection)}%
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontSize: 10.5 }}>{money(kpis?.collectedMonth ?? 0)} collected</Typography>
              <Button size="small" variant="text" color="success" onClick={() => navigate("/invoices")} sx={{ mt: 0.75, p: 0, minHeight: "auto", fontSize: 11.5, fontWeight: 600 }}>View billing →</Button>
            </Box>
            <Box sx={theme => ({ p: 1.75, borderRadius: 2.5, bgcolor: alpha(theme.palette.warning.main, theme.palette.mode === "dark" ? .06 : .03), border: `1px solid ${alpha(theme.palette.warning.main, .1)}` })}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Pending receivables</Typography>
              <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "warning.main" }}>
                {money(kpis?.pendingPayments ?? 0)}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontSize: 10.5 }}>Awaiting customer clearance</Typography>
              <Button size="small" variant="text" color="warning" onClick={() => navigate("/payments")} sx={{ mt: 0.75, p: 0, minHeight: "auto", fontSize: 11.5, fontWeight: 600 }}>Review payments →</Button>
            </Box>
            <Box sx={theme => ({ p: 1.75, borderRadius: 2.5, bgcolor: alpha(theme.palette.info.main, theme.palette.mode === "dark" ? .06 : .03), border: `1px solid ${alpha(theme.palette.info.main, .1)}` })}>
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Repair throughput</Typography>
              <Typography variant="h6" sx={{ mt: 0.25, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "info.main" }}>
                {repairs?.completed ?? 0} jobs
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, fontSize: 10.5 }}>Repairs completed to date</Typography>
              <Button size="small" variant="text" color="info" onClick={() => navigate("/repairs")} sx={{ mt: 0.75, p: 0, minHeight: "auto", fontSize: 11.5, fontWeight: 600 }}>Open repairs board →</Button>
            </Box>
          </Box>
        </Box>
      </WidgetCard>
    </Box>
  </Box></AnimatedPage>;
}
