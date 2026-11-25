"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Avatar, Box, Button, Card, Chip, Divider, IconButton,
  LinearProgress, Skeleton, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AccountBalanceWallet, Build, CheckCircleOutlined, Inventory2, NorthEast,
  Payments, PendingActions, People, PointOfSale, Receipt, Refresh, RequestQuote,
  ShoppingCart, TrendingUp,
} from "@mui/icons-material";
import { addDays, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subDays } from "date-fns";
import {
  AgendaWidget, AnimatedPage, ChecklistWidget, CountUp, DataTable, DistributionWidget, EmptyState,
  InventoryWatchWidget, MetricStrip, PageHeader, ProgressRing, StatCard, TrendChart, WidgetCard,
  WorkloadCalendar, money, type AgendaItem,
} from "@/components/mui";
import { useAuth } from "@/hooks/useAuth";
import { useTaskBoard } from "@/hooks/useTaskBoard";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@/lib/router-compat";
import { completionPercent, dailySeries, localDateKey } from "@/lib/widget-data";
import { taskSummary } from "@/lib/task-summary";
import { controlFeedback } from "@/lib/motion-presets";
import { pastelPillColors, solidHeaderBg, solidTextTone } from "@/lib/pill-style";
import { formatTaskStatus } from "@/lib/task-lanes";

const integer = (value: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
const sum = (rows: any[] | null, column: string) =>
  (rows ?? []).reduce((total, row) => total + Number(row[column] ?? 0), 0);
const assertResults = (results: { error: { message: string } | null }[]) => {
  for (const result of results) if (result.error) throw new Error(result.error.message);
};

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
    supabase
      .from("invoices")
      .select("total, paid_amount")
      .neq("status", "cancelled")
      .gte("created_at", monthStart.toISOString())
      .lt("created_at", tomorrow),
  ]);
  assertResults(results);
  const [sales, pending, accounts, finance, stock, customers, invoices] = results;
  return {
    salesToday: sum(sales.data, "total"),
    pendingPayments: sum(pending.data, "amount"),
    totalBalance: sum(accounts.data, "current_balance"),
    revenue: sum(finance.data?.filter((row: any) => row.type === "income"), "amount"),
    expenses: sum(finance.data?.filter((row: any) => row.type === "expense"), "amount"),
    lowStock: stock.count ?? 0,
    totalCustomers: customers.count ?? 0,
    invoicesMonth: sum(invoices.data, "total"),
    collectedMonth: sum(invoices.data, "paid_amount"),
  };
}

async function fetchSalesTrend() {
  const { data, error } = await supabase
    .from("pos_transactions")
    .select("total, created_at")
    .gte("created_at", startOfDay(subDays(new Date(), 59)).toISOString())
    .lt("created_at", startOfDay(addDays(new Date(), 1)).toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).map((row: any) => ({ date: localDateKey(row.created_at), value: Number(row.total) }));
}

async function fetchRepairs() {
  const { data, error } = await supabase.from("job_sheets").select("status");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const completed = ["repair_completed", "quality_check", "invoice_generated", "delivered"].reduce(
    (total, status) => total + (counts[status] ?? 0),
    0
  );
  const total = (data ?? []).length - (counts.rejected ?? 0);
  const active = (data ?? []).length - (counts.delivered ?? 0) - (counts.invoice_generated ?? 0) - (counts.rejected ?? 0);
  return {
    completed,
    total,
    active,
    items: Object.entries(counts).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })),
  };
}

