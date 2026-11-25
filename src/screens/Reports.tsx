"use client";

import {
  Box, Button, Card, CardContent, Chip, MenuItem, Tab, TableBody, TableCell,
  TableHead, TableRow, TextField, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AnimatedPage, ChartTooltipCard, ChartViewport, DataTable, DistributionWidget, EmptyState, PageHeader,
  StatCard, TabBar, TabPanel, TabView, WidgetCard, toast,
} from "@/components/mui";
import { useState, useEffect, useMemo, useId } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";
import { compactAxisNumber, sortChronologicalTrend } from "@/lib/chart-theme";
import { motionTokens } from "@/lib/motion-presets";
import { Download, TrendingUp, Package, Wrench, DollarSign, CheckCircle, AlertTriangle } from "lucide-react";
import { format, subDays } from "date-fns";

const money = (val: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

export default function Reports() {
  const [tab, setTab] = useState("sales");
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gap: 3 }}>
        <PageHeader
          title="Reports & Analytics"
          subtitle="Real-time business performance analytics, distribution insights, and CSV exports"
          actions={
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <TextField
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                size="small"
                label="From"
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
              <Typography variant="caption" color="text.secondary">
                to
              </Typography>
              <TextField
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                size="small"
                label="To"
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ width: 150 }}
              />
            </Box>
          }
        />

        <TabView value={tab} onChange={setTab}>
          <TabBar>
            <Tab
              value="sales"
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box component={TrendingUp} sx={{ height: 15, width: 15 }} />
                  Sales Analytics
                </Box>
              }
            />
            <Tab
              value="inventory"
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box component={Package} sx={{ height: 15, width: 15 }} />
                  Inventory Health
                </Box>
              }
            />
            <Tab
              value="repairs"
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box component={Wrench} sx={{ height: 15, width: 15 }} />
                  Repair Service
                </Box>
              }
            />
            <Tab
              value="payments"
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                  <Box component={DollarSign} sx={{ height: 15, width: 15 }} />
                  Payment Collections
                </Box>
              }
            />
          </TabBar>

          <TabPanel value="sales">
            <SalesReport start={startDate} end={endDate} />
          </TabPanel>
          <TabPanel value="inventory">
            <InventoryReport />
          </TabPanel>
          <TabPanel value="repairs">
            <RepairsReport start={startDate} end={endDate} />
          </TabPanel>
          <TabPanel value="payments">
            <PaymentsReport start={startDate} end={endDate} />
          </TabPanel>
        </TabView>
      </Box>
    </AnimatedPage>
  );
}

function SalesReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    setLoading(true);
    supabase
      .from("pos_transactions")
      .select("*")
      .gte("created_at", start)
      .lte("created_at", end + "T23:59:59")
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => {
        setData(rows || []);
        setLoading(false);
      });
  }, [start, end]);

  const totalSales = data.reduce((s, d) => s + (d.total || 0), 0);
  const avgSale = data.length ? totalSales / data.length : 0;
  const maxSale = data.length ? Math.max(...data.map(d => d.total || 0)) : 0;
  const salesGradId = `sales-grad-${useId().replace(/:/g, "")}`;

  const dailyTrend = useMemo(() => sortChronologicalTrend(data), [data]);
  const dailyAverage = dailyTrend.length
    ? dailyTrend.reduce((sum, point) => sum + point.total, 0) / dailyTrend.length
    : 0;

  const exportCSV = () => {
    const csv =
      "Transaction,Total,Method,Date\n" +
      data
        .map(d => `${d.transaction_number},${d.total},${d.payment_method},${d.created_at}`)
        .join("\n");
    downloadCSV(csv, `sales-report-${start}-to-${end}.csv`);
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5, pt: 1 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard
          label="Total POS Sales"
          value={totalSales}
          isCurrency
          accent="primary"
          loading={loading}
          index={0}
        />
        <StatCard
          label="Transactions"
          value={data.length}
          accent="info"
          loading={loading}
          index={1}
        />
        <StatCard
          label="Avg Ticket Size"
          value={avgSale}
          isCurrency
          accent="success"
          loading={loading}
          index={2}
        />
        <StatCard
          label="Peak Sale"
          value={maxSale}
          isCurrency
          accent="secondary"
          loading={loading}
          index={3}
        />
      </Box>

      {dailyTrend.length > 1 && (
        <WidgetCard
          title="Sales Trajectory"
          subtitle="Daily aggregated POS collections for selected window · chronological order"
          index={1}
          action={
            <Button
              onClick={exportCSV}
              variant="outlined"
              size="small"
              startIcon={<Box component={Download} sx={{ height: 14, width: 14 }} />}
            >
              Export CSV
            </Button>
          }
        >
          <ChartViewport
            height={240}
            label={`POS sales trajectory across ${dailyTrend.length} active days totaling ${money(totalSales)}`}
          >
            {animate => (
              <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                <AreaChart accessibilityLayer data={dailyTrend} margin={{ top: 10, right: 10, left: -8, bottom: 0 }}>
                  <defs>
                    <linearGradient id={salesGradId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.26} />
                      <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.015} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 5" stroke={alpha(theme.palette.divider, 0.75)} vertical={false} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} dy={6} />
                  <YAxis width={46} axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} tickFormatter={compactAxisNumber} tickCount={4} />
                  {dailyAverage > 0 && (
                    <ReferenceLine y={dailyAverage} stroke={alpha(theme.palette.text.secondary, 0.4)} strokeDasharray="3 4" />
                  )}
                  <Tooltip
                    cursor={{ stroke: alpha(theme.palette.primary.main, 0.25), strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      const pt = payload?.[0]?.payload as { isoDate?: string; date?: string } | undefined;
                      return (
                        <ChartTooltipCard
                          active={active}
                          title={pt?.isoDate || pt?.date}
                          entries={payload?.map(item => ({ name: "POS Sales", value: Number(item.value ?? 0), color: theme.palette.primary.main }))}
                          formatter={money}
                          hint={dailyAverage > 0 ? `Daily avg: ${money(dailyAverage)}` : undefined}
                        />
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#${salesGradId})`}
                    dot={dailyTrend.length <= 10 ? { r: 3, strokeWidth: 1.75, stroke: theme.palette.primary.main, fill: theme.palette.background.paper } : false}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: theme.palette.background.paper, fill: theme.palette.primary.main }}
                    animationDuration={motionTokens.chart * 1000}
                    animationEasing="ease-out"
                    isAnimationActive={animate}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartViewport>
        </WidgetCard>
      )}

      <Card sx={{ borderRadius: "18px" }}>
        <Box sx={{ p: 2, pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Transaction Log ({data.length})
          </Typography>
          {dailyTrend.length <= 1 && (
            <Button
              onClick={exportCSV}
              variant="outlined"
              size="small"
              startIcon={<Box component={Download} sx={{ height: 14, width: 14 }} />}
            >
              Export CSV
            </Button>
          )}
        </Box>
        <CardContent sx={{ p: 0 }}>
          <DataTable columnsCount={4} empty={data.length === 0} emptyMessage="No sales recorded in selected window">
            <TableHead>
              <TableRow>
                <TableCell>Transaction #</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Total</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map(d => (
                <TableRow key={d.id}>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{d.transaction_number}</TableCell>
                  <TableCell sx={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12.5 }}>
                    {money(d.total || 0)}
                  </TableCell>
                  <TableCell sx={{ textTransform: "capitalize", fontSize: 12 }}>{d.payment_method}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {format(new Date(d.created_at), "dd MMM yyyy, h:mm a")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </CardContent>
      </Card>
    </Box>
  );
}

function InventoryReport() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    setLoading(true);
    supabase
      .from("products")
      .select("name,stock_quantity,low_stock_threshold,selling_price,category")
      .order("stock_quantity")
      .then(({ data: rows }) => {
        setData(rows || []);
        setLoading(false);
      });
  }, []);

  const totalProducts = data.length;
  const lowStock = data.filter(p => p.stock_quantity <= p.low_stock_threshold && p.stock_quantity > 0).length;
  const outOfStock = data.filter(p => p.stock_quantity <= 0).length;
  const healthy = totalProducts - lowStock - outOfStock;

  const categoryDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of data) {
      const cat = p.category || "Uncategorized";
      map[cat] = (map[cat] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [data]);

  const exportCSV = () => {
    const csv =
      "Product,Stock,Threshold,Price,Category\n" +
      data
        .map(
          d =>
            `"${d.name}",${d.stock_quantity},${d.low_stock_threshold},${d.selling_price},"${d.category || ""}"`
        )
        .join("\n");
    downloadCSV(csv, "inventory-report.csv");
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5, pt: 1 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard
          label="Total SKUs"
          value={totalProducts}
          accent="primary"
          loading={loading}
        />
        <StatCard
          label="Healthy Stock"
          value={healthy}
          accent="success"
          loading={loading}
        />
        <StatCard
          label="Low Stock Warning"
          value={lowStock}
          accent="warning"
          loading={loading}
        />
        <StatCard
          label="Out of Stock"
          value={outOfStock}
          accent="error"
          loading={loading}
        />
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1.6fr 1fr" }, gap: 2.5 }}>
        <WidgetCard
          title="Stock Levels by SKU"
          subtitle="Lowest 12 inventory items by on-hand quantity"
          index={0}
          action={
            <Button
              onClick={exportCSV}
              variant="outlined"
              size="small"
              startIcon={<Box component={Download} sx={{ height: 14, width: 14 }} />}
            >
              Export CSV
            </Button>
          }
        >
          {data.length === 0 ? (
            <EmptyState title="No products in catalog" description="Stock comparisons appear once products are recorded." sx={{ py: 4 }} />
          ) : (
            <>
              <ChartViewport
                height={Math.max(240, Math.min(data.length, 12) * 28)}
                label={`On-hand stock levels for lowest ${Math.min(data.length, 12)} SKUs`}
              >
                {animate => (
                  <ResponsiveContainer width="100%" height="100%" minWidth={1}>
                    <BarChart accessibilityLayer layout="vertical" data={data.slice(0, 12)} margin={{ top: 4, right: 20, left: 6, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 5" stroke={alpha(theme.palette.divider, 0.75)} horizontal={false} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} tickFormatter={compactAxisNumber} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={128}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: theme.palette.text.secondary, fontSize: 11 }}
                        tickFormatter={val => (String(val).length > 18 ? `${String(val).slice(0, 17)}…` : String(val))}
                      />
                      <Tooltip
                        cursor={{ fill: alpha(theme.palette.primary.main, 0.06) }}
                        content={({ active, payload }) => {
                          const row = payload?.[0]?.payload as { name?: string; stock_quantity?: number; low_stock_threshold?: number } | undefined;
                          const qty = Number(row?.stock_quantity ?? 0);
                          const threshold = Number(row?.low_stock_threshold ?? 0);
                          const barColor = qty <= 0 ? theme.palette.error.main : qty <= threshold ? theme.palette.warning.main : theme.palette.primary.main;
                          const stateLabel = qty <= 0 ? "Out of stock" : qty <= threshold ? `Below threshold (${threshold})` : `Healthy (reorder at ${threshold})`;
                          return (
                            <ChartTooltipCard
                              active={active}
                              title={row?.name}
                              entries={[{ name: "On-hand units", value: qty, color: barColor }]}
                              formatter={val => `${val} units`}
                              hint={stateLabel}
                            />
                          );
                        }}
                      />
                      <Bar dataKey="stock_quantity" barSize={14} radius={[0, 6, 6, 0]} animationDuration={motionTokens.chart * 1000} animationEasing="ease-out" isAnimationActive={animate}>
                        {data.slice(0, 12).map((row, idx) => {
                          const qty = Number(row.stock_quantity ?? 0);
                          const threshold = Number(row.low_stock_threshold ?? 0);
                          const fill = qty <= 0 ? theme.palette.error.main : qty <= threshold ? theme.palette.warning.main : theme.palette.primary.main;
                          return <Cell key={`${row.name}-${idx}`} fill={fill} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartViewport>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, pt: 1.75, mt: 1, borderTop: 1, borderColor: "divider" }}>
                {[
                  { label: `Out of stock (${outOfStock})`, color: "error.main" },
                  { label: `Low stock (${lowStock})`, color: "warning.main" },
                  { label: `Healthy (${healthy})`, color: "primary.main" },
                ].map(item => (
                  <Box key={item.label} sx={{ display: "flex", alignItems: "center", gap: 0.6 }}>
                    <Box component="span" sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: item.color }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, fontVariantNumeric: "tabular-nums" }}>{item.label}</Typography>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </WidgetCard>

        <DistributionWidget
          title="Catalog by category"
          subtitle="Inventory product count distribution."
          items={categoryDistribution}
          loading={loading}
          formatter={val => `${val} SKUs`}
        />
      </Box>

      <Card sx={{ borderRadius: "18px" }}>
        <Box sx={{ p: 2, pb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Inventory Catalog Table
          </Typography>
        </Box>
        <CardContent sx={{ p: 0 }}>
          <DataTable columnsCount={5} empty={data.length === 0} emptyMessage="No products in catalog">
            <TableHead>
              <TableRow>
                <TableCell>Product Name</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Stock</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Threshold</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Selling Price</TableCell>
                <TableCell>Category</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((d, i) => {
                const isCritical = d.stock_quantity <= d.low_stock_threshold;
                return (
                  <TableRow key={i}>
                    <TableCell sx={{ fontWeight: 600, fontSize: 12, color: isCritical ? "error.main" : "text.primary" }}>
                      {d.name}
                    </TableCell>
                    <TableCell sx={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12 }}>
                      {d.stock_quantity}
                    </TableCell>
                    <TableCell sx={{ textAlign: "right", fontSize: 12, color: "text.secondary" }}>
                      {d.low_stock_threshold}
                    </TableCell>
                    <TableCell sx={{ textAlign: "right", fontSize: 12, fontFamily: "monospace" }}>
                      {money(d.selling_price || 0)}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12 }}>{d.category || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </CardContent>
      </Card>
    </Box>
  );
}

function RepairsReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("repair_tickets")
      .select("ticket_number,status,priority,device_type,device_brand,created_at")
      .gte("created_at", start)
      .lte("created_at", end + "T23:59:59")
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => {
        setData(rows || []);
        setLoading(false);
      });
  }, [start, end]);

  const completed = data.filter(d => ["completed", "delivered", "closed"].includes(d.status)).length;
  const inProgress = data.filter(d => ["in_progress", "assigned", "diagnosing"].includes(d.status)).length;
  const urgent = data.filter(d => d.priority === "urgent" || d.priority === "high").length;

  const statusDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of data) {
      const s = (d.status || "unassigned").replace(/_/g, " ");
      map[s] = (map[s] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [data]);

  const exportCSV = () => {
    const csv =
      "Ticket,Status,Priority,Device,Date\n" +
      data
        .map(
          d =>
            `${d.ticket_number},${d.status},${d.priority},"${d.device_brand || ""} ${d.device_type || ""}",${d.created_at}`
        )
        .join("\n");
    downloadCSV(csv, `repairs-report-${start}-to-${end}.csv`);
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5, pt: 1 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard
          label="Total Tickets"
          value={data.length}
          accent="primary"
          loading={loading}
        />
        <StatCard
          label="Completed"
          value={completed}
          accent="success"
          loading={loading}
        />
        <StatCard
          label="In Progress"
          value={inProgress}
          accent="warning"
          loading={loading}
        />
        <StatCard
          label="High Priority"
          value={urgent}
          accent="error"
          loading={loading}
        />
      </Box>

      {statusDistribution.length > 0 && (
        <DistributionWidget
          title="Repair ticket distribution"
          subtitle="Breakdown of tickets by resolution status."
          items={statusDistribution}
          loading={loading}
          formatter={val => `${val} tickets`}
        />
      )}

      <Card sx={{ borderRadius: "18px" }}>
        <Box sx={{ p: 2, pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Repair Ticket Records ({data.length})
          </Typography>
          <Button
            onClick={exportCSV}
            variant="outlined"
            size="small"
            startIcon={<Box component={Download} sx={{ height: 14, width: 14 }} />}
          >
            Export CSV
          </Button>
        </Box>
        <CardContent sx={{ p: 0 }}>
          <DataTable columnsCount={5} empty={data.length === 0} emptyMessage="No repair tickets in selected period">
            <TableHead>
              <TableRow>
                <TableCell>Ticket #</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Device</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map(d => (
                <TableRow key={d.ticket_number}>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{d.ticket_number}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize", fontSize: 12 }}>
                    {d.status?.replace("_", " ")}
                  </TableCell>
                  <TableCell sx={{ textTransform: "capitalize", fontSize: 12 }}>{d.priority}</TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    {d.device_brand} {d.device_type}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {format(new Date(d.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </CardContent>
      </Card>
    </Box>
  );
}

function PaymentsReport({ start, end }: { start: string; end: string }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase
      .from("payments")
      .select("payment_number,amount,payment_method,status,type,created_at")
      .gte("created_at", start)
      .lte("created_at", end + "T23:59:59")
      .order("created_at", { ascending: false })
      .then(({ data: rows }) => {
        setData(rows || []);
        setLoading(false);
      });
  }, [start, end]);

  const totalCollected = data.reduce((s, d) => s + (d.amount || 0), 0);
  const completedCount = data.filter(d => d.status === "completed" || d.status === "paid").length;
  const pendingAmount = data
    .filter(d => d.status === "pending")
    .reduce((s, d) => s + (d.amount || 0), 0);

  const methodDistribution = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of data) {
      const m = (d.payment_method || "Other").toUpperCase();
      map[m] = (map[m] || 0) + (d.amount || 0);
    }
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [data]);

  const exportCSV = () => {
    const csv =
      "Payment,Amount,Method,Status,Type,Date\n" +
      data
        .map(
          d =>
            `${d.payment_number},${d.amount},${d.payment_method},${d.status},${d.type},${d.created_at}`
        )
        .join("\n");
    downloadCSV(csv, `payments-report-${start}-to-${end}.csv`);
  };

  return (
    <Box sx={{ display: "grid", gap: 2.5, pt: 1 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard
          label="Total Collected"
          value={totalCollected}
          isCurrency
          accent="success"
          loading={loading}
        />
        <StatCard
          label="Cleared Transactions"
          value={completedCount}
          accent="primary"
          loading={loading}
        />
        <StatCard
          label="Pending Clearance"
          value={pendingAmount}
          isCurrency
          accent="warning"
          loading={loading}
        />
        <StatCard
          label="Payment Records"
          value={data.length}
          accent="info"
          loading={loading}
        />
      </Box>

      {methodDistribution.length > 0 && (
        <DistributionWidget
          title="Collections by payment method"
          subtitle="Value collected across transaction channels."
          items={methodDistribution}
          loading={loading}
          formatter={money}
        />
      )}

      <Card sx={{ borderRadius: "18px" }}>
        <Box sx={{ p: 2, pb: 1.5, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Payment Ledger Entries ({data.length})
          </Typography>
          <Button
            onClick={exportCSV}
            variant="outlined"
            size="small"
            startIcon={<Box component={Download} sx={{ height: 14, width: 14 }} />}
          >
            Export CSV
          </Button>
        </Box>
        <CardContent sx={{ p: 0 }}>
          <DataTable columnsCount={5} empty={data.length === 0} emptyMessage="No payments in selected window">
            <TableHead>
              <TableRow>
                <TableCell>Payment #</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Amount</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map(d => (
                <TableRow key={d.payment_number}>
                  <TableCell sx={{ fontWeight: 600, fontSize: 12 }}>{d.payment_number}</TableCell>
                  <TableCell sx={{ textAlign: "right", fontFamily: "monospace", fontWeight: 700, fontSize: 12.5 }}>
                    {money(d.amount || 0)}
                  </TableCell>
                  <TableCell sx={{ textTransform: "capitalize", fontSize: 12 }}>{d.payment_method}</TableCell>
                  <TableCell sx={{ textTransform: "capitalize", fontSize: 12 }}>{d.status}</TableCell>
                  <TableCell sx={{ fontSize: 12, color: "text.secondary" }}>
                    {format(new Date(d.created_at), "dd MMM yyyy")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </CardContent>
      </Card>
    </Box>
  );
}

function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${filename}`);
}
