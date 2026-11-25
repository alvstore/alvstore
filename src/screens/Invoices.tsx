"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Alert, Avatar, Box, Button, Card, Chip, Divider, IconButton, LinearProgress,
  MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography, useTheme,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import {
  AnimatedPage, DataTable, DistributionWidget, MetricStrip, PageHeader, ProgressRing,
  SearchToolbar, SideDrawer, TabBar, TabView, WidgetCard, toast,
} from "@/components/mui";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle, CheckCircle, Copy, Eye, FileText, Plus, Receipt, Send, TrendingUp, Users, XCircle,
} from "lucide-react";
import { completionPercent } from "@/lib/widget-data";
import { computePaymentUpdate, filterInvoices, summarizeInvoices } from "@/lib/invoice-metrics";
import { pastelPillColors, solidHeaderBg, solidTextTone } from "@/lib/pill-style";

interface Invoice {
  id: string;
  invoice_number: string;
  customer_id: string | null;
  subtotal: number;
  gst_amount: number;
  total: number;
  paid_amount: number;
  payment_status: string;
  status: string;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  discount_type: string | null;
  discount_value: number | null;
  gst_inclusive: boolean | null;
  public_token: string | null;
  signature_data: string | null;
  signature_name: string | null;
  quotation_id: string | null;
  customers?: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gst_number: string | null;
  } | null;
}