async function fetchRecentInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, paid_amount, payment_status, status, created_at, customers(name)")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function fetchLowStockItems() {
  const { data, error } = await supabase
    .from("products")
    .select("id, name, stock_quantity, low_stock_threshold, category, selling_price")
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
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const paperBg = muiTheme.palette.background.paper;

  const [agendaDate, setAgendaDate] = useState(new Date());
  const weekStart = startOfWeek(agendaDate, { weekStartsOn: 1 });
  const key = ["dashboard", user?.id];

  const kpiQuery = useQuery({ queryKey: [...key, "kpis"], queryFn: fetchKpis, staleTime: 60_000 });
  const salesQuery = useQuery({ queryKey: [...key, "sales"], queryFn: fetchSalesTrend, staleTime: 60_000 });
  const repairsQuery = useQuery({ queryKey: [...key, "repairs"], queryFn: fetchRepairs, staleTime: 60_000 });
  const invoicesQuery = useQuery({ queryKey: [...key, "invoices"], queryFn: fetchRecentInvoices, staleTime: 60_000 });
  const lowStockQuery = useQuery({ queryKey: [...key, "low-stock"], queryFn: fetchLowStockItems, staleTime: 60_000 });
  const agendaQuery = useQuery({
    queryKey: [...key, "agenda", localDateKey(weekStart)],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calendar_events")
        .select("id, title, start_date, all_day, category")
        .gte("start_date", weekStart.toISOString())
        .lte("start_date", endOfWeek(agendaDate, { weekStartsOn: 1 }).toISOString())
        .order("start_date");
      if (error) throw new Error(error.message);
      return (data ?? []).map((event: any) => ({
        id: event.id,
        title: event.title,
        date: event.start_date,
        allDay: Boolean(event.all_day),
        detail: event.category || "business",
      }));
    },
  });

  const board = useTaskBoard();
  const agendaItems: AgendaItem[] = [
    ...(agendaQuery.data ?? []),
    ...board.tasks
      .filter((task) => !!task.due_date)
      .map((task) => ({
        id: `task-${task.id}`,
        title: task.title,
        date: task.due_date!,
        allDay: true,
        kind: "task" as const,
        completed: task.status === "completed",
        detail: `${task.priority ?? "medium"} priority · ${formatTaskStatus(task.status)}`,
      })),
  ];

  const refreshing = [kpiQuery, salesQuery, repairsQuery, invoicesQuery, agendaQuery, lowStockQuery, board].some(
    (query) => query.isFetching
  );
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

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    void board.refresh();
  };
  const kpiValue = (value?: number) => (kpiQuery.isError ? "—" : value ?? 0);

  const quickActions = [
    { label: "New Sale", icon: <PointOfSale fontSize="small" />, to: "/pos" },
    { label: "Quotation", icon: <RequestQuote fontSize="small" />, to: "/sales/new" },
    { label: "Invoice", icon: <Receipt fontSize="small" />, to: "/invoices/new" },
    { label: "Repair", icon: <Build fontSize="small" />, to: "/repairs/new" },
    { label: "Payment", icon: <Payments fontSize="small" />, to: "/finance" },
  ];

  const paidPill = pastelPillColors(muiTheme.palette.success.main, paperBg, isDark);
  const pendingPill = pastelPillColors(muiTheme.palette.warning.main, paperBg, isDark);
  const primaryPill = pastelPillColors(muiTheme.palette.primary.main, paperBg, isDark);

  const activityItems = [
    ...(invoicesQuery.data ?? []).slice(0, 2).map((inv: any) => ({
      id: `inv-${inv.id}`,
      color: muiTheme.palette.success.main,
      title: `Invoice #${inv.invoice_number} (${inv.customers?.name ?? "Walk-in"})`,
      subtitle: `${money(Number(inv.total ?? 0))} · ${inv.payment_status ?? "unpaid"}`,
      time: format(new Date(inv.created_at), "d MMM"),
    })),
    ...board.tasks.slice(0, 2).map((task) => ({
      id: `tsk-${task.id}`,
      color: task.status === "completed" ? muiTheme.palette.info.main : muiTheme.palette.warning.main,
      title: task.title,
      subtitle: `${task.priority ?? "medium"} priority · ${formatTaskStatus(task.status)}`,
      time: task.due_date ? format(new Date(`${task.due_date}T00:00:00`), "d MMM") : "No due date",
    })),
  ];

  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 3, minWidth: 0 }}>
        <PageHeader
          title="Dashboard"
          subtitle={
            <>
              {greeting},{" "}
              <Box component="span" sx={{ color: solidTextTone(muiTheme.palette.primary.main, paperBg, isDark), fontWeight: 600 }}>
                {firstName}
              </Box>
              . Welcome back — here’s your store at a glance.
            </>
          }
          actions={
            <>
              <Chip variant="outlined" size="small" label={format(new Date(), "EEE, d MMM")} sx={{ fontSize: 11 }} />
              <Tooltip title="Refresh dashboard">
                <Box component="span">
                  <IconButton
                    aria-label="Refresh dashboard"
                    aria-busy={refreshing}
                    loading={refreshing}
                    onClick={refresh}
                    size="small"
                    sx={{ minWidth: 36, minHeight: 36 }}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </Box>
              </Tooltip>
            </>
          }
        />

        {/* Store Active Pulse + Quick Actions */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
            p: 1.75,
            px: 2.25,
            borderRadius: "16px",
            bgcolor: alpha(muiTheme.palette.primary.main, isDark ? 0.05 : 0.03),
            border: `1px solid ${alpha(muiTheme.palette.primary.main, 0.14)}`,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.85,
                px: 1.25,
                py: 0.35,
                borderRadius: "9999px",
                bgcolor: paidPill.backgroundColor,
                border: `1px solid ${alpha(muiTheme.palette.success.main, 0.25)}`,
              }}
            >
              <Box
                sx={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  bgcolor: "success.main",
                  position: "relative",
                  "&::after": {
                    content: '""',
                    position: "absolute",
                    inset: -3,
                    borderRadius: "50%",
                    border: `2px solid ${alpha(muiTheme.palette.success.main, 0.45)}`,
                    animation: "alvStorePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                  },
                  "@keyframes alvStorePulse": {
                    "0%, 100%": { opacity: 1, transform: "scale(1)" },
                    "50%": { opacity: 0.25, transform: "scale(1.7)" },
                  },
                }}
              />
              <Typography variant="caption" sx={{ fontSize: 10.5, fontWeight: 700, color: paidPill.color, letterSpacing: ".04em" }}>
                STORE ACTIVE
              </Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 12 }}>
              <Box component="span" sx={{ fontWeight: 650, color: "text.primary" }}>
                {repairsQuery.isPending || repairsQuery.isError ? "—" : repairs?.active ?? 0}
              </Box>{" "}
              active repairs ·{" "}
              <Box component="span" sx={{ fontWeight: 650, color: "text.primary" }}>
                {board.isPending || board.isError ? "—" : work.total - work.completed}
              </Box>{" "}
              pending tasks ·{" "}
              {kpiQuery.isError ? (
                <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>Stock unavailable</Box>
              ) : kpiQuery.isPending ? (
                <Box component="span" sx={{ color: "text.secondary", fontWeight: 600 }}>Checking stock…</Box>
              ) : kpis?.lowStock ? (
                <Box
                  component="span"
                  sx={{ color: solidTextTone(muiTheme.palette.warning.main, paperBg, isDark), fontWeight: 650 }}
                >
                  {kpis.lowStock} low stock item{kpis.lowStock > 1 ? "s" : ""}
                </Box>
              ) : (
                <Box
                  component="span"
                  sx={{ color: solidTextTone(muiTheme.palette.success.main, paperBg, isDark), fontWeight: 600 }}
                >
                  Stock healthy
                </Box>
              )}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 0.85, flexWrap: "wrap", alignItems: "center" }}>
            {quickActions.map((action) => (
              <Button
                key={action.label}
                size="small"
                variant="outlined"
                startIcon={action.icon}
                onClick={() => navigate(action.to)}
                sx={{ borderColor: "divider", bgcolor: "background.paper", borderRadius: "10px", px: 1.35, fontWeight: 600, ...controlFeedback }}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        </Box>

        {kpiQuery.isError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void kpiQuery.refetch()}>
                Retry
              </Button>
            }
          >
            Business totals could not be loaded. They are not shown as zero.
          </Alert>
        )}

        {/* Row 1: Materialize CRM Bento Hero + Balanced Primary KPIs */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
            gap: 2,
          }}
        >
          {/* Hero Performance Card */}
          <Card
            sx={{
              gridColumn: { xs: "auto", sm: "1 / -1", lg: "span 2" },
              p: 2.5,
              borderRadius: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              background: `linear-gradient(135deg, ${alpha(muiTheme.palette.primary.main, isDark ? 0.14 : 0.06)}, ${paperBg} 75%)`,
              borderColor: alpha(muiTheme.palette.primary.main, 0.2),
            }}
          >
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, letterSpacing: "-0.02em" }}>
                {firstName}’s Store Summary
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                {format(new Date(), "MMMM yyyy")} performance
              </Typography>
              {kpiQuery.isPending ? (
                <>
                  <Skeleton width={150} height={38} />
                  <Skeleton width={190} height={18} sx={{ mt: 0.5, mb: 1.75 }} />
                </>
              ) : (
                <>
                  <Typography
                    component="div"
                    sx={{
                      fontSize: { xs: 24, sm: 28 },
                      fontWeight: 750,
                      color: solidTextTone(muiTheme.palette.primary.main, paperBg, isDark),
                      letterSpacing: "-0.04em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {kpiQuery.isError ? "—" : <CountUp value={kpis?.revenue ?? 0} formatter={money} />}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, mb: 1.75 }}>
                    {kpiQuery.isError ? "Monthly collection unavailable" : `${Math.round(collection)}% of monthly billing collected`}
                  </Typography>
                </>
              )}
              <Button variant="contained" size="small" onClick={() => navigate("/invoices")} sx={{ borderRadius: "8px", minHeight: 36 }}>
                View Invoices
              </Button>
            </Box>
            <Box sx={{ flexShrink: 0, display: { xs: "none", sm: "block" } }}>
              {kpiQuery.isPending ? (
                <Skeleton variant="circular" width={96} height={96} />
              ) : (
                <ProgressRing
                  size={96}
                  value={kpiQuery.isError ? 0 : Math.round(collection)}
                  label="Monthly invoice collection"
                  color="primary"
                />
              )}
            </Box>
          </Card>

          <StatCard
            label="Today's Sales"
            value={kpiValue(kpis?.salesToday)}
            isCurrency
            icon={<ShoppingCart fontSize="small" />}
            accent="success"
            trend="Today"
            caption="POS transactions"
            sparkline={salesQuery.data?.length ? dailySeries(salesQuery.data, 7).map((day) => day.value) : undefined}
            loading={kpiQuery.isPending}
            index={1}
            onClick={() => navigate("/pos")}
          />
          <StatCard
            label="Invoices (Month)"
            value={kpiValue(kpis?.invoicesMonth)}
            isCurrency
            icon={<Receipt fontSize="small" />}
            accent="primary"
            trend={kpiQuery.isError ? "Unavailable" : `${Math.round(collection)}% paid`}
            caption="Value invoiced"
            loading={kpiQuery.isPending}
            index={2}
            onClick={() => navigate("/invoices")}
          />
        </Box>

        {/* Unified 4-Cell Secondary MetricStrip */}
        <MetricStrip
          loading={kpiQuery.isPending || repairsQuery.isPending}
          index={1}
          items={[
            {
              id: "cash-balance",
              label: "Cash Balance",
              value: kpiValue(kpis?.totalBalance),
              isCurrency: true,
              caption: "Active accounts",
              icon: <AccountBalanceWallet fontSize="small" />,
              accent: "info",
              onClick: () => navigate("/finance"),
            },
            {
              id: "pending-payments",
              label: "Pending Payments",
              value: kpiValue(kpis?.pendingPayments),
              isCurrency: true,
              caption: "Awaiting clearance",
              icon: <PendingActions fontSize="small" />,
              accent: "warning",
              onClick: () => navigate("/payments"),
            },
            {
              id: "repairs",
              label: "Active Repairs",
              value: repairsQuery.isError ? "—" : repairs?.active ?? 0,
              caption: "Open & ready jobs",
              icon: <Build fontSize="small" />,
              accent: "primary",
              onClick: () => navigate("/repairs"),
            },
            {
              id: "low-stock",
              label: "Low Stock Items",
              value: kpiValue(kpis?.lowStock),
              caption: kpis?.totalCustomers !== undefined ? `${integer(kpis.totalCustomers)} CRM customers` : "At reorder level",
              icon: <Inventory2 fontSize="small" />,
              accent: kpis?.lowStock ? "error" : "success",
              onClick: () => navigate("/inventory"),
            },
          ]}
        />

        {/* Row 2 (Above Fold): Sales Activity + Repair Momentum */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1.7fr) minmax(0,1fr)" }, gap: 2.5 }}>
          <TrendChart
            title="Sales activity"
            subtitle="A little perspective on your daily sales."
            visual="area"
            series={[{ id: "sales", label: "POS sales", values: salesQuery.data ?? [], color: "primary" }]}
            loading={salesQuery.isPending}
            error={salesQuery.error?.message}
            onRetry={() => void salesQuery.refetch()}
            index={0}
          />
          <WidgetCard
            title="Repair momentum"
            subtitle="A clear view of your team’s repair progress."
            eyebrow="OPERATIONS"
            featured
            index={1}
            error={repairsQuery.error?.message}
            onRetry={() => void repairsQuery.refetch()}
            action={
              <Button size="small" endIcon={<NorthEast sx={{ fontSize: 13 }} />} onClick={() => navigate("/repairs")} sx={{ minHeight: 36 }}>
                Jobs
              </Button>
            }
          >
            {repairsQuery.isPending ? (
              <Skeleton variant="circular" width={144} height={144} sx={{ mx: "auto", my: 2 }} />
            ) : repairs?.total ? (
              <>
                <ProgressRing
                  value={completionPercent(repairs.completed, repairs.total)}
                  label="Repair completion"
                  caption={`${repairs.completed} of ${repairs.total} non-rejected jobs repaired`}
                />
                <Box sx={{ mt: 2.5, display: "flex", gap: 1, alignItems: "center", justifyContent: "center", color: "text.secondary" }}>
                  <CheckCircleOutlined sx={{ fontSize: 15, color: solidTextTone(muiTheme.palette.success.main, paperBg, isDark) }} />
                  <Typography variant="caption">Includes quality check, invoiced &amp; delivered</Typography>
                </Box>
              </>
            ) : (
              <EmptyState
                title="Your next repair starts here"
                description="Repair completion will appear when jobs are recorded."
                action={<Button size="small" onClick={() => navigate("/repairs/new")}>Create a job</Button>}
                sx={{ py: 3 }}
              />
            )}
            <Divider sx={{ my: 2 }} />
            {board.isError ? (
              <Typography color="error" variant="caption">Task progress unavailable</Typography>
            ) : (
              <>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">Team tasks</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {board.isPending ? "Loading…" : `${work.completed} / ${work.total}`}
                  </Typography>
                </Box>
                <LinearProgress variant="determinate" value={work.percent} aria-label="Team task completion" sx={{ height: 5, borderRadius: 4 }} />
              </>
            )}
          </WidgetCard>
        </Box>

        {/* Row 3: Synced Workload Calendar, Agenda, and Checklist */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", md: "repeat(2,minmax(0,1fr))", lg: "repeat(3,minmax(0,1fr))" }, gap: 2.5 }}>
          <WorkloadCalendar
            tasks={board.tasks}
            date={agendaDate}
            onDateChange={setAgendaDate}
            loading={board.isPending}
            error={board.error?.message}
            onRetry={() => void board.refetch()}
          />
          <AgendaWidget
            items={agendaItems}
            date={agendaDate}
            onDateChange={setAgendaDate}
            onOpen={(item) => navigate(item.kind === "task" ? "/tasks" : `/calendar?date=${localDateKey(item.date)}`)}
            loading={agendaQuery.isPending || board.isPending}
            error={agendaQuery.error?.message ?? board.error?.message}
            onRetry={() => {
              void agendaQuery.refetch();
              void board.refetch();
            }}
            index={1}
            action={<Button size="small" onClick={() => navigate("/calendar")}>Calendar</Button>}
          />
          <ChecklistWidget
            items={work.focus.map((task) => ({
              id: task.id,
              title: task.title,
              completed: task.status === "completed",
              overdue: !!task.due_date && task.due_date < today,
              detail: task.due_date === today ? "Due today" : `Overdue · ${task.due_date}`,
            }))}
            onToggle={(id, completed) => void board.updateStatus(id, completed ? "completed" : "pending")}
            pendingIds={board.pendingIds}
            loading={board.isPending}
            error={board.error?.message}
            onRetry={() => void board.refetch()}
            action={<Button size="small" onClick={() => navigate("/tasks")}>View all</Button>}
          />
        </Box>

        {/* Row 4 (Below Initial 1000px Fold): Repair Pipeline, Financial & Activity Timeline (Left) + Recent Invoices & Inventory (Right) */}
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0,1fr)", lg: "minmax(0,1fr) minmax(0,1.6fr)" }, gap: 2.5 }}>
          <Box sx={{ display: "grid", gap: 2.5, alignContent: "start" }}>
            <DistributionWidget
              title="Repair pipeline"
              subtitle="Every job, by its current stage."
              items={repairs?.items ?? []}
              loading={repairsQuery.isPending}
              error={repairsQuery.error?.message}
              onRetry={() => void repairsQuery.refetch()}
              formatter={integer}
              index={0}
            />
            <WidgetCard title="Financial overview" subtitle={format(new Date(), "MMMM yyyy")} index={1} error={kpiQuery.error?.message} onRetry={() => void kpiQuery.refetch()}>
              {kpiQuery.isPending ? (
                <Skeleton height={160} />
              ) : (
                <>
                  {[
                    {
                      label: "Income recorded",
                      value: kpis?.revenue ?? 0,
                      color: solidTextTone(muiTheme.palette.success.main, paperBg, isDark),
                    },
                    {
                      label: "Expenses recorded",
                      value: kpis?.expenses ?? 0,
                      color: solidTextTone(muiTheme.palette.warning.main, paperBg, isDark),
                    },
                    {
                      label: "Net income",
                      value: net,
                      color: net >= 0 ? "text.primary" : solidTextTone(muiTheme.palette.error.main, paperBg, isDark),
                    },
                  ].map((item) => (
                    <Box key={item.label} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.25, borderBottom: 1, borderColor: "divider", gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">{item.label}</Typography>
                      <Typography variant="body2" sx={{ color: item.color, fontWeight: 650 }}>
                        {kpiQuery.isError ? "—" : <CountUp value={item.value} formatter={money} />}
                      </Typography>
                    </Box>
                  ))}
                  <Box sx={{ pt: 2 }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1, mb: 0.75 }}>
                      <Typography variant="caption" color="text.secondary">Invoice collection rate</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 650 }}>{Math.round(collection)}%</Typography>
                    </Box>
                    <LinearProgress variant="determinate" value={collection} color="success" aria-label="Invoice collection" sx={{ height: 5, borderRadius: 4 }} />
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75, fontSize: 10.5 }}>
                      {money(kpis?.collectedMonth ?? 0)} paid against {money(kpis?.invoicesMonth ?? 0)} invoiced
                    </Typography>
                  </Box>
                </>
              )}
            </WidgetCard>

            <WidgetCard title="Activity Timeline" subtitle="Recent billing and team checkpoints" index={1}>
              {activityItems.length === 0 ? (
                <EmptyState title="No recent activity" description="New invoices and tasks will stream here." sx={{ py: 2 }} />
              ) : (
                <Box sx={{ display: "grid", gap: 1.5 }}>
                  {activityItems.map((entry, idx) => (
                    <Box key={entry.id} sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                      <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", pt: 0.6 }}>
                        <Box sx={{ width: 9, height: 9, borderRadius: "50%", bgcolor: entry.color }} />
                        {idx < activityItems.length - 1 && <Box sx={{ width: 1.5, flex: 1, minHeight: 24, bgcolor: "divider", mt: 0.5 }} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", justifyContent: "space-between", gap: 1 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: 12.5 }}>
                            {entry.title}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, fontSize: 11 }}>
                            {entry.time}
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary" sx={{ textTransform: "capitalize" }}>
                          {entry.subtitle}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                </Box>
              )}
            </WidgetCard>
          </Box>

          <Box sx={{ display: "grid", gap: 2.5, alignContent: "start" }}>
            <WidgetCard
              title="Recent invoices"
              subtitle="The latest from your billing desk."
              error={invoicesQuery.error?.message}
              onRetry={() => void invoicesQuery.refetch()}
              action={
                <Button size="small" endIcon={<NorthEast sx={{ fontSize: 13 }} />} onClick={() => navigate("/invoices")}>
                  View all
                </Button>
              }
              index={2}
            >
              <DataTable
                columnsCount={4}
                loading={invoicesQuery.isPending}
                empty={!invoicesQuery.data?.length}
                emptyMessage={<EmptyState title="No invoices yet" description="Your most recent invoices will appear here." />}
                maxHeight={320}
                sx={{
                  "& thead th": {
                    bgcolor: solidHeaderBg(paperBg, isDark),
                    fontSize: "11px",
                    fontWeight: 650,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "text.secondary",
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell>#ID</TableCell>
                    <TableCell>Client</TableCell>
                    <TableCell>Total</TableCell>
                    <TableCell sx={{ textAlign: "right" }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(invoicesQuery.data ?? []).map((invoice: any) => {
                    const clientName = invoice.customers?.name ?? "Walk-in customer";
                    const invTotal = Number(invoice.total ?? 0);
                    const isPaid = invTotal > 0 && invoice.payment_status === "paid";
                    return (
                      <TableRow
                        key={invoice.id}
                        onClick={() => navigate(`/invoices/${invoice.id}`)}
                        sx={{ cursor: "pointer" }}
                      >
                        <TableCell sx={{ whiteSpace: "nowrap" }}>
                          <Button
                            variant="text"
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/invoices/${invoice.id}`);
                            }}
                            sx={{
                              minWidth: 0,
                              minHeight: 36,
                              px: 0.75,
                              ml: -0.75,
                              fontFamily: "monospace",
                              fontWeight: 700,
                              fontSize: 12.5,
                              color: solidTextTone(muiTheme.palette.primary.main, paperBg, isDark),
                              textTransform: "none",
                            }}
                          >
                            #{invoice.invoice_number}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 10.5, fontWeight: 700, ...primaryPill }}>
                              {String(clientName).slice(0, 2).toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" noWrap sx={{ fontSize: 12.5, fontWeight: 550 }}>
                              {clientName}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 650, fontSize: 12.5, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                          {money(invTotal)}
                        </TableCell>
                        <TableCell sx={{ textAlign: "right" }}>
                          <Chip
                            size="small"
                            label={invoice.payment_status ?? "unpaid"}
                            sx={{
                              height: 22,
                              fontSize: 11,
                              fontWeight: 650,
                              textTransform: "capitalize",
                              borderRadius: "6px",
                              ...(isPaid ? paidPill : pendingPill),
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </DataTable>
            </WidgetCard>

            <InventoryWatchWidget
              items={lowStockQuery.data ?? []}
              loading={lowStockQuery.isPending}
              error={lowStockQuery.error?.message}
              onRetry={() => void lowStockQuery.refetch()}
              index={3}
            />
          </Box>
        </Box>
      </Box>
    </AnimatedPage>
  );
}
