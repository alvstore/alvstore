"use client";

import { Avatar, Box, Button, Card, IconButton, LinearProgress, MenuItem, Tab, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { AnimatedPage, DataTable, DistributionWidget, FormDialog, PageHeader, ProgressRing, SearchToolbar, StatCard, TabBar, TabView, WidgetCard, mergeSx, toast } from "@/components/mui";
import { useState, useEffect } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Search, Receipt, FileText, TrendingUp, AlertCircle, CheckCircle, Copy, Eye } from "lucide-react";
import { StatusBadge } from "@/components/documents/StatusBadge";
import { completionPercent } from "@/lib/widget-data";
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
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [loading, setLoading] = useState(true);
    // Payment sheet (kept for quick inline payments)
    const [paySheetOpen, setPaySheetOpen] = useState(false);
    const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("cash");
    const fetchInvoices = async () => {
        setLoading(true);
        let query = supabase.from("invoices").select("*, customers(name, email, phone, address, gst_number)").order("created_at", { ascending: false });
        if (statusFilter !== "all")
            query = query.eq("status", statusFilter);
        if (search)
            query = query.ilike("invoice_number", `%${search}%`);
        const { data, error } = await query;
        if (error)
            toast.error(error.message);
        else
            setInvoices((data as any) || []);
        setLoading(false);
    };
    useEffect(() => { fetchInvoices(); }, [search, statusFilter]);
    const totalInvoices = invoices.length;
    const paidCount = invoices.filter(i => i.payment_status === "paid").length;
    const unpaidCount = invoices.filter(i => i.payment_status === "unpaid").length;
    const totalRevenue = invoices.filter(i => i.payment_status === "paid").reduce((s, i) => s + (i.total || 0), 0);
    const totalBilled = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const collectionRate = completionPercent(totalRevenue, totalBilled);

    const paymentStatusDistribution = Object.entries(invoices.reduce((acc, i) => {
        const status = i.payment_status ? (i.payment_status.charAt(0).toUpperCase() + i.payment_status.slice(1)) : "Unpaid";
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {} as Record<string, number>)).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

    const openPayment = (inv: Invoice) => {
        setPayInvoice(inv);
        setPayAmount(String((inv.total - inv.paid_amount).toFixed(2)));
        setPayMethod("cash");
        setPaySheetOpen(true);
    };
    const recordPayment = async () => {
        if (!payInvoice)
            return;
        const amount = parseFloat(payAmount) || 0;
        if (amount <= 0) {
            toast.error("Enter a valid amount");
            return;
        }
        const newPaid = payInvoice.paid_amount + amount;
        const paymentStatus = newPaid >= payInvoice.total ? "paid" : "partial";
        const status = paymentStatus === "paid" ? "paid" : payInvoice.status;
        const { error } = await supabase.from("invoices").update({ paid_amount: newPaid, payment_status: paymentStatus, status }).eq("id", payInvoice.id);
        if (error)
            toast.error(error.message);
        else
            toast.success("Payment recorded");
        setPaySheetOpen(false);
        fetchInvoices();
    };
    const copyPublicLink = (token: string | null) => {
        if (!token) {
            toast.error("No public link available");
            return;
        }
        navigator.clipboard.writeText(`${window.location.origin}/invoice/public/${token}`);
        toast.success("Link copied");
    };
    return <AnimatedPage><Box sx={{ display: "grid", gap: 3 }}>
      <PageHeader title={"Invoices"} subtitle={"Create and manage GST invoices, payments, and client balances"} actions={<><Button onClick={() => navigate("/invoices/new")} variant="contained" startIcon={<Box component={Plus} sx={{ height: "1rem", width: "1rem" }} />}>New Invoice</Button></>}/>

      {/* KPIs */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 2 }}>
        <StatCard label="Total Invoices" value={totalInvoices} icon={<Box component={FileText} sx={{ height: 20, width: 20 }} />} accent="primary" loading={loading} />
        <StatCard label="Paid Invoices" value={paidCount} icon={<Box component={CheckCircle} sx={{ height: 20, width: 20 }} />} accent="success" loading={loading} />
        <StatCard label="Unpaid Invoices" value={unpaidCount} icon={<Box component={AlertCircle} sx={{ height: 20, width: 20 }} />} accent="warning" loading={loading} />
        <StatCard label="Collected Revenue" value={`₹${totalRevenue.toLocaleString("en-IN")}`} icon={<Box component={TrendingUp} sx={{ height: 20, width: 20 }} />} accent="info" loading={loading} />
      </Box>

      {/* Widgets: Collection Rate + Payment Breakdown */}
      {invoices.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "1fr 1.8fr" }, gap: 2.5 }}>
          <WidgetCard title="Collection progress" subtitle="Paid revenue against total billing" eyebrow="FINANCIAL HEALTH" featured>
            <Box sx={{ py: 1 }}>
              <ProgressRing value={collectionRate} label="Invoice collection rate" caption={`₹${totalRevenue.toLocaleString("en-IN")} of ₹${totalBilled.toLocaleString("en-IN")} collected`} size={130} color="success" />
              <Box sx={{ mt: 2, display: "flex", justifyContent: "space-between", alignItems: "center", pt: 1.5, borderTop: 1, borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary">Paid: <Box component="span" sx={{ fontWeight: 600, color: "success.main" }}>{paidCount} invoices</Box></Typography>
                <Typography variant="caption" color="text.secondary">Unpaid: <Box component="span" sx={{ fontWeight: 600, color: "warning.main" }}>{unpaidCount} invoices</Box></Typography>
              </Box>
            </Box>
          </WidgetCard>
          <DistributionWidget
            title="Invoice payment breakdown"
            subtitle="Payment clearance status across customer accounts."
            items={paymentStatusDistribution}
            loading={loading}
            formatter={val => `${val} invoices`}
          />
        </Box>
      )}

      {/* Filters */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, alignItems: "flex-start" }}>
        <TabView value={statusFilter} onChange={setStatusFilter}>
          <TabBar>
            <Tab value="all" label="All" />
            <Tab value="draft" label="Draft" />
            <Tab value="sent" label="Sent" />
            <Tab value="paid" label="Paid" />
            <Tab value="cancelled" label="Cancelled" />
          </TabBar>
        </TabView>
        <SearchToolbar onSearch={query => setSearch(query)} value={search} placeholder="Search invoices..." sx={{ maxWidth: "24rem", width: "100%" }}/>
      </Box>

      {/* Table */}
      <Card sx={theme => ({ borderRadius: "16px", border: `1px solid ${theme.palette.divider}`, overflow: "hidden" })}>
        <DataTable columnsCount={6} loading={loading} empty={invoices.length === 0} emptyMessage={<>
                <Box component={Receipt} sx={{ height: "2.5rem", width: "2.5rem", mx: "auto", mb: 1, opacity: 0.25 }}/>
                <Typography variant="body2" color="text.secondary">No invoices found</Typography>
              </>}>
          <TableHead>
            <TableRow sx={theme => ({ bgcolor: alpha(theme.palette.text.primary, 0.03) })}>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>#ID</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Client</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Total</TableCell>
              <TableCell sx={{ display: { xs: "none", md: "table-cell" }, fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Issued Date</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary" }}>Balance</TableCell>
              <TableCell sx={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", color: "text.secondary", textAlign: "right" }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>{invoices.map(inv => (<TableRow key={inv.id} onClick={() => navigate(`/invoices/${inv.id}`)} sx={theme => ({ cursor: "pointer", "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) }, transition: "background-color 160ms ease" })}>
                <TableCell sx={{ fontWeight: "700", fontFamily: "monospace", fontSize: "0.875rem", color: "primary.main" }}>{inv.invoice_number}</TableCell>
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Avatar sx={theme => ({ height: 32, width: 32, bgcolor: alpha(theme.palette.primary.main, 0.1), color: "primary.main", fontSize: 11, fontWeight: 700 })}>
                      {(inv.customers?.name || "?").slice(0, 2).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.customers?.name || "—"}</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: { xs: "none", sm: "block" } }}>{inv.customers?.email || ""}</Typography>
                    </Box>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: "650", fontSize: "0.875rem", fontVariantNumeric: "tabular-nums" }}>₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                <TableCell sx={{ display: { xs: "none", md: "table-cell" }, fontSize: "0.875rem", color: "text.secondary" }}>
                  {new Date(inv.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell>
                  {inv.payment_status === "paid" ? (<StatusBadge status="paid"/>) : (<Box sx={{ display: "grid", gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: "600", color: "error.main", fontVariantNumeric: "tabular-nums" }}>
                        ₹{((inv.total || 0) - (inv.paid_amount || 0)).toLocaleString("en-IN")}
                      </Typography>
                      {inv.paid_amount > 0 && (<LinearProgress value={(inv.paid_amount / (inv.total || 1)) * 100} variant="determinate" color="warning" sx={{ height: 4, width: 72, borderRadius: 2 }}/>)}
                    </Box>)}
                </TableCell>
                <TableCell onClick={e => e.stopPropagation()}>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", justifyContent: "flex-end" }}>
                    {inv.payment_status !== "paid" && (<Button onClick={() => openPayment(inv)} variant="outlined" size="small" sx={{ height: 28, fontSize: "0.75rem", fontWeight: 600 }}>Pay</Button>)}
                    <IconButton onClick={() => copyPublicLink(inv.public_token)} title="Copy link" aria-label="Copy link" size="small">
                      <Box component={Copy} sx={{ height: 15, width: 15 }}/>
                    </IconButton>
                    <IconButton onClick={() => navigate(`/invoices/${inv.id}`)} title="View" aria-label="View" size="small">
                      <Box component={Eye} sx={{ height: 15, width: 15 }}/>
                    </IconButton>
                  </Box>
                </TableCell>
              </TableRow>))}</TableBody>
        </DataTable>
      </Card>

      {/* Payment Sheet */}
      <FormDialog open={paySheetOpen} onClose={() => setPaySheetOpen(false)} title={"Record Payment"} description={<>
              {payInvoice?.invoice_number} — Balance: ₹{((payInvoice?.total || 0) - (payInvoice?.paid_amount || 0)).toFixed(2)}
            </>} paperSx={{ "@media (min-width: 640px)": { maxWidth: "28rem" } }}>

          <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "1rem" }, marginTop: "1.5rem" }}>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} label={"Amount"} size="small" fullWidth/>
            </Box>
            <Box sx={{ "& > :not([hidden]) ~ :not([hidden])": { marginTop: "0.375rem" } }}>

              <TextField value={payMethod} label={"Payment Method"} select size="small" fullWidth onChange={event => setPayMethod(event.target.value)} slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
                  {["cash", "card", "upi", "online"].map(m => <MenuItem key={m} value={m} sx={{ textTransform: "capitalize" }}>{m}</MenuItem>)}
                </TextField>
            </Box>
            <Button onClick={recordPayment} variant="contained" sx={{ width: "100%" }}>Record Payment</Button>
          </Box>
        </FormDialog>
    </Box></AnimatedPage>;
}