export default function Invoices() {
  const navigate = useNavigate();
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === "dark";
  const paperBg = muiTheme.palette.background.paper;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [paySheetOpen, setPaySheetOpen] = useState(false);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [savingPayment, setSavingPayment] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from("invoices")
      .select("*, customers(name, email, phone, address, gst_number)")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      toast.error(error.message);
    } else {
      setInvoices((data as unknown as Invoice[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void fetchInvoices();
  }, []);

  const stats = useMemo(() => summarizeInvoices(invoices), [invoices]);
  const visibleInvoices = useMemo(
    () => filterInvoices(invoices, statusFilter, search),
    [invoices, statusFilter, search]
  );

  const collectionRate = completionPercent(stats.paidRevenue, stats.totalBilled);
  const paymentStatusDistribution = useMemo(
    () =>
      Object.entries(
        invoices.reduce((acc, inv) => {
          const label = inv.payment_status
            ? inv.payment_status.charAt(0).toUpperCase() + inv.payment_status.slice(1)
            : "Unpaid";
          acc[label] = (acc[label] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value),
    [invoices]
  );

  const openPayment = (inv: Invoice) => {
    const due = Math.max(0, Number(inv.total ?? 0) - Number(inv.paid_amount ?? 0));
    setPayInvoice(inv);
    setPayAmount(due.toFixed(2));
    setPayMethod("cash");
    setPaySheetOpen(true);
  };

  const recordPayment = async () => {
    if (!payInvoice || savingPayment) return;
    const total = Number(payInvoice.total ?? 0);
    const currentPaid = Number(payInvoice.paid_amount ?? 0);
    const paymentValue = Number.parseFloat(payAmount);
    const computation = computePaymentUpdate(total, currentPaid, paymentValue);
    if (!computation.valid) {
      toast.error(computation.error || "Enter a valid amount");
      return;
    }
    setSavingPayment(true);
    try {
      const nextStatus =
        computation.invoiceStatus === "paid"
          ? "paid"
          : payInvoice.status === "draft"
          ? "sent"
          : payInvoice.status;
      const { error } = await supabase
        .from("invoices")
        .update({
          paid_amount: computation.nextPaid,
          payment_status: computation.paymentStatus,
          status: nextStatus,
        })
        .eq("id", payInvoice.id);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Payment recorded");
        setPaySheetOpen(false);
        await fetchInvoices();
      }
    } finally {
      setSavingPayment(false);
    }
  };

  const copyPublicLink = (token: string | null) => {
    if (!token) {
      toast.error("No public link available");
      return;
    }
    void navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${token}`);
    toast.success("Link copied");
  };

  const paidPill = pastelPillColors(muiTheme.palette.success.main, paperBg, isDark);
  const cancelledPill = pastelPillColors(muiTheme.palette.text.secondary, paperBg, isDark);
  const statusBadgeFor = (inv: Invoice) => {
    if (inv.status === "cancelled") {
      return { icon: <XCircle size={14} />, pill: cancelledPill, label: "Cancelled" };
    }
    if (Number(inv.total ?? 0) > 0 && (inv.payment_status === "paid" || inv.status === "paid")) {
      return { icon: <CheckCircle size={14} />, pill: paidPill, label: "Paid" };
    }
    if (inv.status === "sent") {
      return { icon: <Send size={14} />, pill: pastelPillColors(muiTheme.palette.info.main, paperBg, isDark), label: "Sent" };
    }
    return { icon: <FileText size={14} />, pill: pastelPillColors(muiTheme.palette.warning.main, paperBg, isDark), label: "Draft" };
  };

  const payRemaining = payInvoice
    ? Math.max(0, Math.round((Number(payInvoice.total ?? 0) - Number(payInvoice.paid_amount ?? 0)) * 100) / 100)
    : 0;

  return (
    <AnimatedPage>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 3, minWidth: 0 }}>
        <PageHeader
          title="Invoices"
          subtitle="Create and manage GST invoices, payments, and client balances"
          actions={
            <Button
              onClick={() => navigate("/invoices/new")}
              variant="contained"
              startIcon={<Plus size={16} />}
            >
              New Invoice
            </Button>
          }
        />

        {/* Materialize-inspired unified 4-stat KPI strip */}
        <MetricStrip
          loading={loading}
          items={[
            {
              id: "clients",
              label: "Clients",
              value: stats.uniqueClients,
              icon: <Users size={20} />,
              accent: "primary",
            },
            {
              id: "total",
              label: "Invoices",
              value: stats.totalCount,
              icon: <FileText size={20} />,
              accent: "info",
            },
            {
              id: "paid",
              label: "Paid Revenue",
              value: stats.paidRevenue,
              isCurrency: true,
              icon: <TrendingUp size={20} />,
              accent: "success",
            },
            {
              id: "unpaid",
              label: "Unpaid Balance",
              value: stats.unpaidBalance,
              isCurrency: true,
              icon: <AlertCircle size={20} />,
              accent: "warning",
            },
          ]}
        />

        {/* Insights Row */}
        {invoices.length > 0 && (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.8fr" }, gap: 2.5 }}>
            <WidgetCard title="Collection progress" subtitle="Paid revenue against total billing" eyebrow="FINANCIAL HEALTH" featured>
              <Box sx={{ py: 1 }}>
                <ProgressRing
                  value={collectionRate}
                  label="Invoice collection rate"
                  caption={`₹${stats.paidRevenue.toLocaleString("en-IN")} of ₹${stats.totalBilled.toLocaleString("en-IN")} collected`}
                  size={130}
                  color="success"
                />
                <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                  <Typography variant="caption" color="text.secondary">
                    Paid: <Box component="span" sx={{ fontWeight: 650, color: "success.main" }}>{stats.paidCount} invoices</Box>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Open: <Box component="span" sx={{ fontWeight: 650, color: "warning.main" }}>{stats.unpaidCount} invoices</Box>
                  </Typography>
                </Box>
              </Box>
            </WidgetCard>
            <DistributionWidget
              title="Invoice payment breakdown"
              subtitle="Payment clearance status across customer accounts."
              items={paymentStatusDistribution}
              loading={loading}
              formatter={(val) => `${val} invoices`}
            />
          </Box>
        )}

        {/* Unified Filter Toolbar + Materialize Table */}
        {loadError && (
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={() => void fetchInvoices()}>
                Retry
              </Button>
            }
          >
            {loadError}
          </Alert>
        )}

        <Card sx={{ borderRadius: "16px", overflow: "hidden" }}>
          <Box
            sx={{
              p: 2.25,
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 1.5,
              alignItems: { xs: "stretch", md: "center" },
              justifyContent: "space-between",
            }}
          >
            <TabView value={statusFilter} onChange={setStatusFilter}>
              <TabBar>
                <Tab value="all" label="All" />
                <Tab value="draft" label="Draft" />
                <Tab value="sent" label="Sent" />
                <Tab value="paid" label="Paid" />
                <Tab value="cancelled" label="Cancelled" />
              </TabBar>
            </TabView>
            <Box sx={{ display: "flex", gap: 1.25, alignItems: "center", flexWrap: "wrap" }}>
              <SearchToolbar
                onSearch={setSearch}
                value={search}
                placeholder="Search invoice # or client..."
                sx={{ width: { xs: "100%", sm: 260 } }}
              />
            </Box>
          </Box>

          <DataTable
            columnsCount={7}
            loading={loading}
            empty={visibleInvoices.length === 0}
            emptyMessage={
              <>
                <Box component={Receipt} sx={{ height: "2.5rem", width: "2.5rem", mx: "auto", mb: 1, opacity: 0.25 }} />
                <Typography variant="body2" color="text.secondary">No invoices found</Typography>
              </>
            }
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
                <TableCell>Status</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Total</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" } }}>Issued Date</TableCell>
                <TableCell>Balance</TableCell>
                <TableCell sx={{ textAlign: "right" }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleInvoices.map((inv) => {
                const badge = statusBadgeFor(inv);
                const clientName = inv.customers?.name || "—";
                const initials = clientName.slice(0, 2).toUpperCase();
                const avatarStyle = pastelPillColors(muiTheme.palette.primary.main, paperBg, isDark);
                const invTotal = Number(inv.total ?? 0);
                const remaining = Math.max(0, Math.round((invTotal - Number(inv.paid_amount ?? 0)) * 100) / 100);
                const isSettledPaid = invTotal > 0 && (inv.payment_status === "paid" || remaining <= 0.005);

                return (
                  <TableRow
                    key={inv.id}
                    onClick={() => navigate(`/invoices/${inv.id}`)}
                    sx={{ cursor: "pointer", transition: "background-color 160ms ease" }}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      <Button
                        variant="text"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/invoices/${inv.id}`);
                        }}
                        sx={{
                          minWidth: 0,
                          minHeight: 36,
                          px: 0.75,
                          ml: -0.75,
                          fontWeight: 700,
                          fontFamily: "monospace",
                          fontSize: "0.85rem",
                          color: solidTextTone(muiTheme.palette.primary.main, paperBg, isDark),
                          textTransform: "none",
                        }}
                      >
                        #{inv.invoice_number}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={badge.label}>
                        <Box
                          component="span"
                          role="img"
                          aria-label={badge.label}
                          sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            display: "inline-grid",
                            placeItems: "center",
                            ...badge.pill,
                          }}
                        >
                          {badge.icon}
                        </Box>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                        <Avatar sx={{ width: 34, height: 34, fontSize: 11.5, fontWeight: 700, ...avatarStyle }}>
                          {initials}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                            {clientName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: 11, display: { xs: "none", sm: "block" } }}>
                            {inv.customers?.email || inv.customers?.phone || "No contact info"}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ fontWeight: 650, fontSize: "0.875rem", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      ₹{invTotal.toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell sx={{ display: { xs: "none", md: "table-cell" }, fontSize: "0.85rem", color: "text.secondary", whiteSpace: "nowrap" }}>
                      {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell>
                      {inv.status === "cancelled" ? (
                        <Chip size="small" label="Cancelled" sx={{ fontSize: 11, fontWeight: 650, borderRadius: "6px", ...cancelledPill }} />
                      ) : isSettledPaid ? (
                        <Chip size="small" label="Paid" sx={{ fontSize: 11, fontWeight: 650, borderRadius: "6px", ...paidPill }} />
                      ) : invTotal <= 0 ? (
                        <Chip size="small" label="Draft" sx={{ fontSize: 11, fontWeight: 650, borderRadius: "6px", ...cancelledPill }} />
                      ) : (
                        <Box sx={{ display: "grid", gap: 0.5, minWidth: 80 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 650,
                              color: solidTextTone(muiTheme.palette.error.main, paperBg, isDark),
                              fontVariantNumeric: "tabular-nums",
                              fontSize: 12.5,
                            }}
                          >
                            ₹{remaining.toLocaleString("en-IN")}
                          </Typography>
                          {Number(inv.paid_amount ?? 0) > 0 && (
                            <LinearProgress
                              value={(Number(inv.paid_amount ?? 0) / (invTotal || 1)) * 100}
                              variant="determinate"
                              color="warning"
                              sx={{ height: 4, width: 72, borderRadius: 2 }}
                            />
                          )}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", justifyContent: "flex-end" }}>
                        {inv.status !== "cancelled" && !isSettledPaid && remaining > 0.005 && (
                          <Button onClick={() => openPayment(inv)} variant="outlined" size="small" sx={{ minHeight: 36, fontSize: "0.75rem", fontWeight: 600 }}>
                            Pay
                          </Button>
                        )}
                        <IconButton onClick={() => copyPublicLink(inv.public_token)} title="Copy link" aria-label="Copy link" size="small" sx={{ minWidth: 36, minHeight: 36 }}>
                          <Copy size={15} />
                        </IconButton>
                        <IconButton onClick={() => navigate(`/invoices/${inv.id}`)} title="View invoice" aria-label="View" size="small" sx={{ minWidth: 36, minHeight: 36 }}>
                          <Eye size={15} />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </DataTable>
        </Card>

        {/* Right Slide-Over Payment Drawer */}
        <SideDrawer
          open={paySheetOpen}
          busy={savingPayment}
          onClose={() => setPaySheetOpen(false)}
          title="Record Payment"
          description={payInvoice ? `#${payInvoice.invoice_number} · ${payInvoice.customers?.name || "Walk-in client"}` : undefined}
          width={420}
          footer={
            <>
              <Button
                variant="text"
                size="small"
                disabled={savingPayment || !payInvoice}
                onClick={() => {
                  if (!payInvoice) return;
                  setPaySheetOpen(false);
                  navigate(`/invoices/${payInvoice.id}`);
                }}
              >
                Open Invoice
              </Button>
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button variant="outlined" disabled={savingPayment} onClick={() => setPaySheetOpen(false)} sx={{ minHeight: 36 }}>
                  Cancel
                </Button>
                <Button variant="contained" disabled={savingPayment} onClick={() => void recordPayment()} sx={{ minHeight: 36 }}>
                  {savingPayment ? "Recording…" : "Record Payment"}
                </Button>
              </Box>
            </>
          }
        >
          {payInvoice && (
            <Box sx={{ display: "grid", gap: 2.5 }}>
              <Card
                sx={{
                  p: 2,
                  boxShadow: "none",
                  bgcolor: alpha(muiTheme.palette.primary.main, isDark ? 0.08 : 0.04),
                }}
              >
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1.5 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Total Billed</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      ₹{Number(payInvoice.total ?? 0).toLocaleString("en-IN")}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Paid</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: solidTextTone(muiTheme.palette.success.main, paperBg, isDark),
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ₹{Number(payInvoice.paid_amount ?? 0).toLocaleString("en-IN")}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">Due</Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        fontWeight: 700,
                        color: solidTextTone(muiTheme.palette.warning.main, paperBg, isDark),
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      ₹{payRemaining.toLocaleString("en-IN")}
                    </Typography>
                  </Box>
                </Box>
              </Card>

              <Divider />

              <Box sx={{ display: "grid", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Payment Amount
                  </Typography>
                  <Chip
                    size="small"
                    label={`Full balance ₹${payRemaining.toLocaleString("en-IN")}`}
                    onClick={() => setPayAmount(payRemaining.toFixed(2))}
                    sx={{ fontSize: 11, fontWeight: 600, cursor: "pointer", minHeight: 32 }}
                  />
                </Box>
                <TextField
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  label="Amount"
                  size="small"
                  fullWidth
                />
              </Box>

              <TextField
                value={payMethod}
                label="Payment Method"
                select
                size="small"
                fullWidth
                onChange={(e) => setPayMethod(e.target.value)}
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                {["cash", "card", "upi", "online"].map((m) => (
                  <MenuItem key={m} value={m} sx={{ textTransform: "capitalize" }}>
                    {m}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          )}
        </SideDrawer>
      </Box>
    </AnimatedPage>
  );
}
